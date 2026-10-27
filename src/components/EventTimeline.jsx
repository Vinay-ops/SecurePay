import React, { useEffect, useRef } from 'react';

/**
 * Live event timeline used by the transaction lifecycle and attack simulations.
 *
 * events: [{ id, title, detail, status, time }]
 *   status: 'info' | 'success' | 'warning' | 'danger' | 'pending'
 */
const EventTimeline = ({ events = [], maxHeight }) => {
  const endRef = useRef(null);

  useEffect(() => {
    if (endRef.current) {
      endRef.current.scrollIntoView({ block: 'nearest' });
    }
  }, [events.length]);

  if (!events.length) {
    return (
      <div
        style={{
          padding: '1.5rem',
          textAlign: 'center',
          color: 'var(--text-muted)',
          fontSize: '0.8rem',
          background: 'var(--bg-card-subtle)',
          border: '1px dashed var(--border-card)',
          borderRadius: 'var(--radius-md)',
        }}
      >
        No events yet. Run the simulation to see the live event stream.
      </div>
    );
  }

  return (
    <div className="tl" style={maxHeight ? { maxHeight } : undefined}>
      {events.map((ev) => (
        <div className="tl-item" key={ev.id}>
          <div className={`tl-dot ${ev.status || 'info'}`} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}>
              <span className="tl-title">{ev.title}</span>
              <span className="tl-time">{ev.time}</span>
            </div>
            {ev.detail && <div className="tl-detail">{ev.detail}</div>}
          </div>
        </div>
      ))}
      <div ref={endRef} />
    </div>
  );
};

export default EventTimeline;
