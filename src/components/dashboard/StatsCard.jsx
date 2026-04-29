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
function StatsCard({ title, value, icon, color = '#0052CC' }) {
  return (
    <div className="card h-100 border-0 shadow-sm">
      <div className="card-body d-flex align-items-center gap-3">
        {icon && (
          <div
            className="d-flex align-items-center justify-content-center rounded-3 flex-shrink-0"
            style={{ width: 48, height: 48, backgroundColor: `${color}1A` }}
            aria-hidden="true"
          >
            <span style={{ color, fontSize: 24 }}>{icon}</span>
          </div>
        )}
        <div>
          <p className="text-muted small mb-0">{title}</p>
          <p className="fs-4 fw-bold mb-0" style={{ color }}>
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}

export default StatsCard;
