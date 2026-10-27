import React, { useState } from 'react';
import { X, Lock, Key, ShieldCheck, Clock, CheckCircle2, Copy, Zap, ShieldAlert, Check, Play, AlertTriangle } from 'lucide-react';
import CryptoBadge from './CryptoBadge';
import { transactionService, securityService } from '../services/api';

const TransactionModal = ({ transaction: initialTx, onClose, onUpdated }) => {
  const [transaction, setTransaction] = useState(initialTx);
  const [processing, setProcessing] = useState(false);
  const [processResult, setProcessResult] = useState(null);
  const [processError, setProcessError] = useState(null);
  // '' | 'payload' | 'sha' | 'hmac' | 'rsa' when the copy succeeded,
  // 'failed:<key>' when the browser refused clipboard access.
  const [copiedKey, setCopiedKey] = useState('');

  // Server-side verification (Verify Transaction action)
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState(null);
  const [verifyError, setVerifyError] = useState('');
  const [secEvents, setSecEvents] = useState(null); // null = not loaded

  if (!transaction) return null;

  /**
   * Copy a public cryptographic value (hash / HMAC tag / signature).
   * navigator.clipboard rejects when the document is not focused, when the page
   * is not a secure context, or when permission is denied, so the legacy
   * execCommand path is used as a fallback and a failure is reported instead of
   * throwing an unhandled rejection.
   */
  const copyToClipboard = async (text, key) => {
    const value = String(text || '');
    let ok = false;

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(value);
        ok = true;
      }
    } catch (err) {
      ok = false;
    }

    if (!ok) {
      try {
        const area = document.createElement('textarea');
        area.value = value;
        area.setAttribute('readonly', '');
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        ok = document.execCommand('copy');
        document.body.removeChild(area);
      } catch (err) {
        ok = false;
      }
    }

    setCopiedKey(ok ? key : `failed:${key}`);
    setTimeout(() => setCopiedKey(''), 2000);
  };

  const handleProcess = async (options = {}) => {
    setProcessing(true);
    setProcessResult(null);
    setProcessError(null);

    try {
      const res = await transactionService.process(transaction.transactionId, options);
      if (res.success) {
        setProcessResult(res);
        const updated = {
          ...transaction,
          status: 'COMPLETED',
          processedAt: res.processedAt,
          consumedAt: res.consumedAt,
        };
        setTransaction(updated);
        if (onUpdated) onUpdated(updated);
      } else {
        setProcessError(res);
      }
    } catch (err) {
      const errData = err.response?.data || {
        success: false,
        reason: 'PROCESS_ERROR',
        message: err.message || 'Failed to process transaction',
      };
      setProcessError(errData);
    } finally {
      setProcessing(false);
    }
  };

  const txHash = transaction.transactionHash || transaction.sha256Hash || '';
  const hmacSig = transaction.hmac || transaction.hmacSignature || '';
  const rsaSig = transaction.digitalSignature || transaction.rsaSignature || '';

  const handleVerify = async () => {
    if (verifying) return;
    setVerifying(true);
    setVerifyError('');
    setVerifyResult(null);
    try {
      const res = await transactionService.verifySecurity(transaction.transactionId);
      setVerifyResult(res);
    } catch (err) {
      setVerifyError(
        err.response?.data?.message || err.message || 'Verification request failed. Please try again.'
      );
    } finally {
      setVerifying(false);
    }
  };

  const loadSecurityEvents = async () => {
    if (secEvents !== null) {
      setSecEvents(null);
      return;
    }
    try {
      const res = await securityService.getLogs({ transactionId: transaction.transactionId, limit: 20 });
      setSecEvents(res.success ? res.logs || [] : []);
    } catch (err) {
      setSecEvents([]);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '740px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <h2 id="modal-title" style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>Cryptographic Audit Inspector</h2>
              <CryptoBadge status={transaction.status} />
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              Transaction ID: <span className="font-mono" style={{ color: 'var(--text-primary)' }}>{transaction.transactionId}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn btn-secondary"
            style={{ padding: '0.45rem', borderRadius: 'var(--radius-sm)' }}
            aria-label="Close inspector modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Transaction Core Properties Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: '0.75rem',
            marginBottom: '1.25rem',
            background: 'var(--bg-card-subtle)',
            padding: '1rem',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div>
            <div style={{ fontSize: '0.675rem', color: 'var(--text-muted)', fontWeight: 600 }}>SENDER</div>
            <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{transaction.senderName || transaction.sender || 'N/A'}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.675rem', color: 'var(--text-muted)', fontWeight: 600 }}>RECEIVER</div>
            <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{transaction.receiverName || transaction.receiver}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.675rem', color: 'var(--text-muted)', fontWeight: 600 }}>AMOUNT</div>
            <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--accent-cyan)' }}>
              {transaction.currency === 'USD' ? '$' : transaction.currency === 'EUR' ? '€' : '₹'}{Number(transaction.amount).toFixed(2)} {transaction.currency || 'INR'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.675rem', color: 'var(--text-muted)', fontWeight: 600 }}>TIMESTAMP</div>
            <div style={{ fontSize: '0.785rem', color: 'var(--text-secondary)' }}>
              {new Date(transaction.timestamp || transaction.createdAt).toLocaleTimeString()}
            </div>
          </div>
          <div style={{ gridColumn: 'span 2' }}>
            <div style={{ fontSize: '0.675rem', color: 'var(--text-muted)', fontWeight: 600 }}>CSPRNG NONCE</div>
            <div className="font-mono" style={{ fontSize: '0.75rem', color: '#d97706', wordBreak: 'break-all' }}>
              {transaction.nonce}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.675rem', color: 'var(--text-muted)', fontWeight: 600 }}>PROCESSED STATUS</div>
            <div style={{ fontSize: '0.785rem', color: transaction.processedAt ? 'var(--accent-success)' : 'var(--text-muted)', fontWeight: 600 }}>
              {transaction.processedAt ? `Processed (${new Date(transaction.processedAt).toLocaleTimeString()})` : 'Pending Processing'}
            </div>
          </div>
        </div>

        {/* Real Replay Protection Action Box */}
        <div
          style={{
            marginBottom: '1.25rem',
            padding: '1rem',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(88, 101, 242, 0.05)',
            border: '1px solid rgba(99, 102, 241, 0.25)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, fontSize: '0.85rem', color: '#4f46e5' }}>
              <Zap size={15} /> Anti-Replay Processor
            </div>
            <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
              Status: <strong style={{ color: transaction.status === 'COMPLETED' ? '#059669' : '#d97706' }}>{transaction.status}</strong>
            </span>
          </div>

          {processResult && (
            <div
              style={{
                background: 'var(--accent-success-bg)',
                border: '1px solid var(--accent-success-border)',
                borderRadius: 'var(--radius-sm)',
                padding: '0.6rem 0.8rem',
                marginBottom: '0.6rem',
                fontSize: '0.8rem',
                color: 'var(--accent-success)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              <CheckCircle2 size={16} />
              <span>✓ Transaction Processed: Nonce consumed at {new Date(processResult.processedAt).toLocaleTimeString()}</span>
            </div>
          )}

          {processError && (
            <div
              style={{
                background: 'var(--accent-danger-bg)',
                border: '1px solid var(--accent-danger-border)',
                borderRadius: 'var(--radius-sm)',
                padding: '0.6rem 0.8rem',
                marginBottom: '0.6rem',
                fontSize: '0.8rem',
                color: 'var(--accent-danger)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              <ShieldAlert size={16} />
              <span>{processError.reason === 'REPLAY_ATTACK_DETECTED' ? '🚨 Replay Attack Detected: ' : '✗ Error: '} {processError.message}</span>
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              onClick={() => handleProcess()}
              className="btn btn-primary btn-sm"
              disabled={processing}
            >
              <Check size={14} />
              {processing ? 'Processing...' : (transaction.status === 'COMPLETED' ? 'Re-Process (Test Replay Attack)' : 'Process Transaction')}
            </button>
            <button
              onClick={() => handleProcess({ simulateExpired: true })}
              className="btn btn-secondary btn-sm"
              disabled={processing}
            >
              <Clock size={13} /> Test Stale Expiry
            </button>
          </div>
        </div>

        {/* Server-side verification (Verify Transaction) */}
        <div
          style={{
            marginBottom: '1.25rem',
            padding: '1rem',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(88, 101, 242, 0.05)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, fontSize: '0.85rem', color: '#059669' }}>
              <ShieldCheck size={15} /> Verify Transaction
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="button" className="btn btn-primary btn-sm" onClick={handleVerify} disabled={verifying}>
                {verifying ? (
                  <>
                    <Clock size={13} className="spin-animation" /> Verifying…
                  </>
                ) : (
                  <>
                    <Play size={13} /> Run verification
                  </>
                )}
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={loadSecurityEvents}>
                {secEvents === null ? 'Show security events' : 'Hide security events'}
              </button>
            </div>
          </div>

          {verifyError && (
            <div
              style={{
                marginTop: '0.65rem',
                background: 'var(--accent-danger-bg)',
                border: '1px solid var(--accent-danger-border)',
                borderRadius: 'var(--radius-sm)',
                padding: '0.6rem 0.8rem',
                fontSize: '0.78rem',
                color: 'var(--accent-danger)',
              }}>
              Error: {verifyError}
            </div>
          )}

          {verifyResult && (
            <div
              style={{
                marginTop: '0.65rem',
                background: verifyResult.securityVerified ? 'var(--accent-success-bg)' : 'var(--accent-danger-bg)',
                border: `1px solid ${verifyResult.securityVerified ? 'var(--accent-success-border)' : 'var(--accent-danger-border)'}`,
                borderRadius: 'var(--radius-sm)',
                padding: '0.7rem 0.85rem',
                fontSize: '0.78rem',
                color: verifyResult.securityVerified ? 'var(--accent-success)' : 'var(--accent-danger)',
              }}>
              <div style={{ fontWeight: 700, marginBottom: '0.3rem' }}>
                {verifyResult.securityVerified ? 'VERIFIED — TRANSACTION SECURE' : 'REJECTED — CHECKS FAILED'}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.35rem', color: 'var(--text-secondary)' }}>
                <span>SHA-256: {verifyResult.checks?.sha256?.verified ? 'PASSED' : 'FAILED'}</span>
                <span>HMAC: {verifyResult.checks?.hmac?.verified ? 'PASSED' : 'FAILED'}</span>
                <span>RSA: {verifyResult.checks?.rsaSignature?.verified ? 'PASSED' : 'FAILED'}</span>
                <span>Timestamp: {verifyResult.checks?.timestamp?.verified ? 'FRESH' : 'EXPIRED'}</span>
                <span>Nonce/Replay: {verifyResult.checks?.replayProtection?.verified ? 'VALID' : 'BLOCKED'}</span>
              </div>
              <div style={{ color: 'var(--text-muted)', marginTop: '0.3rem' }}>{verifyResult.message}</div>
            </div>
          )}

          {secEvents !== null && (
            <div style={{ marginTop: '0.65rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {secEvents.length === 0 ? (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  No security events recorded for this transaction yet.
                </div>
              ) : (
                secEvents.map((ev) => (
                  <div
                    key={ev._id || ev.logId}
                    style={{
                      display: 'flex',
                      gap: '0.5rem',
                      alignItems: 'flex-start',
                      fontSize: '0.73rem',
                      background: 'var(--bg-card-subtle)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.45rem 0.6rem',
                    }}>
                    {ev.result === 'BLOCKED' || ev.severity === 'HIGH' || ev.severity === 'CRITICAL' ? (
                      <AlertTriangle size={12} color="var(--accent-danger)" style={{ marginTop: '2px', flexShrink: 0 }} />
                    ) : (
                      <CheckCircle2 size={12} color="var(--accent-success)" style={{ marginTop: '2px', flexShrink: 0 }} />
                    )}
                    <div style={{ minWidth: 0 }}>
                      <span className="font-mono" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                        {ev.eventType}
                      </span>{' '}
                      <span style={{ color: 'var(--text-muted)' }}>
                        {ev.createdAt ? new Date(ev.createdAt).toLocaleTimeString() : ''}
                      </span>
                      <div style={{ color: 'var(--text-secondary)' }}>{ev.details}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Cryptographic Hashes & Signatures */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '280px', overflowY: 'auto' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
              <label className="form-label" style={{ marginBottom: 0, fontSize: '0.75rem' }}>Canonical Serialized Payload</label>
              <button
                onClick={() => copyToClipboard(transaction.canonicalPayload || '', 'payload')}
                className="btn btn-secondary btn-sm"
                style={{ padding: '0.15rem 0.45rem', fontSize: '0.675rem' }}
                type="button"
              >
                <Copy size={11} />{' '}
                {copiedKey === 'payload' ? 'Copied!' : copiedKey === 'failed:payload' ? 'Copy failed' : 'Copy'}
              </button>
            </div>
            <div className="crypto-hash-box" style={{ fontSize: '0.725rem' }}>
              {transaction.canonicalPayload || 'N/A'}
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
              <label className="form-label" style={{ marginBottom: 0, fontSize: '0.75rem' }}>1. SHA-256 Digest (Integrity)</label>
              <button
                onClick={() => copyToClipboard(txHash, 'sha')}
                className="btn btn-secondary btn-sm"
                style={{ padding: '0.15rem 0.45rem', fontSize: '0.675rem' }}
                type="button"
              >
                <Copy size={11} />{' '}
                {copiedKey === 'sha' ? 'Copied!' : copiedKey === 'failed:sha' ? 'Copy failed' : 'Copy'}
              </button>
            </div>
            <div className="crypto-hash-box" style={{ color: '#4f46e5', fontSize: '0.775rem' }}>
              {txHash}
            </div>
          </div>

          {hmacSig && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                <label className="form-label" style={{ marginBottom: 0, fontSize: '0.75rem' }}>2. HMAC-SHA-256 (Gateway Authentication)</label>
                <button
                  onClick={() => copyToClipboard(hmacSig, 'hmac')}
                  className="btn btn-secondary btn-sm"
                  style={{ padding: '0.15rem 0.45rem', fontSize: '0.675rem' }}
                  type="button"
                >
                  <Copy size={11} />{' '}
                  {copiedKey === 'hmac' ? 'Copied!' : copiedKey === 'failed:hmac' ? 'Copy failed' : 'Copy'}
                </button>
              </div>
              <div className="crypto-hash-box" style={{ color: '#7c3aed', fontSize: '0.775rem' }}>
                {hmacSig}
              </div>
            </div>
          )}

          {rsaSig && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                <label className="form-label" style={{ marginBottom: 0, fontSize: '0.75rem' }}>3. RSA-2048 Digital Signature (Non-Repudiation)</label>
                <button
                  onClick={() => copyToClipboard(rsaSig, 'rsa')}
                  className="btn btn-secondary btn-sm"
                  style={{ padding: '0.15rem 0.45rem', fontSize: '0.675rem' }}
                  type="button"
                >
                  <Copy size={11} />{' '}
                  {copiedKey === 'rsa' ? 'Copied!' : copiedKey === 'failed:rsa' ? 'Copy failed' : 'Copy'}
                </button>
              </div>
              <div className="crypto-hash-box" style={{ color: '#059669', fontSize: '0.725rem' }}>
                {rsaSig}
              </div>
            </div>
          )}
        </div>

        <div style={{ marginTop: '1.25rem', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} className="btn btn-secondary">
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
};

export default TransactionModal;
