const { v4: uuidv4 } = require('uuid');
const mongoose = require('mongoose');
const Transaction = require('../models/Transaction');
const SecurityLog = require('../models/SecurityLog');
const { getDBStatus } = require('../config/db');
const { inMemoryTransactions, inMemoryLogs, saveStore } = require('../store/inMemoryStore');
const { isDemoResetAllowed, getStorageMode } = require('../config/secrets');

// Every event type that represents an attack attempt recorded by the simulator.
const ATTACK_EVENT_TYPES = [
  'TAMPERING_DETECTED',
  'TAMPERING_ATTACK_DETECTED',
  'HASH_MISMATCH_DETECTED',
  'REPLAY_DETECTED',
  'REPLAY_ATTACK_DETECTED',
  'REPLAY_ATTACK_BLOCKED',
  'FORGERY_DETECTED',
  'FORGERY_ATTACK_DETECTED',
  'FAKE_CONFIRMATION_DETECTED',
];

const countAttackLogs = (logs) => logs.filter((l) => ATTACK_EVENT_TYPES.includes(l.eventType));

/**
 * Record a real security event to MongoDB or in-memory store
 */
async function recordSecurityEvent({
  eventType,
  severity = 'INFO',
  result = 'INFO',
  details,
  transactionId = null,
  metadata = {},
  ip = '127.0.0.1',
}) {
  const logEntry = {
    logId: `SEC-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
    eventType,
    severity,
    result,
    details,
    transactionId,
    metadata,
    ip,
    createdAt: new Date(),
    timestamp: Date.now(),
  };

  const isDbReady = mongoose.connection && mongoose.connection.readyState === 1;
  if (isDbReady) {
    try {
      await SecurityLog.create(logEntry);
    } catch (err) {
      inMemoryLogs.unshift(logEntry);
      saveStore();
    }
  } else {
    inMemoryLogs.unshift(logEntry);
    saveStore();
  }

  // Keep in-memory logs limited to last 200 items
  if (inMemoryLogs.length > 200) {
    inMemoryLogs.pop();
  }

  return logEntry;
}

/**
 * Get comprehensive, real live security dashboard summary
 * GET /api/dashboard/security-summary or GET /api/security/metrics
 */
const getSecurityDashboardMetrics = async (req, res, next) => {
  try {
    const isDbReady = mongoose.connection && mongoose.connection.readyState === 1;

    let totalTransactions = 0;
    let successfulTransactions = 0;
    let pendingTransactions = 0;
    let rejectedTransactions = 0;

    let tamperingCount = 0;
    let replayCount = 0;
    let forgeryCount = 0;
    let fakeConfirmationCount = 0;
    let attacksAttempted = 0;
    let attacksDetected = 0;
    let timestampExpired = 0;

    let sha256Passed = 0;
    let sha256Failed = 0;
    let hmacPassed = 0;
    let hmacFailed = 0;
    let rsaPassed = 0;
    let rsaFailed = 0;
    let replayBlocked = 0;

    let recentTransactions = [];
    let recentLogs = [];

    if (isDbReady) {
      try {
        // Transaction counts from MongoDB
        totalTransactions = await Transaction.countDocuments();
        successfulTransactions = await Transaction.countDocuments({ status: { $in: ['COMPLETED', 'SUCCESS'] } });
        pendingTransactions = await Transaction.countDocuments({ status: 'PENDING' });
        rejectedTransactions = await Transaction.countDocuments({ status: { $in: ['REJECTED', 'TAMPERED'] } });

        // Attack counts from SecurityLog collection
        tamperingCount = await SecurityLog.countDocuments({
          eventType: { $in: ['TAMPERING_DETECTED', 'TAMPERING_ATTACK_DETECTED', 'HASH_MISMATCH_DETECTED'] },
        });
        replayCount = await SecurityLog.countDocuments({
          eventType: { $in: ['REPLAY_DETECTED', 'REPLAY_ATTACK_DETECTED', 'REPLAY_ATTACK_BLOCKED'] },
        });
        forgeryCount = await SecurityLog.countDocuments({
          eventType: { $in: ['FORGERY_DETECTED', 'FORGERY_ATTACK_DETECTED'] },
        });
        fakeConfirmationCount = await SecurityLog.countDocuments({
          eventType: 'FAKE_CONFIRMATION_DETECTED',
        });

        attacksAttempted = await SecurityLog.countDocuments({
          eventType: { $in: ATTACK_EVENT_TYPES },
        });
        attacksDetected = await SecurityLog.countDocuments({
          eventType: { $in: ATTACK_EVENT_TYPES },
          result: 'BLOCKED',
        });
        timestampExpired = await SecurityLog.countDocuments({ eventType: 'TIMESTAMP_EXPIRED' });

        // Verification counts from SecurityLog
        sha256Passed = await SecurityLog.countDocuments({ eventType: 'INTEGRITY_VERIFIED' });
        sha256Failed = await SecurityLog.countDocuments({
          eventType: { $in: ['HASH_MISMATCH_DETECTED', 'INTEGRITY_FAILURE'] },
        });

        hmacPassed = await SecurityLog.countDocuments({ eventType: 'HMAC_VERIFIED' });
        hmacFailed = await SecurityLog.countDocuments({
          eventType: { $in: ['HMAC_FAILURE', 'HMAC_AUTH_FAILED', 'HMAC_VERIFICATION_FAILED'] },
        });

        rsaPassed = await SecurityLog.countDocuments({ eventType: 'SIGNATURE_VERIFIED' });
        rsaFailed = await SecurityLog.countDocuments({
          eventType: { $in: ['SIGNATURE_REJECTED', 'SIGNATURE_INVALID', 'SIGNATURE_FAILURE', 'FORGERY_DETECTED'] },
        });

        replayBlocked = replayCount;

        // Recent records
        recentTransactions = await Transaction.find().sort({ createdAt: -1 }).limit(6);
        recentLogs = await SecurityLog.find().sort({ createdAt: -1 }).limit(10);
      } catch (dbErr) {
        // Fallback to in-memory store
        totalTransactions = inMemoryTransactions.length;
        successfulTransactions = inMemoryTransactions.filter((t) => t.status === 'COMPLETED' || t.status === 'SUCCESS').length;
        pendingTransactions = inMemoryTransactions.filter((t) => t.status === 'PENDING').length;
        rejectedTransactions = inMemoryTransactions.filter((t) => t.status === 'REJECTED' || t.status === 'TAMPERED').length;

        tamperingCount = inMemoryLogs.filter((l) => ['TAMPERING_DETECTED', 'TAMPERING_ATTACK_DETECTED', 'HASH_MISMATCH_DETECTED'].includes(l.eventType)).length;
        replayCount = inMemoryLogs.filter((l) => ['REPLAY_DETECTED', 'REPLAY_ATTACK_DETECTED', 'REPLAY_ATTACK_BLOCKED'].includes(l.eventType)).length;
        forgeryCount = inMemoryLogs.filter((l) => ['FORGERY_DETECTED', 'FORGERY_ATTACK_DETECTED'].includes(l.eventType)).length;
        fakeConfirmationCount = inMemoryLogs.filter((l) => l.eventType === 'FAKE_CONFIRMATION_DETECTED').length;
        attacksAttempted = countAttackLogs(inMemoryLogs).length;
        attacksDetected = countAttackLogs(inMemoryLogs).filter((l) => l.result === 'BLOCKED').length;
        timestampExpired = inMemoryLogs.filter((l) => l.eventType === 'TIMESTAMP_EXPIRED').length;

        sha256Passed = inMemoryLogs.filter((l) => l.eventType === 'INTEGRITY_VERIFIED').length;
        sha256Failed = inMemoryLogs.filter((l) => ['HASH_MISMATCH_DETECTED', 'INTEGRITY_FAILURE'].includes(l.eventType)).length;

        hmacPassed = inMemoryLogs.filter((l) => l.eventType === 'HMAC_VERIFIED').length;
        hmacFailed = inMemoryLogs.filter((l) => ['HMAC_FAILURE', 'HMAC_AUTH_FAILED', 'HMAC_VERIFICATION_FAILED'].includes(l.eventType)).length;

        rsaPassed = inMemoryLogs.filter((l) => l.eventType === 'SIGNATURE_VERIFIED').length;
        rsaFailed = inMemoryLogs.filter((l) => ['SIGNATURE_REJECTED', 'SIGNATURE_INVALID', 'SIGNATURE_FAILURE', 'FORGERY_DETECTED'].includes(l.eventType)).length;

        replayBlocked = replayCount;

        recentTransactions = inMemoryTransactions.slice(0, 6);
        recentLogs = inMemoryLogs.slice(0, 10);
      }
    } else {
      // In-Memory store
      totalTransactions = inMemoryTransactions.length;
      successfulTransactions = inMemoryTransactions.filter((t) => t.status === 'COMPLETED' || t.status === 'SUCCESS').length;
      pendingTransactions = inMemoryTransactions.filter((t) => t.status === 'PENDING').length;
      rejectedTransactions = inMemoryTransactions.filter((t) => t.status === 'REJECTED' || t.status === 'TAMPERED').length;

      tamperingCount = inMemoryLogs.filter((l) => ['TAMPERING_DETECTED', 'TAMPERING_ATTACK_DETECTED', 'HASH_MISMATCH_DETECTED'].includes(l.eventType)).length;
      replayCount = inMemoryLogs.filter((l) => ['REPLAY_DETECTED', 'REPLAY_ATTACK_DETECTED', 'REPLAY_ATTACK_BLOCKED'].includes(l.eventType)).length;
      forgeryCount = inMemoryLogs.filter((l) => ['FORGERY_DETECTED', 'FORGERY_ATTACK_DETECTED'].includes(l.eventType)).length;
      fakeConfirmationCount = inMemoryLogs.filter((l) => l.eventType === 'FAKE_CONFIRMATION_DETECTED').length;
      attacksAttempted = countAttackLogs(inMemoryLogs).length;
      attacksDetected = countAttackLogs(inMemoryLogs).filter((l) => l.result === 'BLOCKED').length;
      timestampExpired = inMemoryLogs.filter((l) => l.eventType === 'TIMESTAMP_EXPIRED').length;

      sha256Passed = inMemoryLogs.filter((l) => l.eventType === 'INTEGRITY_VERIFIED').length;
      sha256Failed = inMemoryLogs.filter((l) => ['HASH_MISMATCH_DETECTED', 'INTEGRITY_FAILURE'].includes(l.eventType)).length;

      hmacPassed = inMemoryLogs.filter((l) => l.eventType === 'HMAC_VERIFIED').length;
      hmacFailed = inMemoryLogs.filter((l) => ['HMAC_FAILURE', 'HMAC_AUTH_FAILED', 'HMAC_VERIFICATION_FAILED'].includes(l.eventType)).length;

      rsaPassed = inMemoryLogs.filter((l) => l.eventType === 'SIGNATURE_VERIFIED').length;
      rsaFailed = inMemoryLogs.filter((l) => ['SIGNATURE_REJECTED', 'SIGNATURE_INVALID', 'SIGNATURE_FAILURE', 'FORGERY_DETECTED'].includes(l.eventType)).length;

      replayBlocked = replayCount;

      recentTransactions = inMemoryTransactions.slice(0, 6);
      recentLogs = inMemoryLogs.slice(0, 10);
    }

    const totalAttacksBlocked = tamperingCount + replayCount + forgeryCount + fakeConfirmationCount;

    // Documented Security Score Formula:
    // Ratio of legitimate/verified events + blocked attacks vs total traffic
    // Score = ((successfulTransactions + totalAttacksBlocked) / max(1, (totalTransactions + totalAttacksBlocked))) * 100
    let securityScore = 100;
    const totalRecordedItems = totalTransactions + totalAttacksBlocked;
    if (totalRecordedItems > 0) {
      const positiveEvents = successfulTransactions + pendingTransactions + totalAttacksBlocked;
      securityScore = parseFloat(Math.min(100, Math.max(0, (positiveEvents / totalRecordedItems) * 100)).toFixed(1));
    }

    const dbStatus = getDBStatus();

    const summaryPayload = {
      success: true,
      totalTransactions,
      successfulTransactions,
      pendingTransactions,
      awaitingVerification: pendingTransactions,
      rejectedTransactions,
      securityScore,
      storageMode: getStorageMode(dbStatus.connected),
      securityScoreFormula: '((Successful + Pending + Blocked Attacks) / (Total Transactions + Total Attacks)) * 100',
      attacks: {
        tampering: tamperingCount,
        replay: replayCount,
        forgery: forgeryCount,
        fakeConfirmation: fakeConfirmationCount,
        attempted: attacksAttempted,
        detected: attacksDetected,
        total: totalAttacksBlocked,
      },
      verification: {
        sha256Passed,
        sha256Failed,
        hmacPassed,
        hmacFailed,
        rsaPassed,
        rsaFailed,
        replayBlocked,
        timestampExpired,
      },
      systemEngines: {
        sha256: {
          active: true,
          status: 'Active',
          algorithm: 'SHA-256 (256-bit)',
          standard: 'FIPS PUB 180-4',
          purpose: 'Transaction Integrity & Canonical Digest',
        },
        hmac: {
          active: true,
          status: 'Active',
          algorithm: 'HMAC-SHA-256',
          standard: 'RFC 2104',
          purpose: 'Payment Gateway Authentication & Integrity',
        },
        rsaSignature: {
          active: true,
          status: 'Active',
          algorithm: 'RSA-2048 (PKCS#1 v2.2)',
          standard: 'RFC 8017 / RSA-SHA256',
          purpose: 'Sender Authentication & Non-Repudiation',
        },
        nonce: {
          active: true,
          status: 'Active',
          algorithm: '128-bit CSPRNG (crypto.randomBytes)',
          standard: 'Unique Entropy Nonce',
          purpose: 'Single-Use Transaction Uniqueness',
        },
        timestamp: {
          active: true,
          status: 'Active',
          freshnessWindowSeconds: 300,
          standard: 'Server Monotonic Clock',
          purpose: 'Freshness Validation & Stale Packet Dropping',
        },
        replayProtection: {
          active: true,
          status: 'Active',
          mechanism: 'Atomic MongoDB State Transition + Runtime Nonce Store',
          purpose: 'Duplicate & Replay Attack Elimination',
        },
      },
      database: dbStatus,
      recentTransactions,
      recentSecurityEvents: recentLogs,
    };

    res.status(200).json(summaryPayload);
  } catch (error) {
    next(error);
  }
};

/**
 * Get full security audit logs
 * GET /api/security/logs
 */
const getSecurityAuditLogs = async (req, res, next) => {
  try {
    const { severity, limit = 50, transactionId } = req.query;
    let query = {};
    if (severity && severity !== 'ALL') {
      query.severity = severity;
    }
    if (transactionId) {
      query.transactionId = transactionId;
    }

    let logs = [];
    const isDbReady = mongoose.connection && mongoose.connection.readyState === 1;
    if (isDbReady) {
      try {
        logs = await SecurityLog.find(query).sort({ createdAt: -1 }).limit(Number(limit));
      } catch (e) {
        logs = inMemoryLogs;
      }
    } else {
      logs = inMemoryLogs
        .filter((l) => (severity && severity !== 'ALL' ? l.severity === severity : true))
        .filter((l) => (transactionId ? l.transactionId === transactionId : true))
        .slice(0, Number(limit));
    }

    res.status(200).json({
      success: true,
      count: logs.length,
      logs,
    });
  } catch (error) {
    next(error);
  }
};

const { clearNonceStore } = require('../crypto/nonce');

/**
 * Reset all ledger transactions, security logs, and nonces to zero state.
 * POST /api/security/reset or POST /api/dashboard/reset
 *
 * Destructive: restricted to local/demo environments. In production the
 * endpoint refuses to run unless ALLOW_DEMO_RESET=true is explicitly set.
 */
const resetDemoState = async (req, res, next) => {
  try {
    if (!isDemoResetAllowed()) {
      return res.status(403).json({
        success: false,
        reason: 'RESET_DISABLED_IN_PRODUCTION',
        message: 'Demo reset is disabled in production. Set ALLOW_DEMO_RESET=true to enable it explicitly.',
      });
    }

    const isDbReady = mongoose.connection && mongoose.connection.readyState === 1;
    if (isDbReady) {
      try {
        await Transaction.deleteMany({});
        await SecurityLog.deleteMany({});
      } catch (e) {}
    }

    inMemoryTransactions.length = 0;
    inMemoryLogs.length = 0;
    if (!isDbReady) saveStore();
    clearNonceStore();

    res.status(200).json({
      success: true,
      message: 'Demo state successfully reset to zero. All transactions, logs, and nonces cleared.',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getSecurityDashboardMetrics,
  getSecurityAuditLogs,
  recordSecurityEvent,
  resetDemoState,
  inMemoryLogs,
};
