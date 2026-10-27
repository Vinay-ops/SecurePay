import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Send,
  Wallet,
  AlertCircle,
  Users,
  FileCheck2,
  ShieldAlert,
  ArrowRight,
  HardDrive,
} from 'lucide-react';
import { useDemo } from '../context/DemoContext';
import TransactionLifecycleModal from '../components/TransactionLifecycleModal';

const MakePaymentPage = () => {
  const { accounts, storageMode, note, loading, refresh } = useDemo();

  const [senderChoice, setSenderChoice] = useState('');
  const [receiverChoice, setReceiverChoice] = useState('');
  const [senderCustom, setSenderCustom] = useState('');
  const [receiverCustom, setReceiverCustom] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [error, setError] = useState('');
  const [payment, setPayment] = useState(null); // opens the lifecycle modal

  // Sensible defaults once the demo accounts arrive
  useEffect(() => {
    if (!senderChoice && accounts.length > 0) {
      setSenderChoice(accounts[0].name);
      setReceiverChoice(accounts[1]?.name || '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts]);

  const effectiveSender = senderChoice === '__custom' ? senderCustom.trim() : senderChoice;
  const effectiveReceiver = receiverChoice === '__custom' ? receiverCustom.trim() : receiverChoice;

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!effectiveSender) {
      setError('Please choose or enter a sender identity.');
      return;
    }
    if (!effectiveReceiver) {
      setError('Please choose or enter a receiver identity.');
      return;
    }
    if (effectiveSender.toLowerCase() === effectiveReceiver.toLowerCase()) {
      setError('Sender and receiver must be different identities.');
      return;
    }
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Please enter a valid amount greater than 0.');
      return;
    }

    setPayment({
      sender: effectiveSender,
      receiver: effectiveReceiver,
      amount: parsedAmount,
      currency,
    });
  };

  const senderNames = accounts.map((a) => a.name);
  const receiverNames = accounts.map((a) => a.name).filter((n) => n !== effectiveSender);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Send Payment</h1>
          <p className="page-subtitle">Transfer funds between demo accounts and watch each verification step.</p>
        </div>
        <Link to="/history" className="btn btn-secondary" style={{ padding: '0.5rem 0.9rem' }}>
          Transaction Ledger <ArrowRight size={14} />
        </Link>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.75rem' }}>
        {/* Payment form */}
        <div className="crypto-card">
          <div className="card-header-flex">
            <h2 className="card-title">
              <Send size={18} color="var(--accent-primary)" /> Payment Details
            </h2>
            <span className="badge badge-cyan">DEMO MODE · NO LOGIN</span>
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
                marginBottom: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="pay-sender">
                Sender identity (pays the amount)
              </label>
              <select
                id="pay-sender"
                className="form-control"
                value={senderChoice}
                onChange={(e) => setSenderChoice(e.target.value)}
              >
                <option value="">Select sender…</option>
                {senderNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
                <option value="__custom">Custom identity…</option>
              </select>
              {senderChoice === '__custom' && (
                <input
                  type="text"
                  className="form-control"
                  style={{ marginTop: '0.5rem' }}
                  placeholder="Enter a sender name"
                  value={senderCustom}
                  onChange={(e) => setSenderCustom(e.target.value)}
                />
              )}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="pay-receiver">
                Receiver identity
              </label>
              <select
                id="pay-receiver"
                className="form-control"
                value={receiverChoice}
                onChange={(e) => setReceiverChoice(e.target.value)}
              >
                <option value="">Select receiver…</option>
                {receiverNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
                <option value="__custom">Custom identity…</option>
              </select>
              {receiverChoice === '__custom' && (
                <input
                  type="text"
                  className="form-control"
                  style={{ marginTop: '0.5rem' }}
                  placeholder="Enter a receiver name"
                  value={receiverCustom}
                  onChange={(e) => setReceiverCustom(e.target.value)}
                />
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.85rem' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="pay-amount">
                  Amount
                </label>
                <input
                  id="pay-amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  className="form-control font-mono"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
                <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.5rem' }}>
                  {[100, 500, 1000].map((v) => (
                    <button
                      key={v}
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '0.2rem 0.6rem', fontSize: '0.72rem' }}
                      onClick={() => setAmount(String(v))}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="pay-currency">
                  Currency
                </label>
                <select
                  id="pay-currency"
                  className="form-control"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                >
                  <option value="INR">INR (₹)</option>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', padding: '0.85rem', fontSize: '0.95rem', marginTop: '0.35rem' }}
              disabled={loading}
            >
              <Send size={16} /> Send Payment
            </button>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.65rem', lineHeight: 1.5 }}>
              Sending opens the animated lifecycle. Funds move only if the <strong>server</strong> accepts the
              transaction; an over-balance amount is rejected with a real server response.
            </p>
          </form>
        </div>

        {/* Demo accounts */}
        <div className="crypto-card">
          <div className="card-header-flex">
            <h2 className="card-title">
              <Users size={18} color="var(--accent-cyan)" /> Demo Accounts &amp; Balances
            </h2>
            <button type="button" className="btn btn-secondary btn-sm" onClick={refresh} disabled={loading}>
              Refresh
            </button>
          </div>

          {loading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              Loading demo accounts…
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {accounts.map((acct) => (
                <div
                  key={acct.email}
                  style={{
                    background: 'var(--bg-card-subtle)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    padding: '1rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '1rem',
                    flexWrap: 'wrap',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Wallet size={15} color="var(--accent-cyan)" />
                      <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.95rem' }}>{acct.name}</span>
                      <span className="badge badge-blue" style={{ fontSize: '0.62rem' }}>
                        SHARED DEMO IDENTITY
                      </span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: '0.2rem' }}>
                      {acct.email}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                      BALANCE
                    </div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent-success)' }}>
                      {Number(acct.balance).toLocaleString('en-IN', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </div>
                  </div>
                </div>
              ))}

              <div
                style={{
                  background: 'rgba(88, 101, 242, 0.08)',
                  border: '1px solid rgba(88, 101, 242, 0.25)',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.7rem 0.9rem',
                  fontSize: '0.75rem',
                  color: '#4338ca',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  flexWrap: 'wrap',
                }}
                title={note}
              >
                <HardDrive size={13} />
                <span>{storageMode || 'storage unknown'}</span>
              </div>

              <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                <Link to="/verify" className="btn btn-secondary btn-sm" style={{ flex: 1 }}>
                  <FileCheck2 size={14} /> Verify a Transaction
                </Link>
                <Link to="/simulation" className="btn btn-danger btn-sm" style={{ flex: 1 }}>
                  <ShieldAlert size={14} /> Attack Lab
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      {payment && (
        <TransactionLifecycleModal
          payment={payment}
          onClose={() => setPayment(null)}
          onCompleted={() => refresh()}
        />
      )}
    </div>
  );
};

export default MakePaymentPage;
