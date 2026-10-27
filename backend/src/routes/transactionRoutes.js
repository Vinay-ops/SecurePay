const express = require('express');
const router = express.Router();
const {
  createTransaction,
  processTransaction,
  verifyTransactionIntegrity,
  verifyTransactionHMAC,
  verifyTransactionSignature,
  verifyTransactionCombinedSecurity,
  getTransactions,
  getTransactionById,
  getTransactionStatus,
} = require('../controllers/paymentController');
const { protect } = require('../middleware/authMiddleware');

// Optional auth protection (allows both logged in and guest educational requests)
const optionalAuth = (req, res, next) => {
  if (req.headers.authorization) {
    return protect(req, res, next);
  }
  req.user = { name: 'Alice Cryptographer', role: 'user' };
  next();
};

// 1. Create a payment transaction (SHA-256 + HMAC-SHA-256 + RSA-2048 Digital Signature)
router.post('/', optionalAuth, createTransaction);
router.post('/create', optionalAuth, createTransaction);

// 2. Process / Submit transaction with Nonce + Timestamp Anti-Replay Check
router.post('/:transactionId/process', processTransaction);

// 3. Combined Comprehensive Security Verification (All 5 security pillars)
router.post('/:transactionId/verify-security', verifyTransactionCombinedSecurity);
router.get('/:transactionId/verify-security', verifyTransactionCombinedSecurity);

// 4. Verify SHA-256 integrity of a transaction by ID
router.post('/:transactionId/verify-integrity', verifyTransactionIntegrity);
router.get('/:transactionId/verify-integrity', verifyTransactionIntegrity);

// 5. Verify HMAC-SHA-256 authentication & integrity of a transaction by ID
router.post('/:transactionId/verify-hmac', verifyTransactionHMAC);
router.get('/:transactionId/verify-hmac', verifyTransactionHMAC);

// 6. Verify RSA-2048 Digital Signature for sender authentication and non-repudiation
router.post('/:transactionId/verify-signature', verifyTransactionSignature);
router.get('/:transactionId/verify-signature', verifyTransactionSignature);

// Query transactions
router.get('/', getTransactions);

// Authoritative server-side status (must be registered before '/:id')
router.get('/:id/status', getTransactionStatus);
router.get('/:id', getTransactionById);

module.exports = router;
