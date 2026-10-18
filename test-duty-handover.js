// test-duty-handover.js
// Verification test for Duty Handover feature in worker's view

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
  console.log('--- STARTING DUTY HANDOVER FEATURE VERIFICATION TESTS ---');

  const runId = Math.floor(Math.random() * 899999 + 100000);
  const ownerMobile = '98' + runId + '01';

  // 1. Owner signup
  const signup = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/signup',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-app': '1' }
  }, {
    name: 'Handover Test Pump Owner',
    mobile: ownerMobile,
    password: 'password123',
    pump_name: 'Handover Station ' + runId,
    pump_code: 'HO-' + runId
  });
  assert.strictEqual(signup.status, 200, 'Owner signup successful');
  const ownerToken = signup.data.token;
  const ownerHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}`, 'x-app': '1' };

  // 2. Setup Nozzles & Rates
  const stateRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/state',
    method: 'GET',
    headers: ownerHeaders
  });
  assert.strictEqual(stateRes.status, 200);

  const putState = await request({
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
          { id: '101', name: 'Nozzle 1 MS', fuel: 'MS', open: 10000, active: true },
          { id: '102', name: 'Nozzle 2 HSD', fuel: 'HSD', open: 20000, active: true }
        ],
        rates: [
          { id: 1, fuel: 'MS', rate: 104.5, from: '2020-01-01' },
          { id: 2, fuel: 'HSD', rate: 92.0, from: '2020-01-01' }
        ],
        fuelprods: [{ name: 'MS', unit: 'L' }, { name: 'HSD', unit: 'L' }],
        expcats: ['Tea and food', 'Repairs', 'Electricity', 'Transport', 'Other'],
        paymodes: [{ key: 'cash', name: 'Cash', active: true }, { key: 'upi', name: 'UPI', active: true }]
      }
    }
  });
  assert.strictEqual(putState.status, 200, 'State updated with nozzles and rates');

  // 3. Create two workers: Ramesh & Suresh
  const w1Res = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/users',
    method: 'POST',
    headers: ownerHeaders
  }, {
    name: 'Ramesh Patel',
    mobile: '98' + runId + '11',
    role: 'worker',
    password: 'password123'
  });
  assert.strictEqual(w1Res.status, 200, 'Worker 1 created');
  const w1Id = w1Res.data.id;

  const w2Res = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/users',
    method: 'POST',
    headers: ownerHeaders
  }, {
    name: 'Suresh Kumar',
    mobile: '98' + runId + '22',
    role: 'worker',
    password: 'password123'
  });
  assert.strictEqual(w2Res.status, 200, 'Worker 2 created');
  const w2Id = w2Res.data.id;

  // Log in as Worker 1 (Ramesh)
  const loginW1 = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-app': '1' }
  }, {
    mobile: '98' + runId + '11',
    password: 'password123'
  });
  assert.strictEqual(loginW1.status, 200, 'Worker 1 login successful');
  const w1Token = loginW1.data.token;
  const w1Headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${w1Token}`, 'x-app': '1' };

  // Log in as Worker 2 (Suresh)
  const loginW2 = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-app': '1' }
  }, {
    mobile: '98' + runId + '22',
    password: 'password123'
  });
  assert.strictEqual(loginW2.status, 200, 'Worker 2 login successful');
  const w2Token = loginW2.data.token;
  const w2Headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${w2Token}`, 'x-app': '1' };

  // 4. Check initial handover-info before any duty
  const hoInit = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/duty/handover-info',
    method: 'GET',
    headers: w1Headers
  });
  assert.strictEqual(hoInit.status, 200);
  assert.strictEqual(hoInit.data.recent_duty, null, 'No recent duty initially');
  assert.strictEqual(hoInit.data.active_duty, null, 'No active duty initially');
  assert.ok(hoInit.data.workers.some(w => w.name === 'Ramesh Patel' && w.is_me), 'Caller is marked is_me');
  assert.ok(hoInit.data.workers.some(w => w.name === 'Suresh Kumar'), 'Other worker listed');

  // 5. Manager assigns Morning duty to Ramesh with Nozzle 101 and 102
  const assignRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/duties/assign',
    method: 'POST',
    headers: ownerHeaders
  }, {
    worker_id: w1Id,
    shift: 'Morning',
    nozzle_ids: ['101', '102']
  });
  assert.strictEqual(assignRes.status, 200, 'Morning duty assigned to Ramesh');
  const duty1Id = assignRes.data.id;

  // 6. Check handover-info while Ramesh has an active open duty
  const hoActive = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/duty/handover-info',
    method: 'GET',
    headers: w1Headers
  });
  assert.strictEqual(hoActive.status, 200);
  assert.ok(hoActive.data.active_duty, 'Active duty detected');
  assert.strictEqual(hoActive.data.active_duty.id, duty1Id);

  // If Ramesh tries to handover while active, it must be rejected!
  const earlyHo = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/duty/handover',
    method: 'POST',
    headers: w1Headers
  }, {
    target_worker_id: w2Id,
    shift: 'Evening',
    nozzle_ids: ['101', '102']
  });
  assert.strictEqual(earlyHo.status, 400, 'Handover rejected when active duty in progress');
  console.log('✓ Handover blocked when worker has unsubmitted open duty');

  // 7. Ramesh enters closing readings and submits the duty
  // Nozzle 101 closing: 10500 (500L MS)
  // Nozzle 102 closing: 20800 (800L HSD)
  const submitRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/duty/${duty1Id}/submit`,
    method: 'POST',
    headers: w1Headers
  }, {
    lines: [
      { nozzle_id: '101', opening: 10000, closing: 10500, testing: 5, rate: 104.5 },
      { nozzle_id: '102', opening: 20000, closing: 20800, testing: 10, rate: 92.0 }
    ],
    items: [],
    expenses: [],
    pay: { cash: 124372.5 }
  });
  assert.strictEqual(submitRes.status, 200, 'Duty 1 submitted successfully');
  console.log('✓ Worker submitted duty #', duty1Id);

  // 8. Now Ramesh checks handover-info after submission!
  const hoAfterSubmit = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/duty/handover-info',
    method: 'GET',
    headers: w1Headers
  });
  assert.strictEqual(hoAfterSubmit.status, 200);
  assert.strictEqual(hoAfterSubmit.data.active_duty, null, 'Active duty is null after submission');
  assert.ok(hoAfterSubmit.data.recent_duty, 'Recent duty is available');
  assert.strictEqual(hoAfterSubmit.data.recent_duty.id, duty1Id);
  assert.strictEqual(hoAfterSubmit.data.recent_duty.status, 'submitted');

  // Check nozzles in handover-info
  assert.strictEqual(hoAfterSubmit.data.nozzles.length, 2);
  const n101 = hoAfterSubmit.data.nozzles.find(n => n.id === '101');
  const n102 = hoAfterSubmit.data.nozzles.find(n => n.id === '102');
  assert.strictEqual(n101.closing, 10500, 'Nozzle 101 closing reading matches 10500');
  assert.strictEqual(n102.closing, 20800, 'Nozzle 102 closing reading matches 20800');
  assert.strictEqual(n101.is_busy, false, 'Nozzles not busy in any open duty');
  console.log('✓ Handover info correctly reflects recently submitted duty nozzles & closing meter readings');

  // 9. Ramesh hands over Nozzle 101 and 102 to Suresh for Evening shift!
  const doHandover1 = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/duty/handover',
    method: 'POST',
    headers: w1Headers
  }, {
    target_worker_id: w2Id,
    shift: 'Evening',
    nozzle_ids: ['101', '102'],
    notes: 'Shift handover smooth, cash verified'
  });
  assert.strictEqual(doHandover1.status, 200, 'Handover to Suresh successful');
  const newDutySureshId = doHandover1.data.duty_id;
  assert.ok(newDutySureshId, 'New duty ID returned');
  assert.strictEqual(doHandover1.data.worker_name, 'Suresh Kumar');
  console.log('✓ Handover created new duty #', newDutySureshId, 'for Suresh Kumar');

  // 10. Verify Suresh's new duty has exact opening readings equal to Ramesh's closing readings!
  const sureshCurrent = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/duty/current',
    method: 'GET',
    headers: w2Headers
  });
  assert.strictEqual(sureshCurrent.status, 200);
  assert.ok(sureshCurrent.data.duty, 'Suresh has current open duty');
  assert.strictEqual(sureshCurrent.data.duty.id, newDutySureshId);
  assert.strictEqual(sureshCurrent.data.duty.shift, 'Evening');
  const sLine101 = sureshCurrent.data.duty.lines.find(l => l.nozzle_id === '101');
  const sLine102 = sureshCurrent.data.duty.lines.find(l => l.nozzle_id === '102');
  assert.strictEqual(sLine101.opening, 10500, 'Opening reading for Suresh on Nozzle 101 is 10500');
  assert.strictEqual(sLine102.opening, 20800, 'Opening reading for Suresh on Nozzle 102 is 20800');
  console.log('✓ Suresh duty successfully started with continuous meter readings: 10500 and 20800');

  // 11. Verify that while Suresh has this open duty, Nozzle 101 is busy
  const hoRameshCheck = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/duty/handover-info',
    method: 'GET',
    headers: w1Headers
  });
  assert.strictEqual(hoRameshCheck.status, 200);
  const n101Busy = hoRameshCheck.data.nozzles.find(n => n.id === '101');
  assert.strictEqual(n101Busy.is_busy, true, 'Nozzle 101 is now busy in Suresh open duty');
  assert.strictEqual(n101Busy.busy_with, 'Suresh Kumar');
  console.log('✓ Nozzle concurrency prevented: accurately marked busy with Suresh Kumar');

  // 12. Handover history check
  assert.ok(hoRameshCheck.data.history.length >= 1, 'Handover history record present');
  const lastH = hoRameshCheck.data.history[0];
  assert.strictEqual(lastH.from_worker_name, 'Ramesh Patel');
  assert.strictEqual(lastH.to_worker_name, 'Suresh Kumar');
  assert.strictEqual(lastH.shift, 'Evening');
  console.log('✓ Handover history recorded with audit trail');

  // 13. Test Handover to HIMSELF:
  // Suresh finishes his Evening shift, records closing readings, and submits duty
  const sureshSubmit = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/duty/${newDutySureshId}/submit`,
    method: 'POST',
    headers: w2Headers
  }, {
    lines: [
      { nozzle_id: '101', opening: 10500, closing: 10900, testing: 0, rate: 104.5 },
      { nozzle_id: '102', opening: 20800, closing: 21300, testing: 0, rate: 92.0 }
    ],
    items: [],
    expenses: [],
    pay: { cash: 87800 }
  });
  assert.strictEqual(sureshSubmit.status, 200, 'Suresh submitted evening duty');

  // Suresh hands over to HIMSELF for Night shift!
  const sureshSelfHandover = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/duty/handover',
    method: 'POST',
    headers: w2Headers
  }, {
    target_worker_id: w2Id, // Himself!
    shift: 'Night',
    nozzle_ids: ['101', '102'],
    notes: 'Continuing on double shift'
  });
  assert.strictEqual(sureshSelfHandover.status, 200, 'Handover to himself succeeded');
  const sureshNightDutyId = sureshSelfHandover.data.duty_id;
  assert.ok(sureshNightDutyId, 'Night duty created for Suresh');

  const sureshNightDuty = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/duty/current',
    method: 'GET',
    headers: w2Headers
  });
  assert.strictEqual(sureshNightDuty.status, 200);
  assert.strictEqual(sureshNightDuty.data.duty.id, sureshNightDutyId);
  assert.strictEqual(sureshNightDuty.data.duty.shift, 'Night');
  const night101 = sureshNightDuty.data.duty.lines.find(l => l.nozzle_id === '101');
  const night102 = sureshNightDuty.data.duty.lines.find(l => l.nozzle_id === '102');
  assert.strictEqual(night101.opening, 10900, 'Opening reading for Suresh on Nozzle 101 is 10900');
  assert.strictEqual(night102.opening, 21300, 'Opening reading for Suresh on Nozzle 102 is 21300');
  console.log('✓ Worker successfully handed over nozzles to himself with meter readings 10900 and 21300');

  // 14. Verify manager can still close the submitted duties without conflict
  const closeD1 = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/duties/${duty1Id}/close`,
    method: 'POST',
    headers: ownerHeaders
  });
  assert.strictEqual(closeD1.status, 200, 'Manager closed duty 1');
  console.log('✓ Manager successfully closed submitted duty #', duty1Id);

  console.log('--- ALL DUTY HANDOVER TESTS PASSED PERFECTLY! ---');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
