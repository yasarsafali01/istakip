import React, { useState } from 'react';
import { TbX } from 'react-icons/tb';
import { useAppContext } from '../../context/AppContext';
import { useAuth } from '../../hooks/useAuth';
import { PRIORITIES, PRIORITY_LABELS, ROLES } from '../../constants';
import Avatar from '../common/Avatar';
import { inProject } from '../../utils/permissionUtils';

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
  const projectMembers = state.users.filter((u) => u.isActive !== false).filter((u) => {
    if (u.role === ROLES.EXTERNAL_USER) return false;
    if (u.role === ROLES.WORKER) return inProject(u, projectId);
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
                outline: assigneeFilter === user.id ? `2px solid #2563eb` : 'none',
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
          type="button"
          className={`ds-filter ${priorityFilter ? 'ds-filter--on' : ''}`}
          onClick={() => setPriorityOpen(v => !v)}
        >
          <span>⚑</span>
          <span>{priorityFilter ? PRIORITY_LABELS[priorityFilter] : 'Öncelik'}</span>
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
            <div className="ds-menu" style={{ left: 0, right: 'auto', minWidth: 160 }}>
              <button type="button" className={!priorityFilter ? 'on' : ''}
                onClick={() => { setPriorityFilter(null); setPriorityOpen(false); }}>
                Tüm Öncelikler
              </button>
              {PRIORITIES.map((p) => (
                <button key={p} type="button" className={priorityFilter === p ? 'on' : ''}
                  onClick={() => { setPriorityFilter(p); setPriorityOpen(false); }}>
                  {PRIORITY_LABELS[p]}
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
