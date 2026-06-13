const axios = require('axios');

const API_URL = 'http://localhost:3000/api/rfid/verify';

async function testCard(scenarioName, uid) {
  console.log(`\n--- Menguji Skenario: ${scenarioName} ---`);
  console.log(`Mengirim UID: ${uid} ke ${API_URL}`);
  
  try {
    const response = await axios.post(API_URL, { uid });
    console.log(`Status HTTP : ${response.status}`);
    console.log(`Response    :`, response.data);
  } catch (error) {
    if (error.response) {
      console.log(`Status HTTP : ${error.response.status}`);
      console.log(`Response    :`, error.response.data);
    } else {
      console.error(`Gagal melakukan request:`, error.message);
    }
  }
}

async function runTests() {
  console.log('Memulai Simulasi Perangkat ESP32...');
  
  // 1. Skenario Kartu Aktif
  await testCard('Skenario A - Akses Diterima (Kartu Aktif)', 'D3FA82C1');

  // Jeda 2 detik
  await new Promise(resolve => setTimeout(resolve, 2000));

  // 2. Skenario Kartu Asing
  await testCard('Skenario B - Akses Ditolak (Kartu Tidak Dikenal)', '99B1A2C3');

  // Jeda 2 detik
  await new Promise(resolve => setTimeout(resolve, 2000));

  // 3. Skenario Kartu Non-Aktif
  await testCard('Skenario C - Akses Ditolak (Kartu Non-Aktif)', 'A1B2C3D4');
}

runTests();
