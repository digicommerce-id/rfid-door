const axios = require('axios');
require('dotenv').config();

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEBHOOK_URL = 'https://rfid-door-one.vercel.app/api/telegram/webhook';

async function setWebhook() {
  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook?url=${WEBHOOK_URL}`;
    const response = await axios.get(url);
    console.log('Webhook set result:', response.data);
  } catch (error) {
    console.error('Error setting webhook:', error.message);
  }
}

setWebhook();
