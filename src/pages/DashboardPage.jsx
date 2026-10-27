import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  CreditCard,
  CheckCircle,
  XCircle,
  ShieldCheck,
  Activity,
  Send,
  Bug,
  FileCheck2,
  ExternalLink,
  AlertTriangle,
  Clock,
  ShieldAlert,
  Users,
  Timer,
  Radio,
  HardDrive,
} from 'lucide-react';
import { dashboardService, securityService } from '../services/api';
import { useDemo } from '../context/DemoContext';
import CryptoBadge from '../components/CryptoBadge';
import TransactionModal from '../components/TransactionModal';
import SecurityIndicator from '../components/SecurityIndicator';
import EventTimeline from '../components/EventTimeline';

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

const toTimelineEvents = (logs) =>
  logs.map((log) => ({
    id: log._id || log.logId,
    title: log.eventType.replace(/_/g, ' '),
    detail: log.details,
    status:
      log.result === 'BLOCKED' || log.severity === 'CRITICAL' || log.severity === 'HIGH'
        ? 'danger'
        : log.result === 'SUCCESS'
        ? 'success'
        : 'warning',
    time: log.createdAt ? new Date(log.createdAt).toLocaleTimeString() : '',
  }));

const DashboardPage = () => {
  const { accounts, storageMode, refresh: refreshAccounts } = useDemo();

  const [summary, setSummary] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTx, setSelectedTx] = useState(null);
  const [lastUpdated, setLastUpdated] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const [summaryRes, logsRes] = await Promise.all([
        dashboardService.getSecuritySummary(),
        securityService.getLogs({ limit: 40 }),
      ]);
      if (summaryRes && summaryRes.success) setSummary(summaryRes);
      if (logsRes && logsRes.success) setLogs(logsRes.logs || []);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (err) {
      console.warn('Dashboard fetch error', err);
    } finally {
      setLoading(false);
      refreshAccounts();
    }
  }, [refreshAccounts]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Live feed auto-refresh
  useEffect(() => {
    const id = setInterval(fetchData, 6000);
    return () => clearInterval(id);
  }, [fetchData]);

  const handleResetDemo = async () => {
    if (
      !window.confirm(
        'Reset the demo ledger? This deletes ALL demo transactions and security logs on the server. It does not affect anything else.'
      )
    ) {
      return;
    }
    try {
      await dashboardService.reset();
      await fetchData();
    } catch (err) {
      window.alert(
        `Reset failed: ${err.response?.data?.message || err.message}. Resets are disabled in production.`
      );
    }
  };

  const totalTx = summary?.totalTransactions ?? 0;
  const successTx = summary?.successfulTransactions ?? 0;
  const rejectedTx = summary?.rejectedTransactions ?? 0;
  const awaitingTx = summary?.awaitingVerification ?? summary?.pendingTransactions ?? 0;
  const attacksAttempted = summary?.attacks?.attempted ?? 0;
  const attacksDetected = summary?.attacks?.detected ?? 0;
  const securityScore = summary?.securityScore ?? 100;

  const recentTransactions = summary?.recentTransactions || [];
  const recentLogs = logs.slice(0, 6);
  const attackLogs = logs.filter((l) => ATTACK_EVENT_TYPES.includes(l.eventType)).slice(0, 8);

  const engines = summary?.systemEngines || {};
  const verification = summary?.verification || {};

  const engineCards = [
    {
      key: 'sha256',
      title: 'SHA-256 Integrity',
      engine: engines.sha256,
      rows: [
        ['Verified', verification.sha256Passed ?? 0],
        ['Failed', verification.sha256Failed ?? 0],
      ],
      color: '#4f46e5',
    },
    {
      key: 'hmac',
      title: 'HMAC-SHA-256 Auth',
      engine: engines.hmac,
      rows: [
        ['Authenticated', verification.hmacPassed ?? 0],
        ['Failed', verification.hmacFailed ?? 0],
      ],
      color: '#059669',
    },
    {
      key: 'rsa',
      title: 'RSA-2048 Signature',
      engine: engines.rsaSignature,
      rows: [
        ['Valid signatures', verification.rsaPassed ?? 0],
        ['Rejected', verification.rsaFailed ?? 0],
      ],
      color: '#7c3aed',
    },
    {
      key: 'nonce',
      title: 'Nonce Anti-Replay',
      engine: engines.nonce,
      rows: [
        ['Replays blocked', verification.replayBlocked ?? 0],
        ['Mechanism', engines.nonce?.algorithm || 'CSPRNG'],
      ],
      color: '#d97706',
    },
    {
      key: 'timestamp',
      title: 'Timestamp Validation',
      engine: engines.timestamp,
      rows: [
        ['Expired rejected', verification.timestampExpired ?? 0],
        ['Freshness window', `${engines.timestamp?.freshnessWindowSeconds || 300}s`],
      ],
      color: '#f59e0b',
    },
  ];

  const metricCards = [
    { icon: CreditCard, color: '#5865f2', bg: 'rgba(88,101,242,0.15)', value: totalTx, label: 'Total Transactions' },
    {
      icon: CheckCircle,
      color: '#10b981',
      bg: 'rgba(16,185,129,0.15)',
      value: successTx,
      label: 'Successful',
      valueColor: '#10b981',
    },
    {
      icon: XCircle,
      color: '#ef4444',
      bg: 'rgba(239,68,68,0.15)',
      value: rejectedTx,
      label: 'Rejected',
      valueColor: '#ef4444',
    },
    {
      icon: Timer,
      color: '#f59e0b',
      bg: 'rgba(245,158,11,0.15)',
      value: awaitingTx,
      label: 'Awaiting Verification',
      valueColor: '#f59e0b',
    },
    {
      icon: Bug,
      color: '#f97316',
      bg: 'rgba(249,115,22,0.15)',
      value: attacksAttempted,
      label: 'Attacks Attempted',
      valueColor: '#f97316',
    },
    {
      icon: ShieldCheck,
      color: '#10b981',
      bg: 'rgba(16,185,129,0.15)',
      value: attacksDetected,
      label: 'Attacks Detected',
      valueColor: '#10b981',
    },
  ];

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Security Operations Dashboard</h1>
          <p className="page-subtitle">Payments, attack attempts and engine health at a glance.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <SecurityIndicator level={rejectedTx > 0 || attacksAttempted > 0 ? 'WARNING' : 'HIGH'} title="Integrity Guard Active" />
          <button type="button" className="btn btn-secondary btn-sm" onClick={fetchData} disabled={loading}>
            <Radio size={14} className={loading ? 'spin-animation' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* Demo accounts strip */}
      <div className="crypto-card" style={{ marginBottom: '1.5rem', padding: '1.1rem 1.35rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: 'var(--text-secondary)', fontSize: '0.78rem', fontWeight: 700 }}>
              <Users size={15} color="var(--accent-cyan)" /> DEMO ACCOUNTS
            </div>
            {accounts.map((a) => (
              <div key={a.email} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>{a.name}</div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{a.email}</div>
                </div>
                <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--accent-success)' }}>
                  {Number(a.balance).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="badge badge-blue" title={storageMode}>
              <HardDrive size={12} /> {storageMode || 'storage unknown'}
            </span>
            <Link to="/payment" className="btn btn-primary btn-sm">
              <Send size={14} /> Send Payment
            </Link>
          </div>
        </div>
      </div>

      {/* Metric cards */}
      <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        {metricCards.map((m) => {
          const Icon = m.icon;
          return (
            <div className="metric-card" key={m.label}>
              <div className="metric-icon-wrapper" style={{ background: m.bg, color: m.color }}>
                <Icon size={22} />
              </div>
              <div>
                <div className="metric-value" style={m.valueColor ? { color: m.valueColor } : undefined}>
                  {m.value}
                </div>
                <div className="metric-label">{m.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick launch */}
      <div
        style={{
          background: 'linear-gradient(90deg, rgba(88, 101, 242, 0.08) 0%, rgba(99, 102, 241, 0.03) 100%)',
          border: '1px solid var(--border-card)',
          borderRadius: 'var(--radius-lg)',
          padding: '1.1rem 1.4rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1.75rem',
        }}
      >
        <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)' }}>Quick actions</div>
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          <Link to="/payment" className="btn btn-primary btn-sm">
            <Send size={14} /> Make Payment
          </Link>
          <Link to="/simulation" className="btn btn-danger btn-sm">
            <Bug size={14} /> Attack Simulator
          </Link>
          <Link to="/verify" className="btn btn-secondary btn-sm">
            <FileCheck2 size={14} /> Verify
          </Link>
          <Link to="/security" className="btn btn-secondary btn-sm">
            <ShieldAlert size={14} /> Security Center
          </Link>
        </div>
      </div>

      {/* Security status panel (5 engines) */}
      <div className="crypto-card" style={{ marginBottom: '1.75rem' }}>
        <div className="card-header-flex">
          <h2 className="card-title">
            <ShieldCheck size={18} color="var(--accent-success)" /> Security Engine Status
          </h2>
          <span className="badge badge-success">Security score {securityScore}%</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0.85rem' }}>
          {engineCards.map((e) => (
            <div
              key={e.key}
              style={{
                background: 'var(--bg-card-subtle)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '0.85rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>{e.title}</span>
                <span className={`badge ${e.engine?.active ? 'badge-success' : 'badge-warning'}`}>
                  {e.engine?.active ? 'ACTIVE' : 'UNKNOWN'}
                </span>
              </div>
              <div style={{ fontSize: '0.68rem', color: e.color, fontFamily: 'var(--font-mono)', marginBottom: '0.45rem' }}>
                {e.engine?.algorithm || e.engine?.standard || e.engine?.mechanism || '—'}
              </div>
              {e.rows.map(([label, value]) => (
                <div
                  key={label}
                  style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', marginTop: '0.15rem' }}
                >
                  <span style={{ color: 'var(--text-muted)' }}>{label}:</span>
                  <span
                    style={{
                      color:
                        label === 'Failed' || label === 'Rejected'
                          ? '#ef4444'
                          : typeof value === 'number'
                          ? '#10b981'
                          : 'var(--text-secondary)',
                      fontWeight: 700,
                    }}
                  >
                    {value}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Two column: activity feed + attack timeline */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
        {/* Animated activity feed */}
        <div className="crypto-card">
          <div className="card-header-flex">
            <h2 className="card-title">
              <Activity size={18} color="var(--accent-primary)" /> Latest Transaction Activity
            </h2>
            <Link to="/history" style={{ fontSize: '0.8rem', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 600 }}>
              View All <ExternalLink size={13} />
            </Link>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {recentTransactions.length > 0 ? (
              recentTransactions.map((tx, idx) => (
                <div
                  key={tx._id || tx.transactionId || idx}
                  className="feed-item"
                  style={{
                    animationDelay: `${idx * 60}ms`,
                    cursor: 'pointer',
                    padding: '0.7rem 0.85rem',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--bg-card-subtle)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '0.75rem',
                  }}
                  onClick={() => setSelectedTx(tx)}
                  title="Click to inspect cryptographic details"
                >
                  <div style={{ minWidth: 0 }}>
                    <div className="font-mono" style={{ fontSize: '0.75rem', color: '#4752c4', fontWeight: 600 }}>
                      {tx.transactionId}
                    </div>
                    <div style={{ fontSize: '0.765rem', color: 'var(--text-secondary)', marginTop: '0.1rem' }}>
                      {tx.sender || tx.senderName} → {tx.receiver || tx.receiverName} ·{' '}
                      {new Date(tx.timestamp || tx.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontWeight: 700, color: 'var(--accent-cyan)', fontSize: '0.85rem' }}>
                      {Number(tx.amount).toFixed(2)} {tx.currency || 'INR'}
                    </div>
                    <div style={{ marginTop: '0.2rem' }}>
                      <CryptoBadge status={tx.status} />
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem', fontSize: '0.8rem' }}>
                No transactions yet.{' '}
                <Link to="/payment" style={{ color: 'var(--accent-primary)' }}>
                  Send the first payment
                </Link>
                .
              </div>
            )}
          </div>
        </div>

        {/* Recent attack events timeline */}
        <div className="crypto-card">
          <div className="card-header-flex">
            <h2 className="card-title">
              <Bug size={18} color="var(--accent-danger)" /> Recent Attack Events
            </h2>
            <Link to="/simulation" style={{ fontSize: '0.8rem', color: 'var(--accent-danger)', display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 600 }}>
              Attack Lab <ExternalLink size={13} />
            </Link>
          </div>
          <EventTimeline events={toTimelineEvents(attackLogs)} maxHeight={320} />
        </div>
      </div>

      {/* Security audit trail + admin */}
      <div className="crypto-card">
        <div className="card-header-flex" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
          <h2 className="card-title">
            <ShieldCheck size={18} color="var(--accent-success)" /> Security Audit Trail
          </h2>
          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              {lastUpdated ? `Updated ${lastUpdated}` : ''}
            </span>
            <Link to="/security" style={{ fontSize: '0.8rem', color: 'var(--accent-primary)', fontWeight: 600 }}>
              Full audit
            </Link>
            <button type="button" className="btn btn-secondary btn-sm" onClick={handleResetDemo} title="Deletes demo ledger data on the server (disabled in production)">
              Reset demo ledger
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {recentLogs.length > 0 ? (
            recentLogs.map((log, idx) => (
              <div
                key={log._id || log.logId || idx}
                className="feed-item"
                style={{
                  animationDelay: `${idx * 50}ms`,
                  padding: '0.7rem 0.85rem',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-card-subtle)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.7rem',
                }}
              >
                <div style={{ marginTop: '2px' }}>
                  {log.severity === 'CRITICAL' || log.severity === 'HIGH' ? (
                    <AlertTriangle size={15} color="var(--accent-danger)" />
                  ) : log.severity === 'MEDIUM' ? (
                    <AlertTriangle size={15} color="var(--accent-warning)" />
                  ) : (
                    <CheckCircle size={15} color="var(--accent-success)" />
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.1rem' }}>
                    <span className="font-mono" style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {log.eventType}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Clock size={11} />
                      {log.createdAt ? new Date(log.createdAt).toLocaleTimeString() : '—'}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.765rem', color: 'var(--text-secondary)', wordBreak: 'break-word' }}>
                    {log.details}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem', fontSize: '0.8rem' }}>
              No security events recorded yet.
            </div>
          )}
        </div>
      </div>

      {selectedTx && <TransactionModal transaction={selectedTx} onClose={() => setSelectedTx(null)} />}
    </div>
  );
};

export default DashboardPage;
