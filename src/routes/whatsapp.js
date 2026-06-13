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
      return res.status(200).json({ reply: '❌ Akses Ditolak: Nomor WhatsApp Anda tidak terdaftar dalam sistem.' });
    }

    const command = message.trim().toUpperCase();

    if (command === 'BUKA') {
      // Perintah BUKA dikenali
      
      // Kirim pesan ke MQTT Broker
      const client = mqtt.connect(MQTT_BROKER_URL);
      
      // Menambah timeout jika mqtt broker tidak merespon
      const timeoutId = setTimeout(() => {
        console.error('Timeout koneksi MQTT');
        client.end();
        if (!res.headersSent) {
          res.status(504).json({ reply: '⚠️ Maaf, server pintu tidak merespon (Timeout).' });
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
              return res.status(500).json({ reply: '⚠️ Maaf, terjadi kesalahan sistem saat menghubungi pintu.' });
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
              return res.status(200).json({
                reply: `✅ Halo ${user.name}, akses diberikan! Pintu sedang dibuka...`
              });
            }
          } catch (dbError) {
            console.error('Database Error:', dbError);
            if (!res.headersSent) {
              return res.status(500).json({ reply: '✅ Pintu terbuka, tetapi gagal mencatat log di database.' });
            }
          }
        });
      });

      client.on('error', (err) => {
        clearTimeout(timeoutId);
        console.error('Error koneksi MQTT', err);
        client.end();
        if (!res.headersSent) {
          return res.status(500).json({ reply: '⚠️ Maaf, gagal terhubung ke server pintu. Coba lagi nanti.' });
        }
      });

    } else {
      // Jika pesannya bukan BUKA
      return res.status(200).json({ reply: 'Format salah. Ketik kata "BUKA" untuk membuka pintu.' });
    }

  } catch (error) {
    console.error('Error handling webhook:', error);
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }
});

module.exports = router;
