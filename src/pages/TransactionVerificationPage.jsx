import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  FileCheck2,
  CheckCircle2,
  XCircle,
  Lock,
  KeyRound,
  RefreshCw,
  AlertTriangle,
  Play,
  ShieldCheck,
  Sliders,
  Clock,
  Zap,
} from 'lucide-react';
import { transactionService } from '../services/api';
import CryptoValueDisplay from '../components/CryptoValueDisplay';

const TransactionVerificationPage = () => {
  const [searchParams] = useSearchParams();
  const initialTxId = searchParams.get('txId') || searchParams.get('id') || '';

  const [transactionId, setTransactionId] = useState(initialTxId);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [loadingRecent, setLoadingRecent] = useState(false);

  // Academic Tamper Toggle for test demonstration
  const [enableTamper, setEnableTamper] = useState(false);
  const [tamperedAmount, setTamperedAmount] = useState('');
  const [tamperedReceiver, setTamperedReceiver] = useState('');
  const [tamperSignature, setTamperSignature] = useState(false);

  // Verification execution states
  const [verifyingSecurity, setVerifyingSecurity] = useState(false);
  const [securityResult, setSecurityResult] = useState(null);
  const [error, setError] = useState('');

  // Fetch recent real transactions from MongoDB
  const fetchRecent = async () => {
    setLoadingRecent(true);
    try {
      const res = await transactionService.getAll({ limit: 8 });
      if (res.success && res.transactions?.length > 0) {
        setRecentTransactions(res.transactions);
        if (!transactionId && res.transactions[0]) {
          setTransactionId(res.transactions[0].transactionId);
        }
      }
    } catch (e) {
      console.warn('Failed to load recent transactions', e);
    } finally {
      setLoadingRecent(false);
    }
  };

  useEffect(() => {
    fetchRecent();
  }, []);

  useEffect(() => {
    if (initialTxId) {
      setTransactionId(initialTxId);
      handleVerifyCompleteSecurity(initialTxId);
    }
  }, [initialTxId]);

  const getTamperPayload = () => {
    if (!enableTamper) return {};
    const payload = {
      simulateTamper: true,
      tamperedAmount: parseFloat(tamperedAmount),
      tamperedReceiver: tamperedReceiver,
    };
    if (tamperSignature) {
      payload.tamperedSignature = 'INVALID_FORGED_SIGNATURE_' + Math.random().toString(36).substring(2);
    }
    return payload;
  };

  const handleVerifyCompleteSecurity = async (targetId = transactionId) => {
    const idToVerify = (targetId || transactionId || '').trim();
    if (!idToVerify) {
      setError('Please enter or select a Transaction ID to verify.');
      return;
    }

    if (verifyingSecurity) return;

    setError('');
    setVerifyingSecurity(true);
    try {
      const res = await transactionService.verifySecurity(idToVerify, getTamperPayload());
      setSecurityResult(res);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Unable to verify this transaction. Please try again.');
      setSecurityResult(null);
    } finally {
      setVerifyingSecurity(false);
    }
  };

  const checks = securityResult?.checks || {};
  const isSecure = securityResult?.securityVerified === true || securityResult?.status === 'TRANSACTION_SECURE';

  /**
   * The backend's combined gate answers "may this packet be accepted right now?".
   * For an AUDIT of an already-recorded transaction we must separate two very
   * different facts, otherwise a perfectly genuine old transaction would look
   * tampered:
   *   - recordAuthentic : SHA-256 + HMAC + RSA all match the ledger record.
   *   - replayBlocked   : timestamp window expired and/or nonce already consumed.
   */
  const recordAuthentic =
    checks.sha256?.verified === true &&
    checks.hmac?.verified === true &&
    checks.rsaSignature?.verified === true;

  const replayBlocked =
    checks.timestamp?.valid === false || checks.replayProtection?.valid === false;

  const replayReason = [
    checks.timestamp?.valid === false ? checks.timestamp?.message : null,
    checks.replayProtection?.valid === false ? checks.replayProtection?.message : null,
  ]
    .filter(Boolean)
    .join(' ');

  const verdictTone = recordAuthentic ? 'success' : 'danger';
  const verdictTitle = recordAuthentic
    ? replayBlocked
      ? '✓ RECORD AUTHENTIC — REPLAY-PROOF'
      : '✓ TRANSACTION SECURE'
    : '✗ TAMPERING DETECTED — TRANSACTION REJECTED';
  const verdictDetail = recordAuthentic
    ? replayBlocked
      ? `Hashes and signature match the ledger record. Replay guard active: ${replayReason}`
      : 'Hashes and signature match the ledger record.'
    : securityResult?.message;

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Verify Transaction</h1>
          <p className="page-subtitle">Check integrity, authenticity, signature and replay status.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '1.75rem' }}>
        {/* Left Column: Transaction Selection & Simulation Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Target Selection Card */}
          <div className="crypto-card">
            <div className="card-header-flex">
              <h2 className="card-title">
                <FileCheck2 size={18} color="var(--accent-primary)" /> Select Transaction
              </h2>
              <span className="badge badge-blue">Audit Input</span>
            </div>

            {error && (
              <div
                style={{
                  background: 'var(--accent-danger-bg)',
                  border: '1px solid var(--accent-danger-border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.75rem 1rem',
                  color: 'var(--accent-danger)',
                  fontSize: '0.825rem',
                  marginBottom: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}

            <div className="form-group">
              <label className="form-label" htmlFor="verify-tx-id">Transaction ID</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  id="verify-tx-id"
                  type="text"
                  className="form-control font-mono"
                  placeholder="TX-..."
                  value={transactionId}
                  onChange={(e) => setTransactionId(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => handleVerifyCompleteSecurity()}
                  className="btn btn-primary"
                  disabled={verifyingSecurity || !transactionId}
                  style={{ flexShrink: 0, padding: '0.65rem 1.25rem' }}
                >
                  {verifyingSecurity ? (
                    <>
                      <RefreshCw size={14} className="spin-animation" /> Verifying...
                    </>
                  ) : (
                    <>
                      <Play size={14} /> Verify Security
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Quick Ledger Select Pills */}
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 600 }}>
                Select from Recent Ledger Transactions:
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '180px', overflowY: 'auto' }}>
                {recentTransactions.map((tx) => (
                  <button
                    key={tx._id || tx.transactionId}
                    type="button"
                    onClick={() => {
                      setTransactionId(tx.transactionId);
                      handleVerifyCompleteSecurity(tx.transactionId);
                    }}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '0.55rem 0.75rem',
                      background: transactionId === tx.transactionId ? 'rgba(88, 101, 242, 0.15)' : 'var(--bg-card-subtle)',
                      border: `1px solid ${transactionId === tx.transactionId ? 'rgba(88, 101, 242, 0.4)' : 'var(--border-subtle)'}`,
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div>
                      <span className="font-mono" style={{ fontSize: '0.775rem', fontWeight: 600, color: '#5865f2' }}>
                        {tx.transactionId}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginLeft: '0.5rem' }}>
                        {tx.sender || tx.senderName} → {tx.receiver || tx.receiverName}
                      </span>
                    </div>
                    <span className="font-mono" style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {tx.currency === 'USD' ? '$' : tx.currency === 'EUR' ? '€' : '₹'}{Number(tx.amount).toFixed(2)} {tx.currency || 'INR'}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Academic Controlled Tampering Sandbox Toggle */}
            <div
              style={{
                marginTop: '1.25rem',
                paddingTop: '1rem',
                borderTop: '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
                <div style={{ fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Sliders size={14} color="var(--accent-warning)" /> Tamper Simulation Toggle
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.785rem', color: enableTamper ? '#f59e0b' : 'var(--text-muted)' }}>
                  <input
                    type="checkbox"
                    checked={enableTamper}
                    onChange={(e) => setEnableTamper(e.target.checked)}
                  />
                  {enableTamper ? 'Tampering Active' : 'Off'}
                </label>
              </div>

              {enableTamper && (
                <div style={{ background: 'var(--bg-card-subtle)', padding: '0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  <div>
                    <label className="form-label" style={{ fontSize: '0.725rem' }}>Tamper Amount</label>
                    <input
                      type="number"
                      className="form-control font-mono"
                      value={tamperedAmount}
                      onChange={(e) => setTamperedAmount(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="form-label" style={{ fontSize: '0.725rem' }}>Tamper Receiver</label>
                    <input
                      type="text"
                      className="form-control"
                      value={tamperedReceiver}
                      onChange={(e) => setTamperedReceiver(e.target.value)}
                    />
                  </div>
                  <p style={{ fontSize: '0.725rem', color: '#f59e0b', margin: 0 }}>
                    ⚠️ Tests that the verification engine mathematically detects and rejects altered payload packets.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Verification Results */}
        <div className="crypto-card">
          <div className="card-header-flex">
            <h2 className="card-title">
              <ShieldCheck size={18} color="var(--accent-cyan)" /> Verification Result
            </h2>
            {securityResult && (
              <span className={`badge ${verdictTone === 'success' ? 'badge-success' : 'badge-danger'}`}>
                {verdictTone === 'success'
                  ? replayBlocked
                    ? '✓ RECORD AUTHENTIC · REPLAY-PROOF'
                    : '✓ ALL CHECKS PASSED'
                  : '✗ TAMPERING DETECTED'}
              </span>
            )}
          </div>

          {!securityResult ? (
            <div
              style={{
                padding: '3.5rem 1.5rem',
                textAlign: 'center',
                background: 'var(--bg-card-subtle)',
                borderRadius: 'var(--radius-md)',
                border: '1px dashed var(--border-card)',
                color: 'var(--text-muted)',
              }}
            >
              <ShieldCheck size={40} style={{ margin: '0 auto 1rem', display: 'block', opacity: 0.4 }} />
              <div style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                Awaiting Verification Command
              </div>
              <p style={{ fontSize: '0.8rem', maxWidth: '360px', margin: '0 auto', lineHeight: 1.5 }}>
                Select a transaction on the left and click <strong>Verify Security</strong> to perform cryptographic verification of SHA-256, HMAC, RSA signature, and replay protection.
              </p>
            </div>
          ) : (
            <div>
              {/* Comprehensive Security Decision Banner */}
              <div
                style={{
                  background: verdictTone === 'success' ? 'var(--accent-success-bg)' : 'var(--accent-danger-bg)',
                  border: `1px solid ${verdictTone === 'success' ? 'var(--accent-success-border)' : 'var(--accent-danger-border)'}`,
                  borderRadius: 'var(--radius-md)',
                  padding: '1.1rem 1.25rem',
                  marginBottom: '1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                }}
              >
                {verdictTone === 'success' ? (
                  <CheckCircle2 size={30} color="var(--accent-success)" style={{ flexShrink: 0 }} />
                ) : (
                  <XCircle size={30} color="var(--accent-danger)" style={{ flexShrink: 0 }} />
                )}
                <div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 800, color: verdictTone === 'success' ? 'var(--accent-success)' : 'var(--accent-danger)' }}>
                    {verdictTitle}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                    {verdictDetail}
                  </div>
                </div>
              </div>

              {/* 5-Pillar Security Checks Breakdown */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginBottom: '1.25rem' }}>
                {/* 1. SHA-256 Integrity Check */}
                <div style={{ padding: '0.75rem 0.9rem', background: 'var(--bg-card-subtle)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Lock size={14} color="#4f46e5" />
                      <span style={{ fontWeight: 600, fontSize: '0.825rem', color: 'var(--text-primary)' }}>SHA-256 Digest</span>
                    </div>
                    <span className={`badge ${checks.sha256?.verified ? 'badge-success' : 'badge-danger'}`}>
                      {checks.sha256?.verified ? '✓ Verified' : '✗ Failed'}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{checks.sha256?.message}</p>
                </div>

                {/* 2. HMAC Authentication Check */}
                <div style={{ padding: '0.75rem 0.9rem', background: 'var(--bg-card-subtle)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <ShieldCheck size={14} color="#059669" />
                      <span style={{ fontWeight: 600, fontSize: '0.825rem', color: 'var(--text-primary)' }}>HMAC-SHA-256 Authentication</span>
                    </div>
                    <span className={`badge ${checks.hmac?.verified ? 'badge-success' : 'badge-danger'}`}>
                      {checks.hmac?.verified ? '✓ Verified' : '✗ Failed'}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{checks.hmac?.message}</p>
                </div>

                {/* 3. RSA Digital Signature Check */}
                <div style={{ padding: '0.75rem 0.9rem', background: 'var(--bg-card-subtle)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <KeyRound size={14} color="#7c3aed" />
                      <span style={{ fontWeight: 600, fontSize: '0.825rem', color: 'var(--text-primary)' }}>RSA-2048 Digital Signature</span>
                    </div>
                    <span className={`badge ${checks.rsaSignature?.verified ? 'badge-success' : 'badge-danger'}`}>
                      {checks.rsaSignature?.verified ? '✓ Verified' : '✗ Failed'}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{checks.rsaSignature?.message}</p>
                </div>

                {/* 4. Timestamp Freshness Check */}
                <div style={{ padding: '0.75rem 0.9rem', background: 'var(--bg-card-subtle)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Clock size={14} color="#d97706" />
                      <span style={{ fontWeight: 600, fontSize: '0.825rem', color: 'var(--text-primary)' }}>Timestamp Freshness</span>
                    </div>
                    <span className={`badge ${checks.timestamp?.valid ? 'badge-success' : 'badge-warning'}`}>
                      {checks.timestamp?.valid ? '✓ Valid' : 'EXPIRED (RECORD STILL AUTHENTIC)'}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{checks.timestamp?.message}</p>
                </div>

                {/* 5. Nonce & Replay Protection */}
                <div style={{ padding: '0.75rem 0.9rem', background: 'var(--bg-card-subtle)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <RefreshCw size={14} color="#5865f2" />
                      <span style={{ fontWeight: 600, fontSize: '0.825rem', color: 'var(--text-primary)' }}>Replay Protection</span>
                    </div>
                    <span className={`badge ${checks.replayProtection?.valid ? 'badge-success' : 'badge-warning'}`}>
                      {checks.replayProtection?.valid ? '✓ Valid' : 'REPLAY BLOCKED (ALREADY PROCESSED)'}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{checks.replayProtection?.message}</p>
                </div>
              </div>

              {/* Canonical Payload Inspector */}
              <CryptoValueDisplay
                label="Canonical Serialized Payload"
                value={securityResult.canonicalPayload}
                algorithm="Deterministic JSON"
                badgeColor="blue"
                description="Strictly ordered payload used as mathematical input for SHA-256, HMAC, and RSA."
                truncateLength={70}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TransactionVerificationPage;
