import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Send,
  History,
  FileCheck2,
  Bug,
  ShieldAlert,
  Home,
  X,
} from 'lucide-react';

const Sidebar = ({ mobileOpen, onCloseMobile }) => {
  const navItems = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard, exact: true },
    { to: '/payment', label: 'Make Payment', icon: Send },
    { to: '/history', label: 'Transactions', icon: History },
    { to: '/verify', label: 'Verify Security', icon: FileCheck2 },
    { to: '/simulation', label: 'Attack Simulation', icon: Bug },
    { to: '/security', label: 'Security Dashboard', icon: ShieldAlert },
    { to: '/overview', label: 'Project Overview', icon: Home },
  ];

  return (
    <aside
      style={{
        width: '260px',
        backgroundColor: 'var(--bg-surface)',
        borderRight: '1px solid var(--border-card)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        flexShrink: 0,
        height: '100vh',
        position: 'sticky',
        top: 0,
        zIndex: 95,
      }}
      className={`app-sidebar ${mobileOpen ? 'mobile-open' : ''}`}
    >
      <div style={{ padding: '1.25rem 0.85rem', overflowY: 'auto' }}>
        {/* Mobile Header / Close Button */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0 0.5rem 0.75rem',
            marginBottom: '0.5rem',
          }}
        >
          <div
            style={{
              fontSize: '0.725rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              color: 'var(--text-muted)',
              letterSpacing: '0.08em',
            }}
          >
            Navigation
          </div>
          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              style={{
                color: 'var(--text-muted)',
                padding: '0.2rem',
                display: 'none',
              }}
              className="d-mobile-close"
              aria-label="Close sidebar"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Navigation Items */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.exact}
                onClick={() => onCloseMobile && onCloseMobile()}
                style={({ isActive }) => ({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.65rem 0.85rem',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.875rem',
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? '#4752c4' : 'var(--text-secondary)',
                  backgroundColor: isActive ? 'rgba(88, 101, 242, 0.08)' : 'transparent',
                  borderLeft: isActive ? '4px solid var(--accent-primary)' : '4px solid transparent',
                  borderRadius: 'var(--radius-md)',
                  transition: 'all 400ms cubic-bezier(0.16, 1, 0.3, 1)',
                })}
              >
                <Icon size={18} color="var(--accent-primary)" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Simulator Footer Badge */}
      <div
        style={{
          padding: '1rem',
          borderTop: '1px solid var(--border-card)',
          fontSize: '0.725rem',
          color: 'var(--text-muted)',
          backgroundColor: 'var(--bg-card-subtle)',
          borderBottomLeftRadius: 'var(--radius-lg)',
        }}
      >
        <div style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.15rem' }}>
          Academic Simulator
        </div>
        <div>Cryptography & Security Demo</div>
        <div style={{ marginTop: '0.25rem', fontSize: '0.7rem', color: 'var(--accent-primary)', fontWeight: 600 }}>
          Integrity & Defense Active
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
