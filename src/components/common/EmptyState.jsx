import React from 'react';
import { TbInbox } from 'react-icons/tb';

/**
 * Displays a centred empty-state illustration with a message and optional action.
 *
 * @param {Object}          props
 * @param {string}          [props.title]       - Primary heading
 * @param {string}          [props.description] - Supporting text
 * @param {React.ReactNode} [props.icon]        - Custom icon element (defaults to inbox icon)
 * @param {React.ReactNode} [props.action]      - Optional action button / link
 * @param {string}          [props.className]   - Additional CSS classes on the wrapper
 */
function EmptyState({
  title = 'Hiçbir şey bulunamadı',
  description = '',
  icon,
  action,
  className = '',
}) {
  return (
    <div
      className={`d-flex flex-column align-items-center justify-content-center text-center py-5 ${className}`}
    >
      <div className="mb-3 text-secondary" aria-hidden="true">
        {icon || <TbInbox size={56} />}
      </div>
      <h6 className="fw-semibold mb-1">{title}</h6>
      {description && (
        <p className="text-muted small mb-3" style={{ maxWidth: 320 }}>
          {description}
        </p>
      )}
      {action && <div>{action}</div>}
    </div>
  );
}

export default EmptyState;
