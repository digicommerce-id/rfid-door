const app = require('./src/server');
const http = require('http');

const server = http.createServer(app);
server.listen(3001, async () => {
  console.log('Server started for testing on port 3001');

  try {
    const axios = require('axios');
    console.log('Testing WA Webhook for non-admin...');
    const response = await axios.post('http://localhost:3001/api/whatsapp/webhook', {
      sender: '08123456789', // fake number, should be "Akses Ditolak"
      message: 'BUKA'
    });
    console.log('WA Webhook response:', response.status, response.data);

    console.log('Testing Telegram /buka...');
    const tgResponse = await axios.post('http://localhost:3001/api/telegram/webhook', {
      message: {
        text: '/buka',
        chat: { id: process.env.TELEGRAM_CHAT_ID || '123' }
      }
    });
    console.log('Telegram Webhook response:', tgResponse.status, tgResponse.data);

  } catch (e) {
    console.error('Test Error:', e.message, e.response?.data);
  } finally {
    server.close();
    process.exit(0);
  }
});
