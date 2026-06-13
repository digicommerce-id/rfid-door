const axios = require('axios');
require('dotenv').config();

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

/**
 * Mengirim pesan ke Telegram
 * @param {string} message - Pesan yang akan dikirim
 */
const sendTelegramMessage = async (message) => {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.warn('⚠️ Telegram Token atau Chat ID belum diset di .env. Melewati pengiriman notifikasi.');
    return;
  }

  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    await axios.post(url, {
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
    });
    console.log(`✅ Pesan Telegram berhasil dikirim`);
  } catch (error) {
    console.error('❌ Gagal mengirim pesan Telegram:', error.response?.data || error.message);
  }
};

const sendApprovalRequest = async (waNumber, userName) => {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;

  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    await axios.post(url, {
      chat_id: TELEGRAM_CHAT_ID,
      text: `🔔 *Permintaan Akses Pintu*\n\nUser: *${userName}*\nWA: ${waNumber}\n\nApakah Anda menyetujui permintaan buka pintu ini?`,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '✅ Setujui', callback_data: `approve_${waNumber}` },
            { text: '❌ Tolak', callback_data: `reject_${waNumber}` }
          ]
        ]
      }
    });
    console.log(`✅ Laporan approval Telegram berhasil dikirim`);
  } catch (error) {
    console.error('❌ Gagal mengirim approval Telegram:', error.response?.data || error.message);
  }
};

module.exports = {
  sendTelegramMessage,
  sendApprovalRequest,
};
