import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Flame,
  RefreshCw,
  KeyRound,
  MessageSquareWarning,
  Play,
  Pause,
  RotateCcw,
  AlertOctagon,
  CheckCircle2,
  ShieldAlert,
  Send,
  Server,
  Eye,
} from 'lucide-react';
import { simulationService, transactionService } from '../services/api';
import NetworkDiagram from '../components/NetworkDiagram';
import EventTimeline from '../components/EventTimeline';

/**
 * ============================================================================
 * ATTACK SIMULATION WORKSPACE
 * ============================================================================
 * Four clearly separated scenarios, each animated over the real network path
 * diagram (Sender / Attacker / Backend Server / Receiver) with a live event
 * timeline. Every verdict comes from an actual backend response:
 *
 *   A. Tampering          -> POST /api/attacks/tamper
 *   B. Replay             -> POST /api/transactions/:id/process (twice)
 *   C. Forged transaction -> POST /api/attacks/forge
 *   D. Fake confirmation  -> POST /api/attacks/fake-confirmation
 *
 * The banner only shows what the server actually reported.
 * "Reset Simulation" clears this visual run only - it never deletes ledger data.
 * ============================================================================
 */

const SCENARIOS = [
  { key: 'TAMPER', label: 'A. Transaction Tampering', icon: Flame },
  { key: 'REPLAY', label: 'B. Replay Attack', icon: RefreshCw },
  { key: 'FORGERY', label: 'C. Forged Transaction', icon: KeyRound },
  { key: 'FAKE', label: 'D. Fake Payment Confirmation', icon: MessageSquareWarning },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clock = () => new Date().toLocaleTimeString();

const emptyRun = () => ({
  events: [],
  edges: [],
  nodes: {},
  banner: null,
  result: null,
  running: false,
  phase: 'idle',
});

const AttackSimulationPage = () => {
  const [activeTab, setActiveTab] = useState('TAMPER');

  // Ledger targets
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [selectedTxId, setSelectedTxId] = useState('');
  const [selectedTx, setSelectedTx] = useState(null);
  const [loadingRecent, setLoadingRecent] = useState(false);

  // Scenario inputs
  const [tamperedField, setTamperedField] = useState('amount');
  const [tamperedAmount, setTamperedAmount] = useState('');
  const [tamperedReceiver, setTamperedReceiver] = useState('');
  const [forgedSender, setForgedSender] = useState('');
  const [forgedReceiver, setForgedReceiver] = useState('');
  const [forgedAmount, setForgedAmount] = useState('');
  const [replayAmount, setReplayAmount] = useState('100');
  const [fakeTarget, setFakeTarget] = useState('FAKE_ID');
  const [fakeTxId, setFakeTxId] = useState('TX-FORGED-RECEIPT-001');
  const [fakeClaimedAmount, setFakeClaimedAmount] = useState('5000');

  // Run state
  const [run, setRun] = useState(emptyRun);
  const [paused, setPaused] = useState(false);
  const [error, setError] = useState('');

  const pausedRef = useRef(false);
  const cancelRef = useRef(false);
  const runSeq = useRef(0);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  const patchRun = useCallback((partial) => {
    setRun((prev) => ({ ...prev, ...partial }));
  }, []);

  const pushEvent = useCallback((title, detail, status = 'info') => {
    setRun((prev) => ({
      ...prev,
      events: [
        ...prev.events,
        { id: `${prev.events.length}-${Date.now()}-${Math.random()}`, title, detail, status, time: clock() },
      ],
    }));
  }, []);

  const setEdges = useCallback((edges) => patchRun({ edges }), [patchRun]);
  const setNodes = useCallback((nodes) => patchRun({ nodes }), [patchRun]);

  const wait = useCallback(async (ms) => {
    let remaining = ms;
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

  const fetchRecent = useCallback(async () => {
    setLoadingRecent(true);
    try {
      const res = await transactionService.getAll({ limit: 10 });
      if (res.success) {
        setRecentTransactions(res.transactions || []);
      }
    } catch (e) {
      /* backend offline - handled by empty state */
    } finally {
      setLoadingRecent(false);
    }
  }, []);

  useEffect(() => {
    fetchRecent();
  }, [fetchRecent]);

  const selectTransaction = (tx) => {
    setSelectedTxId(tx.transactionId);
    setSelectedTx(tx);
    setTamperedAmount(String((Number(tx.amount) || 100) * 2));
    setTamperedReceiver(`${tx.receiver || tx.receiverName}_altered`);
    setForgedSender('Mallory Impersonator');
    setForgedReceiver(tx.receiver || tx.receiverName || '');
    setForgedAmount(String(tx.amount));
    setFakeTxId(tx.transactionId);
    setFakeClaimedAmount(String(tx.amount));
    setError('');
  };

  const beginRun = () => {
    cancelRef.current = false;
    runSeq.current += 1;
    setError('');
    setPaused(false);
    patchRun({ ...emptyRun(), running: true, phase: 'starting' });
    return runSeq.current;
  };

  const finishRun = (seq, partial) => {
    if (seq !== runSeq.current) return;
    patchRun({ ...partial, running: false });
  };

  const failRun = (seq, message) => {
    if (seq !== runSeq.current) return;
    pushEvent('Simulation halted', message, 'danger');
    patchRun({
      running: false,
      banner: { tone: 'warning', text: 'SIMULATION ERROR', sub: message },
    });
  };

  const setBanner = (banner) => patchRun({ banner });

  // ---------------------------------------------------------------------
  // A. TRANSACTION TAMPERING
  // ---------------------------------------------------------------------
  const runTamper = async () => {
    if (!selectedTxId) {
      setError('Select a target transaction from the ledger first.');
      return;
    }
    const seq = beginRun();
    const tx = selectedTx;
    const newAmount =
      tamperedField === 'amount' || tamperedField === 'both' ? parseFloat(tamperedAmount) : undefined;
    const newReceiver =
      tamperedField === 'receiver' || tamperedField === 'both' ? tamperedReceiver : undefined;

    try {
      pushEvent('Attack initiated', `Man-in-the-middle targets transaction ${selectedTxId}`, 'warning');
      setNodes({ sender: 'active', server: 'active' });
      setEdges([{ from: 'sender', to: 'server', state: 'normal' }]);
      await wait(500);

      pushEvent(
        'Payload prepared',
        `Original: ${tx.sender || tx.senderName} → ${tx.receiver || tx.receiverName} · ${Number(tx.amount).toFixed(2)} ${tx.currency || 'INR'}`,
        'info'
      );
      await wait(450);

      pushEvent('Request intercepted', 'Adversary captures the signed packet in transit', 'warning');
      setEdges([
        { from: 'sender', to: 'attacker', state: 'suspicious' },
        { from: 'attacker', to: 'server', state: 'suspicious' },
      ]);
      setNodes({ attacker: 'alert' });
      await wait(450);

      pushEvent(
        'Payload modified',
        `Amount → ${newAmount !== undefined ? newAmount : 'unchanged'} · Receiver → ${newReceiver || 'unchanged'} (signature not re-created)`,
        'warning'
      );
      await wait(450);

      pushEvent('Altered request submitted', 'POST /api/attacks/tamper — server recomputes every check', 'info');
      pushEvent('Server validation started', 'SHA-256 digest, HMAC tag and RSA signature recomputed', 'pending');
      setNodes({ attacker: 'alert', server: 'active' });
      await wait(400);

      const res = await simulationService.tamper({
        transactionId: selectedTxId,
        tamperedAmount: newAmount,
        tamperedReceiver: newReceiver,
      });
      if (seq !== runSeq.current || cancelRef.current) return;

      const c = res.checks || {};
      pushEvent(
        'SHA-256 verification',
        c.sha256 ? `${c.sha256.status}: ${c.sha256.message}` : 'n/a',
        c.sha256?.verified ? 'success' : 'danger'
      );
      pushEvent(
        'HMAC verification',
        c.hmac ? `${c.hmac.status}: ${c.hmac.message}` : 'n/a',
        c.hmac?.verified ? 'success' : 'danger'
      );
      pushEvent(
        'RSA signature verification',
        c.rsaSignature ? `${c.rsaSignature.status}: ${c.rsaSignature.message}` : 'n/a',
        c.rsaSignature?.verified ? 'success' : 'danger'
      );

      if (res.attackDetected) {
        setEdges([{ from: 'attacker', to: 'server', state: 'rejected' }]);
        setNodes({ attacker: 'alert', server: 'ok' });
        pushEvent('Attack detected', 'Integrity verification failed for the altered payload', 'danger');
        pushEvent('Final transaction outcome', `${res.status} — server rejected the altered transaction`, 'danger');
        setBanner({
          tone: 'danger',
          text: 'ATTACK DETECTED',
          sub: 'TRANSACTION REJECTED — the backend refused the altered transaction (hash / HMAC / signature mismatch).',
        });
      } else {
        setEdges([{ from: 'attacker', to: 'server', state: 'success' }]);
        pushEvent('Attack succeeded', 'The altered payload passed verification - security control failed', 'danger');
        pushEvent('Final transaction outcome', res.status, 'danger');
        setBanner({
          tone: 'danger',
          text: 'ATTACK SUCCEEDED — SECURITY CONTROL FAILED',
          sub: 'The altered payload was NOT detected by the backend.',
        });
      }
      finishRun(seq, { result: res });
    } catch (err) {
      if (err.message !== 'cancelled') failRun(seq, err.response?.data?.message || err.message);
    }
  };

  // ---------------------------------------------------------------------
  // B. REPLAY ATTACK
  // ---------------------------------------------------------------------
  const runReplay = async () => {
    const seq = beginRun();
    try {
      pushEvent('Attack initiated', 'Adversary plans to re-submit a previously issued payment', 'warning');
      setNodes({ sender: 'active', server: 'active' });
      setEdges([{ from: 'sender', to: 'server', state: 'normal' }]);
      await wait(400);

      // We need a *valid, unprocessed* transaction to show the full story.
      let tx = selectedTx;
      if (!tx || tx.status === 'COMPLETED' || tx.status === 'SUCCESS') {
        pushEvent(
          'Fresh payload prepared',
          'The selected transaction was already processed, so a fresh valid transaction is created for this run',
          'info'
        );
        const source = tx || {};
        const created = await transactionService.create({
          sender: source.sender || source.senderName || 'Alice Cryptographer',
          receiver: source.receiver || source.receiverName || 'Bob Merchant',
          amount: parseFloat(replayAmount) || 100,
          currency: source.currency || 'INR',
        });
        if (seq !== runSeq.current) return;
        tx = created.transaction;
        setSelectedTxId(tx.transactionId);
        setSelectedTx(tx);
      } else {
        pushEvent('Payload prepared', `Transaction ${tx.transactionId} (status ${tx.status})`, 'info');
      }

      pushEvent(
        'Replay payload details',
        `txId=${tx.transactionId} · nonce=${tx.nonce} · timestamp=${tx.timestamp}`,
        'info'
      );
      await wait(450);

      // 1st (original) submission
      pushEvent('First request submitted', 'POST /api/transactions/:id/process (original request)', 'info');
      pushEvent('Server validation started', 'Freshness, nonce and signature checks', 'pending');
      await wait(400);

      let firstRes = null;
      let firstError = null;
      try {
        firstRes = await transactionService.process(tx.transactionId);
      } catch (err) {
        firstError = err.response?.data || { message: err.message };
      }
      if (seq !== runSeq.current || cancelRef.current) return;

      const firstOk = !firstError && firstRes?.status === 'COMPLETED';
      pushEvent(
        firstOk ? 'Original request processed' : 'Original request not processed',
        firstOk
          ? `COMPLETED at ${new Date(firstRes.processedAt).toLocaleTimeString()} · nonce consumed`
          : `${firstError?.reason || 'ERROR'} — ${firstError?.message || ''}`,
        firstOk ? 'success' : 'danger'
      );
      setEdges([{ from: 'sender', to: 'server', state: firstOk ? 'success' : 'rejected' }]);
      await wait(500);

      // 2nd (replayed) submission - identical packet
      pushEvent('Replay request submitted', 'Identical packet resubmitted with the same transaction ID and nonce', 'warning');
      setEdges([
        { from: 'sender', to: 'attacker', state: 'suspicious' },
        { from: 'attacker', to: 'server', state: 'suspicious' },
      ]);
      setNodes({ attacker: 'alert', server: 'active' });
      await wait(450);

      pushEvent('Server validation started', 'Duplicate / nonce-consumption check before any state change', 'pending');
      await wait(350);

      let secondRes = null;
      let secondError = null;
      let secondStatus = null;
      try {
        secondRes = await transactionService.process(tx.transactionId);
        secondStatus = 200;
      } catch (err) {
        secondError = err.response?.data || { message: err.message };
        secondStatus = err.response?.status;
      }
      if (seq !== runSeq.current || cancelRef.current) return;

      const blocked =
        !!secondError &&
        (secondError.reason === 'REPLAY_ATTACK_DETECTED' || secondStatus === 400 || secondStatus === 409);

      if (blocked) {
        pushEvent(
          'Duplicate check',
          `Nonce ${tx.nonce} already consumed · transaction already ${secondRes?.status || 'COMPLETED'}`,
          'danger'
        );
        pushEvent('Attack detected', 'Server-side replay protection blocked the duplicate submission', 'danger');
        pushEvent('Final transaction outcome', `TRANSACTION REJECTED (${secondError.reason})`, 'danger');
        setEdges([{ from: 'attacker', to: 'server', state: 'rejected' }]);
        setNodes({ attacker: 'alert', server: 'ok' });
        setBanner({
          tone: 'danger',
          text: 'ATTACK DETECTED',
          sub: `TRANSACTION REJECTED — duplicate submission blocked (${secondError.reason}).`,
        });
      } else {
        pushEvent('Duplicate accepted', 'The server processed the same transaction twice', 'danger');
        pushEvent('Final transaction outcome', 'ATTACK SUCCEEDED — replayed payment accepted', 'danger');
        setEdges([{ from: 'attacker', to: 'server', state: 'success' }]);
        setBanner({
          tone: 'danger',
          text: 'ATTACK SUCCEEDED — SECURITY CONTROL FAILED',
          sub: 'The backend accepted a duplicate submission.',
        });
      }

      finishRun(seq, {
        result: {
          attack: 'replay',
          attackDetected: blocked,
          status: blocked ? 'REPLAY_ATTACK_DETECTED' : 'REPLAY_ACCEPTED',
          message: blocked
            ? 'The original transaction succeeded; the duplicate was rejected by server-side replay protection.'
            : 'The duplicate submission was accepted - replay protection did not hold.',
          original: {
            transactionId: tx.transactionId,
            nonce: tx.nonce,
            timestamp: tx.timestamp,
            firstOutcome: firstOk ? 'COMPLETED' : (firstError?.reason || 'ERROR'),
          },
          replay: {
            httpStatus: secondStatus,
            reason: secondError?.reason || null,
            message: secondError?.message || (secondRes?.message || ''),
            status: secondRes?.status || null,
          },
        },
      });
    } catch (err) {
      if (err.message !== 'cancelled') failRun(seq, err.response?.data?.message || err.message);
    }
  };

  // ---------------------------------------------------------------------
  // C. FORGED TRANSACTION
  // ---------------------------------------------------------------------
  const runForgery = async () => {
    if (!selectedTxId) {
      setError('Select a target transaction from the ledger first.');
      return;
    }
    const seq = beginRun();
    try {
      pushEvent('Attack initiated', 'Adversary attempts to forge a transaction without the sender private key', 'warning');
      setNodes({ attacker: 'alert', server: 'active' });
      setEdges([{ from: 'attacker', to: 'server', state: 'suspicious' }]);
      await wait(450);

      pushEvent(
        'Payload prepared',
        `Forged sender: "${forgedSender || 'Mallory'}" · receiver: "${forgedReceiver}" · amount: ${forgedAmount}`,
        'warning'
      );
      pushEvent(
        'Forged signature attached',
        'Signed with the attacker key (or copied verbatim) - it cannot verify against the legitimate public key',
        'warning'
      );
      await wait(450);

      pushEvent('Forged request submitted', 'POST /api/attacks/forge — server verifies with the stored sender public key', 'info');
      pushEvent('Server validation started', 'RSA-2048 signature verification + SHA-256 integrity recomputation', 'pending');
      await wait(400);

      const res = await simulationService.forge({
        transactionId: selectedTxId,
        forgedSender: forgedSender || 'Mallory Impersonator',
        forgedReceiver: forgedReceiver || undefined,
        forgedAmount: forgedAmount ? parseFloat(forgedAmount) : undefined,
      });
      if (seq !== runSeq.current || cancelRef.current) return;

      const c = res.checks || {};
      pushEvent(
        'RSA signature verification',
        c.rsaSignature ? `${c.rsaSignature.status}: ${c.rsaSignature.message}` : 'n/a',
        c.rsaSignature?.verified ? 'success' : 'danger'
      );
      pushEvent(
        'SHA-256 verification',
        c.sha256 ? `${c.sha256.status}: ${c.sha256.message}` : 'n/a',
        c.sha256?.verified ? 'success' : 'danger'
      );

      if (res.attackDetected) {
        pushEvent('Attack detected', 'Signature does not verify against the legitimate public key', 'danger');
        pushEvent('Final transaction outcome', `${res.status} — forged transaction rejected`, 'danger');
        setEdges([{ from: 'attacker', to: 'server', state: 'rejected' }]);
        setNodes({ attacker: 'alert', server: 'ok' });
        setBanner({
          tone: 'danger',
          text: 'ATTACK DETECTED',
          sub: 'TRANSACTION REJECTED — the server could not validate the forged signature.',
        });
      } else {
        pushEvent('Attack succeeded', 'A forged signature was accepted by the backend', 'danger');
        pushEvent('Final transaction outcome', res.status, 'danger');
        setEdges([{ from: 'attacker', to: 'server', state: 'success' }]);
        setBanner({
          tone: 'danger',
          text: 'ATTACK SUCCEEDED — SECURITY CONTROL FAILED',
          sub: 'The backend accepted a forged transaction.',
        });
      }
      finishRun(seq, { result: res });
    } catch (err) {
      if (err.message !== 'cancelled') failRun(seq, err.response?.data?.message || err.message);
    }
  };

  // ---------------------------------------------------------------------
  // D. FAKE PAYMENT CONFIRMATION
  // ---------------------------------------------------------------------
  const runFakeConfirmation = async () => {
    const seq = beginRun();
    const targetId =
      fakeTarget === 'FAKE_ID' ? fakeTxId.trim() || 'TX-FORGED-RECEIPT-001' : selectedTxId;
    if (!targetId) {
      setError('Provide a transaction ID for the fake receipt.');
      return;
    }

    try {
      pushEvent('Attack initiated', 'Adversary prepares a fake "payment successful" receipt for the receiver', 'warning');
      setNodes({ attacker: 'alert', receiver: 'alert' });
      setEdges([{ from: 'attacker', to: 'receiver', state: 'suspicious' }]);
      await wait(450);

      pushEvent(
        'Payload prepared (client claim)',
        `Receipt: TX ${targetId} · status COMPLETED · amount ${fakeClaimedAmount || '—'} (generated on the client, never approved by the server)`,
        'warning'
      );
      await wait(450);

      pushEvent('Fake confirmation arrives at receiver', 'Receiver initial state: UNVERIFIED — a success message is not proof', 'warning');
      await wait(450);

      pushEvent('Verification request submitted', 'Receiver asks the backend for the authoritative transaction status', 'info');
      pushEvent('Server validation started', 'Ledger lookup + claimed-vs-actual comparison', 'pending');
      setEdges([
        { from: 'attacker', to: 'receiver', state: 'suspicious' },
        { from: 'receiver', to: 'server', state: 'normal' },
      ]);
      setNodes({ receiver: 'active', server: 'active' });
      await wait(400);

      const res = await simulationService.fakeConfirmation({
        transactionId: targetId,
        claimedStatus: 'COMPLETED',
        claimedAmount: fakeClaimedAmount ? parseFloat(fakeClaimedAmount) : undefined,
      });
      if (seq !== runSeq.current || cancelRef.current) return;

      const c = res.checks || {};
      pushEvent(
        'Ledger lookup',
        c.serverLookup ? `${c.serverLookup.status}: ${c.serverLookup.message}` : 'n/a',
        c.serverLookup?.verified ? 'success' : 'danger'
      );
      if (c.statusMatch) {
        pushEvent(
          'Claimed vs server status',
          `${c.statusMatch.status}: ${c.statusMatch.message}`,
          c.statusMatch.verified ? 'success' : 'danger'
        );
      }
      if (c.amountMatch) {
        pushEvent(
          'Claimed vs server amount',
          `${c.amountMatch.status}: ${c.amountMatch.message}`,
          c.amountMatch.verified ? 'success' : 'danger'
        );
      }
      if (c.receiverMatch) {
        pushEvent(
          'Claimed vs server receiver',
          `${c.receiverMatch.status}: ${c.receiverMatch.message}`,
          c.receiverMatch.verified ? 'success' : 'danger'
        );
      }

      // The server tells us exactly which part of the claim failed.
      const mismatches = res.mismatches || [];

      if (res.attackDetected) {
        pushEvent(
          'Attack detected',
          mismatches.length
            ? `The client claim fails the server check — ${mismatches.join('; ')}`
            : 'The client-side success message does not match the server record',
          'danger'
        );
        pushEvent(
          'Final transaction outcome',
          `${res.status} — authoritative server status: ${res.server?.serverStatus}`,
          'danger'
        );
        setEdges([
          { from: 'attacker', to: 'receiver', state: 'rejected' },
          { from: 'receiver', to: 'server', state: 'rejected' },
        ]);
        setNodes({ attacker: 'alert', receiver: 'ok', server: 'ok' });
        setBanner({
          tone: 'danger',
          text: 'ATTACK DETECTED',
          sub: `FAKE CONFIRMATION EXPOSED — ${mismatches.join('; ')}. Authoritative server status: ${res.server?.serverStatus}.`,
        });
      } else {
        pushEvent('Claim confirmed', 'The claim matches the authoritative server record', 'success');
        pushEvent('Final transaction outcome', `${res.status} — server approved: ${res.server?.approved}`, 'success');
        setEdges([
          { from: 'attacker', to: 'receiver', state: 'normal' },
          { from: 'receiver', to: 'server', state: 'success' },
        ]);
        setNodes({ receiver: 'ok', server: 'ok' });
        setBanner({
          tone: 'success',
          text: 'SERVER-CONFIRMED PAYMENT',
          sub: 'The claim matches the authoritative backend record — this payment was really processed.',
        });
      }
      finishRun(seq, { result: res });
    } catch (err) {
      if (err.message !== 'cancelled') failRun(seq, err.response?.data?.message || err.message);
    }
  };

  const launchCurrent = () => {
    if (activeTab === 'TAMPER') return runTamper();
    if (activeTab === 'REPLAY') return runReplay();
    if (activeTab === 'FORGERY') return runForgery();
    return runFakeConfirmation();
  };

  const resetSimulation = () => {
    runSeq.current += 1;
    cancelRef.current = true;
    setRun(emptyRun());
    setError('');
    setPaused(false);
  };

  useEffect(() => {
    return () => {
      cancelRef.current = true;
    };
  }, []);

  const noLedger = recentTransactions.length === 0 && !loadingRecent;

  // ---------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------
  const CheckRow = ({ label, data, okField = 'verified' }) => {
    if (!data) return null;
    const ok = data[okField] === true;
    return (
      <div
        style={{
          padding: '0.7rem 0.9rem',
          background: 'var(--bg-card-subtle)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-sm)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.15rem' }}>
          <span style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-primary)' }}>{label}</span>
          <span className={`badge ${ok ? 'badge-success' : 'badge-danger'}`}>
            {data.status || (ok ? 'PASSED' : 'FAILED')}
          </span>
        </div>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{data.message}</p>
      </div>
    );
  };

  const bannerNode = run.banner ? (
    <div className={`result-banner ${run.banner.tone === 'success' ? 'success' : 'danger'}`} style={{ marginBottom: '1.25rem' }}>
      {run.banner.tone === 'success' ? (
        <CheckCircle2 size={30} style={{ flexShrink: 0 }} />
      ) : (
        <AlertOctagon size={30} style={{ flexShrink: 0 }} />
      )}
      <div>
        <div className="result-banner-text">{run.banner.text}</div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
          {run.banner.sub}
        </div>
      </div>
    </div>
  ) : null;

  const result = run.result;

  const resultPanel = () => {
    if (run.running) {
      return (
        <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)' }}>
          <RefreshCw size={34} className="spin-animation" style={{ margin: '0 auto 0.75rem', display: 'block' }} />
          <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Simulation running…</div>
          <p style={{ fontSize: '0.8rem', marginTop: '0.35rem' }}>
            Watch the network diagram and the live event timeline below.
          </p>
        </div>
      );
    }

    if (!result) {
      return (
        <div
          style={{
            padding: '3rem 1.5rem',
            textAlign: 'center',
            background: 'var(--bg-card-subtle)',
            borderRadius: 'var(--radius-md)',
            border: '1px dashed var(--border-card)',
            color: 'var(--text-muted)',
          }}
        >
          <ShieldAlert size={38} style={{ margin: '0 auto 1rem', display: 'block', opacity: 0.4 }} />
          <div style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
            Awaiting attack execution
          </div>
          <p style={{ fontSize: '0.8rem', maxWidth: '380px', margin: '0 auto', lineHeight: 1.5 }}>
            Configure the scenario on the left and launch it. Every verdict below comes from the backend's real
            cryptographic checks.
          </p>
        </div>
      );
    }

    if (result.attack === 'tampering') {
      const c = result.checks || {};
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <div className="compare-grid">
            <div className="compare-col original">
              <h4>Original transaction</h4>
              <div className="kv-row"><span className="kv-k">Amount</span><span className="kv-v">{result.original?.amount} {result.original?.currency}</span></div>
              <div className="kv-row"><span className="kv-k">Receiver</span><span className="kv-v">{result.original?.receiver}</span></div>
              <div className="kv-row"><span className="kv-k">Stored hash</span><span className="kv-v" style={{ fontSize: '0.7rem' }}>{result.original?.storedHash}</span></div>
            </div>
            <div className="compare-col modified">
              <h4>Tampered copy</h4>
              <div className="kv-row"><span className="kv-k">Amount</span><span className="kv-v">{result.tampered?.amount} {result.tampered?.currency}</span></div>
              <div className="kv-row"><span className="kv-k">Receiver</span><span className="kv-v">{result.tampered?.receiver}</span></div>
              <div className="kv-row"><span className="kv-k">Recomputed hash</span><span className="kv-v" style={{ fontSize: '0.7rem' }}>{result.tampered?.calculatedHash}</span></div>
            </div>
          </div>
          <CheckRow label="SHA-256 integrity" data={c.sha256} />
          <CheckRow label="HMAC-SHA-256 authentication" data={c.hmac} />
          <CheckRow label="RSA-2048 signature" data={c.rsaSignature} />
          <div className="kv-row">
            <span className="kv-k">Integrity verification result</span>
            <span className="kv-v" style={{ color: result.attackDetected ? 'var(--accent-danger)' : 'var(--accent-success)' }}>
              {result.attackDetected ? 'MISMATCH — ATTACK DETECTED' : 'MATCH — ATTACK UNDETECTED'}
            </span>
          </div>
          <div className="kv-row">
            <span className="kv-k">Attack outcome</span>
            <span className="kv-v">{result.status}</span>
          </div>
        </div>
      );
    }

    if (result.attack === 'replay') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <div className="compare-grid">
            <div className="compare-col original">
              <h4>Original request (1st submission)</h4>
              <div className="kv-row"><span className="kv-k">Transaction</span><span className="kv-v">{result.original?.transactionId}</span></div>
              <div className="kv-row"><span className="kv-k">Nonce</span><span className="kv-v" style={{ fontSize: '0.7rem' }}>{result.original?.nonce}</span></div>
              <div className="kv-row"><span className="kv-k">Timestamp</span><span className="kv-v">{result.original?.timestamp}</span></div>
              <div className="kv-row"><span className="kv-k">Outcome</span><span className="kv-v">{result.original?.firstOutcome}</span></div>
            </div>
            <div className="compare-col modified">
              <h4>Replayed request (2nd submission)</h4>
              <div className="kv-row"><span className="kv-k">HTTP status</span><span className="kv-v">{result.replay?.httpStatus}</span></div>
              <div className="kv-row"><span className="kv-k">Server reason</span><span className="kv-v">{result.replay?.reason || '—'}</span></div>
              <div className="kv-row"><span className="kv-k">Server message</span><span className="kv-v" style={{ fontSize: '0.72rem' }}>{result.replay?.message}</span></div>
            </div>
          </div>
          <div
            style={{
              padding: '0.75rem 0.9rem',
              background: result.attackDetected ? 'var(--accent-success-bg)' : 'var(--accent-danger-bg)',
              border: `1px solid ${result.attackDetected ? 'var(--accent-success-border)' : 'var(--accent-danger-border)'}`,
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.8rem',
              color: result.attackDetected ? 'var(--accent-success)' : 'var(--accent-danger)',
            }}
          >
            {result.message}
          </div>
        </div>
      );
    }

    if (result.attack === 'forgery') {
      const c = result.checks || {};
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <div className="compare-grid">
            <div className="compare-col original">
              <h4>Legitimate signer</h4>
              <div className="kv-row"><span className="kv-k">Sender</span><span className="kv-v">{result.original?.signer}</span></div>
              <div className="kv-row"><span className="kv-k">Key fingerprint</span><span className="kv-v" style={{ fontSize: '0.72rem' }}>{result.original?.publicKeyFingerprint}</span></div>
            </div>
            <div className="compare-col modified">
              <h4>Forged payload</h4>
              <div className="kv-row"><span className="kv-k">Sender claimed</span><span className="kv-v">{result.forged?.sender}</span></div>
              <div className="kv-row"><span className="kv-k">Amount</span><span className="kv-v">{result.forged?.amount}</span></div>
            </div>
          </div>
          <CheckRow label="RSA-2048 signature verification" data={c.rsaSignature} />
          <CheckRow label="SHA-256 integrity" data={c.sha256} />
          <div className="kv-row">
            <span className="kv-k">Verification outcome</span>
            <span className="kv-v" style={{ color: result.attackDetected ? 'var(--accent-danger)' : 'var(--accent-success)' }}>
              {result.status}
            </span>
          </div>
        </div>
      );
    }

    if (result.attack === 'fake-confirmation') {
      const c = result.checks || {};
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <div className="compare-grid">
            <div className="compare-col modified">
              <h4>Client-side fake confirmation</h4>
              <div className="kv-row"><span className="kv-k">Claimed status</span><span className="kv-v">{result.claimed?.claimedStatus}</span></div>
              <div className="kv-row"><span className="kv-k">Claimed amount</span><span className="kv-v">{result.claimed?.claimedAmount ?? '—'}</span></div>
              <div className="kv-row"><span className="kv-k">Source</span><span className="kv-v">{result.claimed?.source}</span></div>
            </div>
            <div className="compare-col original">
              <h4>Authoritative server record</h4>
              <div className="kv-row"><span className="kv-k">Server status</span><span className="kv-v">{result.server?.serverStatus}</span></div>
              <div className="kv-row"><span className="kv-k">Approved</span><span className="kv-v">{String(result.server?.approved)}</span></div>
              <div className="kv-row"><span className="kv-k">Amount on record</span><span className="kv-v">{result.server?.amount ?? '—'}</span></div>
            </div>
          </div>
          <CheckRow label="Server ledger lookup" data={c.serverLookup} okField="verified" />
          <CheckRow label="Claimed vs server status" data={c.statusMatch} okField="verified" />
          {c.amountMatch && <CheckRow label="Claimed vs server amount" data={c.amountMatch} okField="verified" />}
          {c.receiverMatch && <CheckRow label="Claimed vs server receiver" data={c.receiverMatch} okField="verified" />}
          {result.mismatches && result.mismatches.length > 0 && (
            <div
              style={{
                padding: '0.7rem 0.9rem',
                background: 'var(--accent-danger-bg)',
                border: '1px solid var(--accent-danger-border)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.78rem',
                color: 'var(--accent-danger)',
                lineHeight: 1.5,
              }}
            >
              <strong>Rejected by the server because:</strong>
              <ul style={{ margin: '0.35rem 0 0 1rem', listStyle: 'disc' }}>
                {result.mismatches.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      );
    }

    return null;
  };

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Attack Simulations</h1>
          <p className="page-subtitle">Tampering, replay, forgery and fake confirmations, verified by the backend.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setPaused((v) => !v)}
            disabled={!run.running}
            title={paused ? 'Resume the simulation' : 'Pause the simulation'}
          >
            {paused ? <Play size={14} /> : <Pause size={14} />} {paused ? 'Resume' : 'Pause'}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={launchCurrent}
            disabled={run.running}
            title="Replay this scenario with the current settings"
          >
            <RotateCcw size={14} /> Replay
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={resetSimulation}
            title="Clears this visual run only - no ledger data or security logs are deleted"
          >
            Reset Simulation
          </button>
        </div>
      </div>

      {/* Scenario tabs */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {SCENARIOS.map((s) => {
          const Icon = s.icon;
          const active = activeTab === s.key;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => {
                setActiveTab(s.key);
                resetSimulation();
              }}
              className="btn"
              style={{
                flex: 1,
                minWidth: '210px',
                padding: '0.75rem 1rem',
                background: active ? 'var(--accent-danger-bg)' : 'var(--bg-surface)',
                border: `1px solid ${active ? 'var(--accent-danger-border)' : 'var(--border-card)'}`,
                color: active ? 'var(--accent-danger)' : 'var(--text-secondary)',
                fontWeight: 700,
              }}
            >
              <Icon size={16} /> {s.label}
            </button>
          );
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '1.75rem' }}>
        {/* Left: scenario controls */}
        <div className="crypto-card">
          <div className="card-header-flex">
            <h2 className="card-title">
              <Flame size={18} color="var(--accent-danger)" /> Scenario Configuration
            </h2>
            <span className="badge badge-danger">{SCENARIOS.find((s) => s.key === activeTab)?.label.split(' ')[0]}</span>
          </div>

          {error && (
            <div
              style={{
                background: 'var(--accent-danger-bg)',
                border: '1px solid var(--accent-danger-border)',
                borderRadius: 'var(--radius-md)',
                padding: '0.7rem 1rem',
                color: 'var(--accent-danger)',
                fontSize: '0.8rem',
                marginBottom: '1rem',
              }}
            >
              {error}
            </div>
          )}

          {/* Target transaction picker */}
          <div className="form-group">
            <label className="form-label">Target transaction from the ledger</label>
            {noLedger ? (
              <div
                style={{
                  padding: '1rem',
                  background: 'var(--bg-card-subtle)',
                  border: '1px dashed var(--border-card)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.8rem',
                  color: 'var(--text-muted)',
                }}
              >
                No transactions yet.{' '}
                <Link to="/payment" style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>
                  Create a payment first
                </Link>{' '}
                to give the attacker something to target.
              </div>
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.4rem',
                  maxHeight: '150px',
                  overflowY: 'auto',
                }}
              >
                {recentTransactions.map((tx) => (
                  <button
                    key={tx._id || tx.transactionId}
                    type="button"
                    onClick={() => selectTransaction(tx)}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '0.5rem 0.7rem',
                      background:
                        selectedTxId === tx.transactionId ? 'rgba(88, 101, 242, 0.15)' : 'var(--bg-card-subtle)',
                      border: `1px solid ${
                        selectedTxId === tx.transactionId ? 'rgba(88, 101, 242, 0.4)' : 'var(--border-subtle)'
                      }`,
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <span className="font-mono" style={{ fontSize: '0.75rem', color: '#4752c4', fontWeight: 600 }}>
                      {tx.transactionId}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                      {tx.status} · {Number(tx.amount).toFixed(2)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* A. Tamper inputs */}
          {activeTab === 'TAMPER' && (
            <div>
              <div className="form-group">
                <label className="form-label">Field to tamper</label>
                <select className="form-control" value={tamperedField} onChange={(e) => setTamperedField(e.target.value)}>
                  <option value="amount">Amount only</option>
                  <option value="receiver">Receiver only</option>
                  <option value="both">Both amount &amp; receiver</option>
                </select>
              </div>
              {(tamperedField === 'amount' || tamperedField === 'both') && (
                <div className="form-group">
                  <label className="form-label">
                    Tampered amount (original: {selectedTx ? Number(selectedTx.amount).toFixed(2) : '—'})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-control font-mono"
                    value={tamperedAmount}
                    onChange={(e) => setTamperedAmount(e.target.value)}
                  />
                </div>
              )}
              {(tamperedField === 'receiver' || tamperedField === 'both') && (
                <div className="form-group">
                  <label className="form-label">Tampered receiver</label>
                  <input
                    type="text"
                    className="form-control"
                    value={tamperedReceiver}
                    onChange={(e) => setTamperedReceiver(e.target.value)}
                  />
                </div>
              )}
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: '1rem' }}>
                The packet is altered after signing; the server re-checks it against the stored values.
              </p>
            </div>
          )}

          {/* B. Replay inputs */}
          {activeTab === 'REPLAY' && (
            <div>
              <div className="form-group">
                <label className="form-label">Amount for the (fresh) replayed transaction</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-control font-mono"
                  value={replayAmount}
                  onChange={(e) => setReplayAmount(e.target.value)}
                />
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: '1rem' }}>
                A valid transaction is submitted once, then resubmitted with the same ID and nonce. A fresh one is
                created if the selected transaction was already processed.
              </p>
            </div>
          )}

          {/* C. Forgery inputs */}
          {activeTab === 'FORGERY' && (
            <div>
              <div className="form-group">
                <label className="form-label">Forged sender (attacker-controlled)</label>
                <input type="text" className="form-control" value={forgedSender} onChange={(e) => setForgedSender(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Forged receiver</label>
                <input type="text" className="form-control" value={forgedReceiver} onChange={(e) => setForgedReceiver(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Forged amount</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-control font-mono"
                  value={forgedAmount}
                  onChange={(e) => setForgedAmount(e.target.value)}
                />
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: '1rem' }}>
                The sender and amount are rewritten without the legitimate signing key.
              </p>
            </div>
          )}

          {/* D. Fake confirmation inputs */}
          {activeTab === 'FAKE' && (
            <div>
              <div className="form-group">
                <label className="form-label">Fake receipt references</label>
                <select className="form-control" value={fakeTarget} onChange={(e) => setFakeTarget(e.target.value)}>
                  <option value="FAKE_ID">A fabricated transaction ID (never existed)</option>
                  <option value="LEDGER_ID">The selected ledger transaction</option>
                </select>
              </div>
              {fakeTarget === 'FAKE_ID' && (
                <div className="form-group">
                  <label className="form-label">Fabricated transaction ID</label>
                  <input type="text" className="form-control font-mono" value={fakeTxId} onChange={(e) => setFakeTxId(e.target.value)} />
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Amount claimed in the fake receipt</label>
                <input
                  type="number"
                  className="form-control font-mono"
                  value={fakeClaimedAmount}
                  onChange={(e) => setFakeClaimedAmount(e.target.value)}
                />
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: '1rem' }}>
                A client-side success message is compared with the server's record.
              </p>
            </div>
          )}

          <button
            type="button"
            className="btn btn-danger"
            style={{ width: '100%', padding: '0.8rem' }}
            onClick={launchCurrent}
            disabled={run.running}
          >
            {run.running ? (
              <>
                <RefreshCw size={15} className="spin-animation" /> Simulation running…
              </>
            ) : (
              <>
                <Send size={15} /> Launch Attack Simulation
              </>
            )}
          </button>
        </div>

        {/* Right: results */}
        <div className="crypto-card">
          <div className="card-header-flex">
            <h2 className="card-title">
              <Server size={18} color="var(--accent-cyan)" /> Server-Verified Outcome
            </h2>
            {result && (
              <span className={`badge ${result.attackDetected ? 'badge-danger' : 'badge-success'}`}>
                {result.attackDetected ? 'ATTACK BLOCKED' : 'NO FAILURE DETECTED'}
              </span>
            )}
          </div>

          {bannerNode}
          {resultPanel()}
        </div>
      </div>

      {/* Network diagram + timeline */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '1.75rem', marginTop: '1.75rem' }}>
        <div className="crypto-card">
          <div className="card-header-flex">
            <h2 className="card-title">
              <Eye size={18} color="var(--accent-primary)" /> Network Path
            </h2>
            <span className={`badge ${run.running ? 'badge-warning' : 'badge-gray'}`}>
              {run.running ? (paused ? 'PAUSED' : 'LIVE') : 'IDLE'}
            </span>
          </div>
          <NetworkDiagram
            activeEdges={run.edges}
            activeNodes={run.nodes}
            caption={`Scenario: ${SCENARIOS.find((s) => s.key === activeTab)?.label}`}
          />
        </div>

        <div className="crypto-card">
          <div className="card-header-flex">
            <h2 className="card-title">
              <ShieldAlert size={18} color="var(--accent-danger)" /> Live Event Timeline
            </h2>
            <span className="badge badge-gray">{run.events.length} events</span>
          </div>
          <EventTimeline events={run.events} maxHeight={300} />
        </div>
      </div>
    </div>
  );
};

export default AttackSimulationPage;
