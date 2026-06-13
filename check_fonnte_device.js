const axios = require('axios');
const token = process.env.FONNTE_TOKEN || '4fJrYvEpjMHjR6H4JuX8';

axios.post('https://api.fonnte.com/device', {}, {
  headers: {
    'Authorization': token
  }
}).then(res => {
  console.log('Fonnte Device Info:');
  console.log(JSON.stringify(res.data, null, 2));
}).catch(err => {
  console.error('Error:', err.message);
});
