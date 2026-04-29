import React from 'react';
import { useNavigate } from 'react-router-dom';
import { TbLayoutKanban, TbList, TbCalendar } from 'react-icons/tb';
import { useAppContext } from '../../context/AppContext';
import { formatDate } from '../../utils/dateUtils';

/**
 * Summary card for a single project.
 *
 * @param {Object} props
 * @param {Object} props.project - Project object from the store
 */
function ProjectCard({ project }) {
  const { state } = useAppContext();
  const navigate = useNavigate();

  const projectIssues = state.issues.filter((i) => i.projectId === project.id);
  const openCount = projectIssues.filter((i) => i.status !== 'Done').length;
  const activeSprint = state.sprints.find(
    (s) => s.projectId === project.id && s.status === 'Active'
  );

  return (
    <div
      className="card border-0 shadow-sm h-100 project-card"
      style={{ cursor: 'pointer' }}
      onClick={() => navigate(`/projects/${project.id}/board`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          navigate(`/projects/${project.id}/board`);
        }
      }}
      aria-label={`${project.name} projesine git`}
    >
      <div className="card-body">
        {/* Header */}
        <div className="d-flex align-items-start justify-content-between mb-2">
          <div>
            <span
              className="badge me-2"
              style={{ backgroundColor: '#0052CC', color: '#fff', fontSize: '0.7rem' }}
            >
              {project.key}
            </span>
            <h6 className="d-inline fw-semibold">{project.name}</h6>
          </div>
        </div>

        {/* Description */}
        {project.description && (
          <p
            className="text-muted small mb-3"
            style={{
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {project.description}
          </p>
        )}

        {/* Stats */}
        <div className="d-flex gap-3 mb-3">
          <span className="text-muted small">
            <strong className="text-dark">{openCount}</strong> açık issue
          </span>
          {activeSprint && (
            <span className="text-muted small">
              <span
                className="badge"
                style={{ backgroundColor: '#E3FCEF', color: '#006644', fontSize: '0.65rem' }}
              >
                Aktif Sprint
              </span>
            </span>
          )}
        </div>

        {/* Footer */}
        <div className="d-flex gap-2 mt-auto">
          <button
            className="btn btn-sm btn-outline-primary d-flex align-items-center gap-1"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/projects/${project.id}/board`);
            }}
            aria-label={`${project.name} board`}
          >
            <TbLayoutKanban size={14} aria-hidden="true" />
            Board
          </button>
          <button
            className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/projects/${project.id}/backlog`);
            }}
            aria-label={`${project.name} backlog`}
          >
            <TbList size={14} aria-hidden="true" />
            Backlog
          </button>
        </div>

        {/* Created date */}
        <p className="text-muted mt-2 mb-0 d-flex align-items-center gap-1" style={{ fontSize: '0.7rem' }}>
          <TbCalendar size={12} aria-hidden="true" />
          {formatDate(project.createdAt)}
        </p>
      </div>
    </div>
  );
}

export default ProjectCard;
