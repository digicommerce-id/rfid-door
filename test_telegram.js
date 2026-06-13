const { sendApprovalRequest } = require('./src/telegram');
require('dotenv').config();

async function test() {
  console.log('Sending approval request to telegram...');
  await sendApprovalRequest('087777638865', 'Ahmad Fauzi');
  console.log('Done.');
}
test();
