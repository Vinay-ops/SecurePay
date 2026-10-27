import React from 'react';
import { ShieldCheck, Wallet, Menu, Users } from 'lucide-react';
import { useDemo } from '../context/DemoContext';
import { Link } from 'react-router-dom';

const Navbar = ({ onToggleMobileMenu }) => {
  const { accounts, loading, refresh } = useDemo();
  const primary = accounts[0] || null;

  return (
    <header
      style={{
        height: '68px',
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border-card)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 1.75rem',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        {/* Mobile Menu Toggle */}
        <button
          onClick={onToggleMobileMenu}
          className="btn btn-secondary"
          style={{ padding: '0.45rem', display: 'none' }}
          aria-label="Toggle navigation menu"
          id="mobile-nav-toggle"
        >
          <Menu size={18} />
        </button>

        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: 'var(--radius-md)',
              background: 'linear-gradient(135deg, #5865f2, #4752c4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: '0 2px 8px rgba(88, 101, 242, 0.3)',
            }}
          >
            <ShieldCheck size={20} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1.025rem', color: 'var(--text-primary)', letterSpacing: '-0.01em', lineHeight: 1.2 }}>
              SecurePay <span style={{ color: 'var(--accent-primary)', fontSize: '0.8rem', fontWeight: 800 }}>CRYPTO</span>
            </div>
            <div style={{ fontSize: '0.675rem', color: 'var(--text-muted)' }}>
              Integrity & Authentication Simulator
            </div>
          </div>
        </Link>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        {/* Demo mode indicator (no login required) */}
        <span
          className="badge badge-cyan d-none-sm"
          title="Shared demonstration environment - no login or registration required"
        >
          <Users size={12} /> DEMO MODE
        </span>

        {/* Demo wallet balance display */}
        {primary && (
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-card)',
              borderRadius: 'var(--radius-md)',
              padding: '0.4rem 0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
            }}
            className="d-none-sm"
          >
            <Wallet size={15} color="var(--accent-cyan)" />
            <div>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', lineHeight: 1, letterSpacing: '0.04em' }}>
                DEMO BALANCE · {String(primary.name).split(' ')[0].toUpperCase()}
              </span>
              <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                ₹{(primary.balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={refresh}
          className="btn btn-secondary btn-sm"
          title="Refresh demo balances from the server"
          disabled={loading}
        >
          {loading ? '...' : 'Refresh'}
        </button>
      </div>
    </header>
  );
};

export default Navbar;
