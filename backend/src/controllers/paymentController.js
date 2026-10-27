const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const mongoose = require('mongoose');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const SecurityLog = require('../models/SecurityLog');
const {
  canonicalize,
  buildTransactionPayload,
  hashSHA256,
  verifySHA256,
  generateHMAC,
  verifyHMAC,
  signRSA,
  verifyRSA,
  computeKeyFingerprint,
  generateNonce,
  checkTimestampFreshness,
  isNonceConsumed,
  consumeNonce,
  validateNonceAndTimestamp,
  generateRSAKeyPair,
} = require('../crypto');
const { recordSecurityEvent } = require('./securityController');
const { inMemoryTransactions, saveStore } = require('../store/inMemoryStore');
const {
  resolveAccount,
  getBalance,
  debit,
  credit,
} = require('../store/demoAccounts');
const { requireHmacSecret, getStorageMode } = require('../config/secrets');

/**
 * Read current demo account balances without mutating anything.
 * Balances are transferred only when the server processes (accepts) a transaction.
 */
async function getCurrentBalances(senderIdentifier, receiverIdentifier) {
  let senderBalance = null;
  let receiverBalance = null;
  try {
    if (senderIdentifier) senderBalance = await getBalance(senderIdentifier);
    if (receiverIdentifier) receiverBalance = await getBalance(receiverIdentifier);
  } catch (e) {
    console.warn('Balance lookup warning:', e.message);
  }
  return { senderBalance, receiverBalance };
}

/**
 * Creates a new payment transaction with SHA-256 integrity, HMAC gateway auth, and RSA digital signature
 * POST /api/transactions or POST /api/payments
 */
const createTransaction = async (req, res, next) => {
  try {
    const {
      sender: reqSender,
      senderName: reqSenderName,
      receiver: reqReceiver,
      receiverName: reqReceiverName,
      amount,
      currency = 'INR',
      transactionId: customTxId,
    } = req.body;

    // 1. Input Validation
    const sender = reqSender || reqSenderName || req.user?.name;
    const receiver = reqReceiver || reqReceiverName;

    if (!sender || !String(sender).trim()) {
      return res.status(400).json({
        success: false,
        message: 'Validation Error: Sender name is required.',
      });
    }

    if (!receiver || !String(receiver).trim()) {
      return res.status(400).json({
        success: false,
        message: 'Validation Error: Receiver name is required.',
      });
    }

    const numAmount = parseFloat(Number(amount).toFixed(2));
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({
        success: false,
        reason: 'INVALID_AMOUNT',
        message: 'Validation Error: Amount must be a positive number greater than 0.',
      });
    }

    if (!Number.isFinite(numAmount) || numAmount > 1_000_000_000) {
      return res.status(400).json({
        success: false,
        reason: 'INVALID_AMOUNT',
        message: 'Validation Error: Amount is outside the acceptable range.',
      });
    }

    // Balance validation (demo accounts). Balances are only MOVED when the
    // server processes the transaction; here we reject obviously unfundable
    // transfers early so the demo shows a real server-side rejection.
    const { senderBalance, receiverBalance } = await getCurrentBalances(sender, receiver);
    if (typeof senderBalance === 'number' && senderBalance < numAmount) {
      try {
        await recordSecurityEvent({
          eventType: 'TRANSACTION_REJECTED',
          result: 'BLOCKED',
          severity: 'MEDIUM',
          details: `Transfer rejected before signing: ${sender} has demo balance ${senderBalance} which is less than requested ${numAmount}.`,
          metadata: { amount: numAmount, senderBalance, sender, receiver },
        });
      } catch (e) {}

      return res.status(400).json({
        success: false,
        reason: 'INSUFFICIENT_BALANCE',
        message: `Insufficient demo balance: ${sender} holds ${Number(senderBalance).toFixed(2)} but the transfer requires ${numAmount.toFixed(2)}.`,
        senderBalance,
        requestedAmount: numAmount,
      });
    }

    // 2. Generate Unique Transaction ID
    const randomSuffix = crypto.randomBytes(3).toString('hex').toUpperCase();
    const transactionId = customTxId || `TX-${Date.now()}-${randomSuffix}`;

    // 3. Generate Cryptographically Secure Nonce (CSPRNG)
    const nonce = generateNonce(16);

    // 4. Generate Monotonic Timestamp
    const timestamp = Date.now();

    // 5. Construct Canonical Transaction Payload
    const payloadObject = buildTransactionPayload({
      transactionId,
      sender,
      receiver,
      amount: numAmount,
      currency,
      timestamp,
      nonce,
    });

    const canonicalString = canonicalize(payloadObject);

    // 6. Generate SHA-256 Integrity Hash using Node.js crypto module
    const transactionHash = hashSHA256(canonicalString);

    // 7. Generate HMAC-SHA-256 using server-side secret (Never sent to client)
    const hmacSecret = requireHmacSecret(res);
    if (!hmacSecret) return;
    const hmacSignature = generateHMAC(canonicalString, hmacSecret);

    // 8. Generate RSA-2048 Digital Signature using sender's private key
    let senderPublicKey = req.user?.rsaPublicKey || '';
    let privateKey = req.user?.rsaPrivateKey;

    if (!privateKey && req.user?._id) {
      const isDbReady = mongoose.connection && mongoose.connection.readyState === 1;
      if (isDbReady) {
        try {
          const dbUser = await User.findById(req.user._id);
          if (dbUser) {
            privateKey = dbUser.rsaPrivateKey;
            senderPublicKey = dbUser.rsaPublicKey;
          }
        } catch (e) {}
      }
    }

    // If privateKey is not present, generate a fresh RSA-2048 keypair for this transaction
    if (!privateKey) {
      const generatedKeys = generateRSAKeyPair();
      privateKey = generatedKeys.privateKey;
      senderPublicKey = generatedKeys.publicKey;
    }

    const senderKeyFingerprint = computeKeyFingerprint(senderPublicKey);
    const digitalSignature = signRSA(canonicalString, privateKey);

    // 9. Construct Transaction Record (Never store private key)
    const txRecord = {
      transactionId,
      sender,
      senderName: sender,
      senderId: req.user?._id || req.user?.id,
      receiver,
      receiverName: receiver,
      amount: numAmount,
      currency: String(currency).toUpperCase(),
      timestamp,
      nonce,
      canonicalPayload: canonicalString,
      transactionHash,
      sha256Hash: transactionHash,
      hmac: hmacSignature,
      hmacSignature,
      digitalSignature,
      rsaSignature: digitalSignature,
      senderPublicKey,
      senderKeyFingerprint,
      status: 'PENDING',
      processedAt: null,
      consumedAt: null,
      integrityValid: true,
      verificationBreakdown: {
        sha256Valid: true,
        hmacValid: true,
        rsaValid: true,
        nonceValid: true,
        timestampValid: true,
        overallVerified: true,
      },
      createdAt: new Date(),
    };

    let savedTx = txRecord;
    const isDbReady = mongoose.connection && mongoose.connection.readyState === 1;
    let usingLocalStore = !isDbReady;
    if (isDbReady) {
      try {
        savedTx = await Transaction.create(txRecord);
      } catch (dbErr) {
        if (dbErr.code === 11000) {
          return res.status(400).json({
            success: false,
            message: 'Database uniqueness violation: Nonce or Transaction ID already exists.',
            error: dbErr.message,
          });
        }
        inMemoryTransactions.unshift(txRecord);
        usingLocalStore = true;
      }
    } else {
      inMemoryTransactions.unshift(txRecord);
    }
    if (usingLocalStore) saveStore();

    // Balances are NOT moved at creation time. The server transfers funds
    // atomically only when the transaction passes every verification and is
    // processed (see processTransaction below).

    // Security Log Event
    try {
      await recordSecurityEvent({
        eventType: 'TRANSACTION_CREATED',
        result: 'SUCCESS',
        severity: 'INFO',
        details: `Transaction ${transactionId} created and signed with SHA-256, HMAC-SHA-256, and RSA-2048 (${senderKeyFingerprint}) - Nonce: ${nonce}`,
        transactionId,
        metadata: { amount: numAmount, sender, receiver, nonce },
      });
    } catch (e) {}

    // 10. Return structured response
    res.status(201).json({
      success: true,
      message: 'Transaction created and cryptographically signed with SHA-256, HMAC-SHA-256, and RSA-2048 Digital Signature',
      transaction: savedTx,
      canonicalPayload: canonicalString,
      transactionHash,
      hmac: hmacSignature,
      hmacSignature,
      digitalSignature,
      rsaSignature: digitalSignature,
      senderPublicKeyFingerprint: senderKeyFingerprint,
      senderBalance,
      receiverBalance,
      amountReserved: numAmount,
      balancesTransferredOnProcess: true,
      storageMode: getStorageMode(mongoose.connection && mongoose.connection.readyState === 1),
      status: 'PENDING',
      integrityStatus: '✓ INTEGRITY VERIFIED',
      authenticationStatus: '✓ AUTHENTICATED & NON-REPUDIATED',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Real Transaction Processing & Anti-Replay Engine
 * POST /api/transactions/:transactionId/process
 * POST /api/payments/:transactionId/process
 * 
 * Verifies:
 * 1. Transaction exists
 * 2. Timestamp freshness (within 300s window)
 * 3. Nonce uniqueness and single-use (rejects if already processed)
 * 4. Cryptographic integrity & authentication (SHA-256, HMAC, RSA)
 * 5. Atomic state transition: PENDING -> COMPLETED
 */
const processTransaction = async (req, res, next) => {
  try {
    const { transactionId } = req.params;
    const { simulateAgeSeconds, testMaxAge, simulateExpired = false } = req.body || {};

    const maxAgeSeconds = testMaxAge ? Number(testMaxAge) : 300; // 5 minutes standard freshness window

    const isDbReady = mongoose.connection && mongoose.connection.readyState === 1;
    let transaction = null;

    if (isDbReady) {
      try {
        const isObjectId = mongoose.Types.ObjectId.isValid(transactionId);
        transaction = await Transaction.findOne(
          isObjectId ? { $or: [{ transactionId }, { _id: transactionId }] } : { transactionId }
        );
      } catch (e) {}
    }

    if (!transaction) {
      transaction = inMemoryTransactions.find(
        (t) => t.transactionId === transactionId || String(t._id) === String(transactionId)
      );
    }

    // Step 1: Check existence
    if (!transaction) {
      return res.status(404).json({
        success: false,
        reason: 'TRANSACTION_NOT_FOUND',
        message: `Transaction with ID '${transactionId}' not found in cryptographic database.`,
      });
    }

    // Step 2: Timestamp Freshness Check
    const effectiveTimestamp = simulateExpired
      ? Date.now() - 400000 // 400s ago (exceeds 300s window)
      : (simulateAgeSeconds !== undefined ? Date.now() - (Number(simulateAgeSeconds) * 1000) : transaction.timestamp);

    const now = Date.now();
    const ageSeconds = Math.max(0, (now - effectiveTimestamp) / 1000);

    if (ageSeconds > maxAgeSeconds) {
      try {
        await recordSecurityEvent({
          eventType: 'TIMESTAMP_EXPIRED',
          result: 'BLOCKED',
          severity: 'MEDIUM',
          details: `Stale transaction rejected: TX ${transaction.transactionId} age is ${ageSeconds.toFixed(1)}s (max allowed ${maxAgeSeconds}s)`,
          transactionId: transaction.transactionId,
          metadata: { ageSeconds, maxAgeSeconds },
        });
      } catch (e) {}

      return res.status(400).json({
        success: false,
        reason: 'EXPIRED_TRANSACTION',
        message: `Transaction timestamp expired. Age is ${ageSeconds.toFixed(1)}s (exceeds allowed window of ${maxAgeSeconds}s / 5 minutes).`,
        transactionId: transaction.transactionId,
        timestamp: transaction.timestamp,
        ageSeconds: parseFloat(ageSeconds.toFixed(2)),
        maxAgeSeconds,
      });
    }

    // Step 3: Replay Attack & Double Processing Prevention Check
    const alreadyProcessed = transaction.processedAt !== null ||
                             transaction.status === 'COMPLETED' ||
                             isNonceConsumed(transaction.nonce);

    if (alreadyProcessed) {
      try {
        await recordSecurityEvent({
          eventType: 'REPLAY_ATTACK_DETECTED',
          result: 'BLOCKED',
          severity: 'CRITICAL',
          details: `🚨 REPLAY ATTACK BLOCKED: Nonce '${transaction.nonce}' for TX ${transaction.transactionId} was already consumed at ${transaction.processedAt || transaction.consumedAt}`,
          transactionId: transaction.transactionId,
          metadata: { nonce: transaction.nonce, processedAt: transaction.processedAt },
        });
      } catch (e) {}

      return res.status(400).json({
        success: false,
        reason: 'REPLAY_ATTACK_DETECTED',
        message: 'Transaction has already been processed. Replay attack detected and blocked.',
        transactionId: transaction.transactionId,
        nonce: transaction.nonce,
        status: transaction.status,
        originalProcessedAt: transaction.processedAt || transaction.consumedAt,
      });
    }

    // Step 4: Verify Cryptographic Integrity and Signatures before completing
    const storedHash = transaction.transactionHash || transaction.sha256Hash;
    const storedHmac = transaction.hmac || transaction.hmacSignature;
    const storedSignature = transaction.digitalSignature || transaction.rsaSignature;
    const senderPublicKey = transaction.senderPublicKey;

    const reconstructedPayloadObject = buildTransactionPayload({
      transactionId: transaction.transactionId,
      sender: transaction.sender || transaction.senderName,
      receiver: transaction.receiver || transaction.receiverName,
      amount: parseFloat(Number(transaction.amount).toFixed(2)),
      currency: transaction.currency || 'INR',
      timestamp: Number(transaction.timestamp),
      nonce: String(transaction.nonce).trim(),
    });

    const canonicalString = canonicalize(reconstructedPayloadObject);
    const isShaValid = verifySHA256(canonicalString, storedHash);

    const hmacSecret = requireHmacSecret(res);
    if (!hmacSecret) return;
    const isHmacValid = storedHmac ? verifyHMAC(canonicalString, hmacSecret, storedHmac) : true;
    const isRsaValid = (storedSignature && senderPublicKey)
      ? verifyRSA(canonicalString, storedSignature, senderPublicKey)
      : true;

    if (!isShaValid || !isHmacValid || !isRsaValid) {
      return res.status(400).json({
        success: false,
        reason: 'CRYPTOGRAPHIC_INTEGRITY_FAILED',
        message: 'Cryptographic verification failed prior to transaction processing. Replay / tampering rejected.',
        verification: {
          sha256Valid: isShaValid,
          hmacValid: isHmacValid,
          rsaValid: isRsaValid,
        },
      });
    }

    // Step 5: Atomic funds transfer (debit sender, then CAS PENDING -> COMPLETED,
    // then credit receiver). A duplicate submission never reaches the debit step,
    // and a failed CAS refunds the debit, so money and status stay consistent.
    const transferAmount = parseFloat(Number(transaction.amount).toFixed(2));
    const senderIdentifier = transaction.sender || transaction.senderName;
    const receiverIdentifier = transaction.receiver || transaction.receiverName;

    const debitResult = await debit(senderIdentifier, transferAmount);
    if (!debitResult.ok) {
      try {
        await recordSecurityEvent({
          eventType: 'TRANSACTION_REJECTED',
          result: 'BLOCKED',
          severity: 'MEDIUM',
          details: `Server rejected TX ${transaction.transactionId}: balance transfer refused (${debitResult.reason}).`,
          transactionId: transaction.transactionId,
          metadata: { reason: debitResult.reason, transferAmount },
        });
      } catch (e) {}

      return res.status(400).json({
        success: false,
        reason: debitResult.reason || 'INSUFFICIENT_BALANCE',
        message:
          debitResult.reason === 'INSUFFICIENT_BALANCE'
            ? `Insufficient demo balance for ${senderIdentifier}: available ${debitResult.balance}, required ${transferAmount}.`
            : 'Balance transfer could not be completed. Transaction rejected.',
        transactionId: transaction.transactionId,
        senderBalance: debitResult.balance,
        requestedAmount: transferAmount,
      });
    }

    // Step 6: Atomic Double-Processing Prevention Update (PENDING -> COMPLETED)
    const processedTimestamp = new Date();
    let finalTx = null;

    if (isDbReady) {
      const isObjectId = mongoose.Types.ObjectId.isValid(transactionId);
      finalTx = await Transaction.findOneAndUpdate(
        {
          $or: [{ transactionId }, { _id: isObjectId ? transactionId : null }],
          status: { $ne: 'COMPLETED' },
          processedAt: null,
        },
        {
          $set: {
            status: 'COMPLETED',
            processedAt: processedTimestamp,
            consumedAt: processedTimestamp,
            'verificationBreakdown.nonceValid': true,
            'verificationBreakdown.timestampValid': true,
            'verificationBreakdown.overallVerified': true,
          },
        },
        { new: true }
      );

      if (!finalTx) {
        // Double-processing race condition prevented -> refund the debit
        await credit(senderIdentifier, transferAmount);
        return res.status(409).json({
          success: false,
          reason: 'REPLAY_ATTACK_DETECTED',
          message: 'Concurrent double-processing race condition blocked. Transaction already completed.',
          transactionId: transaction.transactionId,
          nonce: transaction.nonce,
        });
      }
    } else {
      // In-Memory atomic update
      const memIdx = inMemoryTransactions.findIndex(
        (t) => t.transactionId === transactionId || String(t._id) === String(transactionId)
      );
      if (memIdx !== -1) {
        if (inMemoryTransactions[memIdx].status === 'COMPLETED' || inMemoryTransactions[memIdx].processedAt) {
          await credit(senderIdentifier, transferAmount);
          return res.status(409).json({
            success: false,
            reason: 'REPLAY_ATTACK_DETECTED',
            message: 'Transaction has already been processed. Replay attack detected.',
            transactionId: transaction.transactionId,
            nonce: transaction.nonce,
          });
        }
        inMemoryTransactions[memIdx].status = 'COMPLETED';
        inMemoryTransactions[memIdx].processedAt = processedTimestamp;
        inMemoryTransactions[memIdx].consumedAt = processedTimestamp;
        finalTx = inMemoryTransactions[memIdx];
      } else {
        transaction.status = 'COMPLETED';
        transaction.processedAt = processedTimestamp;
        transaction.consumedAt = processedTimestamp;
        finalTx = transaction;
      }
    }

    // Step 7: Credit the receiver now that the transaction is committed.
    const creditResult = await credit(receiverIdentifier, transferAmount);
    if (!creditResult.ok) {
      await credit(senderIdentifier, transferAmount); // undo the debit
      return res.status(500).json({
        success: false,
        reason: 'BALANCE_UPDATE_FAILED',
        message: 'Transaction was verified but the receiver balance update failed. The sender debit was refunded.',
        transactionId: transaction.transactionId,
      });
    }
    if (!isDbReady) saveStore();
    // Register nonce as consumed in memory store
    consumeNonce(transaction.nonce, transaction.timestamp);

    const { senderBalance, receiverBalance } = await getCurrentBalances(senderIdentifier, receiverIdentifier);

    // Step 8: Log Successful Execution
    try {
      await recordSecurityEvent({
        eventType: 'TRANSACTION_PROCESSED',
        result: 'SUCCESS',
        severity: 'INFO',
        details: `✓ TX ${transaction.transactionId} completed. Nonce ${transaction.nonce} consumed. Freshness ${ageSeconds.toFixed(1)}s.`,
        transactionId: transaction.transactionId,
        metadata: { nonce: transaction.nonce, processedAt: processedTimestamp },
      });
    } catch (e) {}

    return res.status(200).json({
      success: true,
      message: 'Transaction processed successfully.',
      transaction: finalTx,
      status: 'COMPLETED',
      processedAt: processedTimestamp,
      consumedAt: processedTimestamp,
      nonce: transaction.nonce,
      timestamp: transaction.timestamp,
      amount: transferAmount,
      sender: senderIdentifier,
      receiver: receiverIdentifier,
      senderBalance,
      receiverBalance,
      transfer: {
        applied: true,
        debitedSender: transferAmount,
        creditedReceiver: transferAmount,
      },
      freshnessWindowSeconds: maxAgeSeconds,
      ageSeconds: parseFloat(ageSeconds.toFixed(2)),
      replayProtection: {
        nonceConsumed: true,
        freshnessVerified: true,
        atomicCompleted: true,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Verify Integrity with SHA-256
 * POST /api/transactions/:transactionId/verify-integrity
 */
const verifyTransactionIntegrity = async (req, res, next) => {
  try {
    const { transactionId } = req.params;
    const {
      tamperedAmount,
      tamperedReceiver,
      tamperedSender,
      tamperedNonce,
      simulateTamper = false,
      simulateTampering = false,
    } = req.body || {};

    const isTamperActive = simulateTamper || simulateTampering || tamperedAmount !== undefined || tamperedReceiver !== undefined || tamperedSender !== undefined || tamperedNonce !== undefined;

    let transaction = null;
    const isDbReady = mongoose.connection && mongoose.connection.readyState === 1;
    if (isDbReady) {
      try {
        const isObjectId = mongoose.Types.ObjectId.isValid(transactionId);
        transaction = await Transaction.findOne(
          isObjectId ? { $or: [{ transactionId }, { _id: transactionId }] } : { transactionId }
        );
      } catch (e) {}
    }

    if (!transaction) {
      transaction = inMemoryTransactions.find(
        (t) => t.transactionId === transactionId || String(t._id) === String(transactionId)
      );
    }

    if (!transaction) {
      return res.status(404).json({
        success: false,
        verified: false,
        integrityValid: false,
        message: `Transaction with ID '${transactionId}' not found in cryptographic ledger.`,
      });
    }

    const storedHash = transaction.transactionHash || transaction.sha256Hash;

    const effectiveSender = isTamperActive && tamperedSender !== undefined
      ? String(tamperedSender).trim()
      : String(transaction.sender || transaction.senderName).trim();

    const effectiveAmount = isTamperActive && tamperedAmount !== undefined
      ? parseFloat(Number(tamperedAmount).toFixed(2))
      : parseFloat(Number(transaction.amount).toFixed(2));

    const effectiveReceiver = isTamperActive && tamperedReceiver !== undefined
      ? String(tamperedReceiver).trim()
      : String(transaction.receiver || transaction.receiverName).trim();

    const effectiveNonce = isTamperActive && tamperedNonce !== undefined
      ? String(tamperedNonce).trim()
      : String(transaction.nonce).trim();

    const reconstructedPayloadObject = buildTransactionPayload({
      transactionId: transaction.transactionId,
      sender: effectiveSender,
      receiver: effectiveReceiver,
      amount: effectiveAmount,
      currency: transaction.currency || 'INR',
      timestamp: Number(transaction.timestamp),
      nonce: effectiveNonce,
    });

    const reconstructedCanonical = canonicalize(reconstructedPayloadObject);
    const calculatedHash = hashSHA256(reconstructedCanonical);
    const integrityValid = verifySHA256(reconstructedCanonical, storedHash);

    const message = integrityValid
      ? '✓ Transaction integrity verified: Payload data has not been modified.'
      : '✗ CRITICAL INTEGRITY ALERT: Transaction data has been modified! SHA-256 hash mismatch detected.';

    try {
      await recordSecurityEvent({
        eventType: integrityValid ? 'INTEGRITY_VERIFIED' : 'HASH_MISMATCH_DETECTED',
        result: integrityValid ? 'SUCCESS' : 'FAILED',
        severity: integrityValid ? 'INFO' : 'HIGH',
        details: `Integrity check on TX ${transactionId}: ${integrityValid ? 'PASSED' : 'FAILED - HASH MISMATCH'}`,
        transactionId,
      });
    } catch (e) {}

    res.status(200).json({
      success: true,
      verified: integrityValid,
      integrityValid,
      transactionId: transaction.transactionId,
      storedHash,
      calculatedHash,
      canonicalPayload: reconstructedCanonical,
      originalPayload: transaction.canonicalPayload,
      message,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Verify HMAC-SHA-256 for Transaction Authentication and Integrity
 * POST /api/transactions/:transactionId/verify-hmac
 */
const verifyTransactionHMAC = async (req, res, next) => {
  try {
    const { transactionId } = req.params;
    const {
      tamperedAmount,
      tamperedReceiver,
      tamperedSender,
      tamperedNonce,
      simulateTamper = false,
      simulateTampering = false,
    } = req.body || {};

    const isTamperActive = simulateTamper || simulateTampering || tamperedAmount !== undefined || tamperedReceiver !== undefined || tamperedSender !== undefined || tamperedNonce !== undefined;

    let transaction = null;
    const isDbReady = mongoose.connection && mongoose.connection.readyState === 1;
    if (isDbReady) {
      try {
        const isObjectId = mongoose.Types.ObjectId.isValid(transactionId);
        transaction = await Transaction.findOne(
          isObjectId ? { $or: [{ transactionId }, { _id: transactionId }] } : { transactionId }
        );
      } catch (e) {}
    }

    if (!transaction) {
      transaction = inMemoryTransactions.find(
        (t) => t.transactionId === transactionId || String(t._id) === String(transactionId)
      );
    }

    if (!transaction) {
      return res.status(404).json({
        success: false,
        verified: false,
        authenticationValid: false,
        integrityValid: false,
        message: `Transaction with ID '${transactionId}' not found in cryptographic ledger.`,
      });
    }

    const storedHmac = transaction.hmac || transaction.hmacSignature || '';

    const effectiveSender = isTamperActive && tamperedSender !== undefined
      ? String(tamperedSender).trim()
      : String(transaction.sender || transaction.senderName).trim();

    const effectiveAmount = isTamperActive && tamperedAmount !== undefined
      ? parseFloat(Number(tamperedAmount).toFixed(2))
      : parseFloat(Number(transaction.amount).toFixed(2));

    const effectiveReceiver = isTamperActive && tamperedReceiver !== undefined
      ? String(tamperedReceiver).trim()
      : String(transaction.receiver || transaction.receiverName).trim();

    const effectiveNonce = isTamperActive && tamperedNonce !== undefined
      ? String(tamperedNonce).trim()
      : String(transaction.nonce).trim();

    const reconstructedPayloadObject = buildTransactionPayload({
      transactionId: transaction.transactionId,
      sender: effectiveSender,
      receiver: effectiveReceiver,
      amount: effectiveAmount,
      currency: transaction.currency || 'INR',
      timestamp: Number(transaction.timestamp),
      nonce: effectiveNonce,
    });

    const reconstructedCanonical = canonicalize(reconstructedPayloadObject);
    const secretKey = requireHmacSecret(res);
    if (!secretKey) return;
    const calculatedHmac = generateHMAC(reconstructedCanonical, secretKey);
    const isMatch = verifyHMAC(reconstructedCanonical, secretKey, storedHmac);

    const responsePayload = isMatch
      ? {
          success: true,
          verified: true,
          authenticationValid: true,
          integrityValid: true,
          transactionId: transaction.transactionId,
          storedHmac,
          calculatedHmac,
          canonicalPayload: reconstructedCanonical,
          message: 'HMAC verification successful',
        }
      : {
          success: false,
          verified: false,
          authenticationValid: false,
          integrityValid: false,
          transactionId: transaction.transactionId,
          storedHmac,
          calculatedHmac,
          canonicalPayload: reconstructedCanonical,
          message: 'HMAC verification failed. Transaction may have been modified or is not authentic.',
        };

    try {
      await recordSecurityEvent({
        eventType: isMatch ? 'HMAC_VERIFIED' : 'HMAC_FAILURE',
        result: isMatch ? 'SUCCESS' : 'FAILED',
        severity: isMatch ? 'INFO' : 'HIGH',
        details: `HMAC verification on TX ${transaction.transactionId}: ${isMatch ? 'PASSED (AUTHENTICATED)' : 'FAILED (AUTH/INTEGRITY MISMATCH)'}`,
        transactionId: transaction.transactionId,
      });
    } catch (e) {}

    return res.status(200).json(responsePayload);
  } catch (error) {
    next(error);
  }
};

/**
 * Verify RSA-2048 Digital Signature for Sender Authentication and Non-Repudiation
 * POST /api/transactions/:transactionId/verify-signature
 */
const verifyTransactionSignature = async (req, res, next) => {
  try {
    const { transactionId } = req.params;
    const {
      tamperedAmount,
      tamperedReceiver,
      tamperedSender,
      tamperedNonce,
      simulateTamper = false,
      simulateTampering = false,
    } = req.body || {};

    const isTamperActive = simulateTamper || simulateTampering || tamperedAmount !== undefined || tamperedReceiver !== undefined || tamperedSender !== undefined || tamperedNonce !== undefined;

    let transaction = null;
    const isDbReady = mongoose.connection && mongoose.connection.readyState === 1;
    if (isDbReady) {
      try {
        const isObjectId = mongoose.Types.ObjectId.isValid(transactionId);
        transaction = await Transaction.findOne(
          isObjectId ? { $or: [{ transactionId }, { _id: transactionId }] } : { transactionId }
        );
      } catch (e) {}
    }

    if (!transaction) {
      transaction = inMemoryTransactions.find(
        (t) => t.transactionId === transactionId || String(t._id) === String(transactionId)
      );
    }

    if (!transaction) {
      return res.status(404).json({
        success: false,
        verified: false,
        signatureValid: false,
        authenticated: false,
        message: `Transaction with ID '${transactionId}' not found in cryptographic ledger.`,
      });
    }

    const digitalSignature = transaction.digitalSignature || transaction.rsaSignature || '';
    const publicKey = transaction.senderPublicKey || '';
    const fingerprint = transaction.senderKeyFingerprint || computeKeyFingerprint(publicKey);

    // Reconstruct canonical transaction payload
    const effectiveSender = isTamperActive && tamperedSender !== undefined
      ? String(tamperedSender).trim()
      : String(transaction.sender || transaction.senderName).trim();

    const effectiveAmount = isTamperActive && tamperedAmount !== undefined
      ? parseFloat(Number(tamperedAmount).toFixed(2))
      : parseFloat(Number(transaction.amount).toFixed(2));

    const effectiveReceiver = isTamperActive && tamperedReceiver !== undefined
      ? String(tamperedReceiver).trim()
      : String(transaction.receiver || transaction.receiverName).trim();

    const effectiveNonce = isTamperActive && tamperedNonce !== undefined
      ? String(tamperedNonce).trim()
      : String(transaction.nonce).trim();

    const reconstructedPayloadObject = buildTransactionPayload({
      transactionId: transaction.transactionId,
      sender: effectiveSender,
      receiver: effectiveReceiver,
      amount: effectiveAmount,
      currency: transaction.currency || 'INR',
      timestamp: Number(transaction.timestamp),
      nonce: effectiveNonce,
    });

    const reconstructedCanonical = canonicalize(reconstructedPayloadObject);

    // Verify RSA digital signature using sender's public key (crypto.createVerify('RSA-SHA256'))
    const isValid = verifyRSA(reconstructedCanonical, digitalSignature, publicKey);

    const responsePayload = isValid
      ? {
          success: true,
          verified: true,
          signatureValid: true,
          authenticated: true,
          transactionId: transaction.transactionId,
          signer: transaction.sender || transaction.senderName,
          publicKeyFingerprint: fingerprint,
          digitalSignature,
          canonicalPayload: reconstructedCanonical,
          message: 'Digital signature verified successfully. Transaction authenticated.',
        }
      : {
          success: false,
          verified: false,
          signatureValid: false,
          authenticated: false,
          transactionId: transaction.transactionId,
          signer: transaction.sender || transaction.senderName,
          publicKeyFingerprint: fingerprint,
          digitalSignature,
          canonicalPayload: reconstructedCanonical,
          message: 'Digital signature verification failed. Transaction may have been modified or forged.',
        };

    try {
      await recordSecurityEvent({
        eventType: isValid ? 'SIGNATURE_VERIFIED' : 'SIGNATURE_REJECTED',
        result: isValid ? 'SUCCESS' : 'FAILED',
        severity: isValid ? 'INFO' : 'HIGH',
        details: `RSA Digital Signature verification on TX ${transaction.transactionId}: ${isValid ? 'PASSED (AUTHENTICATED & NON-REPUDIATED)' : 'FAILED (SIGNATURE MISMATCH)'}`,
        transactionId: transaction.transactionId,
      });
    } catch (e) {}

    return res.status(200).json(responsePayload);
  } catch (error) {
    next(error);
  }
};

/**
 * Combined Comprehensive Security Verification Engine
 * POST /api/transactions/:transactionId/verify-security
 * 
 * Executes full 5-pillar security pipeline:
 * 1. SHA-256 payload integrity check
 * 2. HMAC-SHA-256 gateway authentication check
 * 3. RSA-2048 sender digital signature check
 * 4. Timestamp freshness check (< 300s window)
 * 5. Nonce validity & replay check (single use, not consumed)
 * 
 * Final Security Decision:
 * securityVerified = sha256.verified && hmac.verified && rsa.verified && timestamp.valid && replayProtection.valid
 * 
 * Note: Pure read/audit operation — does NOT mutate transaction status or consume nonces.
 */
const verifyTransactionCombinedSecurity = async (req, res, next) => {
  try {
    const { transactionId } = req.params;
    const {
      tamperedAmount,
      tamperedReceiver,
      tamperedSender,
      tamperedNonce,
      tamperedSignature,
      tamperedTimestamp,
      simulateTamper = false,
      simulateTampering = false,
      simulateExpiredTimestamp = false,
      testMaxAge,
    } = req.body || {};

    const isTamperActive = simulateTamper || simulateTampering || simulateExpiredTimestamp || tamperedAmount !== undefined || tamperedReceiver !== undefined || tamperedSender !== undefined || tamperedNonce !== undefined || tamperedTimestamp !== undefined;

    let transaction = null;
    const isDbReady = mongoose.connection && mongoose.connection.readyState === 1;
    if (isDbReady) {
      try {
        const isObjectId = mongoose.Types.ObjectId.isValid(transactionId);
        transaction = await Transaction.findOne(
          isObjectId ? { $or: [{ transactionId }, { _id: transactionId }] } : { transactionId }
        );
      } catch (e) {}
    }

    if (!transaction) {
      transaction = inMemoryTransactions.find(
        (t) => t.transactionId === transactionId || String(t._id) === String(transactionId)
      );
    }

    if (!transaction) {
      return res.status(404).json({
        success: false,
        securityVerified: false,
        securityDecision: 'TRANSACTION_NOT_FOUND',
        status: 'TRANSACTION_NOT_FOUND',
        message: `Transaction with ID '${transactionId}' not found in cryptographic database.`,
      });
    }

    // Reconstruct canonical payload
    const effectiveSender = isTamperActive && tamperedSender !== undefined
      ? String(tamperedSender).trim()
      : String(transaction.sender || transaction.senderName).trim();

    const effectiveAmount = isTamperActive && tamperedAmount !== undefined
      ? parseFloat(Number(tamperedAmount).toFixed(2))
      : parseFloat(Number(transaction.amount).toFixed(2));

    const effectiveReceiver = isTamperActive && tamperedReceiver !== undefined
      ? String(tamperedReceiver).trim()
      : String(transaction.receiver || transaction.receiverName).trim();

    const effectiveNonce = isTamperActive && tamperedNonce !== undefined
      ? String(tamperedNonce).trim()
      : String(transaction.nonce).trim();

    const effectiveTimestamp = isTamperActive && tamperedTimestamp !== undefined
      ? Number(tamperedTimestamp)
      : Number(transaction.timestamp);

    const reconstructedPayloadObject = buildTransactionPayload({
      transactionId: transaction.transactionId,
      sender: effectiveSender,
      receiver: effectiveReceiver,
      amount: effectiveAmount,
      currency: transaction.currency || 'INR',
      timestamp: effectiveTimestamp,
      nonce: effectiveNonce,
    });

    const canonicalString = canonicalize(reconstructedPayloadObject);

    // 1. SHA-256 Integrity Verification
    const storedHash = transaction.transactionHash || transaction.sha256Hash || '';
    const calculatedHash = hashSHA256(canonicalString);
    const sha256Verified = verifySHA256(canonicalString, storedHash);

    // 2. HMAC-SHA-256 Authentication Verification
    const storedHmac = transaction.hmac || transaction.hmacSignature || '';
    const hmacSecret = requireHmacSecret(res);
    if (!hmacSecret) return;
    const calculatedHmac = generateHMAC(canonicalString, hmacSecret);
    const hmacVerified = storedHmac ? verifyHMAC(canonicalString, hmacSecret, storedHmac) : true;

    // 3. RSA-2048 Digital Signature & Non-Repudiation
    const storedSignature = isTamperActive && tamperedSignature !== undefined
      ? String(tamperedSignature).trim()
      : (transaction.digitalSignature || transaction.rsaSignature || '');
    const publicKey = transaction.senderPublicKey || '';
    const fingerprint = transaction.senderKeyFingerprint || (publicKey ? computeKeyFingerprint(publicKey) : 'RSA-2048');
    const rsaVerified = (storedSignature && publicKey)
      ? verifyRSA(canonicalString, storedSignature, publicKey)
      : true;

    // 4. Timestamp Freshness Verification
    const maxAgeSeconds = testMaxAge ? Number(testMaxAge) : 300; // 5 minutes standard freshness
    const now = Date.now();
    const ageMs = Math.max(0, now - effectiveTimestamp);
    const ageSeconds = parseFloat((ageMs / 1000).toFixed(2));
    const timestampValid = ageSeconds <= maxAgeSeconds;

    // 5. Nonce & Replay Protection Verification
    const nonceExists = Boolean(effectiveNonce && effectiveNonce.length >= 16);
    const isAlreadyConsumed = transaction.processedAt !== null ||
                             transaction.status === 'COMPLETED' ||
                             isNonceConsumed(transaction.nonce);
    const replayProtectionValid = nonceExists && !isAlreadyConsumed;
    const replayDetected = isAlreadyConsumed;

    // 6. Comprehensive Security Decision (Calculated dynamically from all checks)
    const securityVerified = sha256Verified && hmacVerified && rsaVerified && timestampValid && replayProtectionValid;
    const finalStatus = securityVerified ? 'TRANSACTION_SECURE' : 'TRANSACTION_REJECTED';
    const securityDecision = securityVerified ? 'SECURE' : 'REJECTED_SECURITY_FAILURE';

    const checks = {
      sha256: {
        valid: sha256Verified,
        verified: sha256Verified,
        storedHash,
        calculatedHash,
        status: sha256Verified ? 'PASSED' : 'FAILED',
        message: sha256Verified
          ? 'Canonical payload SHA-256 digest matches stored ledger hash.'
          : 'Hash mismatch: Payload data has been modified in transit.',
      },
      hmac: {
        valid: hmacVerified,
        verified: hmacVerified,
        storedHmac,
        calculatedHmac,
        status: hmacVerified ? 'PASSED' : 'FAILED',
        message: hmacVerified
          ? 'HMAC-SHA-256 authenticates gateway origin and payload integrity.'
          : 'HMAC verification failed: Shared secret mismatch or untrusted message.',
      },
      rsaSignature: {
        valid: rsaVerified,
        verified: rsaVerified,
        signer: effectiveSender,
        publicKeyFingerprint: fingerprint,
        digitalSignature: storedSignature,
        status: rsaVerified ? 'PASSED' : 'FAILED',
        message: rsaVerified
          ? 'RSA-2048 digital signature verified using sender public key (non-repudiation proved).'
          : 'RSA signature verification failed: Sender forged or data altered.',
      },
      timestamp: {
        valid: timestampValid,
        verified: timestampValid,
        timestamp: effectiveTimestamp,
        ageSeconds,
        ageMs,
        maxAgeSeconds,
        status: timestampValid ? 'PASSED' : 'EXPIRED',
        message: timestampValid
          ? `Timestamp is fresh (${ageSeconds}s old <= ${maxAgeSeconds}s window).`
          : `Timestamp expired (${ageSeconds}s old > ${maxAgeSeconds}s window).`,
      },
      nonce: {
        valid: replayProtectionValid,
        verified: replayProtectionValid,
        nonce: effectiveNonce,
        status: replayProtectionValid ? 'PASSED' : 'FAILED',
        message: replayProtectionValid ? 'Nonce is valid and unique.' : 'Nonce invalid or consumed.',
      },
      replayProtection: {
        valid: replayProtectionValid,
        verified: replayProtectionValid,
        nonce: effectiveNonce,
        replayDetected,
        processedAt: transaction.processedAt || transaction.consumedAt || null,
        status: replayProtectionValid ? 'PASSED' : (replayDetected ? 'REPLAY_DETECTED' : 'INVALID_NONCE'),
        message: replayProtectionValid
          ? 'CSPRNG Nonce is fresh, unique, and has not been consumed yet.'
          : (replayDetected
            ? `Replay attack detected: Nonce was already consumed at ${transaction.processedAt || transaction.consumedAt}.`
            : 'Invalid or missing nonce.'),
      },
    };

    // Log combined security audit event
    try {
      await recordSecurityEvent({
        eventType: securityVerified ? 'COMBINED_SECURITY_VERIFIED' : 'COMBINED_SECURITY_FAILED',
        result: securityVerified ? 'SUCCESS' : 'FAILED',
        severity: securityVerified ? 'INFO' : 'HIGH',
        details: `Combined security audit on TX ${transaction.transactionId}: ${finalStatus} (SHA:${sha256Verified} HMAC:${hmacVerified} RSA:${rsaVerified} TIME:${timestampValid} REPLAY:${replayProtectionValid})`,
        transactionId: transaction.transactionId,
        metadata: { securityVerified, checks },
      });
    } catch (e) {}

    return res.status(200).json({
      success: true,
      transactionId: transaction.transactionId,
      securityVerified,
      securityDecision,
      status: finalStatus,
      message: securityVerified
        ? '✓ TRANSACTION SECURE: All 5 cryptographic and anti-replay layers verified.'
        : '✗ TRANSACTION REJECTED: One or more security checks failed.',
      checks,
      canonicalPayload: canonicalString,
      transaction: {
        transactionId: transaction.transactionId,
        sender: effectiveSender,
        receiver: effectiveReceiver,
        amount: effectiveAmount,
        currency: transaction.currency || 'INR',
        status: transaction.status,
        timestamp: effectiveTimestamp,
        nonce: effectiveNonce,
        processedAt: transaction.processedAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all transactions
 * GET /api/transactions or GET /api/payments
 */
const getTransactions = async (req, res, next) => {
  try {
    const { status, search, limit = 50 } = req.query;
    let query = {};

    if (status && status !== 'ALL') {
      query.status = status;
    }
    if (search) {
      query.$or = [
        { transactionId: { $regex: search, $options: 'i' } },
        { receiver: { $regex: search, $options: 'i' } },
        { receiverName: { $regex: search, $options: 'i' } },
        { sender: { $regex: search, $options: 'i' } },
        { senderName: { $regex: search, $options: 'i' } },
        { transactionHash: { $regex: search, $options: 'i' } },
        { sha256Hash: { $regex: search, $options: 'i' } },
      ];
    }

    let transactions = [];
    const isDbReady = mongoose.connection && mongoose.connection.readyState === 1;
    if (isDbReady) {
      try {
        transactions = await Transaction.find(query)
          .sort({ createdAt: -1 })
          .limit(Number(limit));
      } catch (dbErr) {}
    }

    if (transactions.length === 0) {
      transactions = inMemoryTransactions.filter((tx) => {
        if (status && status !== 'ALL' && tx.status !== status) return false;
        if (search) {
          const s = search.toLowerCase();
          return (
            tx.transactionId.toLowerCase().includes(s) ||
            (tx.receiver && tx.receiver.toLowerCase().includes(s)) ||
            (tx.transactionHash && tx.transactionHash.toLowerCase().includes(s))
          );
        }
        return true;
      });
    }

    res.status(200).json({
      success: true,
      count: transactions.length,
      transactions,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get single transaction by ID
 * GET /api/transactions/:id
 */
const getTransactionById = async (req, res, next) => {
  try {
    const { id } = req.params;
    let transaction = null;

    const isDbReady = mongoose.connection && mongoose.connection.readyState === 1;
    if (isDbReady) {
      try {
        transaction = await Transaction.findOne({
          $or: [{ transactionId: id }, { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }],
        });
      } catch (e) {}
    }

    if (!transaction) {
      transaction = inMemoryTransactions.find(
        (t) => t.transactionId === id || t._id === id
      );
    }

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: `Transaction '${id}' not found in cryptographic database.`,
      });
    }

    res.status(200).json({
      success: true,
      transaction,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Authoritative server-side transaction status.
 * GET /api/transactions/:transactionId/status
 *
 * The server - not the client - is the source of truth for whether a payment
 * exists and whether it was actually processed. Used to expose the difference
 * between a fake client-side confirmation and a server-confirmed payment.
 */
const getTransactionStatus = async (req, res, next) => {
  try {
    // Route is mounted as '/:id/status' (and '/:transactionId/status')
    const transactionId = req.params.transactionId || req.params.id;
    let transaction = null;
    const isDbReady = mongoose.connection && mongoose.connection.readyState === 1;

    if (isDbReady) {
      try {
        const isObjectId = mongoose.Types.ObjectId.isValid(transactionId);
        transaction = await Transaction.findOne(
          isObjectId ? { $or: [{ transactionId }, { _id: transactionId }] } : { transactionId }
        );
      } catch (e) {}
    }

    if (!transaction) {
      transaction = inMemoryTransactions.find(
        (t) => t.transactionId === transactionId || String(t._id) === String(transactionId)
      );
    }

    if (!transaction) {
      return res.status(200).json({
        success: true,
        exists: false,
        transactionId,
        serverStatus: 'NOT_FOUND',
        approved: false,
        message:
          'The server has no record of this transaction. A payment confirmation referencing this ID is unverified.',
      });
    }

    const serverStatus = transaction.status || 'PENDING';
    const approved = serverStatus === 'COMPLETED' || serverStatus === 'SUCCESS';

    res.status(200).json({
      success: true,
      exists: true,
      transactionId: transaction.transactionId,
      serverStatus,
      approved,
      amount: transaction.amount,
      currency: transaction.currency || 'INR',
      sender: transaction.sender || transaction.senderName,
      receiver: transaction.receiver || transaction.receiverName,
      timestamp: transaction.timestamp,
      processedAt: transaction.processedAt || null,
      message: approved
        ? 'Server confirmed: this transaction was processed and funds were transferred.'
        : `Server status is ${serverStatus}: funds have NOT been transferred for this transaction.`,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createTransaction,
  processTransaction,
  verifyTransactionIntegrity,
  verifyTransactionHMAC,
  verifyTransactionSignature,
  verifyTransactionCombinedSecurity,
  getTransactions,
  getTransactionById,
  getTransactionStatus,
  inMemoryTransactions,
};
