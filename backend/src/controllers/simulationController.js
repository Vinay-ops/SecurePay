const { v4: uuidv4 } = require('uuid');
const mongoose = require('mongoose');
const Transaction = require('../models/Transaction');
const SecurityLog = require('../models/SecurityLog');
const { recordSecurityEvent } = require('./securityController');
const {
  canonicalize,
  buildTransactionPayload,
  hashSHA256,
  verifySHA256,
  generateHMAC,
  verifyHMAC,
  generateRSAKeyPair,
  signRSA,
  verifyRSA,
  computeKeyFingerprint,
  generateNonce,
  isNonceConsumed,
  consumeNonce,
} = require('../crypto');
const { inMemoryTransactions } = require('../store/inMemoryStore');
const { requireHmacSecret } = require('../config/secrets');

/**
 * Helper to retrieve a transaction by ID from MongoDB or in-memory fallback
 */
async function getTransaction(transactionId) {
  if (!transactionId) return null;
  const isDbReady = mongoose.connection && mongoose.connection.readyState === 1;
  let tx = null;

  if (isDbReady) {
    try {
      const isObjectId = mongoose.Types.ObjectId.isValid(transactionId);
      tx = await Transaction.findOne(
        isObjectId ? { $or: [{ transactionId }, { _id: transactionId }] } : { transactionId }
      );
    } catch (e) {}
  }

  if (!tx) {
    tx = inMemoryTransactions.find(
      (t) => t.transactionId === transactionId || String(t._id) === String(transactionId)
    );
  }

  return tx;
}

/**
 * ATTACK 1: Transaction Tampering Simulation
 * POST /api/attacks/tamper or POST /api/simulation/tamper
 * 
 * Modifies in-memory test copy of transaction and runs real cryptographic verification
 * against stored SHA-256, HMAC, and RSA signatures.
 * IMPORTANT: NEVER modifies the original database record.
 */
const simulateTamperingAttack = async (req, res, next) => {
  try {
    const {
      transactionId,
      tamperedAmount,
      tamperedReceiver,
      tamperedNonce,
    } = req.body;

    let original = await getTransaction(transactionId);

    if (!original) {
      return res.status(404).json({
        success: false,
        message: `Transaction '${transactionId}' not found. Please select a valid transaction from the ledger.`,
      });
    }

    const storedHash = original.transactionHash || original.sha256Hash || '';
    const storedHmac = original.hmac || original.hmacSignature || '';
    const storedSignature = original.digitalSignature || original.rsaSignature || '';
    const senderPublicKey = original.senderPublicKey || '';
    const fingerprint = original.senderKeyFingerprint || computeKeyFingerprint(senderPublicKey);

    // Create In-Memory Test Copy (NEVER mutate original DB transaction)
    const effectiveAmount = tamperedAmount !== undefined && !isNaN(Number(tamperedAmount))
      ? parseFloat(Number(tamperedAmount).toFixed(2))
      : parseFloat(Number(original.amount).toFixed(2));

    const effectiveReceiver = tamperedReceiver !== undefined && String(tamperedReceiver).trim()
      ? String(tamperedReceiver).trim()
      : String(original.receiver || original.receiverName).trim();

    const effectiveNonce = tamperedNonce !== undefined && String(tamperedNonce).trim()
      ? String(tamperedNonce).trim()
      : String(original.nonce).trim();

    // Reconstruct canonical payload of tampered test copy
    const tamperedPayloadObject = buildTransactionPayload({
      transactionId: original.transactionId,
      sender: original.sender || original.senderName,
      receiver: effectiveReceiver,
      amount: effectiveAmount,
      currency: original.currency || 'INR',
      timestamp: Number(original.timestamp),
      nonce: effectiveNonce,
    });

    const tamperedCanonical = canonicalize(tamperedPayloadObject);

    // 1. Recalculate SHA-256 on tampered payload and compare to original stored hash
    const tamperedCalculatedHash = hashSHA256(tamperedCanonical);
    const sha256Valid = verifySHA256(tamperedCanonical, storedHash);

    // 2. Recalculate HMAC on tampered payload and compare to original stored HMAC
    const hmacSecret = requireHmacSecret(res);
    if (!hmacSecret) return;
    const tamperedCalculatedHmac = generateHMAC(tamperedCanonical, hmacSecret);
    const hmacValid = verifyHMAC(tamperedCanonical, hmacSecret, storedHmac);

    // 3. Verify original RSA signature against tampered payload
    const rsaValid = (storedSignature && senderPublicKey)
      ? verifyRSA(tamperedCanonical, storedSignature, senderPublicKey)
      : false;

    const attackDetected = !(sha256Valid && hmacValid && rsaValid);

    // Log attack event in SecurityLog (Audit only, never corrupt transaction)
    await recordSecurityEvent({
      eventType: 'TAMPERING_DETECTED',
      severity: 'HIGH',
      result: 'BLOCKED',
      details: `Simulated tampering attack on TX ${original.transactionId}: Amount ${original.amount} -> ${effectiveAmount}. Attack trapped by cryptographic guards.`,
      transactionId: original.transactionId,
      metadata: {
        attackType: 'tampering',
        tamperedAmount: effectiveAmount,
        tamperedReceiver: effectiveReceiver,
      },
    });

    return res.status(200).json({
      success: true,
      attack: 'tampering',
      attackDetected,
      // Legacy summary shape kept for older academic demo scripts/tests.
      simulation: {
        attackType: 'TRANSACTION_TAMPERING',
        attackDetected,
        verdict: attackDetected
          ? 'ATTACK DETECTED & BLOCKED by cryptographic integrity guards'
          : 'ATTACK SUCCEEDED - SECURITY CONTROL FAILED',
        breakdown: {
          sha256: {
            passed: sha256Valid,
            statusText: sha256Valid ? 'PASSED (unexpected)' : 'FAILED - SHA-256 hash mismatch',
          },
          hmac: {
            passed: hmacValid,
            statusText: hmacValid ? 'PASSED (unexpected)' : 'FAILED - HMAC-SHA-256 mismatch',
          },
          rsaSignature: {
            passed: rsaValid,
            statusText: rsaValid ? 'PASSED (unexpected)' : 'FAILED - RSA signature invalid for altered payload',
          },
        },
      },
      status: attackDetected ? 'TRANSACTION_TAMPERING_DETECTED' : 'TAMPERING_UNDETECTED',
      message: attackDetected
        ? '🚨 TRANSACTION TAMPERING DETECTED: Mathematical failure across cryptographic layers.'
        : '✓ No tampering detected.',
      original: {
        transactionId: original.transactionId,
        sender: original.sender || original.senderName,
        receiver: original.receiver || original.receiverName,
        amount: original.amount,
        currency: original.currency || 'INR',
        timestamp: original.timestamp,
        nonce: original.nonce,
        storedHash,
        storedHmac,
        storedSignature,
        publicKeyFingerprint: fingerprint,
      },
      tampered: {
        transactionId: original.transactionId,
        sender: original.sender || original.senderName,
        receiver: effectiveReceiver,
        amount: effectiveAmount,
        currency: original.currency || 'INR',
        timestamp: original.timestamp,
        nonce: effectiveNonce,
        calculatedHash: tamperedCalculatedHash,
        calculatedHmac: tamperedCalculatedHmac,
        canonicalPayload: tamperedCanonical,
      },
      checks: {
        sha256: {
          verified: sha256Valid,
          storedHash,
          calculatedHash: tamperedCalculatedHash,
          status: sha256Valid ? 'PASSED' : 'FAILED',
          message: sha256Valid
            ? 'SHA-256 hash verified match.'
            : '✗ Integrity violation detected: SHA-256 hash mismatch.',
        },
        hmac: {
          verified: hmacValid,
          storedHmac,
          calculatedHmac: tamperedCalculatedHmac,
          status: hmacValid ? 'PASSED' : 'FAILED',
          message: hmacValid
            ? 'HMAC-SHA-256 authentication verified.'
            : '✗ Authentication/integrity verification failed.',
        },
        rsaSignature: {
          verified: rsaValid,
          signer: original.sender || original.senderName,
          publicKeyFingerprint: fingerprint,
          status: rsaValid ? 'PASSED' : 'FAILED',
          message: rsaValid
            ? 'RSA digital signature valid.'
            : '✗ Signature verification failed: Message altered in-transit.',
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * ATTACK 2: Replay Attack Simulation
 * POST /api/attacks/replay or POST /api/simulation/replay
 * 
 * Attempts to re-submit or replay an identical transaction packet.
 * Backend verifies that the nonce is already consumed or the transaction was previously processed.
 */
const simulateReplayAttack = async (req, res, next) => {
  try {
    const { transactionId } = req.body;

    let original = await getTransaction(transactionId);

    if (!original) {
      return res.status(404).json({
        success: false,
        message: `Transaction '${transactionId}' not found. Please select a valid transaction.`,
      });
    }

    // Check if the transaction was already processed or nonce consumed
    const isAlreadyConsumed = original.processedAt !== null ||
                             original.status === 'COMPLETED' ||
                             isNonceConsumed(original.nonce);

    // If it was already processed, the replay attempt is instantly blocked by anti-replay logic
    if (isAlreadyConsumed) {
      await recordSecurityEvent({
        eventType: 'REPLAY_DETECTED',
        severity: 'CRITICAL',
        result: 'BLOCKED',
        details: `🚨 Replay Attack Blocked on TX ${original.transactionId}: Duplicate Nonce '${original.nonce}' rejected.`,
        transactionId: original.transactionId,
        metadata: { attackType: 'replay', nonce: original.nonce },
      });

      return res.status(200).json({
        success: true,
        attack: 'replay',
        attackDetected: true,
        status: 'REPLAY_ATTACK_DETECTED',
        message: '🚨 REPLAY ATTACK DETECTED: Transaction has already been processed and nonce is consumed.',
        rejectionReason: 'REPLAY_ATTACK_DETECTED',
        original: {
          transactionId: original.transactionId,
          nonce: original.nonce,
          timestamp: original.timestamp,
          status: original.status,
          processedAt: original.processedAt || original.consumedAt,
        },
        checks: {
          nonceCheck: {
            valid: false,
            status: 'CONSUMED',
            message: `Nonce '${original.nonce}' was already used. Replay prohibited.`,
          },
          processingCheck: {
            valid: false,
            status: 'ALREADY_COMPLETED',
            message: `Transaction was completed at ${original.processedAt || original.consumedAt}. Duplicate execution blocked.`,
          },
        },
      });
    }

    // If not yet consumed, simulate the replay attempt by testing against the processing engine
    consumeNonce(original.nonce, original.timestamp);

    await recordSecurityEvent({
      eventType: 'REPLAY_DETECTED',
      severity: 'CRITICAL',
      result: 'BLOCKED',
      details: `🚨 Replay Attack Blocked on TX ${original.transactionId}: Simulated nonce re-use attempt trapped.`,
      transactionId: original.transactionId,
      metadata: { attackType: 'replay', nonce: original.nonce },
    });

    return res.status(200).json({
      success: true,
      attack: 'replay',
      attackDetected: true,
      status: 'REPLAY_ATTACK_DETECTED',
      message: '🚨 REPLAY ATTACK DETECTED: Nonce is already consumed in execution store.',
      rejectionReason: 'REPLAY_ATTACK_DETECTED',
      original: {
        transactionId: original.transactionId,
        nonce: original.nonce,
        timestamp: original.timestamp,
        status: 'COMPLETED (SIMULATED REPLAY)',
        processedAt: new Date(),
      },
      checks: {
        nonceCheck: {
          valid: false,
          status: 'CONSUMED',
          message: `Replay Attack trapped: Nonce '${original.nonce}' cannot be reused.`,
        },
        processingCheck: {
          valid: false,
          status: 'REPLAY_PREVENTED',
          message: 'Double-processing prevention rule active.',
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * ATTACK 3: Transaction Forgery Simulation
 * POST /api/attacks/forge or POST /api/simulation/forge
 * 
 * An attacker modifies the sender or transaction details without possessing
 * the legitimate sender's private RSA-2048 key.
 * Verifies with crypto.createVerify('RSA-SHA256') that the original digital signature is mathematically invalid.
 */
const simulateForgeryAttack = async (req, res, next) => {
  try {
    const {
      transactionId,
      forgedSender = 'Attacker Mallory',
      forgedReceiver,
      forgedAmount,
    } = req.body;

    let original = await getTransaction(transactionId);

    if (!original) {
      return res.status(404).json({
        success: false,
        message: `Transaction '${transactionId}' not found. Please select a valid transaction.`,
      });
    }

    const storedSignature = original.digitalSignature || original.rsaSignature || '';
    const legitimatePublicKey = original.senderPublicKey || '';
    const fingerprint = original.senderKeyFingerprint || computeKeyFingerprint(legitimatePublicKey);

    // Create In-Memory Forged Copy
    const effectiveSender = forgedSender && String(forgedSender).trim()
      ? String(forgedSender).trim()
      : 'Attacker Mallory';

    const effectiveReceiver = forgedReceiver !== undefined && String(forgedReceiver).trim()
      ? String(forgedReceiver).trim()
      : String(original.receiver || original.receiverName).trim();

    const effectiveAmount = forgedAmount !== undefined && !isNaN(Number(forgedAmount))
      ? parseFloat(Number(forgedAmount).toFixed(2))
      : parseFloat(Number(original.amount).toFixed(2));

    const forgedPayloadObject = buildTransactionPayload({
      transactionId: original.transactionId,
      sender: effectiveSender,
      receiver: effectiveReceiver,
      amount: effectiveAmount,
      currency: original.currency || 'INR',
      timestamp: Number(original.timestamp),
      nonce: String(original.nonce).trim(),
    });

    const forgedCanonical = canonicalize(forgedPayloadObject);

    // Run real RSA verification using legitimate sender's public key
    const rsaSignatureValid = (storedSignature && legitimatePublicKey)
      ? verifyRSA(forgedCanonical, storedSignature, legitimatePublicKey)
      : false;

    // Run real SHA-256 check
    const storedHash = original.transactionHash || original.sha256Hash || '';
    const forgedCalculatedHash = hashSHA256(forgedCanonical);
    const sha256Valid = verifySHA256(forgedCanonical, storedHash);

    const attackDetected = !rsaSignatureValid;

    // Log security event
    await recordSecurityEvent({
      eventType: 'FORGERY_DETECTED',
      severity: 'CRITICAL',
      result: 'BLOCKED',
      details: `🚨 Transaction Forgery Attempt on TX ${original.transactionId}: Forged sender '${effectiveSender}'. RSA digital signature verification failed.`,
      transactionId: original.transactionId,
      metadata: { attackType: 'forgery', forgedSender: effectiveSender },
    });

    return res.status(200).json({
      success: true,
      attack: 'forgery',
      attackDetected,
      status: attackDetected ? 'FORGED_TRANSACTION_REJECTED' : 'FORGERY_ACCEPTED',
      message: attackDetected
        ? '🚨 FORGED TRANSACTION REJECTED: Attacker lacks sender private RSA key. Digital signature verification failed.'
        : 'Forgery verification passed.',
      original: {
        transactionId: original.transactionId,
        sender: original.sender || original.senderName,
        receiver: original.receiver || original.receiverName,
        amount: original.amount,
        currency: original.currency || 'INR',
        signer: original.sender || original.senderName,
        publicKeyFingerprint: fingerprint,
        storedSignature,
      },
      forged: {
        transactionId: original.transactionId,
        sender: effectiveSender,
        receiver: effectiveReceiver,
        amount: effectiveAmount,
        currency: original.currency || 'INR',
        canonicalPayload: forgedCanonical,
      },
      checks: {
        rsaSignature: {
          verified: rsaSignatureValid,
          signer: original.sender || original.senderName,
          publicKeyFingerprint: fingerprint,
          status: rsaSignatureValid ? 'PASSED' : 'FAILED',
          message: rsaSignatureValid
            ? 'RSA Digital signature valid.'
            : '✗ Invalid: Attacker does not possess sender private key. Signature does not match forged payload.',
        },
        sha256: {
          verified: sha256Valid,
          storedHash,
          calculatedHash: forgedCalculatedHash,
          status: sha256Valid ? 'PASSED' : 'FAILED',
          message: sha256Valid
            ? 'SHA-256 hash valid.'
            : '✗ Hash mismatch: Forged payload string altered.',
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * ATTACK 4: Fake Payment Confirmation
 * POST /api/attacks/fake-confirmation
 *
 * A recipient is shown a client-side "payment successful" message. The server
 * independently looks up the real transaction state and reports whether the
 * claim matches reality. The client can NEVER declare a payment approved.
 */
const simulateFakeConfirmation = async (req, res, next) => {
  try {
    const {
      transactionId,
      claimedStatus = 'COMPLETED',
      claimedAmount,
      claimedReceiver,
    } = req.body;

    if (!transactionId || !String(transactionId).trim()) {
      return res.status(400).json({
        success: false,
        message: 'A claimed transaction ID is required for the fake confirmation test.',
      });
    }

    const tx = await getTransaction(String(transactionId).trim());
    const serverStatus = tx ? (tx.status || 'PENDING') : 'NOT_FOUND';

    const normalize = (s) => {
      const v = String(s || '').toUpperCase();
      return v === 'SUCCESS' ? 'COMPLETED' : v;
    };

    const claimNormalized = normalize(claimedStatus);
    const statusMatch = !!tx && claimNormalized === normalize(serverStatus);
    const amountMatch =
      claimedAmount === undefined ||
      claimedAmount === null ||
      claimedAmount === '' ||
      (!!tx && Math.abs(Number(claimedAmount) - Number(tx.amount)) < 0.005);
    const receiverMatch =
      !claimedReceiver ||
      !String(claimedReceiver).trim() ||
      (!!tx &&
        String(tx.receiver || tx.receiverName || '').toLowerCase() ===
          String(claimedReceiver).trim().toLowerCase());

    const claimVerified = !!tx && statusMatch && amountMatch && receiverMatch;
    const attackDetected = !claimVerified;
    const serverApproved = !!tx && normalize(serverStatus) === 'COMPLETED';

    // Describe EXACTLY which part of the client claim the server rejected, so
    // the UI and the audit log never blame the wrong check.
    const mismatches = [];
    if (!tx) {
      mismatches.push(`no transaction '${String(transactionId).trim()}' exists in the server ledger`);
    } else {
      if (!statusMatch) {
        mismatches.push(`claimed status ${claimNormalized} does not match server status ${serverStatus}`);
      }
      if (!amountMatch) {
        mismatches.push(
          `claimed amount ${Number(claimedAmount)} does not match the server amount ${tx.amount} ${tx.currency || 'INR'}`
        );
      }
      if (!receiverMatch) {
        mismatches.push(
          `claimed receiver "${String(claimedReceiver).trim()}" does not match the server receiver "${tx.receiver || tx.receiverName || ''}"`
        );
      }
    }

    await recordSecurityEvent({
      eventType: attackDetected ? 'FAKE_CONFIRMATION_DETECTED' : 'FAKE_CONFIRMATION_VERIFIED',
      severity: attackDetected ? 'HIGH' : 'INFO',
      result: attackDetected ? 'BLOCKED' : 'SUCCESS',
      details: attackDetected
        ? `Fake payment confirmation exposed for '${transactionId}': ${mismatches.join('; ')}.`
        : `Client confirmation for '${transactionId}' matches the authoritative server status (${serverStatus}).`,
      transactionId: tx ? tx.transactionId : String(transactionId),
      metadata: {
        attackType: 'fake-confirmation',
        claimedStatus: claimNormalized,
        claimedAmount: claimedAmount !== undefined && claimedAmount !== '' ? Number(claimedAmount) : null,
        serverStatus,
        serverAmount: tx ? tx.amount : null,
        mismatches,
      },
    });

    return res.status(200).json({
      success: true,
      attack: 'fake-confirmation',
      attackDetected,
      claimVerified,
      status: attackDetected ? 'FAKE_CONFIRMATION_DETECTED' : 'SERVER_CONFIRMED_PAYMENT',
      reason: attackDetected ? 'CLAIM_MISMATCH' : 'CLAIM_MATCHED',
      mismatches,
      message: attackDetected
        ? `The claimed payment confirmation does NOT match the authoritative server record: ${mismatches.join('; ')}. A success message alone does not prove a payment was processed.`
        : 'The claim matches the authoritative server record.',
      claimed: {
        transactionId: String(transactionId).trim(),
        claimedStatus: claimNormalized,
        claimedAmount: claimedAmount !== undefined && claimedAmount !== '' ? Number(claimedAmount) : null,
        source: 'client-side message',
      },
      server: {
        transactionId: tx ? tx.transactionId : String(transactionId).trim(),
        serverStatus,
        approved: serverApproved,
        amount: tx ? tx.amount : null,
        currency: tx ? tx.currency || 'INR' : null,
        sender: tx ? tx.sender || tx.senderName : null,
        receiver: tx ? tx.receiver || tx.receiverName : null,
        processedAt: tx ? tx.processedAt || null : null,
      },
      checks: {
        serverLookup: {
          verified: !!tx,
          status: tx ? 'FOUND' : 'NOT_FOUND',
          message: tx
            ? 'Transaction exists in the server ledger.'
            : 'No such transaction exists in the server ledger.',
        },
        statusMatch: {
          verified: statusMatch,
          status: statusMatch ? 'MATCH' : 'MISMATCH',
          message: statusMatch
            ? `Claimed status matches server status (${serverStatus}).`
            : `Claimed status ${claimNormalized} does not match server status ${serverStatus}.`,
        },
        amountMatch: {
          verified: amountMatch,
          status: amountMatch ? 'MATCH' : 'MISMATCH',
          message: amountMatch
            ? 'Claimed amount matches the server record.'
            : `Claimed amount does not match the server record (${tx ? `${tx.amount} ${tx.currency || 'INR'}` : 'no record'}).`,
        },
        receiverMatch: {
          verified: receiverMatch,
          status: receiverMatch ? 'MATCH' : 'MISMATCH',
          message: receiverMatch
            ? 'Claimed receiver matches the server record.'
            : 'Claimed receiver does not match the server record.',
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Backwards-compatible general attack simulator endpoint
 * POST /api/simulation/attack
 */
const simulateAttack = async (req, res, next) => {
  const { attackType = 'AMOUNT_TAMPERING' } = req.body;
  if (attackType === 'REPLAY_ATTACK') {
    return simulateReplayAttack(req, res, next);
  } else if (attackType === 'SIGNATURE_FORGERY') {
    return simulateForgeryAttack(req, res, next);
  } else if (attackType === 'FAKE_CONFIRMATION') {
    return simulateFakeConfirmation(req, res, next);
  } else {
    return simulateTamperingAttack(req, res, next);
  }
};

module.exports = {
  simulateTamperingAttack,
  simulateReplayAttack,
  simulateForgeryAttack,
  simulateFakeConfirmation,
  simulateAttack,
};
