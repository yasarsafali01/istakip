import React, { useState } from 'react';
import { TbPlus } from 'react-icons/tb';
import { useAppContext } from '../../context/AppContext';
import { useAuth } from '../../hooks/useAuth';
import { usePermissions } from '../../hooks/usePermissions';
import { getVisibleProjects } from '../../utils/permissionUtils';
import { ROLES } from '../../constants';
import ProjectCard from './ProjectCard';
import ProjectForm from './ProjectForm';
import Modal from '../common/Modal';
import EmptyState from '../common/EmptyState';

/**
 * Renders the list of projects visible to the current user,
 * with role-based filtering and a conditional create button.
 */
function ProjectList() {
  const { state } = useAppContext();
  const { currentUser } = useAuth();
  const { canCreateProject, role } = usePermissions();
  const [showModal, setShowModal] = useState(false);

  const visibleProjects = getVisibleProjects(state.projects, currentUser);

  // For System_Admin show unit name as group label
  const showUnitLabel = role === ROLES.SYSTEM_ADMIN;

  function handleSuccess() {
    setShowModal(false);
  }

  return (
    <div>
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h4 className="fw-bold mb-0">Projeler</h4>
        {canCreateProject && (
          <button
            className="btn btn-primary d-flex align-items-center gap-1"
            onClick={() => setShowModal(true)}
          >
            <TbPlus size={18} aria-hidden="true" />
            Proje Oluştur
          </button>
        )}
      </div>

      {/* Project grid */}
      {visibleProjects.length === 0 ? (
        <EmptyState
          title="Henüz proje yok"
          description="İlk projenizi oluşturarak başlayın."
          action={
            canCreateProject ? (
              <button className="btn btn-primary" onClick={() => setShowModal(true)}>
                Proje Oluştur
              </button>
            ) : null
          }
        />
      ) : showUnitLabel ? (
        // System_Admin: group by unit
        state.units.map(unit => {
          const unitProjects = visibleProjects.filter(p => p.unitId === unit.id);
          if (unitProjects.length === 0) return null;
          return (
            <div key={unit.id} className="mb-4">
              <div className="d-flex align-items-center gap-2 mb-2">
                <span className="fw-semibold text-muted small text-uppercase" style={{ letterSpacing: '0.06em' }}>
                  {unit.name}
                </span>
                <span className="badge bg-primary bg-opacity-10 text-primary" style={{ fontSize: '0.65rem' }}>
                  {unit.unitCode}
                </span>
              </div>
              <div className="row g-3">
                {unitProjects.map(project => (
                  <div key={project.id} className="col-12 col-md-6 col-xl-4">
                    <ProjectCard project={project} />
                  </div>
                ))}
              </div>
            </div>
          );
        })
      ) : (
        <div className="row g-3">
          {visibleProjects.map(project => (
            <div key={project.id} className="col-12 col-md-6 col-xl-4">
              <ProjectCard project={project} />
            </div>
          ))}
        </div>
      )}

      {/* Create project modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Yeni Proje Oluştur"
        size="lg"
      >
        <ProjectForm onSuccess={handleSuccess} onCancel={() => setShowModal(false)} />
      </Modal>
    </div>
  );
}

export default ProjectList;
