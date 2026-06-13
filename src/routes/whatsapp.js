const express = require('express');
const mqtt = require('mqtt');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');
const { sendTelegramMessage } = require('../telegram');

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

// Helper to send message via Fonnte API
const sendFonnteMessage = async (target, text) => {
  try {
    const token = process.env.FONNTE_TOKEN || '4fJrYvEpjMHjR6H4JuX8';
    const response = await fetch('https://api.fonnte.com/send', {
      method: 'POST',
      headers: {
        'Authorization': token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        target: target,
        message: text
      })
    });
    const result = await response.json();
    console.log('Fonnte Send API Result:', result);
  } catch (error) {
    console.error('Error sending message via Fonnte API:', error);
  }
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
      // Perintah BUKA dikenali
      
      // Kirim pesan ke MQTT Broker
      const client = mqtt.connect(MQTT_BROKER_URL);
      
      // Menambah timeout jika mqtt broker tidak merespon
      const timeoutId = setTimeout(async () => {
        console.error('Timeout koneksi MQTT');
        client.end();
        if (!res.headersSent) {
          await sendFonnteMessage(sender, '⚠️ Maaf, server pintu tidak merespon (Timeout).');
          res.status(504).send('Timeout');
        }
      }, 5000);

      client.on('connect', async () => {
        clearTimeout(timeoutId); // Hapus timeout karena sudah terkoneksi
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
          client.end(); // Tutup koneksi
          
          try {
            // Log ke database
            await prisma.accessLog.create({
              data: {
                status: 'SUCCESS',
                cardUid: `WA_${sender}`,
              }
            });

            // Notifikasi Telegram
            const successMessage = `✅ AKSES DIBERIKAN: Pintu Utama dibuka via WhatsApp oleh ${user.name} [${user.role}] pada ${formattedDate} WIB.`;
            await sendTelegramMessage(successMessage);

            if (!res.headersSent) {
              await sendFonnteMessage(sender, `✅ Halo ${user.name}, akses diberikan! Pintu sedang dibuka...`);
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
      // Jika pesannya bukan BUKA
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
