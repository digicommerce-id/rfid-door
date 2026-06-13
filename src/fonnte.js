const axios = require('axios');
require('dotenv').config();

/**
 * Mengirim pesan via Fonnte API
 * @param {string} target - Nomor WA tujuan (misal: 62812...)
 * @param {string} text - Pesan teks
 */
const sendFonnteMessage = async (target, text) => {
  try {
    const token = process.env.FONNTE_TOKEN || '4fJrYvEpjMHjR6H4JuX8';
    const response = await axios.post('https://api.fonnte.com/send', {
      target: target,
      message: text
    }, {
      headers: {
        'Authorization': token,
        'Content-Type': 'application/json'
      }
    });
    console.log(`✅ Fonnte Send API Result for ${target}:`, response.data.status);
  } catch (error) {
    console.error('❌ Error sending message via Fonnte API:', error.message);
  }
};

module.exports = { sendFonnteMessage };
