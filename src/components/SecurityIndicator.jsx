import React from 'react';
import { ShieldCheck, ShieldAlert, ShieldX } from 'lucide-react';

const SecurityIndicator = ({ level = 'HIGH', title = 'Cryptographic Guard Active' }) => {
  let color = 'var(--accent-success)';
  let bg = 'var(--accent-success-bg)';
  let border = 'var(--accent-success-border)';
  let Icon = ShieldCheck;

  if (level === 'MEDIUM' || level === 'WARNING') {
    color = 'var(--accent-warning)';
    bg = 'var(--accent-warning-bg)';
    border = 'var(--accent-warning-border)';
    Icon = ShieldAlert;
  } else if (level === 'CRITICAL' || level === 'DANGER' || level === 'LOW') {
    color = 'var(--accent-danger)';
    bg = 'var(--accent-danger-bg)';
    border = 'var(--accent-danger-border)';
    Icon = ShieldX;
  }

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.4rem 0.85rem',
        borderRadius: 'var(--radius-md)',
        backgroundColor: bg,
        border: `1px solid ${border}`,
        color: color,
        fontSize: '0.785rem',
        fontWeight: 600,
        letterSpacing: '0.01em',
      }}
    >
      <Icon size={15} />
      <span>{title}</span>
    </div>
  );
};

export default SecurityIndicator;
