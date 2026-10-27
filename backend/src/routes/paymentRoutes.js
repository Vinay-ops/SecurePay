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

const optionalAuth = (req, res, next) => {
  if (req.headers.authorization) {
    return protect(req, res, next);
  }
  req.user = { name: 'Alice Cryptographer', role: 'user' };
  next();
};

router.post('/', optionalAuth, createTransaction);
router.post('/create', optionalAuth, createTransaction);
router.post('/execute', optionalAuth, createTransaction);
router.post('/prepare', optionalAuth, createTransaction);
router.post('/:transactionId/process', processTransaction);
router.post('/:transactionId/verify-security', verifyTransactionCombinedSecurity);
router.post('/:transactionId/verify-integrity', verifyTransactionIntegrity);
router.post('/:transactionId/verify-hmac', verifyTransactionHMAC);
router.post('/:transactionId/verify-signature', verifyTransactionSignature);
router.get('/', getTransactions);
router.get('/:id/status', getTransactionStatus);
router.get('/:id', getTransactionById);

module.exports = router;
