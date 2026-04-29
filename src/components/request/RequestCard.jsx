import React from 'react';
import { TbCalendar, TbBuilding } from 'react-icons/tb';
import { useAppContext } from '../../context/AppContext';
import Badge from '../common/Badge';
import PriorityIcon from '../common/PriorityIcon';
import { formatDate } from '../../utils/dateUtils';

export default function RequestCard({ request }) {
  const { state } = useAppContext();
  const unit = state.units.find(u => u.unitCode === request.unitCode);

  return (
    <div className="card border-0 shadow-sm mb-2">
      <div className="card-body py-3">
        <div className="d-flex align-items-start justify-content-between gap-2">
          <div className="flex-grow-1 min-width-0">
            <div className="d-flex align-items-center gap-2 mb-1">
              <span className="text-muted small fw-medium">{request.number}</span>
              <PriorityIcon priority={request.priority} />
            </div>
            <p className="mb-1 fw-medium" style={{ fontSize: '0.9rem' }}>{request.title}</p>
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
          <Badge label={request.status} type="status" />
        </div>
      </div>
    </div>
  );
}
