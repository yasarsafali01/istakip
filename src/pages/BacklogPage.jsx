import React, { useState } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { TbLock } from 'react-icons/tb';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../hooks/useAuth';
import { canAccessProject } from '../utils/permissionUtils';
import SprintList from '../components/sprint/SprintList';
import BacklogView from '../components/sprint/BacklogView';
import EmptyState from '../components/common/EmptyState';

const MONTH_NAMES = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

function BacklogPage() {
  const { projectId } = useParams();
  const { state } = useAppContext();
  const { currentUser } = useAuth();
  const [selectedSprintId, setSelectedSprintId] = useState('all');

  const project = state.projects.find(p => p.id === projectId);

  if (!project) {
    return (
      <EmptyState
        title="Proje bulunamadı"
        description="Bu proje mevcut değil veya silinmiş olabilir."
        action={<Link to="/projects" className="btn btn-primary">Projelere Dön</Link>}
      />
    );
  }

  // Access control: redirect if user has no access to this project
  if (!canAccessProject(project, currentUser)) {
    return <Navigate to="/projects" replace />;
  }

  const allSprints = state.sprints
    .filter(s => s.projectId === projectId)
    .sort((a, b) => {
      const aYear = a.year ?? new Date(a.startDate).getFullYear();
      const bYear = b.year ?? new Date(b.startDate).getFullYear();
      const aMonth = a.month ?? new Date(a.startDate).getMonth() + 1;
      const bMonth = b.month ?? new Date(b.startDate).getMonth() + 1;
      if (aYear !== bYear) return bYear - aYear;
      return bMonth - aMonth;
    });

  const selectedSprint = selectedSprintId !== 'all'
    ? allSprints.find(s => s.id === selectedSprintId)
    : null;

  const isReadonly = selectedSprint?.status === 'Completed';

  // Issues for the selected sprint (or all backlog if 'all')
  const sprintIssues = selectedSprint
    ? state.issues.filter(i => i.projectId === projectId && i.sprintId === selectedSprint.id)
    : null;

  return (
    <div>
      <div className="mb-3">
        <h4 className="fw-bold mb-0">{project.name}</h4>
        <p className="text-muted small mb-0">Backlog & Aylık Dönemler</p>
      </div>

      {/* Month filter */}
      {allSprints.length > 0 && (
        <div className="d-flex align-items-center gap-2 mb-4 flex-wrap">
          <label className="form-label mb-0 small fw-semibold">Ay Filtresi:</label>
          <select
            className="form-select form-select-sm"
            style={{ maxWidth: 200 }}
            value={selectedSprintId}
            onChange={e => setSelectedSprintId(e.target.value)}
          >
            <option value="all">Tüm Backlog</option>
            {allSprints.map(sprint => {
              const label = sprint.name ||
                (sprint.month ? `${MONTH_NAMES[sprint.month - 1]} ${sprint.year}` : sprint.id);
              return (
                <option key={sprint.id} value={sprint.id}>
                  {label}
                  {sprint.status === 'Active' ? ' ✓' : sprint.status === 'Completed' ? ' 🔒' : ''}
                </option>
              );
            })}
          </select>
          {isReadonly && (
            <span className="badge d-flex align-items-center gap-1"
              style={{ background: '#DEEBFF', color: '#0747A6', fontSize: '0.75rem', padding: '5px 10px' }}>
              <TbLock size={13} /> Kapalı Ay — Salt Okunur
            </span>
          )}
        </div>
      )}

      <div className="row g-4">
        {/* Sprint management */}
        <div className="col-12 col-lg-5">
          <SprintList projectId={projectId} />
        </div>

        {/* Backlog / sprint issues */}
        <div className="col-12 col-lg-7">
          {selectedSprint ? (
            // Show issues of selected sprint
            <div>
              <h6 className="fw-semibold mb-3 d-flex align-items-center gap-2">
                {isReadonly && <TbLock size={15} className="text-muted" />}
                {selectedSprint.name} — İşler
                <span className="text-muted fw-normal small">({sprintIssues.length})</span>
              </h6>
              {sprintIssues.length === 0 ? (
                <p className="text-muted small">Bu ayda issue yok.</p>
              ) : (
                <ul className="list-unstyled mb-0">
                  {sprintIssues.map(issue => {
                    const assignee = state.users.find(u => u.id === issue.assigneeId);
                    return (
                      <li key={issue.id} className="card border-0 shadow-sm mb-2"
                        style={{ opacity: isReadonly ? 0.85 : 1 }}>
                        <div className="card-body py-2 px-3 d-flex align-items-center gap-3 flex-wrap">
                          <span className="text-muted small">{issue.number}</span>
                          <span className="small fw-semibold flex-grow-1">{issue.title}</span>
                          <span className={`badge bg-${
                            issue.status === 'Done' ? 'success' :
                            issue.status === 'In Progress' ? 'primary' :
                            issue.status === 'In Review' ? 'warning' : 'secondary'
                          }`} style={{ fontSize: '0.65rem' }}>
                            {issue.status}
                          </span>
                          {assignee && (
                            <span className="text-muted small">{assignee.name}</span>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ) : (
            <BacklogView projectId={projectId} />
          )}
        </div>
      </div>
    </div>
  );
}

export default BacklogPage;
