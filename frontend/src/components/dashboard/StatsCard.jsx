import React from 'react';

/**
 * A summary statistics card for the dashboard.
 *
 * @param {Object}          props
 * @param {string}          props.title   - Card label
 * @param {number|string}   props.value   - Primary metric value
 * @param {React.ReactNode} [props.icon]  - Icon element
 * @param {string}          [props.color] - Accent colour (hex or CSS value)
 */
function StatsCard({ title, value, icon, color = '#2563eb' }) {
  return (
    <div className="card h-100 border-0">
      <div className="card-body d-flex align-items-center gap-3">
        {icon && (
          <div
            className="d-flex align-items-center justify-content-center flex-shrink-0"
            style={{ width: 46, height: 46, borderRadius: 12, backgroundColor: `${color}1A` }}
            aria-hidden="true"
          >
            <span style={{ color, fontSize: 22, display: 'flex' }}>{icon}</span>
          </div>
        )}
        <div style={{ minWidth: 0 }}>
          <p className="mb-0" style={{ fontSize: 12, fontWeight: 500, color: '#64748b' }}>{title}</p>
          <p className="mb-0" style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.2, color: '#0f172a' }}>
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}

export default StatsCard;
