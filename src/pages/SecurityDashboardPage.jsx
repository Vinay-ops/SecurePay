import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldAlert,
  Key,
  Lock,
  Database,
  RefreshCw,
  Activity,
  CheckCircle2,
  AlertTriangle,
  FileText,
  ShieldCheck,
  XCircle,
  Clock,
  Bug,
  Flame,
  Radio,
  FileCheck2,
} from 'lucide-react';
import { securityService, dashboardService } from '../services/api';
import CryptoBadge from '../components/CryptoBadge';

const SecurityDashboardPage = () => {
  const [summary, setSummary] = useState(null);
  const [logs, setLogs] = useState([]);
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchDashboardData = async () => {
    try {
      const summaryRes = await dashboardService.getSecuritySummary();
      if (summaryRes && summaryRes.success) {
        setSummary(summaryRes);
      }

      const logsRes = await securityService.getLogs({
        severity: severityFilter !== 'ALL' ? severityFilter : undefined,
        limit: 30,
      });
      if (logsRes && logsRes.success) {
        setLogs(logsRes.logs || []);
      }
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (err) {
      console.warn('Security dashboard data fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleResetDemo = async () => {
    if (!window.confirm('Reset all ledger transactions, security logs, and metrics to clean zero state for live demonstration?')) {
      return;
    }
    setLoading(true);
    try {
      await securityService.reset();
      await fetchDashboardData();
    } catch (err) {
      console.warn('Reset error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [severityFilter]);

  // Auto-refresh interval (every 5 seconds) for live demonstration
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchDashboardData();
    }, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, severityFilter]);

  // Safe fallback counts from backend summary
  const totalTx = summary?.totalTransactions ?? 0;
  const successTx = summary?.successfulTransactions ?? 0;
  const pendingTx = summary?.pendingTransactions ?? 0;
  const rejectedTx = summary?.rejectedTransactions ?? 0;

  const tamperingAttempts = summary?.attacks?.tampering ?? 0;
  const replayAttempts = summary?.attacks?.replay ?? 0;
  const forgeryAttempts = summary?.attacks?.forgery ?? 0;
  const totalAttacks = summary?.attacks?.total ?? 0;

  const sha256Passed = summary?.verification?.sha256Passed ?? 0;
  const sha256Failed = summary?.verification?.sha256Failed ?? 0;
  const hmacPassed = summary?.verification?.hmacPassed ?? 0;
  const hmacFailed = summary?.verification?.hmacFailed ?? 0;
  const rsaPassed = summary?.verification?.rsaPassed ?? 0;
  const rsaFailed = summary?.verification?.rsaFailed ?? 0;
  const replayBlocked = summary?.verification?.replayBlocked ?? 0;

  const securityScore = summary?.securityScore ?? 100;
  const recentTransactions = summary?.recentTransactions || [];
  const dbStatus = summary?.database;

  /**
   * The storage mode is reported by the backend (MongoDB when connected,
   * otherwise the volatile in-memory fallback). Every label below uses this so
   * the UI never claims MongoDB persistence that is not actually active.
   */
  const storageLabel = summary?.storageMode
    ? summary.storageMode.split('(')[0].trim()
    : dbStatus?.connected
    ? 'MongoDB'
    : 'In-memory store';

  // Chart data calculations
  const totalAttackEvents = tamperingAttempts + replayAttempts + forgeryAttempts;
  const tamperingPct = totalAttackEvents > 0 ? ((tamperingAttempts / totalAttackEvents) * 100).toFixed(0) : 0;
  const replayPct = totalAttackEvents > 0 ? ((replayAttempts / totalAttackEvents) * 100).toFixed(0) : 0;
  const forgeryPct = totalAttackEvents > 0 ? ((forgeryAttempts / totalAttackEvents) * 100).toFixed(0) : 0;

  return (
    <div>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: '1.25rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.25rem' }}>
            <h1 className="page-title">Cybersecurity & Cryptographic Operations Center</h1>
            <span className="badge badge-blue font-mono" style={{ fontSize: '0.725rem' }}>
              LIVE TELEMETRY
            </span>
          </div>
          <p className="page-subtitle">Audit metrics, blocked attacks and cryptographic engine health.</p>
        </div>
      </div>

      {lastUpdated && (
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1.25rem', display: 'flex', justifyContent: 'flex-end', gap: '0.4rem', alignItems: 'center' }}>
          <Clock size={13} /> Last updated: <strong style={{ color: 'var(--text-secondary)' }}>{lastUpdated}</strong>
        </div>
      )}

      {/* Row 1: Top Statistics Cards */}
      <div style={{ marginBottom: '1.75rem' }}>
        <h2 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.85rem' }}>
          1. Top Transaction Statistics — storage: {storageLabel}
        </h2>
        <div className="metrics-grid">
          <div className="metric-card">
            <div className="metric-icon-wrapper" style={{ background: 'rgba(88, 101, 242, 0.15)', color: '#5865f2' }}>
              <Activity size={24} />
            </div>
            <div>
              <div className="metric-value">{totalTx}</div>
              <div className="metric-label">Total Transactions</div>
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-icon-wrapper" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
              <CheckCircle2 size={24} />
            </div>
            <div>
              <div className="metric-value" style={{ color: '#10b981' }}>{successTx}</div>
              <div className="metric-label">Successful / Verified</div>
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-icon-wrapper" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}>
              <XCircle size={24} />
            </div>
            <div>
              <div className="metric-value" style={{ color: '#ef4444' }}>{rejectedTx}</div>
              <div className="metric-label">Rejected / Tampered</div>
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-icon-wrapper" style={{ background: 'rgba(124, 58, 237, 0.15)', color: '#7c3aed' }}>
              <ShieldCheck size={24} />
            </div>
            <div>
              <div className="metric-value">{securityScore}%</div>
              <div className="metric-label">Security Resilience Score</div>
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Attack Overview Cards */}
      <div style={{ marginBottom: '1.75rem' }}>
        <h2 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.85rem' }}>
          2. Attack Overview (Trapped & Mitigated Violations)
        </h2>
        <div className="metrics-grid">
          <div className="metric-card" style={{ borderLeft: '3px solid #ef4444' }}>
            <div className="metric-icon-wrapper" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}>
              <Flame size={24} />
            </div>
            <div>
              <div className="metric-value" style={{ color: '#ef4444' }}>{tamperingAttempts}</div>
              <div className="metric-label">Tampering Trapped</div>
              <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                Caught by SHA-256 / HMAC
              </div>
            </div>
          </div>

          <div className="metric-card" style={{ borderLeft: '3px solid #f59e0b' }}>
            <div className="metric-icon-wrapper" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>
              <RefreshCw size={24} />
            </div>
            <div>
              <div className="metric-value" style={{ color: '#f59e0b' }}>{replayAttempts}</div>
              <div className="metric-label">Replay Trapped</div>
              <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                Caught by Nonce / Monotonic Clock
              </div>
            </div>
          </div>

          <div className="metric-card" style={{ borderLeft: '3px solid #7c3aed' }}>
            <div className="metric-icon-wrapper" style={{ background: 'rgba(124, 58, 237, 0.15)', color: '#7c3aed' }}>
              <Key size={24} />
            </div>
            <div>
              <div className="metric-value" style={{ color: '#7c3aed' }}>{forgeryAttempts}</div>
              <div className="metric-label">Forgery Trapped</div>
              <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                Caught by RSA-2048 Verify
              </div>
            </div>
          </div>

          <div className="metric-card" style={{ borderLeft: '3px solid #10b981' }}>
            <div className="metric-icon-wrapper" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
              <ShieldCheck size={24} />
            </div>
            <div>
              <div className="metric-value" style={{ color: '#10b981' }}>{totalAttacks}</div>
              <div className="metric-label">Total Trapped Threats</div>
              <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                100% Defense Success Rate
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Row 3: Verification Overview (Pillars) */}
      <div style={{ marginBottom: '1.75rem' }}>
        <h2 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.85rem' }}>
          3. Verification Overview (Cryptographic Engines)
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.1rem' }}>
          {/* SHA-256 Engine */}
          <div className="crypto-card">
            <div className="card-header-flex">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShieldCheck size={18} color="#10b981" />
                <h3 style={{ fontSize: '0.925rem', fontWeight: 700, color: 'var(--text-primary)' }}>SHA-256 Integrity</h3>
              </div>
              <span className="badge badge-success">✓ Active</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem', background: 'var(--bg-card-subtle)', padding: '0.75rem', borderRadius: 'var(--radius-sm)' }}>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Passed</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#10b981' }}>{sha256Passed}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Mismatches</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 700, color: sha256Failed > 0 ? '#ef4444' : 'var(--text-secondary)' }}>{sha256Failed}</div>
              </div>
            </div>
          </div>

          {/* HMAC Engine */}
          <div className="crypto-card">
            <div className="card-header-flex">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Lock size={18} color="#4f46e5" />
                <h3 style={{ fontSize: '0.925rem', fontWeight: 700, color: 'var(--text-primary)' }}>HMAC-SHA-256 Auth</h3>
              </div>
              <span className="badge badge-success">✓ Active</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem', background: 'var(--bg-card-subtle)', padding: '0.75rem', borderRadius: 'var(--radius-sm)' }}>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Authenticated</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#4f46e5' }}>{hmacPassed}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Auth Failures</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 700, color: hmacFailed > 0 ? '#ef4444' : 'var(--text-secondary)' }}>{hmacFailed}</div>
              </div>
            </div>
          </div>

          {/* RSA Engine */}
          <div className="crypto-card">
            <div className="card-header-flex">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Key size={18} color="#7c3aed" />
                <h3 style={{ fontSize: '0.925rem', fontWeight: 700, color: 'var(--text-primary)' }}>RSA-2048 Signature</h3>
              </div>
              <span className="badge badge-success">✓ Active</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem', background: 'var(--bg-card-subtle)', padding: '0.75rem', borderRadius: 'var(--radius-sm)' }}>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Valid Signatures</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#7c3aed' }}>{rsaPassed}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Forged / Invalid</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 700, color: rsaFailed > 0 ? '#ef4444' : 'var(--text-secondary)' }}>{rsaFailed}</div>
              </div>
            </div>
          </div>

          {/* Replay Protection Engine */}
          <div className="crypto-card">
            <div className="card-header-flex">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <RefreshCw size={18} color="#d97706" />
                <h3 style={{ fontSize: '0.925rem', fontWeight: 700, color: 'var(--text-primary)' }}>Replay Guard</h3>
              </div>
              <span className="badge badge-success">✓ Active</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem', background: 'var(--bg-card-subtle)', padding: '0.75rem', borderRadius: 'var(--radius-sm)' }}>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Replay Blocked</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#10b981' }}>{replayBlocked}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Nonce Mechanism</div>
                <div style={{ fontSize: '0.825rem', fontWeight: 700, color: '#d97706' }}>128-bit CSPRNG</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Row 4: Attack Distribution Visualizer */}
      {totalAttackEvents > 0 && (
        <div className="crypto-card" style={{ marginBottom: '1.75rem' }}>
          <div className="card-header-flex">
            <div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Attack Distribution & Threat Telemetry
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Distribution of blocked threats trapped across all test suites
              </p>
            </div>
            <Link to="/simulation" className="btn btn-danger btn-sm">
              <Bug size={14} /> Attack Sandbox
            </Link>
          </div>

          <div
            style={{
              height: '14px',
              borderRadius: '7px',
              display: 'flex',
              overflow: 'hidden',
              backgroundColor: 'var(--bg-card-subtle)',
              marginBottom: '1rem',
            }}
          >
            {tamperingAttempts > 0 && (
              <div style={{ width: `${tamperingPct}%`, backgroundColor: '#ef4444' }} title={`Tampering: ${tamperingAttempts} (${tamperingPct}%)`} />
            )}
            {replayAttempts > 0 && (
              <div style={{ width: `${replayPct}%`, backgroundColor: '#f59e0b' }} title={`Replay: ${replayAttempts} (${replayPct}%)`} />
            )}
            {forgeryAttempts > 0 && (
              <div style={{ width: `${forgeryPct}%`, backgroundColor: '#7c3aed' }} title={`Forgery: ${forgeryAttempts} (${forgeryPct}%)`} />
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.45rem', background: 'var(--bg-card-subtle)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: '#ef4444' }} />
              <div style={{ fontSize: '0.785rem', color: 'var(--text-primary)' }}>Tampering: <strong>{tamperingAttempts}</strong> ({tamperingPct}%)</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.45rem', background: 'var(--bg-card-subtle)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: '#f59e0b' }} />
              <div style={{ fontSize: '0.785rem', color: 'var(--text-primary)' }}>Replay: <strong>{replayAttempts}</strong> ({replayPct}%)</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.45rem', background: 'var(--bg-card-subtle)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: '#7c3aed' }} />
              <div style={{ fontSize: '0.785rem', color: 'var(--text-primary)' }}>Forgery: <strong>{forgeryAttempts}</strong> ({forgeryPct}%)</div>
            </div>
          </div>
        </div>
      )}

      {/* Row 5: Recent Security Events Audit Trail */}
      <div className="crypto-card" style={{ marginBottom: '1.75rem' }}>
        <div className="card-header-flex" style={{ flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 className="card-title">
              <ShieldAlert size={18} color="var(--accent-danger)" /> Recent Security Events ({storageLabel} audit log)
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Real-time audit log recording every verified transaction, rejected packet, and trapped simulation
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.775rem', color: 'var(--text-muted)' }}>Filter:</span>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="form-control"
              style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem', width: 'auto' }}
            >
              <option value="ALL">All Severities</option>
              <option value="CRITICAL">CRITICAL</option>
              <option value="HIGH">HIGH</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="INFO">INFO</option>
            </select>
          </div>
        </div>

        {logs.length === 0 ? (
          <div style={{ padding: '2.5rem 1rem', textAlign: 'center', background: 'var(--bg-card-subtle)', borderRadius: 'var(--radius-md)' }}>
            <FileText size={36} color="var(--text-muted)" style={{ margin: '0 auto 0.75rem', display: 'block' }} />
            <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
              No security events recorded matching filter ({severityFilter})
            </div>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="crypto-table">
              <thead>
                <tr>
                  <th style={{ width: '90px' }}>Time</th>
                  <th style={{ width: '180px' }}>Event</th>
                  <th style={{ width: '130px' }}>Transaction ID</th>
                  <th style={{ width: '90px' }}>Result</th>
                  <th style={{ width: '80px' }}>Severity</th>
                  <th>Audit Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log, idx) => {
                  const timeStr = log.createdAt
                    ? new Date(log.createdAt).toLocaleTimeString()
                    : new Date().toLocaleTimeString();

                  const isBlocked = log.result === 'BLOCKED' || log.severity === 'CRITICAL' || log.severity === 'HIGH';
                  const isSuccess = log.result === 'SUCCESS' || log.eventType?.includes('VERIFIED') || log.eventType?.includes('PROCESSED');

                  return (
                    <tr key={log._id || log.logId || idx}>
                      <td className="font-mono" style={{ color: 'var(--text-secondary)', fontSize: '0.785rem' }}>
                        {timeStr}
                      </td>
                      <td>
                        <span
                          className={`badge ${isBlocked ? 'badge-danger' : isSuccess ? 'badge-success' : 'badge-blue'}`}
                        >
                          {log.eventType}
                        </span>
                      </td>
                      <td className="font-mono" style={{ fontSize: '0.775rem' }}>
                        {log.transactionId ? (
                          <Link to={`/verify?txId=${log.transactionId}`} style={{ color: 'var(--accent-primary)', textDecoration: 'underline' }}>
                            {log.transactionId.substring(0, 14)}...
                          </Link>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>N/A (System)</span>
                        )}
                      </td>
                      <td>
                        <span
                          style={{
                            fontWeight: 700,
                            fontSize: '0.75rem',
                            color: log.result === 'BLOCKED' ? 'var(--accent-danger)' : log.result === 'SUCCESS' ? 'var(--accent-success)' : 'var(--text-secondary)',
                          }}
                        >
                          {log.result || 'INFO'}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            log.severity === 'CRITICAL' || log.severity === 'HIGH'
                              ? 'badge-danger'
                              : log.severity === 'MEDIUM'
                              ? 'badge-warning'
                              : 'badge-blue'
                          }`}
                          style={{ fontSize: '0.675rem' }}
                        >
                          {log.severity}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-primary)', maxWidth: '350px' }}>
                        {log.details || 'Cryptographic check performed.'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Row 6: Recent Transactions Feed */}
      <div className="crypto-card">
        <div className="card-header-flex">
          <div>
            <h2 className="card-title">
              <FileCheck2 size={18} color="var(--accent-primary)" /> Live Ledger Transactions
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Most recent transactions stored in {storageLabel} with cryptographic signatures
            </p>
          </div>
          <Link to="/history" className="btn btn-secondary btn-sm">
            View Full Ledger
          </Link>
        </div>

        <div className="table-responsive">
          <table className="crypto-table">
            <thead>
              <tr>
                <th>Transaction ID</th>
                <th>Sender → Receiver</th>
                <th>Amount</th>
                <th>Timestamp</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {recentTransactions.length > 0 ? (
                recentTransactions.map((tx, idx) => (
                  <tr key={tx._id || tx.transactionId || idx}>
                    <td className="font-mono" style={{ fontSize: '0.785rem', color: '#4752c4', fontWeight: 600 }}>
                      {tx.transactionId}
                    </td>
                    <td>{tx.sender || tx.senderName} → {tx.receiver || tx.receiverName}</td>
                    <td style={{ fontWeight: 700, color: 'var(--accent-cyan)' }}>
                      {tx.currency === 'USD' ? '$' : tx.currency === 'EUR' ? '€' : '₹'}{Number(tx.amount).toFixed(2)} {tx.currency || 'INR'}
                    </td>
                    <td style={{ fontSize: '0.785rem', color: 'var(--text-secondary)' }}>
                      {new Date(tx.timestamp || tx.createdAt).toLocaleTimeString()}
                    </td>
                    <td>
                      <CryptoBadge status={tx.status} />
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    No transactions recorded in {storageLabel} yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SecurityDashboardPage;
