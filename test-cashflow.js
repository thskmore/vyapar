// test-cashflow.js
// Automated verification test suite for Indian Petrol Pump 6 AM Cash Flow Engine

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
    headers: { 'Content-Type': 'application/json', 'x-app': '1' }
  }, {
    name: 'Cashflow Dealer',
    mobile: mobile,
    password: 'password123',
    pump_name: 'Indian Oil Bharat Highway',
    pump_code: 'IOCL-' + runId
  });
  assert(signup.status === 200, 'Dealer signup successful');
  const token = signup.data.token;
  const authHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'x-app': '1' };

  const day1 = '2026-10-15';
  const day2 = '2026-10-16';

  // 2. Set Opening cash for Day 1 at 6:00 AM (₹20,000)
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

  // 3. Record Bank Deposit of ₹15,000
  const depRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/cashflow/deposit',
    method: 'POST',
    headers: authHeaders
  }, {
    d: day1,
    amount: 15000,
    bank_name: 'State Bank of India',
    slip_no: 'SBI-DEP-99881',
    deposited_by: 'Manager Alok',
    note: 'Afternoon post-morning shift cash deposit'
  });
  assert(depRes.status === 200, 'Bank deposit recorded');
  assert.strictEqual(depRes.data.flow.bank_deposit, 15000, 'Total bank deposit is 15000');
  console.log('✓ PASS: Recorded bank deposit of ₹15,000');

  // 4. Verify Day 1 Cash Flow:
  // Opening: 20,000
  // Bank deposit: -15,000
  // Expected closing: 20000 - 15000 = 5,000
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
  assert.strictEqual(d1.bank_deposit, 15000, 'Day 1 bank deposit is 15000');
  assert.strictEqual(d1.subtotal_after_morning, 20000, 'Subtotal after morning is 20000');
  assert.strictEqual(d1.subtotal_after_deposit, 5000, 'Subtotal after deposit is 5000');
  assert.strictEqual(d1.closing_cash, 5000, 'Day 1 closing balance is 5000');
  assert.strictEqual(d1.next_day_opening, 5000, 'Day 1 next_day_opening is 5000');
  console.log('✓ PASS: Day 1 closing cash calculated correctly (₹5,000)');

  // 5. CRITICAL: Test Next Day Rollover!
  // Day 2 (2026-10-16) at 6:00 AM MUST automatically have opening cash = Day 1 closing cash (₹5,000)!
  const flowDay2 = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/cashflow/day/${day2}`,
    method: 'GET',
    headers: authHeaders
  });
  assert(flowDay2.status === 200, 'Fetch Day 2 cashflow');
  const d2 = flowDay2.data;
  assert.strictEqual(d2.opening_cash, 5000, 'Day 2 6 AM Opening Cash equals Day 1 Closing Balance (₹5,000)');
  assert.strictEqual(d2.opening_is_manual, false, 'Day 2 opening was auto-carried from previous day closing');
  console.log('✓ PASS: Day 2 automatically inherited Day 1 closing cash (₹5,000) as 6 AM opening balance');

  // 6. Test Manual Override on Day 2 & Reset
  const manualDay2 = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/cashflow/opening',
    method: 'POST',
    headers: authHeaders
  }, {
    d: day2,
    opening_cash: 12000,
    note: 'Manually verified till count'
  });
  assert(manualDay2.status === 200 && manualDay2.data.flow.opening_cash === 12000, 'Manual override sets ₹12,000');
  assert.strictEqual(manualDay2.data.flow.opening_is_manual, true, 'Marked as manual override');
  console.log('✓ PASS: Day 2 manual opening override supported');

  const resetDay2 = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/cashflow/reset-opening',
    method: 'POST',
    headers: authHeaders
  }, { d: day2 });
  assert(resetDay2.status === 200 && resetDay2.data.flow.opening_cash === 5000, 'Reset restored auto-chain from Day 1');
  assert.strictEqual(resetDay2.data.flow.opening_is_manual, false, 'Restored to auto-carried state');
  console.log('✓ PASS: Day 2 reset successfully restored auto-carry rollover');

  // 7. Multi-Day Register API verification
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
