import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TbLayoutKanban, TbList, TbCalendar, TbEdit } from 'react-icons/tb';
import { useAppContext } from '../../context/AppContext';
import { useAuth } from '../../hooks/useAuth';
import { usePermissions } from '../../hooks/usePermissions';
import { ROLES } from '../../constants';
import { formatDate } from '../../utils/dateUtils';
import Modal from '../common/Modal';
import ProjectForm from './ProjectForm';

/**
 * Summary card for a single project.
 *
 * @param {Object} props
 * @param {Object} props.project - Project object from the store
 */
function ProjectCard({ project }) {
  const { state } = useAppContext();
  const { currentUser } = useAuth();
  const { role } = usePermissions();
  const navigate = useNavigate();
  const [showEditModal, setShowEditModal] = useState(false);

  const projectIssues = state.issues.filter((i) => i.projectId === project.id);
  const openCount = projectIssues.filter((i) => i.status !== 'Done').length;
  const activeSprint = state.sprints.find(
    (s) => s.projectId === project.id && s.status === 'Active'
  );

  // Department_Head kendi birimine ait projeleri düzenleyebilir
  const canEdit = role === ROLES.DEPARTMENT_HEAD && project.unitId === currentUser?.unitId;

  return (
    <>
      <div
        className="card border-0 shadow-sm h-100 project-card"
        style={{ cursor: 'pointer' }}
        onClick={() => navigate(`/projects/${project.id}?tab=board`)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            navigate(`/projects/${project.id}?tab=board`);
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
            {canEdit && (
              <button
                className="btn btn-sm btn-link p-0 text-muted"
                title="Projeyi düzenle"
                onClick={(e) => { e.stopPropagation(); setShowEditModal(true); }}
                aria-label={`${project.name} projesini düzenle`}
              >
                <TbEdit size={16} />
              </button>
            )}
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
                navigate(`/projects/${project.id}?tab=board`);
              }}
              aria-label={`${project.name} board`}
            >
              <TbLayoutKanban size={14} aria-hidden="true" />
              Aktif İşler
            </button>
            <button
              className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/projects/${project.id}?tab=backlog`);
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

      {/* Edit modal */}
      {canEdit && (
        <Modal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          title="Projeyi Düzenle"
          size="lg"
        >
          <ProjectForm
            project={project}
            onSuccess={() => setShowEditModal(false)}
            onCancel={() => setShowEditModal(false)}
          />
        </Modal>
      )}
    </>
  );
}

export default ProjectCard;
