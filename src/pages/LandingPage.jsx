import React from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  Lock,
  KeyRound,
  Zap,
  ArrowRight,
  ShieldAlert,
  FileCheck2,
  Bug,
  RefreshCw,
  Cpu,
  Layers,
} from 'lucide-react';

const LandingPage = () => {
  const cryptoPillars = [
    {
      title: '1. SHA-256 Transaction Integrity',
      desc: 'Ensures that transaction parameters (amount, receiver, nonce, timestamp) cannot be altered in transit without breaking the 256-bit cryptographic digest.',
      icon: Lock,
      color: '#4f46e5',
      standard: 'FIPS PUB 180-4',
    },
    {
      title: '2. HMAC-SHA-256 Authentication',
      desc: 'Guarantees message authenticity and gateway node trust via keyed-hash message authentication code using shared cryptographic secrets.',
      icon: ShieldCheck,
      color: '#059669',
      standard: 'RFC 2104',
    },
    {
      title: '3. RSA-2048 Digital Signatures',
      desc: 'Provides asymmetric sender authentication and legally binding non-repudiation. The sender signs with their private key, and the network verifies with their public key.',
      icon: KeyRound,
      color: '#7c3aed',
      standard: 'PKCS #1 v2.2',
    },
    {
      title: '4. Nonce & Timestamp Anti-Replay',
      desc: 'Thwarts replay attacks using cryptographically generated single-use nonces combined with a 300-second monotonic freshness window.',
      icon: RefreshCw,
      color: '#d97706',
      standard: 'CSPRNG Nonce Guard',
    },
    {
      title: '5. Confidentiality & Key Isolation',
      desc: 'Protects user credentials, private keys, and session parameters through authenticated security boundaries and secret segregation.',
      icon: ShieldAlert,
      color: '#f43f5e',
      standard: 'NIST SP 800-38D',
    },
  ];

  return (
    <div>
      {/* Hero Section */}
      <section
        style={{
          background: 'linear-gradient(180deg, rgba(88, 101, 242, 0.09) 0%, rgba(248, 250, 252, 0) 100%)',
          border: '1px solid var(--border-card)',
          borderRadius: 'var(--radius-xl)',
          padding: '3rem 2.25rem',
          marginBottom: '2rem',
          position: 'relative',
        }}
      >
        <div style={{ maxWidth: '880px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.35rem 0.85rem',
              background: 'rgba(88, 101, 242, 0.12)',
              border: '1px solid rgba(88, 101, 242, 0.3)',
              borderRadius: 'var(--radius-sm)',
              color: '#4752c4',
              fontSize: '0.785rem',
              fontWeight: 600,
              marginBottom: '1.25rem',
            }}
          >
            <ShieldCheck size={16} /> ACADEMIC CRYPTOGRAPHY & SECURITY PROJECT
          </div>

          <h1
            style={{
              fontSize: '2.3rem',
              fontWeight: 800,
              letterSpacing: '-0.03em',
              lineHeight: 1.2,
              marginBottom: '1rem',
              color: 'var(--text-primary)',
            }}
          >
            Secure Digital Payment System
          </h1>

          <p
            style={{
              fontSize: '1.05rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.6,
              marginBottom: '2rem',
            }}
          >
            An educational payment simulator demonstrating cryptographic integrity, authentication, digital signatures, and replay protection.
          </p>

          <div style={{ display: 'flex', gap: '0.85rem', flexWrap: 'wrap' }}>
            <Link to="/payment" className="btn btn-primary btn-lg">
              <Zap size={17} /> Launch Payment Simulator
            </Link>
            <Link to="/simulation" className="btn btn-danger btn-lg">
              <Bug size={17} /> Attack Simulation Lab
            </Link>
            <Link to="/dashboard" className="btn btn-secondary btn-lg">
              View Dashboard <ArrowRight size={17} />
            </Link>
          </div>
        </div>
      </section>

      {/* Cryptographic Pipeline Flow Visualizer */}
      <div
        className="crypto-card"
        style={{
          marginBottom: '2rem',
          background: 'var(--bg-card-subtle)',
        }}
      >
        <div style={{ marginBottom: '1.25rem' }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Layers size={18} color="var(--accent-primary)" /> Cryptographic Transaction Pipeline
          </h2>
          <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
            Every digital transaction follows a strict multi-layer mathematical verification sequence:
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '0.85rem',
          }}
        >
          <div style={{ padding: '0.85rem', background: 'var(--bg-main)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ fontSize: '0.7rem', color: '#5865f2', fontWeight: 700, textTransform: 'uppercase' }}>Step 1: Initiation</div>
            <div style={{ fontWeight: 600, fontSize: '0.875rem', marginTop: '0.25rem' }}>CSPRNG Nonce + Clock</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>128-bit unique entropy + monotonic timestamp</div>
          </div>

          <div style={{ padding: '0.85rem', background: 'var(--bg-main)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ fontSize: '0.7rem', color: '#4f46e5', fontWeight: 700, textTransform: 'uppercase' }}>Step 2: Integrity</div>
            <div style={{ fontWeight: 600, fontSize: '0.875rem', marginTop: '0.25rem' }}>SHA-256 Digest</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Deterministic canonical payload hashing</div>
          </div>

          <div style={{ padding: '0.85rem', background: 'var(--bg-main)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ fontSize: '0.7rem', color: '#7c3aed', fontWeight: 700, textTransform: 'uppercase' }}>Step 3: Non-Repudiation</div>
            <div style={{ fontWeight: 600, fontSize: '0.875rem', marginTop: '0.25rem' }}>RSA-2048 Sign</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Private key digital signature</div>
          </div>

          <div style={{ padding: '0.85rem', background: 'var(--bg-main)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ fontSize: '0.7rem', color: '#059669', fontWeight: 700, textTransform: 'uppercase' }}>Step 4: Authenticity</div>
            <div style={{ fontWeight: 600, fontSize: '0.875rem', marginTop: '0.25rem' }}>HMAC Authentication</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Shared secret gateway verification</div>
          </div>

          <div style={{ padding: '0.85rem', background: 'var(--bg-main)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ fontSize: '0.7rem', color: '#d97706', fontWeight: 700, textTransform: 'uppercase' }}>Step 5: Execution</div>
            <div style={{ fontWeight: 600, fontSize: '0.875rem', marginTop: '0.25rem' }}>Anti-Replay CAS</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Atomic lock & ledger finalization</div>
          </div>
        </div>
      </div>

      {/* 5 Core Pillars Grid */}
      <div style={{ marginBottom: '2.5rem' }}>
        <div style={{ marginBottom: '1.25rem' }}>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 700 }}>Core Cryptographic Mechanisms</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            The 5 foundational security layers safeguarding each payment packet against tampering and adversary threats.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem' }}>
          {cryptoPillars.map((pillar, idx) => {
            const Icon = pillar.icon;
            return (
              <div key={idx} className="crypto-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: 'var(--radius-md)',
                      background: 'rgba(88, 101, 242, 0.05)',
                      border: '1px solid var(--border-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: '1rem',
                    }}
                  >
                    <Icon size={22} color={pillar.color} />
                  </div>
                  <h3 style={{ fontSize: '1.025rem', fontWeight: 600, marginBottom: '0.5rem', color: '#0f172a' }}>
                    {pillar.title}
                  </h3>
                  <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '1rem' }}>
                    {pillar.desc}
                  </p>
                </div>
                <div style={{ paddingTop: '0.75rem', borderTop: '1px solid var(--border-subtle)', fontSize: '0.725rem', color: pillar.color, fontWeight: 600 }}>
                  Standard: {pillar.standard}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Interactive Feature Modules Callouts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
        <div className="crypto-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <FileCheck2 size={24} color="var(--accent-primary)" />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Deep Verification Auditor</h3>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', lineHeight: 1.5 }}>
            Audit any transaction packet with real-time verification of canonical serialization, SHA-256 hash digests, HMAC authentication, and RSA digital signatures.
          </p>
          <Link to="/verify" className="btn btn-secondary" style={{ width: '100%' }}>
            Open Verification Auditor <ArrowRight size={15} />
          </Link>
        </div>

        <div className="crypto-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <Bug size={24} color="var(--accent-danger)" />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Attack Simulation Sandbox</h3>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', lineHeight: 1.5 }}>
            Simulate Man-In-The-Middle alterations, amount tampering, receiver hijacking, signature forgery, and replay attacks to observe cryptographic rejection.
          </p>
          <Link to="/simulation" className="btn btn-secondary" style={{ width: '100%' }}>
            Launch Attack Sandbox <ArrowRight size={15} />
          </Link>
        </div>

        <div className="crypto-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <ShieldAlert size={24} color="var(--accent-success)" />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Security Center & Telemetry</h3>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', lineHeight: 1.5 }}>
            Monitor cryptographic health parameters, key management infrastructure, entropy status, database resilience, and real-time MongoDB audit logs.
          </p>
          <Link to="/security" className="btn btn-secondary" style={{ width: '100%' }}>
            View Security Dashboard <ArrowRight size={15} />
          </Link>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
