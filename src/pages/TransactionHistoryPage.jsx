import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  RefreshCw,
  Eye,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  Send,
} from 'lucide-react';
import { paymentService, verifyService } from '../services/api';
import CryptoBadge from '../components/CryptoBadge';
import TransactionModal from '../components/TransactionModal';
import { Link } from 'react-router-dom';

const TransactionHistoryPage = () => {
  const [transactions, setTransactions] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [selectedTx, setSelectedTx] = useState(null);

  /**
   * Per-row verification of the STORED RECORD.
   *
   * This asks the backend three independent questions about the ledger entry:
   *   1. is the SHA-256 digest still consistent with the payload?   (integrity)
   *   2. was the packet authenticated by the gateway key?           (authenticity)
   *   3. does the RSA-2048 signature belong to the claimed sender?  (non-repudiation)
   *
   * Anti-replay freshness is deliberately NOT part of this verdict: a
   * COMPLETED transaction always has a consumed nonce and an old timestamp, and
   * that must not make an untampered record read as "rejected". The replay state
   * is reported separately by the verification page and the process endpoint.
   *
   * Shape: { [txId]: { status: 'loading'|'VERIFIED'|'REJECTED'|'ERROR', checks?, message? } }
   */
  const [verifyState, setVerifyState] = useState({});

  const handleVerifyRow = async (tx) => {
    const id = tx.transactionId;
    setVerifyState((prev) => ({ ...prev, [id]: { status: 'loading' } }));
    try {
      const [integrity, hmac, signature] = await Promise.all([
        verifyService.verifyIntegrity(id),
        verifyService.verifyHmac(id),
        verifyService.verifySignature(id),
      ]);

      const checks = {
        sha256: integrity?.integrityValid === true,
        hmac: hmac?.authenticationValid === true,
        rsa: signature?.signatureValid === true,
      };
      const allPassed = checks.sha256 && checks.hmac && checks.rsa;

      setVerifyState((prev) => ({
        ...prev,
        [id]: {
          status: allPassed ? 'VERIFIED' : 'REJECTED',
          checks,
          message: allPassed
            ? 'Server confirmed: SHA-256 digest, HMAC tag and RSA-2048 signature all match the stored record.'
            : 'Server reported a cryptographic mismatch on this stored record.',
        },
      }));
    } catch (err) {
      setVerifyState((prev) => ({
        ...prev,
        [id]: { status: 'ERROR', message: err.response?.data?.message || err.message },
      }));
    }
  };

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const data = await paymentService.getAll({
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        search: search || undefined,
      });
      if (data.success) {
        setTransactions(data.transactions || []);
      } else {
        setTransactions([]);
      }
    } catch (err) {
      console.warn('Transaction ledger fetch error', err);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [statusFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchTransactions();
  };


  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Transaction Ledger & Integrity Log</h1>
          <p className="page-subtitle">All transactions with their hashes, signatures and current status.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={fetchTransactions}
            className="btn btn-secondary"
            style={{ padding: '0.5rem 0.85rem' }}
          >
            <RefreshCw size={14} className={loading ? 'spin-animation' : ''} /> Refresh
          </button>
          <Link to="/payment" className="btn btn-primary" style={{ padding: '0.5rem 0.85rem' }}>
            <Send size={14} /> New Transaction
          </Link>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        className="crypto-card"
        style={{
          padding: '1rem 1.25rem',
          marginBottom: '1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '0.5rem', flex: 1, maxWidth: '500px' }}>
          <div style={{ position: 'relative', width: '100%' }}>
            <input
              type="text"
              className="form-control"
              placeholder="Search by TX ID, receiver, or SHA-256 hash..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: '2.25rem' }}
            />
            <Search
              size={16}
              color="var(--text-muted)"
              style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)' }}
            />
          </div>
          <button type="submit" className="btn btn-secondary">
            Search
          </button>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Filter size={15} color="var(--text-muted)" />
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Status:</span>
          <select
            className="form-control"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ width: 'auto', padding: '0.4rem 0.8rem', fontSize: '0.825rem' }}
          >
            <option value="ALL">All Transactions</option>
            <option value="SUCCESS">Verified (Success)</option>
            <option value="REJECTED">Rejected / Tampered</option>
          </select>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="crypto-card">
        <div className="table-responsive">
          <table className="crypto-table">              <thead>
                <tr>
                  <th>Transaction ID</th>
                  <th>Sender → Receiver</th>
                  <th>Amount</th>
                  <th>Date &amp; Time</th>
                  <th>Status</th>
                  <th>Verification</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
            <tbody>
              {transactions.length > 0 ? (
                transactions.map((tx, idx) => {
                  const vState = verifyState[tx.transactionId];
                  const when = new Date(tx.timestamp || tx.createdAt);
                  return (
                  <tr key={tx._id || tx.transactionId || idx}>
                    <td className="font-mono" style={{ fontSize: '0.8rem', color: '#4752c4', fontWeight: 600 }}>
                      {tx.transactionId}
                    </td>
                    <td>
                      <span style={{ color: 'var(--text-secondary)' }}>{tx.sender || tx.senderName}</span>
                      <span style={{ color: 'var(--accent-primary)', margin: '0 0.35rem' }}>→</span>
                      <strong style={{ color: 'var(--text-primary)' }}>{tx.receiver || tx.receiverName}</strong>
                    </td>
                    <td style={{ fontWeight: 700, color: 'var(--accent-cyan)' }}>
                      {tx.currency === 'USD' ? '$' : tx.currency === 'EUR' ? '€' : '₹'}{Number(tx.amount).toFixed(2)} {tx.currency || 'INR'}
                    </td>
                    <td style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      <div>{when.toLocaleDateString()} {when.toLocaleTimeString()}</div>
                      <div className="font-mono" style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                        {tx.timestamp}
                      </div>
                    </td>
                    <td>
                      <CryptoBadge status={tx.status} />
                    </td>
                    <td>
                      {vState === undefined ? (
                        <span className="badge badge-gray">NOT RUN</span>
                      ) : vState.status === 'loading' ? (
                        <span className="badge badge-blue"><RefreshCw size={11} className="spin-animation" /> VERIFYING</span>
                      ) : vState.status === 'VERIFIED' ? (
                        <span className="badge badge-success" title={vState.message}>
                          <CheckCircle2 size={11} /> VERIFIED
                        </span>
                      ) : vState.status === 'REJECTED' ? (
                        <span
                          className="badge badge-danger"
                          title={`SHA-256: ${vState.checks?.sha256 ? 'PASSED' : 'FAILED'} · HMAC: ${
                            vState.checks?.hmac ? 'PASSED' : 'FAILED'
                          } · RSA: ${vState.checks?.rsa ? 'PASSED' : 'FAILED'}`}
                        >
                          <XCircle size={11} /> TAMPERED
                        </span>
                      ) : (
                        <span className="badge badge-warning" title={vState.message}>ERROR</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button
                        onClick={() => handleVerifyRow(tx)}
                        className="btn btn-secondary"
                        style={{ padding: '0.3rem 0.55rem', fontSize: '0.72rem', marginRight: '0.35rem' }}
                        disabled={vState === 'loading'}
                        title="Ask the backend whether this stored record is authentic (SHA-256, HMAC, RSA-2048)"
                      >
                        <ShieldCheck size={12} /> Verify
                      </button>
                      <button
                        onClick={() => setSelectedTx(tx)}
                        className="btn btn-secondary"
                        style={{ padding: '0.3rem 0.55rem', fontSize: '0.72rem' }}
                        title="Open details view"
                      >
                        <Eye size={12} /> Details
                      </button>
                    </td>
                  </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    No transactions match the selected filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedTx && (
        <TransactionModal transaction={selectedTx} onClose={() => setSelectedTx(null)} />
      )}
    </div>
  );
};

export default TransactionHistoryPage;
