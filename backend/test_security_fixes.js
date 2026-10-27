/**
 * ============================================================================
 * SECURITY FIX REGRESSION SUITE
 * ============================================================================
 * Covers the security hardening added for the demo-mode release:
 *   1. Client-supplied HMAC secrets are ignored (server-side secret only)
 *   2. Balance validation rejects unfundable transfers
 *   3. Funds move atomically at processing time, not at creation
 *   4. Authoritative server-side transaction status endpoint
 *   5. Fake payment confirmation is checked against server truth
 *   6. Demo accounts endpoint works without any login token
 *   7. No secrets/private keys appear in API responses
 *   8. Destructive reset + missing HMAC secret fail safely in production
 *
 * Run: node test_security_fixes.js   (requires the API on 127.0.0.1:5000,
 *      except section 8 which spawns its own production-mode instance on 5001)
 * ============================================================================
 */
const { spawn } = require('child_process');
const path = require('path');

const API = 'http://127.0.0.1:5000/api';

let passed = 0;
let failed = 0;

function check(condition, label, extra = '') {
  if (condition) {
    console.log(`  [PASS] ${label}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${label}${extra ? ` -- ${extra}` : ''}`);
    failed++;
  }
}

async function req(method, url, body = null) {
  const options = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) options.body = JSON.stringify(body);
  const res = await fetch(url, options);
  let data = null;
  try {
    data = await res.json();
  } catch (e) {
    data = null;
  }
  return { status: res.status, data };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(url, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch (e) {
      /* not up yet */
    }
    await sleep(300);
  }
  return false;
}

async function run() {
  console.log('====================================================');
  console.log('SECURITY FIX REGRESSION TEST SUITE');
  console.log('====================================================\n');

  // ---------------------------------------------------------------------
  console.log('--- 1. Client-supplied HMAC secret must be ignored ---');
  // ---------------------------------------------------------------------
  const payload = {
    transactionId: 'TX-ATTACKER-1',
    senderName: 'Alice Cryptographer',
    receiverName: 'Bob Merchant',
    amount: 100,
    currency: 'INR',
    timestamp: Date.now(),
    nonce: 'deadbeefdeadbeefdeadbeefdeadbeef',
  };
  const { canonicalize, generateHMAC } = require('./src/crypto');
  const canonical = canonicalize(payload);
  const attackerSecret = 'attacker_chosen_secret_value_123456';
  const attackerHmac = generateHMAC(canonical, attackerSecret);

  const inspectRes = await req('POST', `${API}/verify/inspect`, {
    ...payload,
    sha256Hash: require('./src/crypto').hashSHA256(canonical),
    hmacSignature: attackerHmac,
    hmacSecret: attackerSecret,
  });

  check(inspectRes.status === 200, 'Inspect endpoint responds 200');
  check(
    inspectRes.data?.data?.hmac?.isValid === false,
    'HMAC computed with a client-provided secret does NOT validate',
    `got isValid=${inspectRes.data?.data?.hmac?.isValid}`
  );

  // ---------------------------------------------------------------------
  console.log('\n--- 2. Balance validation rejects unfundable transfers ---');
  // ---------------------------------------------------------------------
  const tooBig = await req('POST', `${API}/transactions`, {
    sender: 'Alice Cryptographer',
    receiver: 'Bob Merchant',
    amount: 99999999,
    currency: 'INR',
  });
  check(tooBig.status === 400, 'Over-balance transfer rejected with HTTP 400', `got ${tooBig.status}`);
  check(
    tooBig.data?.reason === 'INSUFFICIENT_BALANCE',
    'Rejection reason is INSUFFICIENT_BALANCE',
    `got ${tooBig.data?.reason}`
  );

  const badAmount = await req('POST', `${API}/transactions`, {
    sender: 'Alice Cryptographer',
    receiver: 'Bob Merchant',
    amount: -50,
  });
  check(badAmount.status === 400 && badAmount.data?.reason === 'INVALID_AMOUNT',
    'Negative amount rejected as INVALID_AMOUNT');

  // ---------------------------------------------------------------------
  console.log('\n--- 3. Balances move only when the server processes the tx ---');
  // ---------------------------------------------------------------------
  const beforeRes = await req('GET', `${API}/demo/accounts`);
  check(beforeRes.status === 200 && beforeRes.data?.success === true,
    'GET /api/demo/accounts works without any login token');
  const acctBefore = beforeRes.data.accounts.find((a) => a.name === 'Alice Cryptographer');
  const bobBefore = beforeRes.data.accounts.find((a) => a.name === 'Bob Merchant');
  check(!!acctBefore && !!bobBefore, 'Both shared demo identities are returned');
  check(typeof beforeRes.data.storageMode === 'string' && beforeRes.data.storageMode.length > 0,
    'Storage mode is reported honestly', beforeRes.data.storageMode);
  check(!JSON.stringify(beforeRes.data).includes('PRIVATE KEY'), 'No private keys in demo accounts response');

  const created = await req('POST', `${API}/transactions`, {
    sender: 'Alice Cryptographer',
    receiver: 'Bob Merchant',
    amount: 250,
    currency: 'INR',
  });
  check(created.status === 201, 'Valid demo transfer created (no auth required)', `got ${created.status}`);
  const txId = created.data?.transaction?.transactionId;
  check(!!txId, 'Transaction ID returned');

  const afterCreate = await req('GET', `${API}/demo/accounts`);
  const aliceAfterCreate = afterCreate.data.accounts.find((a) => a.name === 'Alice Cryptographer');
  check(
    aliceAfterCreate.balance === acctBefore.balance,
    'Balance is NOT changed at creation time',
    `before=${acctBefore.balance} after=${aliceAfterCreate.balance}`
  );

  const processed = await req('POST', `${API}/transactions/${txId}/process`, {});
  check(processed.status === 200 && processed.data?.status === 'COMPLETED',
    'Server processes the transaction', `status=${processed.status}`);

  const afterProcess = await req('GET', `${API}/demo/accounts`);
  const aliceAfter = afterProcess.data.accounts.find((a) => a.name === 'Alice Cryptographer');
  const bobAfter = afterProcess.data.accounts.find((a) => a.name === 'Bob Merchant');
  check(
    Math.abs(aliceAfter.balance - (acctBefore.balance - 250)) < 0.005,
    'Sender debited exactly once at processing',
    `expected ${acctBefore.balance - 250}, got ${aliceAfter.balance}`
  );
  check(
    Math.abs(bobAfter.balance - (bobBefore.balance + 250)) < 0.005,
    'Receiver credited exactly once at processing',
    `expected ${bobBefore.balance + 250}, got ${bobAfter.balance}`
  );

  // Replay must not move money a second time
  const replayed = await req('POST', `${API}/transactions/${txId}/process`, {});
  check(
    replayed.status === 400 || replayed.status === 409,
    'Duplicate submission rejected',
    `got ${replayed.status}`
  );
  const afterReplay = await req('GET', `${API}/demo/accounts`);
  const aliceAfterReplay = afterReplay.data.accounts.find((a) => a.name === 'Alice Cryptographer');
  check(
    Math.abs(aliceAfterReplay.balance - aliceAfter.balance) < 0.005,
    'Replay attempt did NOT move any additional funds'
  );

  // ---------------------------------------------------------------------
  console.log('\n--- 4. Authoritative server-side status endpoint ---');
  // ---------------------------------------------------------------------
  const statusReal = await req('GET', `${API}/transactions/${txId}/status`);
  check(statusReal.status === 200 && statusReal.data?.exists === true,
    'Existing transaction reported as found');
  check(
    statusReal.data?.serverStatus === 'COMPLETED' && statusReal.data?.approved === true,
    'Processed transaction reported COMPLETED / approved',
    `got ${statusReal.data?.serverStatus}`
  );

  const statusFake = await req('GET', `${API}/transactions/TX-NONEXISTENT-404/status`);
  check(
    statusFake.status === 200 && statusFake.data?.exists === false &&
      statusFake.data?.serverStatus === 'NOT_FOUND' && statusFake.data?.approved === false,
    'Unknown transaction reported NOT_FOUND / not approved'
  );

  // ---------------------------------------------------------------------
  console.log('\n--- 5. Fake payment confirmation vs server truth ---');
  // ---------------------------------------------------------------------
  const fakeClaim = await req('POST', `${API}/attacks/fake-confirmation`, {
    transactionId: 'TX-FAKE-RECEIPT-999',
    claimedStatus: 'COMPLETED',
    claimedAmount: 5000,
  });
  check(fakeClaim.status === 200, 'Fake confirmation endpoint responds 200');
  check(fakeClaim.data?.claimVerified === false && fakeClaim.data?.attackDetected === true,
    'Fake receipt for unknown transaction is exposed');
  check(fakeClaim.data?.server?.serverStatus === 'NOT_FOUND',
    'Server reports NOT_FOUND for the fake receipt');

  const realClaim = await req('POST', `${API}/attacks/fake-confirmation`, {
    transactionId: txId,
    claimedStatus: 'COMPLETED',
    claimedAmount: 250,
  });
  check(realClaim.data?.claimVerified === true && realClaim.data?.attackDetected === false,
    'Accurate claim about a real processed payment is confirmed by the server');

  const pendingCreated = await req('POST', `${API}/transactions`, {
    sender: 'Bob Merchant',
    receiver: 'Alice Cryptographer',
    amount: 10,
    currency: 'INR',
  });
  const pendingId = pendingCreated.data?.transaction?.transactionId;
  const pendingClaim = await req('POST', `${API}/attacks/fake-confirmation`, {
    transactionId: pendingId,
    claimedStatus: 'COMPLETED',
  });
  check(
    pendingClaim.data?.claimVerified === false && pendingClaim.data?.server?.serverStatus === 'PENDING',
    'A "success" claim about an unprocessed (PENDING) payment is rejected'
  );

  // ---------------------------------------------------------------------
  console.log('\n--- 6. No secrets or private keys in API responses ---');
  // ---------------------------------------------------------------------
  const detail = await req('GET', `${API}/transactions/${txId}`);
  const list = await req('GET', `${API}/transactions?limit=5`);
  const metrics = await req('GET', `${API}/dashboard/security-summary`);
  const logs = await req('GET', `${API}/security/logs?limit=20`);
  const combined = JSON.stringify([detail.data, list.data, metrics.data, logs.data, created.data]);

  check(!combined.includes('gateway_shared_hmac_master_secret'), 'No hardcoded HMAC secret in responses');
  check(!combined.includes('super_secret_cryptographic_jwt'), 'No JWT secret in responses');
  check(!combined.includes('BEGIN PRIVATE KEY') && !combined.includes('BEGIN RSA PRIVATE KEY'),
    'No private keys in responses');
  check(!combined.includes('hmacSecret') && !combined.includes('"password"'),
    'No hmacSecret / password fields in responses');
  check(detail.data?.transaction?.hmacSecret === undefined, 'HMAC secret is not stored on the transaction');

  // ---------------------------------------------------------------------
  console.log('\n--- 7. Storage mode + health reporting ---');
  // ---------------------------------------------------------------------
  const health = await req('GET', `${API}/health`);
  check(health.status === 200 && typeof health.data?.storageMode === 'string',
    'Health endpoint reports storage mode', health.data?.storageMode);
  check(health.data?.authMode?.includes('DEMO'),
    'Health endpoint documents demo (no-login) auth mode');

  // ---------------------------------------------------------------------
  console.log('\n--- 8. Production fail-safe (spawned production instance) ---');
  // ---------------------------------------------------------------------
  const child = spawn(process.execPath, [path.join(__dirname, 'src', 'server.js')], {
    env: {
      ...process.env,
      PORT: '5001',
      NODE_ENV: 'production',
      MONGODB_URI: 'mongodb://127.0.0.1:27017/securepay_prod_guard_test',
    },
    stdio: 'ignore',
  });

  try {
    const up = await waitFor('http://127.0.0.1:5001/api/health');
    check(up, 'Production-mode instance started on port 5001');

    if (up) {
      const prodReset = await req('POST', 'http://127.0.0.1:5001/api/security/reset', {});
      check(prodReset.status === 403 && prodReset.data?.reason === 'RESET_DISABLED_IN_PRODUCTION',
        'Destructive reset is refused in production (HTTP 403)',
        `got ${prodReset.status} ${prodReset.data?.reason}`);

      // HMAC_SECRET is intentionally unset -> payment creation must fail safely
      const prodCreate = await req('POST', 'http://127.0.0.1:5001/api/transactions', {
        sender: 'Alice Cryptographer',
        receiver: 'Bob Merchant',
        amount: 10,
      });
      check(
        prodCreate.status === 503 && prodCreate.data?.reason === 'HMAC_SECRET_NOT_CONFIGURED',
        'Missing HMAC secret fails safely with HTTP 503 in production',
        `got ${prodCreate.status} ${prodCreate.data?.reason}`
      );

      const prodLogin = await req('POST', 'http://127.0.0.1:5001/api/auth/login', {
        email: 'nobody@example.com',
        password: 'irrelevant',
      });
      check(prodLogin.status === 401 || prodLogin.status === 503,
        'Production login without JWT_SECRET never authenticates (401/503)',
        `got ${prodLogin.status}`);
    }
  } finally {
    child.kill();
  }

  // ---------------------------------------------------------------------
  console.log('\n====================================================');
  console.log(`SECURITY FIX SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error('Suite crashed:', err);
  process.exit(1);
});
