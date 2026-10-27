import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X,
  Send,
  FileText,
  Lock,
  ShieldCheck,
  KeyRound,
  RefreshCw,
  Server,
  Wallet,
  CheckCircle2,
  Check,
  XCircle,
  AlertTriangle,
  Pause,
  Play,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Clock,
} from 'lucide-react';
import { transactionService, demoService } from '../services/api';
import EventTimeline from './EventTimeline';

/**
 * ============================================================================
 * TRANSACTION LIFECYCLE ANIMATION
 * ============================================================================
 * Every stage is driven by a REAL backend operation:
 *   1. Payment Initiated        - user input (sender, receiver, amount)
 *   2. Transaction Created      - POST /api/transactions        -> txId
 *   3. SHA-256 Hashing          - POST /verify-integrity        -> verified
 *   4. HMAC Generation          - POST /verify-hmac             -> verified
 *   5. RSA Digital Signature    - POST /verify-signature        -> verified
 *   6. Nonce & Timestamp        - POST /verify-security         -> checks.*
 *   7. Server Verification      - POST /process                 -> COMPLETED / rejected
 *   8. Balance Update           - GET  /demo/accounts           -> live balances
 *   9. Final Result             - derived from the server responses above
 *
 * A stage is only marked successful when the corresponding backend call
 * returned a successful result - nothing is faked on the client.
 * ============================================================================
 */

const STAGES = [
  { key: 'initiated', label: 'Payment Initiated', icon: Send },
  { key: 'created', label: 'Transaction Created', icon: FileText },
  { key: 'hash', label: 'SHA-256 Hashing', icon: Lock },
  { key: 'hmac', label: 'HMAC Generation', icon: ShieldCheck },
  { key: 'signature', label: 'RSA Digital Signature', icon: KeyRound },
  { key: 'nonce', label: 'Nonce & Timestamp', icon: RefreshCw },
  { key: 'server', label: 'Server Verification', icon: Server },
  { key: 'balance', label: 'Balance Update', icon: Wallet },
  { key: 'result', label: 'Final Result', icon: CheckCircle2 },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clock = () => new Date().toLocaleTimeString();

const emptyStages = () => {
  const s = {};
  STAGES.forEach((st) => {
    s[st.key] = 'pending';
  });
  return s;
};

const TransactionLifecycleModal = ({ payment, onClose, onCompleted }) => {
  const [stages, setStages] = useState(emptyStages);
  const [stageInfo, setStageInfo] = useState({});
  const [events, setEvents] = useState([]);
  const [outcome, setOutcome] = useState(null); // { type, title, reason, message }
  const [finished, setFinished] = useState(false);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [showTech, setShowTech] = useState(false);
  const [runId, setRunId] = useState(0);
  const [activeIdx, setActiveIdx] = useState(0);
  const [capture, setCapture] = useState({}); // technical values
  const [progress, setProgress] = useState(0);

  const pausedRef = useRef(false);
  const speedRef = useRef(1);
  const cancelRef = useRef(false);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);
  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  const pushEvent = useCallback((title, detail, status = 'info') => {
    setEvents((prev) => [
      ...prev,
      { id: `${prev.length}-${Date.now()}-${Math.random()}`, title, detail, status, time: clock() },
    ]);
  }, []);

  const setStage = useCallback((key, state) => {
    setStages((prev) => ({ ...prev, [key]: state }));
  }, []);

  const setInfo = useCallback((key, info) => {
    setStageInfo((prev) => ({ ...prev, [key]: info }));
  }, []);

  // Waits while respecting pause and playback speed; throws 'cancelled' on abort.
  const wait = useCallback(async (ms) => {
    let remaining = ms / speedRef.current;
    while (remaining > 0) {
      if (cancelRef.current) throw new Error('cancelled');
      const chunk = Math.min(remaining, 120);
      await sleep(chunk);
      remaining -= chunk;
      while (pausedRef.current && !cancelRef.current) await sleep(80);
    }
    while (pausedRef.current && !cancelRef.current) {
      if (cancelRef.current) throw new Error('cancelled');
      await sleep(80);
    }
    if (cancelRef.current) throw new Error('cancelled');
  }, []);

  const failRemaining = (fromIdx) => {
    setStages((prev) => {
      const next = { ...prev };
      STAGES.forEach((s, i) => {
        if (i > fromIdx && next[s.key] === 'pending') next[s.key] = 'skipped';
      });
      return next;
    });
  };

  useEffect(() => {
    cancelRef.current = false;
    let mounted = true;

    const run = async () => {
      setStages(emptyStages());
      setStageInfo({});
      setEvents([]);
      setOutcome(null);
      setFinished(false);
      setCapture({});
      setProgress(0);

      const p = payment || {};
      let txId = null;
      let currentIdx = 0;

      try {
        // ---------------- Stage 1: Payment Initiated ----------------
        currentIdx = 0;
        setActiveIdx(0);
        setStage('initiated', 'active');
        pushEvent(
          'Payment initiated',
          `${p.sender} → ${p.receiver} · ${p.currency || 'INR'} ${Number(p.amount).toFixed(2)}`,
          'info'
        );
        setInfo('initiated', {
          note: 'Payment parameters captured on the client. Nothing has been sent yet.',
          rows: [
            { k: 'Sender', v: p.sender },
            { k: 'Receiver', v: p.receiver },
            { k: 'Amount', v: `${p.currency || 'INR'} ${Number(p.amount).toFixed(2)}` },
          ],
        });
        await wait(2000);
        setStage('initiated', 'success');
        setProgress(1);

        // ---------------- Stage 2: Transaction Created ----------------
        currentIdx = 1;
        setActiveIdx(1);
        setStage('created', 'active');
        pushEvent('Request submitted', 'POST /api/transactions — signing with SHA-256, HMAC and RSA-2048', 'pending');
        await wait(1800);
        const createRes = await transactionService.create({
          sender: p.sender,
          receiver: p.receiver,
          amount: parseFloat(p.amount),
          currency: p.currency || 'INR',
        });

        if (!mounted || cancelRef.current) return;

        const tx = createRes.transaction || {};
        txId = tx.transactionId;
        setCapture((c) => ({
          ...c,
          transactionId: txId,
          timestamp: tx.timestamp,
          nonce: tx.nonce,
          canonicalPayload: tx.canonicalPayload || createRes.canonicalPayload,
          sha256: tx.transactionHash || tx.sha256Hash || createRes.transactionHash,
          hmac: tx.hmac || tx.hmacSignature || createRes.hmac,
          rsaSignature: tx.digitalSignature || tx.rsaSignature || createRes.digitalSignature,
          keyFingerprint: tx.senderKeyFingerprint || createRes.senderPublicKeyFingerprint,
          currency: tx.currency,
          amount: tx.amount,
          sender: tx.sender || tx.senderName,
          receiver: tx.receiver || tx.receiverName,
        }));
        setStage('created', 'success');
        pushEvent('Transaction created', `Transaction ID ${txId} issued by the server`, 'success');
        setInfo('created', {
          note: 'Server generated the transaction ID, a 128-bit CSPRNG nonce and a monotonic timestamp.',
          rows: [
            { k: 'Transaction ID', v: txId },
            { k: 'Nonce', v: tx.nonce },
            { k: 'Timestamp', v: `${tx.timestamp} (${new Date(tx.timestamp).toLocaleTimeString()})` },
          ],
        });
        setProgress(2);

        // ---------------- Stage 3: SHA-256 Hashing ----------------
        currentIdx = 2;
        setActiveIdx(2);
        setStage('hash', 'active');
        pushEvent('Computing SHA-256 digest', 'POST /api/transactions/:id/verify-integrity', 'pending');
        await wait(2000);
        const integrity = await transactionService.verifyIntegrity(txId);
        if (!mounted || cancelRef.current) return;
        const hashOk = integrity.verified === true || integrity.integrityValid === true;
        setStage('hash', hashOk ? 'success' : 'failed');
        pushEvent(
          'SHA-256 verification',
          hashOk
            ? `Digest matches the stored ledger hash (${String(integrity.calculatedHash).substring(0, 24)}…)`
            : 'Hash mismatch reported by the server',
          hashOk ? 'success' : 'danger'
        );
        setInfo('hash', {
          note: integrity.message,
          rows: [
            { k: 'Stored hash', v: integrity.storedHash },
            { k: 'Calculated hash', v: integrity.calculatedHash },
          ],
        });
        setCapture((c) => ({ ...c, integrityResult: integrity }));
        setProgress(3);

        // ---------------- Stage 4: HMAC Generation ----------------
        currentIdx = 3;
        setActiveIdx(3);
        setStage('hmac', 'active');
        pushEvent('Generating / verifying HMAC-SHA-256', 'POST /api/transactions/:id/verify-hmac', 'pending');
        await wait(2000);
        const hmacRes = await transactionService.verifyHmac(txId);
        if (!mounted || cancelRef.current) return;
        const hmacOk = hmacRes.verified === true || hmacRes.authenticationValid === true;
        setStage('hmac', hmacOk ? 'success' : 'failed');
        pushEvent(
          'HMAC verification',
          hmacOk
            ? `Server-side key authenticated the payload (tag ${String(hmacRes.storedHmac).substring(0, 20)}…)`
            : 'HMAC verification failed on the server',
          hmacOk ? 'success' : 'danger'
        );
        setInfo('hmac', {
          note: hmacRes.message,
          rows: [
            { k: 'Stored tag', v: hmacRes.storedHmac },
            { k: 'Recomputed tag', v: hmacRes.calculatedHmac },
          ],
        });
        setCapture((c) => ({ ...c, hmacResult: hmacRes }));
        setProgress(4);

        // ---------------- Stage 5: RSA Digital Signature ----------------
        currentIdx = 4;
        setActiveIdx(4);
        setStage('signature', 'active');
        pushEvent('Verifying RSA-2048 digital signature', 'POST /api/transactions/:id/verify-signature', 'pending');
        await wait(2200);
        const sigRes = await transactionService.verifySignature(txId);
        if (!mounted || cancelRef.current) return;
        const sigOk = sigRes.verified === true || sigRes.signatureValid === true;
        setStage('signature', sigOk ? 'success' : 'failed');
        pushEvent(
          'Signature verification',
          sigOk
            ? `Signed by ${sigRes.signer} · key fingerprint ${sigRes.publicKeyFingerprint}`
            : 'Digital signature rejected by the server',
          sigOk ? 'success' : 'danger'
        );
        setInfo('signature', {
          note: sigRes.message,
          rows: [
            { k: 'Signer', v: sigRes.signer },
            { k: 'Key fingerprint', v: sigRes.publicKeyFingerprint },
          ],
        });
        setCapture((c) => ({ ...c, signatureResult: sigRes }));
        setProgress(5);

        // ---------------- Stage 6: Nonce & Timestamp Validation ----------------
        currentIdx = 5;
        setActiveIdx(5);
        setStage('nonce', 'active');
        pushEvent('Validating nonce and timestamp window', 'POST /api/transactions/:id/verify-security', 'pending');
        await wait(2000);
        const combined = await transactionService.verifySecurity(txId);
        if (!mounted || cancelRef.current) return;
        const checks = combined.checks || {};
        const nonceOk = checks.nonce?.verified === true && checks.timestamp?.verified === true;
        setStage('nonce', nonceOk ? 'success' : 'failed');
        pushEvent(
          'Replay protection check',
          `Nonce ${checks.nonce?.valid ? 'is unique and unconsumed' : 'INVALID'} · timestamp age ${checks.timestamp?.ageSeconds ?? '—'}s (max ${checks.timestamp?.maxSeconds || checks.timestamp?.maxAgeSeconds || 300}s)`,
          nonceOk ? 'success' : 'danger'
        );
        setInfo('nonce', {
          note: checks.replayProtection?.message || checks.timestamp?.message,
          rows: [
            { k: 'Nonce', v: checks.nonce?.nonce },
            { k: 'Timestamp age', v: `${checks.timestamp?.ageSeconds}s / ${checks.timestamp?.maxAgeSeconds}s` },
            { k: 'Nonce status', v: checks.nonce?.status || (nonceOk ? 'PASSED' : 'FAILED') },
          ],
        });
        setCapture((c) => ({ ...c, securityResult: combined }));
        setProgress(6);

        // ---------------- Stage 7: Server Verification ----------------
        currentIdx = 6;
        setActiveIdx(6);
        setStage('server', 'active');
        pushEvent('Server verification started', 'POST /api/transactions/:id/process — atomic PENDING → COMPLETED', 'pending');
        await wait(2500);

        let processRes = null;
        let processError = null;
        try {
          processRes = await transactionService.process(txId);
        } catch (err) {
          processError = err.response?.data || {
            reason: 'NETWORK_OR_SERVER_ERROR',
            message: err.message || 'The server could not be reached.',
          };
        }
        if (!mounted || cancelRef.current) return;

        const serverOk = !processError && processRes?.success === true && processRes?.status === 'COMPLETED';
        setStage('server', serverOk ? 'success' : 'failed');
        pushEvent(
          serverOk ? 'Server accepted the transaction' : 'Server rejected the transaction',
          serverOk
            ? `COMPLETED · nonce consumed · freshness ${processRes.ageSeconds}s`
            : `${processError?.reason || processRes?.reason || 'ERROR'} — ${processError?.message || processRes?.message || ''}`,
          serverOk ? 'success' : 'danger'
        );
        setInfo('server', {
          note: serverOk
            ? 'All server-side checks passed and the transaction was committed atomically.'
            : processError?.message || processRes?.message || 'Processing failed.',
          rows: serverOk
            ? [
                { k: 'Status', v: processRes.status },
                { k: 'Processed at', v: new Date(processRes.processedAt).toLocaleString() },
                { k: 'Nonce consumed', v: String(processRes.replayProtection?.nonceConsumed) },
                { k: 'Freshness', v: `${processRes.ageSeconds}s / ${processRes.freshnessWindowSeconds}s` },
              ]
            : [{ k: 'Reason', v: processError?.reason || processRes?.reason || 'UNKNOWN' }],
        });
        setCapture((c) => ({ ...c, processResult: serverOk ? processRes : processError }));
        setProgress(7);

        // ---------------- Stage 8: Balance Update ----------------
        currentIdx = 7;
        setActiveIdx(7);
        if (serverOk) {
          setStage('balance', 'active');
          pushEvent('Updating demo account balances', 'GET /api/demo/accounts — reading authoritative balances', 'pending');
          await wait(1800);
          const accountsRes = await demoService.getAccounts();
          if (!mounted || cancelRef.current) return;
          const list = accountsRes.accounts || [];
          const senderAcct = list.find((a) => a.name === p.sender || a.email === p.sender);
          const receiverAcct = list.find((a) => a.name === p.receiver || a.email === p.receiver);
          const moved =
            typeof processRes.senderBalance === 'number' && typeof processRes.receiverBalance === 'number';
          setStage('balance', moved || (senderAcct && receiverAcct) ? 'success' : 'failed');
          pushEvent(
            'Balance update confirmed',
            moved
              ? `${p.sender}: ${Number(processRes.senderBalance).toFixed(2)} · ${p.receiver}: ${Number(processRes.receiverBalance).toFixed(2)}`
              : 'Balances reported by the server',
            'success'
          );
          setInfo('balance', {
            note: 'Funds moved once, atomically, when the server accepted the transaction.',
            rows: [
              { k: `${p.sender} balance`, v: senderAcct ? Number(senderAcct.balance).toFixed(2) : (processRes.senderBalance ?? '—') },
              { k: `${p.receiver} balance`, v: receiverAcct ? Number(receiverAcct.balance).toFixed(2) : (processRes.receiverBalance ?? '—') },
              { k: 'Amount transferred', v: Number(processRes.amount ?? p.amount).toFixed(2) },
            ],
          });
          setCapture((c) => ({
            ...c,
            balances: {
              sender: senderAcct ? senderAcct.balance : processRes.senderBalance,
              receiver: receiverAcct ? receiverAcct.balance : processRes.receiverBalance,
              transferred: processRes.amount,
            },
          }));
        } else {
          setStage('balance', 'skipped');
          pushEvent('Balance update skipped', 'No funds move when the server rejects a transaction.', 'warning');
          setInfo('balance', {
            note: 'The server rejected the transaction, so no balances were changed.',
            rows: [{ k: 'Transferred', v: '0.00 (rejected before transfer)' }],
          });
        }
        setProgress(8);

        // ---------------- Stage 9: Final Result ----------------
        currentIdx = 8;
        setActiveIdx(8);
        setStage('result', 'active');
        await wait(1500);
        if (serverOk) {
          setStage('result', 'success');
          setOutcome({
            type: 'SUCCESS',
            title: 'SUCCESS',
            message: 'The server verified and completed the transaction. All cryptographic checks passed.',
            reason: 'COMPLETED',
          });
          setInfo('result', {
            note: 'Derived from the server response of stage 7 (process) — not asserted by the client.',
            rows: [
              { k: 'Outcome', v: 'SUCCESS' },
              { k: 'Server reason', v: 'COMPLETED' },
              { k: 'Transaction ID', v: txId },
              { k: 'Amount', v: `${p.currency || 'INR'} ${Number(p.amount).toFixed(2)}` },
            ],
          });
          pushEvent('Final result: SUCCESS', 'Server-side verification, transfer and replay protection complete.', 'success');
        } else {
          setStage('result', 'failed');
          const reason = processError?.reason || processRes?.reason || 'TRANSACTION_FAILED';
          const rejectedByServer = !!processError || !!processRes;
          const outcomeMessage =
            processError?.message || processRes?.message || 'The transaction could not be processed.';
          setOutcome({
            type: rejectedByServer ? 'REJECTED' : 'FAILED',
            title: rejectedByServer ? 'REJECTED' : 'FAILED',
            reason,
            message: outcomeMessage,
          });
          setInfo('result', {
            note: 'Derived from the server response of stage 7 (process) — the backend rejected this transaction.',
            rows: [
              { k: 'Outcome', v: rejectedByServer ? 'REJECTED' : 'FAILED' },
              { k: 'Server reason', v: reason },
              { k: 'Message', v: outcomeMessage },
              { k: 'Transferred', v: '0.00 (no funds moved)' },
            ],
          });
          pushEvent(
            `Final result: ${rejectedByServer ? 'REJECTED' : 'FAILED'}`,
            `${reason} — ${outcomeMessage}`,
            'danger'
          );
          failRemaining(8);
        }
        setProgress(9);
        setFinished(true);
        if (onCompleted) onCompleted();
      } catch (err) {
        if (err && err.message === 'cancelled') return;
        if (!mounted) return;
        setStage(STAGES[currentIdx].key, 'failed');
        const message =
          err?.response?.data?.message || err?.message || 'Unexpected error while running the payment lifecycle.';
        const reason = err?.response?.data?.reason || 'NETWORK_OR_SERVER_ERROR';
        pushEvent('Lifecycle halted', `${reason} — ${message}`, 'danger');
        setInfo(STAGES[currentIdx].key, { note: message, rows: [{ k: 'Reason', v: reason }] });
        setOutcome({
          type: err?.response ? 'REJECTED' : 'FAILED',
          title: err?.response ? 'REJECTED' : 'FAILED',
          reason,
          message,
        });
        failRemaining(currentIdx);
        setFinished(true);
      }
    };

    run();

    return () => {
      mounted = false;
      cancelRef.current = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId]);

  const doneCount = STAGES.filter((s) => ['success', 'failed', 'skipped'].includes(stages[s.key])).length;
  const pct = Math.round((doneCount / STAGES.length) * 100);
  const activeStage = STAGES[activeIdx] || STAGES[0];
  const currentInfo = stageInfo[activeStage.key];

  const outcomeTone = outcome?.type === 'SUCCESS' ? 'success' : 'danger';

  const stageStateLabel = (state) =>
    state === 'success'
      ? 'DONE'
      : state === 'failed'
      ? 'FAILED'
      : state === 'skipped'
      ? 'SKIPPED'
      : state === 'active'
      ? 'RUNNING'
      : 'WAITING';

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Transaction lifecycle">
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '960px', padding: '1.5rem 1.75rem 1.75rem' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>Transaction Lifecycle</h2>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              {capture.transactionId ? (
                <>
                  Transaction ID:{' '}
                  <span className="font-mono" style={{ color: 'var(--text-primary)' }}>
                    {capture.transactionId}
                  </span>
                </>
              ) : (
                'Preparing cryptographic payment pipeline…'
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary"
            style={{ padding: '0.45rem', borderRadius: 'var(--radius-sm)' }}
            aria-label="Close lifecycle modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Progress + controls */}
        <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
          <div className="progress-track" style={{ flex: 1, minWidth: '180px' }}>
            <div
              className={`progress-fill ${outcomeTone === 'success' && finished ? 'success' : finished ? 'danger' : ''}`}
              style={{ width: `${finished ? 100 : Math.max(pct, (progress / 9) * 100)}%` }}
            />
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
            {doneCount}/{STAGES.length} stages
          </span>
          {!finished && (
            <>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPaused((v) => !v)}>
                {paused ? <Play size={13} /> : <Pause size={13} />}
                {paused ? 'Resume' : 'Pause'}
              </button>
              <div style={{ display: 'flex', gap: '0.25rem' }}>
                {[0.5, 1, 2].map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`btn btn-sm ${speed === s ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setSpeed(s)}
                    style={{ padding: '0.3rem 0.55rem' }}
                    title={s === 0.5 ? 'Ultra slow — great for classroom demos' : s === 1 ? 'Normal speed' : 'Fast mode'}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            </>
          )}
          {finished && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => {
                setRunId((v) => v + 1);
                setPaused(false);
              }}
              title="Submit a NEW payment with the same details and animate it end-to-end"
            >
              <RotateCcw size={13} /> Run Again
            </button>
          )}
        </div>

        {/* Stepper (horizontal desktop / vertical timeline on narrow modals) */}
        <div className="lc-stepper-wrap" style={{ marginTop: '1.1rem' }}>
        <div className="lifecycle-stepper">
          {STAGES.map((s, i) => {
            const state = stages[s.key];
            const Icon = s.icon;
            return (
              <div className={`lc-step ${state}`} key={s.key}>
                <div className="lc-step-line">
                  <div className="lc-step-line-fill" />
                </div>
                <div className="lc-node">
                  {state === 'success' ? (
                    <Check size={18} strokeWidth={3.2} className="lc-check-mark" />
                  ) : state === 'failed' ? (
                    <XCircle size={18} />
                  ) : state === 'active' ? (
                    <RefreshCw size={16} className="spin-animation" />
                  ) : (
                    <Icon size={17} />
                  )}
                </div>
                <div>
                  <div className="lc-label">{s.label}</div>
                  <div className="lc-status">{stageStateLabel(state)}</div>
                </div>
              </div>
            );
          })}
        </div>
        </div>

        {/* Current stage detail */}
        <div className="stage-panel" style={{ marginTop: '0.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
              {activeIdx + 1}. {activeStage.label}
            </div>
            <span
              className={`badge ${
                stages[activeStage.key] === 'failed'
                  ? 'badge-danger'
                  : stages[activeStage.key] === 'success'
                  ? 'badge-success'
                  : stages[activeStage.key] === 'active'
                  ? 'badge-blue'
                  : 'badge-gray'
              }`}
            >
              {stageStateLabel(stages[activeStage.key])}
            </span>
          </div>
          {currentInfo?.note && (
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.45rem', lineHeight: 1.5 }}>
              {currentInfo.note}
            </p>
          )}
          {currentInfo?.rows?.length > 0 && (
            <div style={{ marginTop: '0.55rem' }}>
              {currentInfo.rows.map((row, i) => (
                <div className="kv-row" key={i}>
                  <span className="kv-k">{row.k}</span>
                  <span className="kv-v">{String(row.v ?? '—')}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Live event timeline */}
        <div style={{ marginTop: '1rem' }}>
          <div
            style={{
              fontSize: '0.72rem',
              fontWeight: 700,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginBottom: '0.4rem',
            }}
          >
            Live event timeline
          </div>
          <EventTimeline events={events} maxHeight={200} />
        </div>

        {/* Final result banner */}
        {finished && outcome && (
          <div className={`result-banner ${outcomeTone}`} style={{ marginTop: '1rem' }}>
            {outcome.type === 'SUCCESS' ? (
              <CheckCircle2 size={30} style={{ flexShrink: 0 }} />
            ) : (
              <AlertTriangle size={30} style={{ flexShrink: 0 }} />
            )}
            <div>
              <div className="result-banner-text">
                {outcome.type === 'SUCCESS' ? 'SUCCESS' : outcome.title}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                {outcome.message}
              </div>
              {outcome.reason && (
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: '0.15rem' }}>
                  reason: {outcome.reason}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Technical details (expandable) */}
        <div style={{ marginTop: '1rem' }}>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ width: '100%', justifyContent: 'space-between', fontSize: '0.82rem' }}
            onClick={() => setShowTech((v) => !v)}
            aria-expanded={showTech}
          >
            <span>View Technical Details (cryptographic values)</span>
            {showTech ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>

          {showTech && (
            <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <div className="kv-row">
                <span className="kv-k">Transaction ID</span>
                <span className="kv-v">{capture.transactionId || '—'}</span>
              </div>
              <div className="kv-row">
                <span className="kv-k">Timestamp</span>
                <span className="kv-v">
                  {capture.timestamp ? `${capture.timestamp} (${new Date(capture.timestamp).toLocaleString()})` : '—'}
                </span>
              </div>
              <div className="kv-row">
                <span className="kv-k">Nonce (128-bit CSPRNG)</span>
                <span className="kv-v">{capture.nonce || '—'}</span>
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                  Canonical payload
                </div>
                <div className="crypto-hash-box" style={{ fontSize: '0.72rem', maxHeight: '90px', overflowY: 'auto' }}>
                  {capture.canonicalPayload || '—'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                  SHA-256 digest (FIPS PUB 180-4)
                </div>
                <div className="crypto-hash-box" style={{ fontSize: '0.72rem', color: '#4f46e5' }}>
                  {capture.sha256 || '—'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                  HMAC-SHA-256 tag (computed server-side; the secret is never exposed)
                </div>
                <div className="crypto-hash-box" style={{ fontSize: '0.72rem', color: '#7c3aed' }}>
                  {capture.hmac || '—'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                  RSA-2048 digital signature
                </div>
                <div className="crypto-hash-box" style={{ fontSize: '0.72rem', color: '#059669', maxHeight: '90px', overflowY: 'auto' }}>
                  {capture.rsaSignature || '—'}
                </div>
              </div>
              <div className="kv-row">
                <span className="kv-k">Sender key fingerprint</span>
                <span className="kv-v">{capture.keyFingerprint || '—'}</span>
              </div>
              <div className="kv-row">
                <span className="kv-k">Integrity check (server)</span>
                <span className="kv-v">
                  {capture.integrityResult ? (capture.integrityResult.verified ? 'VERIFIED' : 'FAILED') : '—'}
                </span>
              </div>
              <div className="kv-row">
                <span className="kv-k">HMAC check (server)</span>
                <span className="kv-v">
                  {capture.hmacResult ? (capture.hmacResult.verified ? 'VERIFIED' : 'FAILED') : '—'}
                </span>
              </div>
              <div className="kv-row">
                <span className="kv-k">Signature check (server)</span>
                <span className="kv-v">
                  {capture.signatureResult ? (capture.signatureResult.verified ? 'VERIFIED' : 'FAILED') : '—'}
                </span>
              </div>
              <div className="kv-row">
                <span className="kv-k">Nonce / timestamp check (server)</span>
                <span className="kv-v">
                  {capture.securityResult
                    ? `${capture.securityResult.checks?.nonce?.verified ? 'NONCE OK' : 'NONCE FAIL'} / ${
                        capture.securityResult.checks?.timestamp?.verified ? 'FRESH' : 'EXPIRED'
                      }`
                    : '—'}
                </span>
              </div>
              <div className="kv-row">
                <span className="kv-k">Verification result (server)</span>
                <span className="kv-v">
                  {capture.securityResult ? capture.securityResult.status || '—' : '—'}
                </span>
              </div>
              {capture.balances && (
                <>
                  <div className="kv-row">
                    <span className="kv-k">Sender balance after transfer</span>
                    <span className="kv-v">{Number(capture.balances.sender ?? 0).toFixed(2)}</span>
                  </div>
                  <div className="kv-row">
                    <span className="kv-k">Receiver balance after transfer</span>
                    <span className="kv-v">{Number(capture.balances.receiver ?? 0).toFixed(2)}</span>
                  </div>
                </>
              )}
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                <Clock size={12} /> Private keys, HMAC secrets and JWT secrets are never returned by the API and are
                never rendered here.
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div style={{ marginTop: '1.25rem', display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setRunId((v) => v + 1);
              setPaused(false);
            }}
            title="Submit a NEW payment with the same details and animate it end-to-end"
          >
            <RotateCcw size={15} /> Run Again
          </button>
        </div>
      </div>
    </div>
  );
};

export default TransactionLifecycleModal;
