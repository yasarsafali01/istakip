import React from 'react';
import { TbClock } from 'react-icons/tb';
import { getSlaInfo, SLA_RISK_COLORS } from '../../utils/slaUtils';

/** Small pill showing a request's remaining/overdue SLA time. Renders nothing for non-requests. */
function SlaBadge({ request, size = 'sm' }) {
  const sla = getSlaInfo(request);
  if (!sla) return null;
  const colors = SLA_RISK_COLORS[sla.risk];

  return (
    <span
      className="d-inline-flex align-items-center gap-1"
      style={{
        backgroundColor: colors.bg,
        color: colors.text,
        fontSize: size === 'sm' ? '0.68rem' : '0.8rem',
        fontWeight: 600,
        padding: '3px 8px',
        borderRadius: 10,
        whiteSpace: 'nowrap',
      }}
      title={`Beklenen çözüm: ${sla.dueAt.toLocaleString('tr-TR')}`}
    >
      <TbClock size={size === 'sm' ? 11 : 13} />
      {sla.label}
    </span>
  );
}

export default SlaBadge;
