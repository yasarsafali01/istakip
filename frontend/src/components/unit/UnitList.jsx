import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  TbPlus, TbArrowLeft, TbLayoutKanban, TbList, TbEdit, TbBuilding, TbFolder, TbUser, TbUsers, TbInbox,
  TbChevronRight, TbCalendar,
} from 'react-icons/tb';
import { useAppContext } from '../../context/AppContext';
import { useAuth } from '../../hooks/useAuth';
import { usePermissions } from '../../hooks/usePermissions';
import { getVisibleProjects, inProject } from '../../utils/permissionUtils';
import { summarize } from '../../utils/reportUtils';
import { formatDuration } from '../../utils/durationUtils';
import { ROLES } from '../../constants';
import UnitForm from './UnitForm';
import ProjectForm from '../project/ProjectForm';
import Modal from '../common/Modal';
import { requestMetrics } from '../dashboard/DashboardKit';

const pct = (rate) => (rate === null ? '—' : `%${Math.round(rate * 100)}`);

function MiniStat({ label, value, color }) {
  return (
    <div className="text-center flex-fill">
      <div className="fw-bold" style={{ fontSize: '1.05rem', color: color || 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      <div className="text-muted" style={{ fontSize: '0.7rem' }}>{label}</div>
    </div>
  );
}

function CardShell({ onClick, children }) {
  return (
    <div className={`ds-kpi ${onClick ? 'ds-kpi--link' : ''}`} onClick={onClick} role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined} onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}>
      {children}
    </div>
  );
}

export default function UnitList() {
  const { state } = useAppContext();
  const { currentUser } = useAuth();
  const { canManageUnits, canCreateProject } = usePermissions();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const [showUnitModal, setShowUnitModal] = useState(false);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [editingUnit, setEditingUnit] = useState(null);
  const [editingProject, setEditingProject] = useState(null);

  const visibleUnits = !currentUser ? []
    : currentUser.role === ROLES.SYSTEM_ADMIN ? state.units
      : state.units.filter((u) => u.id === currentUser.unitId);
  // ?unit= opens a daire başkanlığı (the admin home links here); a single unit opens directly.
  const selectedUnit = visibleUnits.find((u) => u.id === params.get('unit')) || (visibleUnits.length === 1 ? visibleUnits[0] : null);
  const selectUnit = (u) => setParams(u ? { unit: u.id } : {});

  const requestsOf = (pids) => state.issues.filter((i) => i.isRequest && pids.has(i.projectId));
  const userName = (id) => state.users.find((u) => u.id === id)?.name;

  if (selectedUnit) {
    const unitProjects = getVisibleProjects(state.projects, currentUser).filter((p) => p.unitId === selectedUnit.id);
    const head = userName(selectedUnit.departmentHeadId);
    return (
      <div>
        <div className="pg-head">
          <div>
            {visibleUnits.length > 1 && (
              <button className="btn btn-sm btn-link px-0 text-decoration-none d-inline-flex align-items-center gap-1 mb-1"
                onClick={() => selectUnit(null)}>
                <TbArrowLeft size={15} /> Daire Başkanlıkları
              </button>
            )}
            <div className="pg-head__title">
              <h4 className="pg-head__name">{selectedUnit.name}</h4>
              <span className="ds-pill" style={{ background: 'var(--navy-soft)', color: 'var(--navy)' }}>{selectedUnit.unitCode}</span>
            </div>
            <div className="pg-head__desc">Daire Başkanı: {head || 'Atanmamış'} · {unitProjects.length} müdürlük</div>
          </div>
          {canCreateProject && (
            <button className="btn btn-primary btn-sm d-flex align-items-center gap-1" onClick={() => setShowProjectModal(true)}>
              <TbPlus size={16} /> Yeni Müdürlük
            </button>
          )}
        </div>

        {unitProjects.length === 0 ? (
          <div className="ds-panel"><div className="ds-panel__empty">Bu daire başkanlığında henüz müdürlük yok.</div></div>
        ) : (
          <div className="row g-3">
            {unitProjects.map((project) => {
              const list = requestsOf(new Set([project.id]));
              const m = requestMetrics(list);
              const sum = summarize(list);
              const activeSprint = state.sprints.find((s) => s.projectId === project.id && s.status === 'Active');
              const staff = state.users.filter((u) => u.isActive !== false && inProject(u, project.id)).length;
              return (
                <div key={project.id} className="col-12 col-md-6 col-xl-4">
                  <CardShell>
                    <div className="d-flex align-items-start justify-content-between gap-2">
                      <div style={{ minWidth: 0 }}>
                        <div className="fw-bold text-truncate" style={{ color: 'var(--ink)' }}>{project.name}</div>
                        <div className="text-muted" style={{ fontSize: '0.74rem' }}>
                          <TbUser size={12} /> {userName(project.managerId) || 'Müdür atanmamış'} · <TbUsers size={12} /> {staff} personel
                        </div>
                      </div>
                      {canCreateProject && (
                        <button className="btn btn-sm btn-link p-0 text-muted" title="Müdürlüğü düzenle" onClick={() => setEditingProject(project)}>
                          <TbEdit size={17} />
                        </button>
                      )}
                    </div>
                    <div className="d-flex my-3">
                      <MiniStat label="Açık" value={m.open.length} />
                      <MiniStat label="Atanmamış" value={m.unassigned.length} color={m.unassigned.length ? 'var(--orange)' : undefined} />
                      <MiniStat label="Süresi aşan" value={m.breached.length} color={m.breached.length ? 'var(--danger)' : undefined} />
                      <MiniStat label="Bu ay çözülen" value={m.resolvedThisMonth.length} />
                    </div>
                    <div className="d-flex align-items-center gap-2 mb-1">
                      <div className="ds-meter flex-grow-1"><span style={{ width: `${Math.round((sum.completionRate ?? 0) * 100)}%`, background: 'var(--ok)' }} /></div>
                      <span className="fw-semibold" style={{ fontSize: '0.76rem' }}>{pct(sum.completionRate)}</span>
                    </div>
                    <div className="text-muted mb-3" style={{ fontSize: '0.72rem' }}>
                      Ort. çözüm: {formatDuration(sum.avgResolution)}
                      {activeSprint && <> · <TbCalendar size={12} /> {activeSprint.name}</>}
                    </div>
                    <div className="d-flex gap-2">
                      <button className="btn btn-sm btn-outline-primary d-flex align-items-center gap-1" onClick={() => navigate(`/projects/${project.id}?tab=board`)}>
                        <TbLayoutKanban size={14} /> Aktif Talepler
                      </button>
                      <button className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1" onClick={() => navigate(`/projects/${project.id}?tab=backlog`)}>
                        <TbList size={14} /> Bekleyen Talepler
                      </button>
                    </div>
                  </CardShell>
                </div>
              );
            })}
          </div>
        )}

        <Modal isOpen={showProjectModal} title="Yeni Müdürlük Oluştur" onClose={() => setShowProjectModal(false)} size="lg">
          <ProjectForm defaultUnitId={selectedUnit.id} onSuccess={() => setShowProjectModal(false)} onCancel={() => setShowProjectModal(false)} />
        </Modal>
        <Modal isOpen={!!editingProject} title="Müdürlüğü Düzenle" onClose={() => setEditingProject(null)} size="lg">
          {editingProject && (
            <ProjectForm project={editingProject} onSuccess={() => setEditingProject(null)} onCancel={() => setEditingProject(null)} />
          )}
        </Modal>
      </div>
    );
  }

  function closeUnitModal() {
    setShowUnitModal(false);
    setEditingUnit(null);
  }

  return (
    <div>
      <div className="pg-head">
        <div>
          <h4 className="pg-head__name">Daire Başkanlıkları</h4>
          <div className="pg-head__desc">{visibleUnits.length} daire başkanlığı · karta tıklayınca müdürlükleri açılır</div>
        </div>
        {canManageUnits && (
          <button className="btn btn-primary btn-sm d-flex align-items-center gap-1" onClick={() => setShowUnitModal(true)}>
            <TbPlus size={16} /> Yeni Daire Başkanlığı
          </button>
        )}
      </div>

      {visibleUnits.length === 0 ? (
        <div className="ds-panel"><div className="ds-panel__empty">Henüz daire başkanlığı yok.</div></div>
      ) : (
        <div className="row g-3">
          {visibleUnits.map((unit) => {
            const pids = new Set(state.projects.filter((p) => p.unitId === unit.id).map((p) => p.id));
            const m = requestMetrics(requestsOf(pids));
            const staff = state.users.filter((u) => u.isActive !== false && u.unitId === unit.id && u.role !== ROLES.EXTERNAL_USER).length;
            return (
              <div key={unit.id} className="col-12 col-md-6 col-xl-4">
                <CardShell onClick={() => selectUnit(unit)}>
                  <div className="d-flex align-items-start gap-2">
                    <span className="ds-kpi__icon" style={{ background: 'var(--navy-soft)', color: 'var(--navy)' }}><TbBuilding size={17} /></span>
                    <div className="flex-grow-1" style={{ minWidth: 0 }}>
                      <div className="fw-bold" style={{ color: 'var(--ink)' }}>{unit.name}</div>
                      <div className="text-muted" style={{ fontSize: '0.74rem' }}>
                        {unit.unitCode} · Daire Başkanı: {userName(unit.departmentHeadId) || 'Atanmamış'}
                      </div>
                    </div>
                    {canManageUnits && (
                      <button className="btn btn-sm btn-link p-0 text-muted" title="Düzenle"
                        onClick={(e) => { e.stopPropagation(); setEditingUnit(unit); setShowUnitModal(true); }}>
                        <TbEdit size={17} />
                      </button>
                    )}
                    <TbChevronRight size={18} className="text-muted" />
                  </div>
                  <div className="d-flex mt-3">
                    <MiniStat label={<><TbFolder size={11} /> Müdürlük</>} value={pids.size} />
                    <MiniStat label={<><TbUsers size={11} /> Personel</>} value={staff} />
                    <MiniStat label={<><TbInbox size={11} /> Açık talep</>} value={m.open.length} />
                    <MiniStat label="Süresi aşan" value={m.breached.length} color={m.breached.length ? 'var(--danger)' : undefined} />
                  </div>
                </CardShell>
              </div>
            );
          })}
        </div>
      )}

      <Modal isOpen={showUnitModal} title={editingUnit ? 'Daire Başkanlığını Düzenle' : 'Yeni Daire Başkanlığı Oluştur'} onClose={closeUnitModal}>
        <UnitForm onClose={closeUnitModal} existingUnit={editingUnit} />
      </Modal>
    </div>
  );
}
