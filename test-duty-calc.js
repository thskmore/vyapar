// test-duty-calc.js
// Automated verification test suite for Duty Calculation, Lubes, Expenses, and Credit Sales Linking

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

async function runDutyTests() {
  console.log('--- STARTING DUTY CALCULATION & CREDIT SALE LINKING TESTS ---');

  // 1. Signup owner for a dedicated test pump
  const runId = Math.floor(Math.random() * 899999 + 100000);
  const mobile = '97' + runId + '11';
  const signup = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/signup',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-app': '1' }
  }, {
    name: 'Duty Dealer',
    mobile: mobile,
    password: 'password123',
    pump_name: 'Bharat Petroleum Highway ' + runId,
    pump_code: 'BPCL-' + runId
  });
  assert.strictEqual(signup.status, 200, 'Dealer signup successful');
  const ownerToken = signup.data.token;
  const ownerHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}`, 'x-app': '1' };

  // 2. Setup Nozzles, Rates, and Shop Items in State
  const stateRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/state',
    method: 'GET',
    headers: ownerHeaders
  });
  assert.strictEqual(stateRes.status, 200, 'Fetched initial state');

  const today = stateRes.data.date || new Date().toISOString().slice(0, 10);
  const setupPut = await request({
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
          { id: 'N1', name: 'Nozzle 1 MS', fuel: 'Petrol (MS)', open: 10000, active: true },
          { id: 'N2', name: 'Nozzle 2 HSD', fuel: 'Diesel (HSD)', open: 20000, active: true }
        ],
        rates: [
          { id: 1, fuel: 'Petrol (MS)', rate: 100.0, from: '2020-01-01' },
          { id: 2, fuel: 'Diesel (HSD)', rate: 90.0, from: '2020-01-01' }
        ],
        expcats: ['Tea and food', 'Repairs', 'Electricity', 'Transport', 'Other'],
        paymodes: [{ key: 'cash', name: 'Cash', active: true }, { key: 'upi', name: 'UPI', active: true }, { key: 'card', name: 'Card', active: true }],
        fuelprods: [{ name: 'Petrol (MS)', unit: 'L' }, { name: 'Diesel (HSD)', unit: 'L' }]
      },
      items: {
        items: [
          { id: 'ITEM1', name: 'Mak 4T Plus 1L', unit: 'Bottle', sell: 350.0, stock: 50 }
        ],
        itemcats: ['Engine Oil', 'Grease', 'Coolant', 'Other']
      },
      c: {
        c: [
          { id: 'CUST1', name: 'Sharma Transport Co', limit: 25000, active: true, veh: ['MH12AB1234'] }
        ]
      }
    }
  });
  assert.strictEqual(setupPut.status, 200, 'Setup nozzles, rates, items, and credit customer');

  // 3. Create worker user
  const workerMob = '97' + runId + '22';
  const workerCreate = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/users',
    method: 'POST',
    headers: ownerHeaders
  }, {
    name: 'Ramesh Operator',
    mobile: workerMob,
    role: 'worker',
    password: 'workerpass123'
  });
  assert.strictEqual(workerCreate.status, 200, 'Worker created');
  const workerId = workerCreate.data.user ? workerCreate.data.user.id : workerCreate.data.id;

  // Login as worker
  const workerLogin = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-app': '1' }
  }, {
    mobile: workerMob,
    password: 'workerpass123'
  });
  assert.strictEqual(workerLogin.status, 200, 'Worker logged in');
  const workerToken = workerLogin.data.token;
  const workerHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${workerToken}`, 'x-app': '1' };

  // 4. Assign duty to worker with N1 & N2
  const assignRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/duties/assign',
    method: 'POST',
    headers: ownerHeaders
  }, {
    worker_id: workerId,
    shift: 'Morning',
    nozzle_ids: ['N1', 'N2']
  });
  assert.strictEqual(assignRes.status, 200, 'Duty assigned');
  const dutyId = assignRes.data.id;
  console.log('✓ PASS: Duty assigned successfully with ID:', dutyId);

  // 5. Worker checks duty/current:
  // Initial state: closing is null. Litres sold must be 0, Sales must be 0, Expected must be 0!
  const currentDuty = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/duty/current',
    method: 'GET',
    headers: workerHeaders
  });
  assert.strictEqual(currentDuty.status, 200, 'Fetched current duty');
  const d0 = currentDuty.data.duty;
  assert(d0, 'Active duty returned');
  assert.strictEqual(d0.litres, 0, 'Unentered closing meter readings produce 0 litres');
  assert.strictEqual(d0.sales, 0, 'Unentered closing meter readings produce 0 fuel sales');
  assert.strictEqual(d0.total_sales, 0, 'Total sales is 0 initially');
  assert.strictEqual(d0.expected, 0, 'Initial expected collection is 0');
  console.log('✓ PASS: Initial duty state correctly computes 0 litres & 0 expected collection (no negative readings)');

  // 6. Worker records lube sale (1 bottle of Mak 4T Plus @ ₹350)
  const saveLube = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/duty/${dutyId}`,
    method: 'PUT',
    headers: workerHeaders
  }, {
    lines: d0.lines,
    items: [{ item_id: 'ITEM1', qty: 1 }],
    expenses: [],
    pay: { cash: 0, upi: 0, card: 0 }
  });
  assert.strictEqual(saveLube.status, 200, 'Lube item saved on duty draft');

  // Verify duty shows lube = 350, expected = 350
  const dutyAfterLube = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/duty/current',
    method: 'GET',
    headers: workerHeaders
  });
  const dLube = dutyAfterLube.data.duty;
  assert.strictEqual(dLube.lube, 350, 'Lube sales is 350');
  assert.strictEqual(dLube.total_sales, 350, 'Total sales is 350');
  assert.strictEqual(dLube.expected, 350, 'Expected collection after lube is 350');
  console.log('✓ PASS: Lube sales link directly to duty and add to expected collection');

  // 7. Worker records an expense from the till (₹50 for Tea and food)
  const saveExp = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/duty/${dutyId}`,
    method: 'PUT',
    headers: workerHeaders
  }, {
    lines: d0.lines,
    items: [{ item_id: 'ITEM1', qty: 1 }],
    expenses: [{ cat: 'Tea and food', note: 'Staff morning tea', amount: 50 }],
    pay: { cash: 0, upi: 0, card: 0 }
  });
  assert.strictEqual(saveExp.status, 200, 'Expense saved on duty draft');

  const dutyAfterExp = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/duty/current',
    method: 'GET',
    headers: workerHeaders
  });
  const dExp = dutyAfterExp.data.duty;
  assert.strictEqual(dExp.exp, 50, 'Expenses is 50');
  assert.strictEqual(dExp.expected, 300, 'Expected collection after expense is 350 - 50 = 300');
  console.log('✓ PASS: Expenses link directly to duty and deduct from expected collection');

  // 8. Worker records Credit Sale linked to duty (20 L Diesel @ ₹90 = ₹1,800 to Sharma Transport)
  const creditRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/credit-sales',
    method: 'POST',
    headers: workerHeaders
  }, {
    cust_id: 'CUST1',
    fuel: 'Diesel (HSD)',
    litres: 20,
    a: 1800,
    veh: 'MH12AB1234',
    duty_id: dutyId,
    force: false
  });
  assert.strictEqual(creditRes.status, 200, 'Credit sale recorded by worker');
  assert.strictEqual(creditRes.data.duty_id, dutyId, 'Credit sale explicitly linked to duty ID');
  console.log('✓ PASS: Credit sale recorded and linked to duty');

  // 9. Now worker enters closing readings on nozzles:
  // N1: Opening 10000, Closing 10050, Testing 5 -> 45 L Petrol @ 100 = ₹4,500
  // N2: Opening 20000, Closing 20100, Testing 0 -> 100 L Diesel @ 90 = ₹9,000
  // Total fuel litres: 145 L, Total fuel sales: 4,500 + 9,000 = ₹13,500
  // Total lube: ₹350
  // Gross Total Sales: 13,500 + 350 = ₹13,850
  // Less Credit Sales: ₹1,800
  // Less Expenses: ₹50
  // Net Expected Cash Collection = 13,850 - 1,800 - 50 = ₹12,000!
  // Worker collects: Cash ₹10,000 + UPI ₹2,000 = ₹12,000!
  // Difference = 12,000 - 12,000 = 0 (TALLY!)
  const submitDuty = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/duty/${dutyId}/submit`,
    method: 'POST',
    headers: workerHeaders
  }, {
    lines: [
      { nozzle_id: 'N1', closing: 10050, testing: 5 },
      { nozzle_id: 'N2', closing: 20100, testing: 0 }
    ],
    items: [{ item_id: 'ITEM1', qty: 1 }],
    expenses: [{ cat: 'Tea and food', note: 'Staff morning tea', amount: 50 }],
    pay: { cash: 10000, upi: 2000, card: 0 }
  });
  assert.strictEqual(submitDuty.status, 200, 'Duty successfully submitted');

  // 10. Manager reviews duty via GET /api/duties/:id
  const reviewRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/duties/${dutyId}`,
    method: 'GET',
    headers: ownerHeaders
  });
  assert.strictEqual(reviewRes.status, 200, 'Fetched duty for manager review');
  const rev = reviewRes.data;
  assert.strictEqual(rev.litres, 145, 'Total liquid fuel sold is 145 L');
  assert.strictEqual(rev.sales, 13500, 'Fuel sales is ₹13,500');
  assert.strictEqual(rev.lube, 350, 'Lube sales is ₹350');
  assert.strictEqual(rev.total_sales, 13850, 'Total gross sales is ₹13,850');
  assert.strictEqual(rev.credit, 1800, 'Credit sales deducted is ₹1,800');
  assert.strictEqual(rev.exp, 50, 'Expenses deducted is ₹50');
  assert.strictEqual(rev.expected, 12000, 'Expected cash collection is exactly ₹12,000');
  assert.strictEqual(rev.collected, 12000, 'Actual cash + upi collected is ₹12,000');
  assert.strictEqual(rev.diff, 0, 'Duty difference is 0 (Exact Tally)');
  console.log('✓ PASS: Duty calculation verified with 100% exact math in manager review (Tally = ₹0.00)');

  // 11. Manager closes duty
  const closeRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/duties/${dutyId}/close`,
    method: 'POST',
    headers: ownerHeaders
  });
  assert.strictEqual(closeRes.status, 200, 'Duty closed by manager');

  // 12. Check Day Report summary
  const dayReportRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/day-report?d=${today}`,
    method: 'GET',
    headers: ownerHeaders
  });
  assert.strictEqual(dayReportRes.status, 200, 'Fetched day report');
  const sum = dayReportRes.data.summary;
  assert.strictEqual(sum.sales, 13500, 'Day report fuel sales is 13500');
  assert.strictEqual(sum.lube, 350, 'Day report lube sales is 350');
  assert.strictEqual(sum.total, 13850, 'Day report total sales is 13850');
  assert.strictEqual(sum.credit, 1800, 'Day report credit is 1800');
  assert.strictEqual(sum.exp, 50, 'Day report expense is 50');
  assert.strictEqual(sum.expected, 12000, 'Day report expected collection is 12000');
  assert.strictEqual(sum.collected, 12000, 'Day report collected is 12000');
  assert.strictEqual(sum.diff, 0, 'Day report diff is 0');
  console.log('✓ PASS: Day report correctly tallies all sales, lubes, expenses, and credit deductions');

  console.log('ALL DUTY CALCULATION & CREDIT LINKING TESTS PASSED SUCCESSFULLY! ✓');
}

runDutyTests().catch((err) => {
  console.error('Duty test error:', err);
  process.exit(1);
});
