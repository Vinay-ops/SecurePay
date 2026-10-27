const mongoose = require('mongoose');

const securityLogSchema = new mongoose.Schema(
  {
    logId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    eventType: {
      type: String,
      required: true,
      enum: [
        'TRANSACTION_CREATED',
        'TRANSACTION_PROCESSED',
        'TRANSACTION_REJECTED',
        'INTEGRITY_VERIFIED',
        'HASH_MISMATCH_DETECTED',
        'INTEGRITY_FAILURE',
        'HMAC_VERIFIED',
        'HMAC_FAILURE',
        'HMAC_AUTH_FAILED',
        'HMAC_VERIFICATION_FAILED',
        'SIGNATURE_VERIFIED',
        'SIGNATURE_REJECTED',
        'SIGNATURE_FAILURE',
        'SIGNATURE_INVALID',
        'TIMESTAMP_EXPIRED',
        'REPLAY_DETECTED',
        'REPLAY_ATTACK_DETECTED',
        'REPLAY_ATTACK_BLOCKED',
        'TAMPERING_DETECTED',
        'TAMPERING_ATTACK_DETECTED',
        'FORGERY_DETECTED',
        'FORGERY_ATTACK_DETECTED',
        'COMBINED_SECURITY_VERIFIED',
        'COMBINED_SECURITY_FAILED',
        'SIMULATION_ATTACK_LAUNCHED',
        'FAKE_CONFIRMATION_DETECTED',
        'FAKE_CONFIRMATION_VERIFIED',
        'AUTH_SUCCESS',
        'AUTH_FAILURE',
        'KEY_GENERATED',
        'SECURITY_ANOMALY',
      ],
    },
    result: {
      type: String,
      enum: ['SUCCESS', 'BLOCKED', 'FAILED', 'INFO', 'WARNING'],
      default: 'INFO',
    },
    severity: {
      type: String,
      enum: ['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      default: 'INFO',
    },
    details: {
      type: String,
      required: true,
    },
    transactionId: {
      type: String,
      default: null,
      index: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    ip: {
      type: String,
      default: '127.0.0.1',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('SecurityLog', securityLogSchema);
