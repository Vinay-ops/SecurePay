import React, { useState } from 'react';
import { Copy, Check, ChevronDown, ChevronUp } from 'lucide-react';

const CryptoValueDisplay = ({
  label,
  value,
  algorithm,
  badgeColor = 'blue',
  truncateLength = 64,
  allowExpand = true,
  description,
}) => {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const strValue = String(value || '');

  const handleCopy = () => {
    if (!strValue) return;
    navigator.clipboard.writeText(strValue);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shouldTruncate = allowExpand && strValue.length > truncateLength;
  const displayValue = shouldTruncate && !expanded
    ? `${strValue.substring(0, truncateLength)}...`
    : strValue;

  return (
    <div
      style={{
        background: 'var(--bg-card-subtle)',
        border: '1px solid var(--border-card)',
        borderRadius: 'var(--radius-md)',
        padding: '0.85rem 1rem',
        marginBottom: '0.85rem',
        transition: 'border-color 0.15s ease',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '0.35rem',
          flexWrap: 'wrap',
          gap: '0.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.785rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
            {label}
          </span>
          {algorithm && (
            <span
              className={`badge badge-${badgeColor}`}
              style={{ fontSize: '0.675rem', padding: '0.15rem 0.45rem' }}
            >
              {algorithm}
            </span>
          )}
        </div>

        <button
          onClick={handleCopy}
          className="btn btn-secondary btn-sm"
          style={{
            padding: '0.2rem 0.55rem',
            fontSize: '0.725rem',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.3rem',
          }}
          title="Copy cryptographic value"
          disabled={!strValue}
          type="button"
        >
          {copied ? (
            <>
              <Check size={12} color="var(--accent-success)" />
              <span style={{ color: 'var(--accent-success)', fontWeight: 600 }}>Copied!</span>
            </>
          ) : (
            <>
              <Copy size={12} />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {description && (
        <p style={{ fontSize: '0.735rem', color: 'var(--text-muted)', marginBottom: '0.45rem', lineHeight: 1.4 }}>
          {description}
        </p>
      )}

      <div
        className="crypto-hash-box"
        style={{
          fontSize: '0.775rem',
          padding: '0.65rem 0.85rem',
        }}
      >
        {strValue ? displayValue : <span style={{ color: 'var(--text-muted)' }}>Not generated yet</span>}
      </div>

      {shouldTruncate && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          style={{
            marginTop: '0.4rem',
            fontSize: '0.725rem',
            color: 'var(--accent-primary)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
            fontWeight: 600,
          }}
        >
          {expanded ? (
            <>
              <ChevronUp size={13} /> Collapse Full ({strValue.length} chars)
            </>
          ) : (
            <>
              <ChevronDown size={13} /> View Full String ({strValue.length} characters)
            </>
          )}
        </button>
      )}
    </div>
  );
};

export default CryptoValueDisplay;
