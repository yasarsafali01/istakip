import React, { useState } from 'react';
import { TbX } from 'react-icons/tb';
import { useAppContext } from '../../context/AppContext';
import { useAuth } from '../../hooks/useAuth';
import { PRIORITIES, ROLES } from '../../constants';
import Avatar from '../common/Avatar';

function BoardFilters({
  projectId,
  assigneeFilter,
  priorityFilter,
  setAssigneeFilter,
  setPriorityFilter,
  clearFilters,
}) {
  const { state } = useAppContext();
  const { currentUser } = useAuth();
  const [priorityOpen, setPriorityOpen] = useState(false);
  const hasActiveFilter = assigneeFilter || priorityFilter;
  const isWorker = currentUser?.role === ROLES.WORKER;

  const project = state.projects.find((p) => p.id === projectId);
  const projectMembers = state.users.filter((u) => {
    if (u.role === ROLES.EXTERNAL_USER) return false;
    if (u.role === ROLES.WORKER) return u.projectId === projectId;
    if (u.role === ROLES.PROJECT_MANAGER) return project?.managerId === u.id;
    if (u.role === ROLES.DEPARTMENT_HEAD) return u.unitId === project?.unitId;
    if (u.role === ROLES.SYSTEM_ADMIN) return true;
    return false;
  });

  return (
    <div className="d-flex align-items-center gap-2 flex-wrap">
      {/* Avatar filtresi — Worker için gösterme */}
      {!isWorker && (
        <div className="d-flex align-items-center gap-1" role="group" aria-label="Atanan kişiye göre filtrele">
          {projectMembers.map((user) => (
            <button
              key={user.id}
              className="btn p-0 border-0"
              style={{
                outline: assigneeFilter === user.id ? `2px solid #0052CC` : 'none',
                outlineOffset: 2,
                borderRadius: '50%',
                opacity: assigneeFilter && assigneeFilter !== user.id ? 0.4 : 1,
                transition: 'opacity 0.15s',
              }}
              onClick={() => setAssigneeFilter(assigneeFilter === user.id ? null : user.id)}
              title={user.name}
              aria-pressed={assigneeFilter === user.id}
              aria-label={user.name}
            >
              <Avatar name={user.name} color={user.avatarColor} size={28} />
            </button>
          ))}
        </div>
      )}

      {/* Öncelik — modern pill dropdown */}
      <div className="position-relative">
        <button
          className="btn btn-sm d-flex align-items-center gap-1"
          style={{
            border: priorityFilter ? '1.5px solid #0052CC' : '1.5px solid #DFE1E6',
            borderRadius: 20,
            padding: '4px 12px',
            fontSize: '0.82rem',
            fontWeight: priorityFilter ? 600 : 400,
            background: priorityFilter ? '#EAF2FF' : '#fff',
            color: priorityFilter ? '#0052CC' : '#42526E',
            whiteSpace: 'nowrap',
          }}
          onClick={() => setPriorityOpen(v => !v)}
        >
          <span>⚑</span>
          <span>{priorityFilter || 'Öncelik'}</span>
          {priorityFilter ? (
            <span
              role="button"
              style={{ marginLeft: 4, fontWeight: 700, fontSize: '0.9rem', lineHeight: 1 }}
              onClick={(e) => { e.stopPropagation(); setPriorityFilter(null); setPriorityOpen(false); }}
            >×</span>
          ) : (
            <span style={{ fontSize: '0.65rem', marginLeft: 2 }}>▾</span>
          )}
        </button>
        {priorityOpen && (
          <>
            <div className="position-fixed top-0 start-0 w-100 h-100" style={{ zIndex: 1040 }} onClick={() => setPriorityOpen(false)} />
            <div className="position-absolute bg-white rounded shadow p-2" style={{ zIndex: 1050, top: '110%', left: 0, minWidth: 150, border: '1px solid #DFE1E6' }}>
              <button className={`btn btn-sm w-100 text-start mb-1 ${!priorityFilter ? 'btn-primary' : 'btn-light'}`} style={{ fontSize: '0.82rem' }}
                onClick={() => { setPriorityFilter(null); setPriorityOpen(false); }}>
                Tüm Öncelikler
              </button>
              {PRIORITIES.map((p) => (
                <button key={p} className={`btn btn-sm w-100 text-start mb-1 ${priorityFilter === p ? 'btn-primary' : 'btn-light'}`} style={{ fontSize: '0.82rem' }}
                  onClick={() => { setPriorityFilter(p); setPriorityOpen(false); }}>
                  {p}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Temizle */}
      {hasActiveFilter && (
        <button
          className="btn btn-sm btn-link text-danger p-0 text-decoration-none"
          style={{ fontSize: '0.8rem' }}
          onClick={clearFilters}
        >
          <TbX size={13} /> Temizle
        </button>
      )}
    </div>
  );
}

export default BoardFilters;
