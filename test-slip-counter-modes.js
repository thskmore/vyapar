const http = require('http');
const assert = require('assert');

// Test that custom collection modes with slip counting work end-to-end
console.log('--- STARTING SLIP-COUNTING & COLLECTION MODES TESTS ---');

function req(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const r = http.request({
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'X-App': '1',
        ...(token ? { 'Authorization': 'Bearer ' + token } : {}),
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
      }
    }, res => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: buf ? JSON.parse(buf) : {} });
        } catch (e) {
          resolve({ status: res.statusCode, raw: buf });
        }
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

async function run() {
  const runId = Math.floor(Math.random() * 899999 + 100000);
  const mobile = '98' + runId + '01';
  const regRes = await req('POST', '/api/signup', {
    pump_name: `Slip Station ${runId}`,
    pump_code: `SLIP${runId}`,
    name: "Station Owner",
    mobile: mobile,
    password: "Password123!"
  });
  assert.strictEqual(regRes.status, 200, "Owner registration must succeed");
  const token = regRes.body.token;

  // 1. Get initial state and check default paymodes
  const stateRes = await req('GET', '/api/state', null, token);
  assert.strictEqual(stateRes.status, 200);
  const state = stateRes.body.state || {};
  const currentModes = state.paymodes || [
    { key: "cash", name: "Cash", active: true },
    { key: "upi", name: "UPI", active: true, slipCounter: true },
    { key: "card", name: "Card", active: true, slipCounter: true }
  ];

  // 2. Add custom collection mode with slip-counting facility
  const customMode = {
    key: "fleet_card_" + runId,
    name: "HPCL DriveTrack Plus",
    active: true,
    slipCounter: true,
    type: "card"
  };
  const updatedModes = [...currentModes, customMode];
  const setupData = {
    nozzles: state.nozzles || [],
    rates: state.rates || [],
    expcats: state.expcats || [],
    paymodes: updatedModes,
    fuelprods: state.fuelprods || []
  };
  const putStateRes = await req('PUT', '/api/state', {
    vers: stateRes.body.vers || {},
    changes: {
      setup: setupData
    }
  }, token);
  assert.strictEqual(putStateRes.status, 200, "State update with custom collection mode should succeed");
  console.log('✓ PASS: Custom collection mode added with slipCounter: true');

  // 3. Create worker user
  const workerMobile = '97' + runId + '02';
  const workerRes = await req('POST', '/api/users', {
    name: "Duty Worker",
    mobile: workerMobile,
    password: "WorkerPass123!",
    role: "worker"
  }, token);
  assert.strictEqual(workerRes.status, 200);

  const loginWorkerRes = await req('POST', '/api/login', {
    mobile: workerMobile,
    password: "WorkerPass123!"
  });
  const wToken = loginWorkerRes.body.token;

  // Assign duty to worker
  const assignInfo = await req('GET', '/api/assign-info', null, token);
  assert.ok(assignInfo.body.nozzles.length > 0, "Should have default nozzles");
  const nozId = assignInfo.body.nozzles[0].id;

  const assignRes = await req('POST', '/api/duties/assign', {
    worker_id: workerRes.body.user ? workerRes.body.user.id : workerRes.body.id,
    shift: "Morning",
    nozzle_ids: [nozId]
  }, token);
  assert.strictEqual(assignRes.status, 200, "Assigning duty must succeed");

  const wCurrentRes = await req('GET', '/api/duty/current', null, wToken);
  assert.strictEqual(wCurrentRes.status, 200);
  const duty = wCurrentRes.body.duty;
  assert.ok(duty, "Worker should have an active open duty");

  const returnedModes = wCurrentRes.body.modes;
  const foundCustom = returnedModes.find(m => m.key === customMode.key);
  assert.ok(foundCustom, "Worker duty info must include the custom collection mode");
  assert.strictEqual(foundCustom.slipCounter, true, "Custom collection mode must have slipCounter: true");
  console.log('✓ PASS: Worker view reflects custom collection mode with slip-counting enabled');

  // 4. Submit duty with slips for custom collection mode and cash denominations
  const slipsData = {
    [customMode.key]: [
      { amount: 1500, ref: "Slip #4812" },
      { amount: 2500, ref: "Slip #4813" }
    ]
  };
  const openReading = parseFloat(duty.lines[0].opening) || 0;
  const dutyPayload = {
    lines: [{
      nozzle_id: nozId,
      closing: openReading + 100,
      testing: 0
    }],
    items: [],
    expenses: [],
    pay: {
      cash: 6450,
      upi: 0,
      card: 0,
      [customMode.key]: 4000,
      _cashDenom: { 500: 12, 200: 2, 50: 1, _totalNotes: 15 },
      _slips: slipsData
    },
    note: "Duty closed with Fleet Card slips"
  };
  const saveRes = await req('PUT', `/api/duty/${duty.id}`, dutyPayload, wToken);
  assert.strictEqual(saveRes.status, 200, "Duty save with custom mode slips must succeed");
  console.log('✓ PASS: Duty successfully saved with custom collection mode slips');

  const submitRes = await req('POST', `/api/duty/${duty.id}/submit`, dutyPayload, wToken);
  if (submitRes.status !== 200) console.error("submit failed:", submitRes.body);
  assert.strictEqual(submitRes.status, 200, "Duty submit must succeed");

  // 5. Manager reviews duty and verifies slips persistence
  const managerReviewRes = await req('GET', `/api/duties/${duty.id}`, null, token);
  assert.strictEqual(managerReviewRes.status, 200);
  const reviewedDuty = managerReviewRes.body;
  assert.strictEqual(reviewedDuty.pay[customMode.key], 4000, "Collection amount matches slips total");
  assert.ok(reviewedDuty.pay._slips, "Slips data should be preserved in duty pay");
  assert.strictEqual(reviewedDuty.pay._slips[customMode.key].length, 2, "Both slips persisted correctly");
  console.log('✓ PASS: Slips persisted and verified in duty review');

  console.log('ALL SLIP-COUNTING & COLLECTION MODES TESTS PASSED SUCCESSFULLY! ✓');
}

run().catch(err => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
