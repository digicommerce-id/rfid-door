const express = require('express');
const mqtt = require('mqtt');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');
const { sendTelegramMessage, sendApprovalRequest } = require('../telegram');
const { sendFonnteMessage } = require('../fonnte');

const router = express.Router();
const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Konfigurasi MQTT Broker
// Kita gunakan WebSocket (ws://) di port 8000 karena Vercel sering memblokir port TCP standar 1883
const MQTT_BROKER_URL = process.env.MQTT_BROKER_URL || 'ws://broker.hivemq.com:8000/mqtt';
const MQTT_TOPIC = process.env.MQTT_TOPIC || 'smartdoor_rfid_12345/command'; // Gunakan topik default yang agak random agar tidak bentrok

// Helper to format date
const formatDate = (date) => {
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta'
  }).format(date);
};


// Webhook untuk Fonnte
router.post('/webhook', async (req, res) => {
  // Fonnte mengirim data POST JSON atau Form-UrlEncoded
  // Struktur yang dikirim fonnte biasanya: { device, sender, message, ... }
  const { sender, message } = req.body;

  if (!sender || !message) {
    return res.status(400).json({ error: 'Invalid webhook payload' });
  }

  // Fonnte mengirim nomor dengan format awalan "62" (contoh: 62877...). 
  // Sementara di database mungkin tersimpan dengan awalan "0" (0877...).
  // Kita buat dua versi nomor untuk dicari di database:
  let senderWith0 = sender;
  let senderWith62 = sender;
  
  if (sender.startsWith('62')) {
    senderWith0 = '0' + sender.slice(2);
  } else if (sender.startsWith('0')) {
    senderWith62 = '62' + sender.slice(1);
  }

  try {
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { whatsappNumber: sender },
          { whatsappNumber: senderWith0 },
          { whatsappNumber: senderWith62 }
        ]
      }
    });

    const now = new Date();
    const formattedDate = formatDate(now);

    if (!user) {
      // Jika nomor tidak terdaftar
      console.log(`Pesan dari nomor tak terdaftar (${sender}): ${message}`);
      await sendFonnteMessage(sender, '❌ Akses Ditolak: Nomor WhatsApp Anda tidak terdaftar dalam sistem.');
      return res.status(200).send('OK');
    }

    const command = message.trim().toUpperCase();

    if (command === 'BUKA') {
      // Jika yang minta BUKA bukan Admin, alihkan ke Approval Telegram
      if (user.role !== 'Admin') {
        console.log(`User ${user.name} (${user.role}) meminta buka pintu. Mengirim request ke Telegram...`);
        await sendApprovalRequest(sender, user.name);
        await sendFonnteMessage(sender, '⏳ Permintaan buka pintu Anda telah diteruskan ke Admin. Harap tunggu persetujuan...');
        return res.status(200).send('OK');
      }

      // Jika Admin, langsung buka pintu via MQTT
      const client = mqtt.connect(MQTT_BROKER_URL);
      
      const timeoutId = setTimeout(async () => {
        console.error('Timeout koneksi MQTT');
        client.end();
        if (!res.headersSent) {
          await sendFonnteMessage(sender, '⚠️ Maaf, server pintu tidak merespon (Timeout).');
          res.status(504).send('Timeout');
        }
      }, 5000);

      client.on('connect', async () => {
        clearTimeout(timeoutId);
        console.log('Terkoneksi ke MQTT Broker, Mengirim perintah BUKA...');
        
        client.publish(MQTT_TOPIC, 'OPEN_DOOR', { qos: 1 }, async (err) => {
          if (err) {
            console.error('Gagal mengirim perintah ke MQTT', err);
            client.end();
            if (!res.headersSent) {
              await sendFonnteMessage(sender, '⚠️ Maaf, terjadi kesalahan sistem saat menghubungi pintu.');
              return res.status(500).send('MQTT Error');
            }
          }
          
          console.log('Perintah BUKA berhasil dikirim ke MQTT.');
          client.end();
          
          try {
            await prisma.accessLog.create({
              data: {
                status: 'SUCCESS',
                cardUid: `WA_${sender}`,
              }
            });

            const successMessage = `✅ AKSES DIBERIKAN: Pintu Utama dibuka via WhatsApp secara langsung oleh Admin ${user.name} pada ${formattedDate} WIB.`;
            await sendTelegramMessage(successMessage);

            if (!res.headersSent) {
              await sendFonnteMessage(sender, `✅ Halo Admin ${user.name}, pintu sedang dibuka!`);
              return res.status(200).send('OK');
            }
          } catch (dbError) {
            console.error('Database Error:', dbError);
            if (!res.headersSent) {
              await sendFonnteMessage(sender, '✅ Pintu terbuka, tetapi gagal mencatat log di database.');
              return res.status(500).send('DB Error');
            }
          }
        });
      });

      client.on('error', async (err) => {
        clearTimeout(timeoutId);
        console.error('Error koneksi MQTT', err);
        client.end();
        if (!res.headersSent) {
          await sendFonnteMessage(sender, '⚠️ Maaf, gagal terhubung ke server pintu. Coba lagi nanti.');
          return res.status(500).send('MQTT Connect Error');
        }
      });

    } else {
      await sendFonnteMessage(sender, 'Format salah. Ketik kata "BUKA" untuk membuka pintu.');
      return res.status(200).send('OK');
    }

  } catch (error) {
    console.error('Error handling webhook:', error);
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }
});

module.exports = router;
