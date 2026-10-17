// test-cashflow.js
// Verification test for Indian Petrol Pump 6 AM Cash Flow Engine

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
  console.log('--- STARTING 6 AM CASH FLOW & NEXT DAY ROLLOVER TESTS ---');

  // 1. Signup owner for a dedicated test pump
  const runId = Math.floor(Math.random() * 899999 + 100000);
  const mobile = '98' + runId + '55';
  const signup = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/signup',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    name: 'Cashflow Dealer',
    mobile: mobile,
    password: 'password123',
    pump_name: 'Indian Oil Bharat Highway',
    pump_code: 'IOCL-' + runId
  });
  assert(signup.status === 200, 'Dealer signup successful');
  const token = signup.data.token;
  const authHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const day1 = '2026-10-15';
  const day2 = '2026-10-16';

  // 2. Set Opening cash for Day 1 at 6:00 AM (e.g. ₹20,000)
  const setOpen = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/cashflow/opening',
    method: 'POST',
    headers: authHeaders
  }, {
    d: day1,
    opening_cash: 20000,
    note: 'Initial till cash counted at 06:00 AM'
  });
  assert(setOpen.status === 200, 'Set opening cash successful');
  assert.strictEqual(setOpen.data.flow.opening_cash, 20000, 'Day 1 opening cash is 20000');
  console.log('✓ PASS: Day 1 opening cash set to ₹20,000 at 06:00 AM');

  // 3. Create a worker and record morning shift duty (Morning shift cash = ₹45,000)
  const workerRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/users',
    method: 'POST',
    headers: authHeaders
  }, {
    name: 'Ramesh Morning',
    mobile: '98' + runId + '66',
    role: 'worker',
    password: 'workerpass123'
  });
  assert(workerRes.status === 200, 'Worker created');
  const workerId = workerRes.data.user.id;

  // Assign and submit Morning shift duty
  // First ensure nozzle exists
  const stRes = await request({ hostname: 'localhost', port: 3000, path: '/api/state', method: 'GET', headers: authHeaders });
  const nozzles = stRes.data.state.nozzles || [];
  const nozzleId = nozzles.length ? nozzles[0].id : 1;

  const assignMorning = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/duties/assign',
    method: 'POST',
    headers: authHeaders
  }, {
    worker_id: workerId,
    shift: 'Morning',
    nozzle_ids: [nozzleId]
  });
  assert(assignMorning.status === 200, 'Morning duty assigned');

  // Find the open duty
  const dutiesRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/duties?d=${day1}`,
    method: 'GET',
    headers: authHeaders
  });
  const openDuty = dutiesRes.data.open[0];
  assert(openDuty, 'Open duty found');

  // Submit morning duty with ₹45,000 cash collection
  // Update duty day to day1 if needed
  const submitMorning = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/duties/${openDuty.id}`,
    method: 'PUT',
    headers: authHeaders
  }, {
    pay: { cash: 45000, upi: 5000, card: 0 },
    cash: 45000,
    upi: 5000,
    card: 0,
    lines: openDuty.lines.map(l => ({ ...l, opening: 1000, closing: 1500, testing: 0, rate: 100 })),
    items: [],
    expenses: []
  });
  assert(submitMorning.status === 200, 'Morning duty updated');

  const closeMorning = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/duties/${openDuty.id}/close`,
    method: 'POST',
    headers: authHeaders
  });
  assert(closeMorning.status === 200, 'Morning duty closed');

  // Update date of duty to day1 directly in database for precision
  const sqlite = require('better-sqlite3')('petroplus.db');
  sqlite.prepare("update duties set d=? where id=?").run(day1, openDuty.id);
  sqlite.close();

  // 4. Record Bank Deposit of ₹40,000
  const depRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/cashflow/deposit',
    method: 'POST',
    headers: authHeaders
  }, {
    d: day1,
    amount: 40000,
    bank_name: 'State Bank of India',
    slip_no: 'SBI-DEP-99881',
    deposited_by: 'Manager Alok',
    note: 'Afternoon post-morning shift cash deposit'
  });
  assert(depRes.status === 200, 'Bank deposit recorded');
  assert.strictEqual(depRes.data.flow.bank_deposit, 40000, 'Total bank deposit is 40000');
  console.log('✓ PASS: Recorded post-morning bank deposit of ₹40,000');

  // 5. Add Evening shift duty with ₹35,000 cash collection
  const sqlite2 = require('better-sqlite3')('petroplus.db');
  const pumpInfo = await request({ hostname: 'localhost', port: 3000, path: '/api/me', method: 'GET', headers: authHeaders });
  const pid = pumpInfo.data.user.pump_id;

  sqlite2.prepare(`
    insert into duties(pump_id, worker_id, d, shift, status, cash, upi, card, started, submitted, closed_by, closed_at, pay_json)
    values(?, ?, ?, 'Evening', 'closed', 35000, 2000, 0, 1729000000, 1729030000, 1, 1729030000, '{"cash":35000,"upi":2000,"card":0}')
  `).run(pid, workerId, day1);

  // 6. Add Night shift duty with ₹15,000 cash collection
  sqlite2.prepare(`
    insert into duties(pump_id, worker_id, d, shift, status, cash, upi, card, started, submitted, closed_by, closed_at, pay_json)
    values(?, ?, ?, 'Night', 'closed', 15000, 1000, 0, 1729030000, 1729060000, 1, 1729060000, '{"cash":15000,"upi":1000,"card":0}')
  `).run(pid, workerId, day1);
  sqlite2.close();

  // 7. Verify Day 1 Cash Flow:
  // Opening: 20,000
  // Morning: 45,000
  // Bank deposit: -40,000
  // Evening: 35,000
  // Night: 15,000
  // Expected closing: 20000 + 45000 - 40000 + 35000 + 15000 = 75,000
  const flowDay1 = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/cashflow/day/${day1}`,
    method: 'GET',
    headers: authHeaders
  });
  assert(flowDay1.status === 200, 'Fetch Day 1 cashflow');
  const d1 = flowDay1.data;
  assert.strictEqual(d1.opening_cash, 20000, 'Day 1 opening is 20000');
  assert.strictEqual(d1.morning_cash, 45000, 'Day 1 morning cash is 45000');
  assert.strictEqual(d1.bank_deposit, 40000, 'Day 1 bank deposit is 40000');
  assert.strictEqual(d1.evening_cash, 35000, 'Day 1 evening cash is 35000');
  assert.strictEqual(d1.night_cash, 15000, 'Day 1 night cash is 15000');
  assert.strictEqual(d1.subtotal_after_morning, 65000, 'Subtotal after morning is 65000');
  assert.strictEqual(d1.subtotal_after_deposit, 25000, 'Subtotal after deposit is 25000');
  assert.strictEqual(d1.closing_cash, 75000, 'Day 1 closing balance is 75000');
  assert.strictEqual(d1.next_day_opening, 75000, 'Day 1 next_day_opening is 75000');
  console.log('✓ PASS: Day 1 closing cash calculated correctly (₹75,000)');

  // 8. CRITICAL: Test Next Day Rollover!
  // Day 2 (2026-10-16) at 6:00 AM MUST automatically have opening cash = Day 1 closing cash (₹75,000)!
  const flowDay2 = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/cashflow/day/${day2}`,
    method: 'GET',
    headers: authHeaders
  });
  assert(flowDay2.status === 200, 'Fetch Day 2 cashflow');
  const d2 = flowDay2.data;
  assert.strictEqual(d2.opening_cash, 75000, 'Day 2 6 AM Opening Cash equals Day 1 Closing Balance (₹75,000)');
  assert.strictEqual(d2.opening_is_manual, false, 'Day 2 opening was auto-carried from previous day closing');
  console.log('✓ PASS: Day 2 automatically inherited Day 1 closing cash (₹75,000) as 6 AM opening balance');

  // 9. Multi-Day Register API verification
  const regRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/cashflow/register?from=${day1}&to=${day2}`,
    method: 'GET',
    headers: authHeaders
  });
  assert(regRes.status === 200, 'Register API succeeded');
  assert.strictEqual(regRes.data.days.length, 2, 'Two days returned in register');
  assert.strictEqual(regRes.data.days[0].closing_cash, regRes.data.days[1].opening_cash, 'Day 1 closing matches Day 2 opening in register');
  console.log('✓ PASS: Multi-day cash flow register preserves contiguous opening/closing balances');

  console.log('ALL CASH FLOW TESTS PASSED SUCCESSFULLY! ✓');
}

runTests().catch((e) => {
  console.error('Test failed with error:', e);
  process.exit(1);
});
