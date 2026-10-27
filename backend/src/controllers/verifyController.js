const Transaction = require('../models/Transaction');
const SecurityLog = require('../models/SecurityLog');
const { v4: uuidv4 } = require('uuid');
const {
  canonicalize,
  hashSHA256,
  verifySHA256,
  generateHMAC,
  verifyHMAC,
  verifyRSA,
} = require('../crypto');
const { requireHmacSecret } = require('../config/secrets');

/**
 * Interactive validator for inspecting transaction integrity, HMAC, and RSA signatures
 */
const inspectTransaction = async (req, res, next) => {
  try {
    // SECURITY: the HMAC secret is resolved SERVER-SIDE only. A client-supplied
    // secret is ignored so an attacker can never make verification pass by
    // submitting a secret of their own choosing.
    const hmacSecret = requireHmacSecret(res);
    if (!hmacSecret) return;

    const {
      transactionId,
      senderName,
      receiverName,
      amount,
      currency = 'INR',
      timestamp,
      nonce,
      sha256Hash,
      hmacSignature,
      rsaSignature,
      senderPublicKey,
    } = req.body;

    const rawPayload = {
      transactionId,
      senderName,
      receiverName,
      amount: parseFloat(Number(amount).toFixed(2)),
      currency,
      timestamp: Number(timestamp),
      nonce,
    };

    // 1. Canonical representation
    const canonicalString = canonicalize(rawPayload);

    // 2. Compute expected values
    const computedSHA256 = hashSHA256(canonicalString);
    const computedHMAC = generateHMAC(canonicalString, hmacSecret);

    // 3. Verify checks
    const isSha256Match = computedSHA256.toLowerCase() === (sha256Hash || '').toLowerCase();
    const isHmacMatch = verifyHMAC(canonicalString, hmacSecret, hmacSignature);
    const isRsaMatch = rsaSignature && senderPublicKey
      ? verifyRSA(canonicalString, rsaSignature, senderPublicKey)
      : false;

    const now = Date.now();
    const txTime = Number(timestamp);
    const ageSeconds = Math.abs(now - txTime) / 1000;
    const isFresh = ageSeconds <= 300;

    const overallVerified = isSha256Match && isHmacMatch && isRsaMatch && isFresh;

    // Log verification query
    try {
      await SecurityLog.create({
        logId: uuidv4(),
        eventType: overallVerified ? 'INTEGRITY_VERIFIED' : 'SECURITY_ANOMALY',
        severity: overallVerified ? 'INFO' : 'MEDIUM',
        details: `Audit inspection run on TX ${transactionId}. Status: ${overallVerified ? 'VERIFIED' : 'FAILED'}`,
        transactionId,
      });
    } catch (e) {}

    res.status(200).json({
      success: true,
      data: {
        canonicalString,
        sha256: {
          provided: sha256Hash,
          computed: computedSHA256,
          isValid: isSha256Match,
          algorithm: 'SHA-256 (FIPS 180-4)',
        },
        hmac: {
          provided: hmacSignature,
          computed: computedHMAC,
          isValid: isHmacMatch,
          algorithm: 'HMAC-SHA-256 (RFC 2104)',
        },
        rsa: {
          providedSignature: rsaSignature,
          publicKeyProvided: !!senderPublicKey,
          isValid: isRsaMatch,
          algorithm: 'RSA-SHA256 (PKCS#1 v1.5 / 2048-bit)',
        },
        replayProtection: {
          timestamp: txTime,
          currentTime: now,
          ageSeconds: Number(ageSeconds.toFixed(1)),
          isFresh,
          nonce,
        },
        overallVerified,
        verdict: overallVerified
          ? 'SECURE: All cryptographic properties (Integrity, Authenticity, Non-Repudiation, Freshness) verified.'
          : 'COMPROMISED: One or more cryptographic proofs failed verification.',
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  inspectTransaction,
};
