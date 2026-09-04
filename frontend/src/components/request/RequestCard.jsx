import React from 'react';
import { TbCalendar, TbBuilding } from 'react-icons/tb';
import { useAppContext } from '../../context/AppContext';
import Badge from '../common/Badge';
import PriorityIcon from '../common/PriorityIcon';
import { formatDate } from '../../utils/dateUtils';
import { highlightText } from '../../utils/highlightUtils';
import { STATUS_COLORS } from '../../constants';

/**
 * Modernized request card with:
 * - Left-side status colour bar
 * - Request number as a styled badge
 * - Title highlight for search matches
 * - Hover lift effect (via .request-card CSS class)
 *
 * @param {Object} props
 * @param {Object} props.request     - The request (issue) object
 * @param {string} [props.searchQuery] - Active search query for highlight (default: '')
 */
export default function RequestCard({ request, searchQuery = '' }) {
  const { state } = useAppContext();
  const unit = state.units.find(u => u.unitCode === request.unitCode);

  const statusColor = STATUS_COLORS[request.status] || '#DFE1E6';

  return (
    <div
      className="card border-0 shadow-sm mb-2 request-card"
      style={{ borderLeft: `4px solid ${statusColor} !important`, overflow: 'hidden' }}
    >
      {/* Status colour bar — left edge */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 4,
          backgroundColor: statusColor,
          borderRadius: '4px 0 0 4px',
        }}
      />

      <div className="card-body py-3" style={{ paddingLeft: '1.25rem' }}>
        <div className="d-flex align-items-start justify-content-between gap-2">
          <div className="flex-grow-1 min-width-0">
            {/* Top row: number badge + priority icon */}
            <div className="d-flex align-items-center gap-2 mb-1">
              <span
                className="badge rounded-pill fw-semibold"
                style={{
                  backgroundColor: '#EAF0FB',
                  color: '#0052CC',
                  fontSize: '0.7rem',
                  letterSpacing: '0.02em',
                  padding: '2px 8px',
                }}
              >
                {request.number}
              </span>
              <PriorityIcon priority={request.priority} />
            </div>

            {/* Title with optional highlight */}
            <p className="mb-1 fw-medium" style={{ fontSize: '0.9rem' }}>
              {highlightText(request.title, searchQuery)}
            </p>

            {/* Meta row: unit + date */}
            <div className="d-flex align-items-center gap-3 flex-wrap">
              {unit && (
                <span className="d-flex align-items-center gap-1 text-muted small">
                  <TbBuilding size={13} />
                  {unit.name}
                </span>
              )}
              <span className="d-flex align-items-center gap-1 text-muted small">
                <TbCalendar size={13} />
                {formatDate(request.createdAt)}
              </span>
            </div>
          </div>

          {/* Status badge + rejection/resolution note */}
          <div className="d-flex flex-column align-items-end gap-1" style={{ flexShrink: 0 }}>
            <Badge label={request.status} type="status" />
            {request.status === 'Geri Çevrildi' && request.rejectionReason && (
              <div
                style={{
                  color: '#7B1A0A',
                  fontStyle: 'italic',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  maxWidth: 220,
                  textAlign: 'right',
                }}
              >
                🚫 {request.rejectionReason}
              </div>
            )}
            {request.status === 'Done' && request.resolutionNote && (
              <div
                style={{
                  color: '#1B5E20',
                  fontStyle: 'italic',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  maxWidth: 220,
                  textAlign: 'right',
                }}
              >
                ✅ {request.resolutionNote}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
