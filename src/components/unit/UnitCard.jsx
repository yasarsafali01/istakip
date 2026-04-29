import React from 'react';
import { TbBuilding, TbFolder, TbUser, TbChevronRight } from 'react-icons/tb';
import { useAppContext } from '../../context/AppContext';

export default function UnitCard({ unit, onEdit, onClick }) {
  const { state } = useAppContext();
  const head = unit.departmentHeadId ? state.users.find(u => u.id === unit.departmentHeadId) : null;
  const projectCount = state.projects.filter(p => p.unitId === unit.id).length;

  return (
    <div
      className="card border-0 shadow-sm h-100"
      style={{ cursor: onClick ? 'pointer' : 'default', transition: 'box-shadow 0.15s' }}
      onClick={onClick ? () => onClick(unit) : undefined}
      onMouseEnter={e => { if (onClick) e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,82,204,0.12)'; }}
      onMouseLeave={e => { if (onClick) e.currentTarget.style.boxShadow = ''; }}
    >
      <div className="card-body">
        <div className="d-flex align-items-start justify-content-between mb-2">
          <div className="d-flex align-items-center gap-2">
            <div className="d-flex align-items-center justify-content-center rounded-2"
              style={{ width: 36, height: 36, background: '#0052CC1A', flexShrink: 0 }}>
              <TbBuilding size={18} color="#0052CC" />
            </div>
            <div>
              <h6 className="mb-0 fw-semibold">{unit.name}</h6>
              <span className="badge bg-primary bg-opacity-10 text-primary" style={{ fontSize: '0.7rem' }}>
                {unit.unitCode}
              </span>
            </div>
          </div>
          <div className="d-flex align-items-center gap-1">
            {onEdit && (
              <button
                className="btn btn-sm btn-outline-secondary"
                onClick={e => { e.stopPropagation(); onEdit(unit); }}
              >
                Düzenle
              </button>
            )}
            {onClick && <TbChevronRight size={18} className="text-muted" />}
          </div>
        </div>
        <div className="d-flex gap-3 mt-3">
          <span className="d-flex align-items-center gap-1 text-muted small">
            <TbUser size={14} />
            {head ? head.name : 'Atanmamış'}
          </span>
          <span className="d-flex align-items-center gap-1 text-muted small">
            <TbFolder size={14} />
            {projectCount} proje
          </span>
        </div>
      </div>
    </div>
  );
}
