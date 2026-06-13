const axios = require('axios');
const token = '4fJrYvEpjMHjR6H4JuX8';

axios.post('https://api.fonnte.com/send', {
  target: '087777638865',
  message: 'Test dari Server'
}, {
  headers: {
    'Authorization': token,
    'Content-Type': 'application/json'
  }
}).then(res => console.log('Response:', res.data))
  .catch(err => console.error('Error:', err.message));
