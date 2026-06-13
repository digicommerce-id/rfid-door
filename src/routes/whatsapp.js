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
const MQTT_BROKER_URL = process.env.MQTT_BROKER_URL || 'mqtt://broker.hivemq.com';
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

  // Normalisasi nomor HP (misal: Fonnte mengirim dengan format "628xxx" atau "08xxx")
  // Untuk amannya, kita cek menggunakan "ends with" atau pastikan format konsisten.
  // Tapi asumsikan nomor tersimpan di database persis seperti format fonnte.
  
  // Format nomor Fonnte: 6281234567890. Format di DB mungkin 081234567890 atau 628...
  // Mari kita cari data user yang memiliki whatsappNumber ini.
  
  try {
    const user = await prisma.user.findFirst({
      where: {
        whatsappNumber: {
          equals: sender,
        }
      }
    });

    const now = new Date();
    const formattedDate = formatDate(now);

    if (!user) {
      // Jika nomor tidak terdaftar
      console.log(`Pesan dari nomor tak terdaftar (${sender}): ${message}`);
      // Opsional: Balas pesan jika nomor tidak terdaftar (membutuhkan API Fonnte Send Message)
      return res.status(200).json({ status: 'ignored', reason: 'Unregistered number' });
    }

    const command = message.trim().toUpperCase();

    if (command === 'BUKA') {
      // Perintah BUKA dikenali
      
      // Kirim pesan ke MQTT Broker
      const client = mqtt.connect(MQTT_BROKER_URL);
      
      client.on('connect', async () => {
        console.log('Terkoneksi ke MQTT Broker, Mengirim perintah BUKA...');
        
        client.publish(MQTT_TOPIC, 'OPEN_DOOR', { qos: 1 }, async (err) => {
          if (err) {
            console.error('Gagal mengirim perintah ke MQTT', err);
            client.end();
            return res.status(500).json({ error: 'Gagal mengirim sinyal MQTT' });
          }
          
          console.log('Perintah BUKA berhasil dikirim ke MQTT.');
          client.end(); // Tutup koneksi karena serverless function (hanya hidup sebentar)
          
          // Log ke database
          await prisma.accessLog.create({
            data: {
              status: 'SUCCESS',
              // Kita anggap credentialId untuk WA
              credentialId: `WHATSAPP_${sender}`,
            }
          });

          // Notifikasi Telegram
          const successMessage = `✅ AKSES DIBERIKAN: Pintu Utama dibuka via WhatsApp oleh ${user.name} [${user.role}] pada ${formattedDate} WIB.`;
          await sendTelegramMessage(successMessage);

          return res.status(200).json({
            status: 'success',
            message: 'Perintah BUKA sedang diproses.'
          });
        });
      });

      client.on('error', (err) => {
        console.error('Error koneksi MQTT', err);
        client.end();
        return res.status(500).json({ error: 'MQTT Connection Error' });
      });

      // Menambah timeout jika mqtt broker tidak merespon
      setTimeout(() => {
        if (client.connected) return;
        console.error('Timeout koneksi MQTT');
        client.end();
        if (!res.headersSent) {
          res.status(504).json({ error: 'MQTT Broker Timeout' });
        }
      }, 5000);

    } else {
      // Jika pesannya bukan BUKA
      return res.status(200).json({ status: 'ignored', reason: 'Invalid command' });
    }

  } catch (error) {
    console.error('Error handling webhook:', error);
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }
});

module.exports = router;
