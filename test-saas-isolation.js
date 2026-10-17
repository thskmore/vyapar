// test-saas-isolation.js
// Automated verification test suite for Multi-Customer SaaS & Pump-Level Data Isolation

const http = require('http');

function request(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: body ? JSON.parse(body) : null, raw: body });
        } catch (e) {
          resolve({ status: res.statusCode, raw: body });
        }
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
  console.log('--- STARTING MULTI-PUMP SAAS & DATA ISOLATION TESTS ---');
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log('✓ PASS:', message);
      passed++;
    } else {
      console.error('✗ FAIL:', message);
      failed++;
    }
  }

  try {
    // 1. Health check & /api/me unauthorized
    const meRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/me',
      method: 'GET'
    });
    assert(meRes.status === 200 && meRes.data && meRes.data.user === null, 'Unauthorized /api/me returns user: null');

    // 2. Register Tenant A (Pump A)
    const runId = Math.floor(Math.random() * 899999 + 100000);
    const mobileA = '98' + runId + '01';
    const signupARes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/signup',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-app': '1' }
    }, {
      name: 'Tenant A Owner',
      mobile: mobileA,
      password: 'secretPassword123',
      pump_name: 'Highway Fuels Station Alpha ' + runId,
      pump_code: 'A' + runId
    });
    if (signupARes.status !== 200) console.error('Signup A failed:', signupARes.data || signupARes.raw);
    assert(signupARes.status === 200 && signupARes.data && signupARes.data.token, 'Tenant A successfully registers with isolated pump');
    const tokenA = signupARes.data ? signupARes.data.token : null;
    const pumpIdA = signupARes.data && signupARes.data.user ? signupARes.data.user.pump_id : null;

    // 3. Register Tenant B (Pump B)
    const mobileB = '98' + runId + '02';
    const signupBRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/signup',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-app': '1' }
    }, {
      name: 'Tenant B Owner',
      mobile: mobileB,
      password: 'secretPassword456',
      pump_name: 'Metro City Fuel Outlet Beta ' + runId,
      pump_code: 'B' + runId
    });
    if (signupBRes.status !== 200) console.error('Signup B failed:', signupBRes.data || signupBRes.raw);
    assert(signupBRes.status === 200 && signupBRes.data && signupBRes.data.token, 'Tenant B successfully registers with isolated pump');
    const tokenB = signupBRes.data ? signupBRes.data.token : null;
    const pumpIdB = signupBRes.data && signupBRes.data.user ? signupBRes.data.user.pump_id : null;

    assert(pumpIdA !== pumpIdB, `Tenant A pump_id (${pumpIdA}) is distinct from Tenant B pump_id (${pumpIdB})`);

    // 4. Test State Isolation: Tenant A updates state (e.g. custom credit customers)
    const stateA = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/state',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${tokenA}` }
    });
    assert(stateA.status === 200 && stateA.data, 'Tenant A fetches isolated state successfully');

    // Tenant A adds a credit customer
    const putRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/state',
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-app': '1', 'Authorization': `Bearer ${tokenA}` }
    }, {
      vers: stateA.data.vers,
      changes: {
        c: {
          c: [{ id: 'CUST-A-1', name: 'Alpha Logistics Pvt Ltd', bal: 15000, mob: '9888811111', limit: 50000 }]
        }
      }
    });
    assert(putRes.status === 200, 'Tenant A successfully updates customer state');

    // Tenant B fetches their state: should NOT contain Alpha Logistics
    const stateB = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/state',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${tokenB}` }
    });
    const custsB = stateB.data && stateB.data.state && stateB.data.state.c ? stateB.data.state.c : [];
    const hasAlphaInB = custsB.some(c => c.name === 'Alpha Logistics Pvt Ltd');
    assert(!hasAlphaInB, 'Tenant B state is strictly isolated from Tenant A state');

    // 5. Test User Management Isolation: Tenant A adds worker Sunil
    const addWorkerA = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/users',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-app': '1', 'Authorization': `Bearer ${tokenA}` }
    }, {
      name: 'Sunil Operator Alpha',
      mobile: '98' + runId + '03',
      role: 'worker',
      password: 'workerpass123'
    });
    assert(addWorkerA.status === 200, 'Tenant A creates worker user');

    // Tenant B lists users: should NOT contain Sunil Operator Alpha
    const usersB = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/users',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${tokenB}` }
    });
    const hasSunilInB = Array.isArray(usersB.data) && usersB.data.some(u => u.name === 'Sunil Operator Alpha');
    assert(!hasSunilInB, 'Tenant B user list does not expose Tenant A workers');

    // 6. Test Multi-Station Outlet Creation & Station Switching for Owner
    const newStationA = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/pumps',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-app': '1', 'Authorization': `Bearer ${tokenA}` }
    }, {
      name: 'Highway Fuels Branch Alpha-North ' + runId,
      code: 'BR' + runId
    });
    assert(newStationA.status === 200 && newStationA.data && newStationA.data.pump, 'Owner can create secondary pump station outlet');
    const newPumpId = newStationA.data.pump.id;

    // Switch active station for Owner A
    const switchRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/pumps/switch',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-app': '1', 'Authorization': `Bearer ${tokenA}` }
    }, {
      pump_id: newPumpId
    });
    assert(switchRes.status === 200 && switchRes.data && switchRes.data.user.pump_id === newPumpId, 'Owner can switch active station safely');

    // Tenant B attempting to switch to Tenant A's pump should be forbidden
    const rogueSwitch = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/pumps/switch',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-app': '1', 'Authorization': `Bearer ${tokenB}` }
    }, {
      pump_id: newPumpId
    });
    assert(rogueSwitch.status === 403, 'Cross-tenant pump switching is rejected with HTTP 403 Forbidden');

    // 7. Audit Log Isolation
    const auditA = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/audit',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${tokenA}` }
    });
    const auditB = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/audit',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${tokenB}` }
    });
    assert(auditA.status === 200 && Array.isArray(auditA.data), 'Tenant A retrieves audit logs');
    assert(auditB.status === 200 && Array.isArray(auditB.data), 'Tenant B retrieves audit logs');
    const hasBranchInB = auditB.data.some(entry => entry.detail && entry.detail.includes('Highway Fuels Branch Alpha-North'));
    assert(!hasBranchInB, 'Tenant B audit trail does not expose Tenant A station operations');

    // Switch Owner A back to primary pump A to test primary station operations
    await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/pumps/switch',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-app': '1', 'Authorization': `Bearer ${tokenA}` }
    }, {
      pump_id: pumpIdA
    });

    // 8. Credit Sales Isolation
    const creditSaleA = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/credit-sales',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-app': '1', 'Authorization': `Bearer ${tokenA}` }
    }, {
      cust_id: 'CUST-A-1',
      fuel: 'Petrol',
      litres: 25.5,
      n: 'Petrol filling',
      a: 2550.00,
      veh: 'MH12AB1234',
      force: true
    });
    if (creditSaleA.status !== 200) console.error('Credit sale A failed:', creditSaleA.status, creditSaleA.data || creditSaleA.raw);
    assert(creditSaleA.status === 200, 'Tenant A records credit sale');

    const creditSalesB = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/credit-sales',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${tokenB}` }
    });
    const hasVehInB = Array.isArray(creditSalesB.data) && creditSalesB.data.some(cs => cs.veh === 'MH12AB1234');
    assert(!hasVehInB, 'Tenant B credit ledger is completely isolated from Tenant A sales');

    console.log(`\nTests finished: ${passed} passed, ${failed} failed.`);
    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  }
}

runTests();
