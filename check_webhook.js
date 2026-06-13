const axios = require('axios');
require('dotenv').config();
const url = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getWebhookInfo`;
axios.get(url).then(res => console.log(res.data)).catch(err => console.error(err));
