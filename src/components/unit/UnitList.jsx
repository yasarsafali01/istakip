import React, { useState } from 'react';
import { TbPlus, TbArrowLeft, TbLayoutKanban, TbList } from 'react-icons/tb';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';
import { useAuth } from '../../hooks/useAuth';
import { usePermissions } from '../../hooks/usePermissions';
import { getVisibleProjects } from '../../utils/permissionUtils';
import { ROLES } from '../../constants';
import UnitCard from './UnitCard';
import UnitForm from './UnitForm';
import ProjectForm from '../project/ProjectForm';
import Modal from '../common/Modal';
import EmptyState from '../common/EmptyState';

export default function UnitList() {
  const { state } = useAppContext();
  const { currentUser } = useAuth();
  const { canManageUnits, canCreateProject } = usePermissions();
  const navigate = useNavigate();

  const [showUnitModal, setShowUnitModal] = useState(false);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [editingUnit, setEditingUnit] = useState(null);
  const [selectedUnit, setSelectedUnit] = useState(null); // drill-down

  // Which units to show
  const visibleUnits = (() => {
    if (!currentUser) return [];
    if (currentUser.role === ROLES.SYSTEM_ADMIN) return state.units;
    // Department_Head and Project_Manager see only their own unit
    if (currentUser.unitId) {
      return state.units.filter(u => u.id === currentUser.unitId);
    }
    return [];
  })();

  // Projects for the selected unit (drill-down)
  const unitProjects = selectedUnit
    ? getVisibleProjects(state.projects, currentUser).filter(p => p.unitId === selectedUnit.id)
    : [];

  function handleUnitClick(unit) {
    setSelectedUnit(unit);
  }

  function handleEdit(unit) {
    setEditingUnit(unit);
    setShowUnitModal(true);
  }

  function handleCloseUnitModal() {
    setShowUnitModal(false);
    setEditingUnit(null);
  }

  // ── Drill-down: projects of selected unit ──────────────────────────────────
  if (selectedUnit) {
    return (
      <div>
        {/* Breadcrumb */}
        <div className="d-flex align-items-center gap-2 mb-4">
          <button
            className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1"
            onClick={() => setSelectedUnit(null)}
          >
            <TbArrowLeft size={15} />
            Birimler
          </button>
          <span className="text-muted">/</span>
          <span className="fw-semibold">{selectedUnit.name}</span>
          <span className="badge bg-primary bg-opacity-10 text-primary ms-1" style={{ fontSize: '0.7rem' }}>
            {selectedUnit.unitCode}
          </span>
        </div>

        <div className="d-flex justify-content-between align-items-center mb-3">
          <h5 className="fw-bold mb-0">Projeler</h5>
          {canCreateProject && (
            <button
              className="btn btn-primary btn-sm d-flex align-items-center gap-1"
              onClick={() => setShowProjectModal(true)}
            >
              <TbPlus size={16} />
              Yeni Proje
            </button>
          )}
        </div>

        {unitProjects.length === 0 ? (
          <EmptyState
            title="Bu birimde henüz proje yok"
            description="Yeni bir proje oluşturabilirsiniz."
            action={canCreateProject ? (
              <button className="btn btn-primary btn-sm" onClick={() => setShowProjectModal(true)}>
                Proje Oluştur
              </button>
            ) : null}
          />
        ) : (
          <div className="row g-3">
            {unitProjects.map(project => {
              const openCount = state.issues.filter(i => i.projectId === project.id && i.status !== 'Done').length;
              const activeSprint = state.sprints.find(s => s.projectId === project.id && s.status === 'Active');
              return (
                <div key={project.id} className="col-12 col-md-6 col-lg-4">
                  <div className="card border-0 shadow-sm h-100">
                    <div className="card-body">
                      <h6 className="fw-semibold mb-1">{project.name}</h6>
                      {project.description && (
                        <p className="text-muted small mb-2" style={{
                          display: '-webkit-box', WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical', overflow: 'hidden'
                        }}>
                          {project.description}
                        </p>
                      )}
                      <div className="d-flex gap-2 mb-2 text-muted small">
                        <span><strong className="text-dark">{openCount}</strong> açık issue</span>
                        {activeSprint && (
                          <span className="badge" style={{ backgroundColor: '#E3FCEF', color: '#006644', fontSize: '0.65rem' }}>
                            Aktif Sprint
                          </span>
                        )}
                      </div>
                      <div className="d-flex gap-2 mt-2">
                        <button
                          className="btn btn-sm btn-outline-primary d-flex align-items-center gap-1"
                          onClick={() => navigate(`/projects/${project.id}/board`)}
                        >
                          <TbLayoutKanban size={13} /> Board
                        </button>
                        <button
                          className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1"
                          onClick={() => navigate(`/projects/${project.id}/backlog`)}
                        >
                          <TbList size={13} /> Backlog
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <Modal isOpen={showProjectModal} title="Yeni Proje Oluştur" onClose={() => setShowProjectModal(false)} size="lg">
          <ProjectForm
            defaultUnitId={selectedUnit.id}
            onSuccess={() => setShowProjectModal(false)}
            onCancel={() => setShowProjectModal(false)}
          />
        </Modal>
      </div>
    );
  }

  // ── Unit list ──────────────────────────────────────────────────────────────
  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h4 className="fw-bold mb-0">Birimler</h4>
        {canManageUnits && (
          <button className="btn btn-primary d-flex align-items-center gap-1" onClick={() => setShowUnitModal(true)}>
            <TbPlus size={18} />
            Yeni Birim
          </button>
        )}
      </div>

      {visibleUnits.length === 0 ? (
        <EmptyState
          title="Henüz birim yok"
          description="Sistem yöneticisi birim oluşturabilir."
          action={canManageUnits ? (
            <button className="btn btn-primary btn-sm" onClick={() => setShowUnitModal(true)}>
              Birim Oluştur
            </button>
          ) : null}
        />
      ) : (
        <div className="row g-3">
          {visibleUnits.map(unit => (
            <div key={unit.id} className="col-12 col-md-6 col-lg-4">
              <UnitCard
                unit={unit}
                onEdit={canManageUnits ? handleEdit : null}
                onClick={handleUnitClick}
              />
            </div>
          ))}
        </div>
      )}

      <Modal
        isOpen={showUnitModal}
        title={editingUnit ? 'Birimi Düzenle' : 'Yeni Birim Oluştur'}
        onClose={handleCloseUnitModal}
      >
        <UnitForm onClose={handleCloseUnitModal} existingUnit={editingUnit} />
      </Modal>
    </div>
  );
}
