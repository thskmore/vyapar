// test-duty-sendback.js
// Verification for Manager cannot edit duty during review, sends back to worker for corrections

const http = require('http');
const assert = require('assert');

function request(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        let parsed;
        try {
          parsed = JSON.parse(body);
        } catch (e) {
          parsed = null;
        }
        resolve({ status: res.statusCode, headers: res.headers, data: parsed, raw: body });
      });
    });
    req.on('error', reject);
    if (data) {
      req.write(typeof data === 'string' ? data : JSON.stringify(data));
    }
    req.end();
  });
}

async function runTests() {
  console.log('--- STARTING DUTY SEND-BACK FEATURE VERIFICATION TESTS ---');

  const runId = Math.floor(Math.random() * 899999 + 100000);
  const ownerMobile = '98' + runId + '01';

  // 1. Signup owner
  const signup = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/signup',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-app': '1' }
  }, {
    name: 'Sendback Test Owner',
    mobile: ownerMobile,
    password: 'password123',
    pump_name: 'Sendback Station ' + runId,
    pump_code: 'SB-' + runId
  });
  assert.strictEqual(signup.status, 200);
  const ownerHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${signup.data.token}`, 'x-app': '1' };

  // 2. Setup state with nozzles and rates
  const stateRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/state',
    method: 'GET',
    headers: ownerHeaders
  });
  await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/state',
    method: 'PUT',
    headers: ownerHeaders
  }, {
    vers: stateRes.data.vers,
    changes: {
      setup: {
        nozzles: [
          { id: '101', name: 'Nozzle 1 MS', fuel: 'MS', open: 10000, active: true }
        ],
        rates: [
          { id: 1, fuel: 'MS', rate: 100.0, from: '2020-01-01' }
        ],
        fuelprods: [{ name: 'MS', unit: 'L' }],
        expcats: ['Tea', 'Repairs'],
        paymodes: [{ key: 'cash', name: 'Cash', active: true }]
      }
    }
  });

  // 3. Create worker
  const wRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/users',
    method: 'POST',
    headers: ownerHeaders
  }, {
    name: 'Dilip Kumar',
    mobile: '98' + runId + '11',
    role: 'worker',
    password: 'password123'
  });
  assert.strictEqual(wRes.status, 200);
  const workerId = wRes.data.id;

  // Worker login
  const wLogin = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-app': '1' }
  }, {
    mobile: '98' + runId + '11',
    password: 'password123'
  });
  const workerHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${wLogin.data.token}`, 'x-app': '1' };

  // 4. Assign duty to worker
  const assign = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/duties/assign',
    method: 'POST',
    headers: ownerHeaders
  }, {
    worker_id: workerId,
    shift: 'Morning',
    nozzle_ids: ['101']
  });
  assert.strictEqual(assign.status, 200);
  const dutyId = assign.data.id;

  // 5. Worker enters figures with a mistake and submits duty
  // Mistake: worker enters closing 10050 (50L = 5000) but only collected 4000
  const submit1 = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/duty/${dutyId}/submit`,
    method: 'POST',
    headers: workerHeaders
  }, {
    lines: [{ nozzle_id: '101', opening: 10000, closing: 10050, testing: 0, rate: 100.0 }],
    items: [],
    expenses: [],
    pay: { cash: 4000 }
  });
  assert.strictEqual(submit1.status, 200);
  console.log('✓ Worker submitted initial duty #', dutyId);

  // 6. Manager reviews duty: Sees figures, notices shortage of ₹1,000, sends back to worker!
  const sendBack = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/duties/${dutyId}/send-back`,
    method: 'POST',
    headers: ownerHeaders
  }, {
    reason: 'Closing reading is correct but cash short by ₹1000. Please recount cash.'
  });
  assert.strictEqual(sendBack.status, 200);
  assert.strictEqual(sendBack.data.worker_name, 'Dilip Kumar');
  console.log('✓ Manager sent duty back to worker: status reverted to open');

  // 7. Verify worker can access this duty again in /api/duty/current
  const workerCurrent = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/duty/current',
    method: 'GET',
    headers: workerHeaders
  });
  assert.strictEqual(workerCurrent.status, 200);
  assert.ok(workerCurrent.data.duty, 'Duty is present in worker current');
  assert.strictEqual(workerCurrent.data.duty.id, dutyId);
  assert.strictEqual(workerCurrent.data.duty.status, 'open');
  console.log('✓ Worker sees duty back in active open state to make corrections');

  // 8. Worker corrects cash collection to 5000 and resubmits!
  const submit2 = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/duty/${dutyId}/submit`,
    method: 'POST',
    headers: workerHeaders
  }, {
    lines: [{ nozzle_id: '101', opening: 10000, closing: 10050, testing: 0, rate: 100.0 }],
    items: [],
    expenses: [],
    pay: { cash: 5000 }
  });
  assert.strictEqual(submit2.status, 200);
  console.log('✓ Worker corrected figures and resubmitted duty');

  // 9. Manager reviews again and closes duty
  const closeRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/duties/${dutyId}/close`,
    method: 'POST',
    headers: ownerHeaders
  });
  assert.strictEqual(closeRes.status, 200);
  console.log('✓ Manager closed duty #', dutyId);

  // 10. Attempting to send back an already closed duty is rejected
  const invalidSendBack = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/duties/${dutyId}/send-back`,
    method: 'POST',
    headers: ownerHeaders
  });
  assert.strictEqual(invalidSendBack.status, 404);
  console.log('✓ Cannot send back an already closed duty');

  console.log('--- ALL DUTY SEND-BACK TESTS PASSED! ---');
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
