const express = require('express');
const axios = require('axios');
const mqtt = require('mqtt');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');
const { sendFonnteMessage } = require('../fonnte');

const router = express.Router();
const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const MQTT_BROKER_URL = process.env.MQTT_BROKER_URL || 'ws://broker.hivemq.com:8000/mqtt';
const MQTT_TOPIC = process.env.MQTT_TOPIC || 'smartdoor_rfid_12345/command';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// Fungsi helper untuk membuka pintu via MQTT
const openDoor = async () => {
  return new Promise((resolve, reject) => {
    const client = mqtt.connect(MQTT_BROKER_URL);
    const timeoutId = setTimeout(() => {
      client.end();
      reject(new Error('Timeout koneksi MQTT'));
    }, 5000);

    client.on('connect', () => {
      clearTimeout(timeoutId);
      client.publish(MQTT_TOPIC, 'OPEN_DOOR', { qos: 1 }, (err) => {
        client.end();
        if (err) reject(err);
        else resolve(true);
      });
    });

    client.on('error', (err) => {
      clearTimeout(timeoutId);
      client.end();
      reject(err);
    });
  });
};

router.post('/webhook', async (req, res) => {
  try {
    const { message, callback_query } = req.body;

    // Handle Manual Open dari command /buka
    if (message && message.text === '/buka') {
      const chatId = message.chat.id;
      
      // Verifikasi apakah yang mengirim adalah admin yang sah (berdasarkan TELEGRAM_CHAT_ID)
      if (chatId.toString() !== process.env.TELEGRAM_CHAT_ID) {
        return res.status(200).send('OK');
      }

      await openDoor();
      
      await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        chat_id: chatId,
        text: '✅ Pintu berhasil dibuka secara manual dari Telegram.'
      });

      return res.status(200).send('OK');
    }

    // Handle Callback Query dari tombol Inline (Approve/Reject)
    if (callback_query) {
      const data = callback_query.data;
      const messageId = callback_query.message.message_id;
      const chatId = callback_query.message.chat.id;

      let responseText = '';

      if (data.startsWith('approve_')) {
        const waNumber = data.split('_')[1];
        
        // Buka pintu
        await openDoor();

        // Log ke database
        await prisma.accessLog.create({
          data: {
            status: 'SUCCESS',
            cardUid: `WA_APP_${waNumber}`,
          }
        });

        // Balas WA
        await sendFonnteMessage(waNumber, '✅ Permintaan disetujui Admin. Pintu Utama telah dibuka!');
        responseText = `✅ *Akses Disetujui* untuk WA: ${waNumber}`;
      } else if (data.startsWith('reject_')) {
        const waNumber = data.split('_')[1];
        // Balas WA
        await sendFonnteMessage(waNumber, '❌ Permintaan akses ditolak oleh Admin.');
        responseText = `❌ *Akses Ditolak* untuk WA: ${waNumber}`;
      }

      if (responseText) {
        // Edit pesan original agar tombol hilang
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageText`, {
          chat_id: chatId,
          message_id: messageId,
          text: responseText,
          parse_mode: 'Markdown'
        });
      }

      // Answer callback query to remove loading state
      await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
        callback_query_id: callback_query.id
      });
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('Error in Telegram webhook:', error);
    res.status(500).send('Error');
  }
});

module.exports = router;
