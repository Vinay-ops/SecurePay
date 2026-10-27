const crypto = require('crypto');
const {
  canonicalize,
  buildTransactionPayload,
  hashSHA256,
  verifySHA256,
  generateHMAC,
  verifyHMAC,
  generateNonce,
} = require('./src/crypto');

console.log('====================================================');
console.log('🧪 RUNNING CRYPTOGRAPHIC HMAC & SHA-256 TEST SUITE');
console.log('====================================================\n');

// Random per-run test key: no hardcoded secrets anywhere in the codebase.
const secretKey = crypto.randomBytes(32).toString('hex');

// Test Case 1: Create normal transaction -> SHA-256 valid -> HMAC valid
console.log('--- TEST 1: Normal Transaction Creation & Validation ---');
const originalPayload = buildTransactionPayload({
  transactionId: 'TX-TEST-001',
  sender: 'Alice Cryptographer',
  receiver: 'Bob Merchant',
  amount: 500.0,
  currency: 'INR',
  timestamp: 1718029990000,
  nonce: '1a2b3c4d5e6f7g8h',
});

const canonicalOriginal = canonicalize(originalPayload);
const sha256Original = hashSHA256(canonicalOriginal);
const hmacOriginal = generateHMAC(canonicalOriginal, secretKey);

console.log('Canonical Payload:', canonicalOriginal);
console.log('SHA-256 Hash:    ', sha256Original);
console.log('HMAC-SHA-256:    ', hmacOriginal);

const sha1Pass = verifySHA256(canonicalOriginal, sha256Original);
const hmac1Pass = verifyHMAC(canonicalOriginal, secretKey, hmacOriginal);

console.log('SHA-256 Valid?:  ', sha1Pass ? '✅ PASS' : '❌ FAIL');
console.log('HMAC Valid?:     ', hmac1Pass ? '✅ PASS' : '❌ FAIL');
if (!sha1Pass || !hmac1Pass) throw new Error('Test 1 Failed');

// Test Case 2: Verify unchanged transaction -> both valid
console.log('\n--- TEST 2: Verify Unchanged Transaction ---');
const recomputedCanonical = canonicalize(buildTransactionPayload({
  transactionId: 'TX-TEST-001',
  sender: 'Alice Cryptographer',
  receiver: 'Bob Merchant',
  amount: 500.0,
  currency: 'INR',
  timestamp: 1718029990000,
  nonce: '1a2b3c4d5e6f7g8h',
}));
const sha2Pass = verifySHA256(recomputedCanonical, sha256Original);
const hmac2Pass = verifyHMAC(recomputedCanonical, secretKey, hmacOriginal);
console.log('Unchanged SHA-256:', sha2Pass ? '✅ PASS' : '❌ FAIL');
console.log('Unchanged HMAC:   ', hmac2Pass ? '✅ PASS' : '❌ FAIL');
if (!sha2Pass || !hmac2Pass) throw new Error('Test 2 Failed');

// Test Case 3: Change amount (₹500 -> ₹5000) -> SHA-256 fails -> HMAC fails
console.log('\n--- TEST 3: Change Amount (₹500 -> ₹5000) ---');
const tamperedAmountPayload = buildTransactionPayload({
  transactionId: 'TX-TEST-001',
  sender: 'Alice Cryptographer',
  receiver: 'Bob Merchant',
  amount: 5000.0, // Tampered!
  currency: 'INR',
  timestamp: 1718029990000,
  nonce: '1a2b3c4d5e6f7g8h',
});
const canonicalTamperedAmount = canonicalize(tamperedAmountPayload);
const sha3Pass = verifySHA256(canonicalTamperedAmount, sha256Original);
const hmac3Pass = verifyHMAC(canonicalTamperedAmount, secretKey, hmacOriginal);
console.log('SHA-256 on Tampered Amount: (Expected False):', !sha3Pass ? '✅ CORRECTLY FAILED (PASS)' : '❌ ERROR: Passed when should fail');
console.log('HMAC on Tampered Amount:    (Expected False):', !hmac3Pass ? '✅ CORRECTLY FAILED (PASS)' : '❌ ERROR: Passed when should fail');
if (sha3Pass || hmac3Pass) throw new Error('Test 3 Failed');

// Test Case 4: Change receiver ('Bob Merchant' -> 'Mallory Attacker') -> SHA-256 fails -> HMAC fails
console.log('\n--- TEST 4: Change Receiver ---');
const tamperedReceiverPayload = buildTransactionPayload({
  transactionId: 'TX-TEST-001',
  sender: 'Alice Cryptographer',
  receiver: 'Mallory Attacker', // Tampered!
  amount: 500.0,
  currency: 'INR',
  timestamp: 1718029990000,
  nonce: '1a2b3c4d5e6f7g8h',
});
const canonicalTamperedReceiver = canonicalize(tamperedReceiverPayload);
const sha4Pass = verifySHA256(canonicalTamperedReceiver, sha256Original);
const hmac4Pass = verifyHMAC(canonicalTamperedReceiver, secretKey, hmacOriginal);
console.log('SHA-256 on Tampered Receiver: (Expected False):', !sha4Pass ? '✅ CORRECTLY FAILED (PASS)' : '❌ ERROR: Passed when should fail');
console.log('HMAC on Tampered Receiver:    (Expected False):', !hmac4Pass ? '✅ CORRECTLY FAILED (PASS)' : '❌ ERROR: Passed when should fail');
if (sha4Pass || hmac4Pass) throw new Error('Test 4 Failed');

// Test Case 5: Change Nonce or Timestamp -> HMAC fails
console.log('\n--- TEST 5: Change Nonce / Timestamp ---');
const tamperedNoncePayload = buildTransactionPayload({
  transactionId: 'TX-TEST-001',
  sender: 'Alice Cryptographer',
  receiver: 'Bob Merchant',
  amount: 500.0,
  currency: 'INR',
  timestamp: 1718029990000,
  nonce: 'modified_nonce_99', // Tampered!
});
const canonicalTamperedNonce = canonicalize(tamperedNoncePayload);
const hmac5Pass = verifyHMAC(canonicalTamperedNonce, secretKey, hmacOriginal);
console.log('HMAC on Tampered Nonce: (Expected False):', !hmac5Pass ? '✅ CORRECTLY FAILED (PASS)' : '❌ ERROR: Passed when should fail');
if (hmac5Pass) throw new Error('Test 5 Failed');

// Test Case 6: Wrong Secret Key -> HMAC fails
console.log('\n--- TEST 6: Wrong Secret Key Authentication Rejection ---');
const wrongSecretKey = 'attacker_guessed_wrong_secret_key';
const hmac6Pass = verifyHMAC(canonicalOriginal, wrongSecretKey, hmacOriginal);
console.log('HMAC with Wrong Secret: (Expected False):', !hmac6Pass ? '✅ CORRECTLY FAILED (PASS)' : '❌ ERROR: Passed when should fail');
if (hmac6Pass) throw new Error('Test 6 Failed');

console.log('\n====================================================');
console.log('🎉 ALL 6 CRYPTOGRAPHIC INTEGRITY & AUTHENTICATION TESTS PASSED!');
console.log('====================================================\n');
