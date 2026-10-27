import React from 'react';

/**
 * Animated network path diagram between Sender, Attacker, Backend Server and
 * Receiver.
 *
 * props:
 *   activeEdges: [{ from, to, state }]
 *       state: 'normal' | 'suspicious' | 'rejected' | 'success'
 *   activeNodes: { sender: 'active'|'alert'|'ok', ... }
 *   caption: optional text under the diagram
 */
const NODES = {
  sender: { x: 14, y: 112, w: 132, h: 56, name: 'Sender', sub: 'client' },
  attacker: { x: 268, y: 18, w: 132, h: 56, name: 'Attacker', sub: 'adversary' },
  server: { x: 520, y: 112, w: 140, h: 56, name: 'Backend Server', sub: 'verifier' },
  receiver: { x: 742, y: 112, w: 132, h: 56, name: 'Receiver', sub: 'payee' },
};

const center = (key) => {
  const n = NODES[key];
  return { x: n.x + n.w / 2, y: n.y + n.h / 2 };
};

const EDGES = {
  'sender>attacker': [center('sender'), center('attacker')],
  'attacker>server': [center('attacker'), center('server')],
  'sender>server': [center('sender'), center('server')],
  'server>receiver': [center('server'), center('receiver')],
  'attacker>receiver': [center('attacker'), center('receiver')],
  'receiver>server': [center('receiver'), center('server')],
};

const edgeKey = (e) => `${e.from}>${e.to}`;

const NetworkDiagram = ({ activeEdges = [], activeNodes = {}, caption }) => {
  const activeMap = {};
  activeEdges.forEach((e) => {
    activeMap[edgeKey(e)] = e.state || 'normal';
  });

  return (
    <div className="net-wrap">
      <svg className="net-svg" viewBox="0 0 890 190" role="img" aria-label="Network path diagram">
        {/* Base edges */}
        {Object.entries(EDGES).map(([[from, to], [a, b]]) => (
          <line key={`base-${from}-${to}`} className="net-edge" x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
        ))}

        {/* Active / animated edges */}
        {Object.entries(EDGES).map(([[from, to], [a, b]]) => {
          const state = activeMap[`${from}>${to}`];
          if (!state) return null;
          return (
            <line
              key={`active-${from}-${to}`}
              className={`net-edge net-edge-active ${state}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              strokeLinecap="round"
            />
          );
        })}

        {/* Nodes */}
        {Object.entries(NODES).map(([key, n]) => {
          const stateClass = activeNodes[key] || '';
          return (
            <g key={key} className={`net-node ${stateClass}`}>
              <rect className="net-node-rect" x={n.x} y={n.y} width={n.w} height={n.h} rx="10" />
              <text className="net-node-name" x={n.x + n.w / 2} y={n.y + 25} textAnchor="middle">
                {n.name}
              </text>
              <text className="net-node-sub" x={n.x + n.w / 2} y={n.y + 41} textAnchor="middle">
                {n.sub}
              </text>
            </g>
          );
        })}
      </svg>

      {caption && (
        <div
          style={{
            fontSize: '0.72rem',
            color: 'var(--text-secondary)',
            textAlign: 'center',
            marginTop: '0.25rem',
          }}
        >
          {caption}
        </div>
      )}

      <div
        style={{
          display: 'flex',
          gap: '0.85rem',
          flexWrap: 'wrap',
          justifyContent: 'center',
          marginTop: '0.35rem',
          fontSize: '0.675rem',
          color: 'var(--text-muted)',
        }}
      >
        <span><span style={{ color: '#5865f2' }}>—</span> normal traffic</span>
        <span><span style={{ color: '#f59e0b' }}>—</span> suspicious activity</span>
        <span><span style={{ color: '#ef4444' }}>—</span> rejected request</span>
        <span><span style={{ color: '#10b981' }}>—</span> successful transaction</span>
      </div>
    </div>
  );
};

export default NetworkDiagram;
