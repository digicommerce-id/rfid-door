const fetch = require('node-fetch') || global.fetch;
require('dotenv').config();

/**
 * Mengirim pesan via Fonnte API
 * @param {string} target - Nomor WA tujuan (misal: 62812...)
 * @param {string} text - Pesan teks
 */
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
    console.log(`✅ Fonnte Send API Result for ${target}:`, result.status);
  } catch (error) {
    console.error('❌ Error sending message via Fonnte API:', error.message);
  }
};

module.exports = { sendFonnteMessage };
