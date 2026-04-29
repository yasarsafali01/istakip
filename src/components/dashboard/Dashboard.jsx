import React from 'react';
import {
  TbFolder, TbAlertCircle, TbPlayerPlay, TbChartBar, TbBuilding, TbTicket,
} from 'react-icons/tb';
import { useAppContext } from '../../context/AppContext';
import { useAuth } from '../../hooks/useAuth';
import { usePermissions } from '../../hooks/usePermissions';
import StatsCard from './StatsCard';
import ProjectProgress from './ProjectProgress';
import RecentActivity from './RecentActivity';
import { PRIORITY_COLORS, ROLES } from '../../constants';
import { getVisibleProjects, getVisibleRequests } from '../../utils/permissionUtils';

// ─── System Admin Dashboard ──────────────────────────────────────────────────
function AdminDashboard({ state }) {
  const totalProjects = state.projects.length;
  const openIssues = state.issues.filter(i => i.status !== 'Done').length;
  const activeSprints = state.sprints.filter(s => s.status === 'Active').length;
  const totalUnits = state.units.length;

  return (
    <div>
      <h4 className="fw-bold mb-4">Sistem Yönetim Paneli</h4>
      <div className="row g-3 mb-4">
        <div className="col-6 col-lg-3">
          <StatsCard title="Toplam Birim" value={totalUnits} icon={<TbBuilding />} color="#6554C0" />
        </div>
        <div className="col-6 col-lg-3">
          <StatsCard title="Toplam Proje" value={totalProjects} icon={<TbFolder />} color="#0052CC" />
        </div>
        <div className="col-6 col-lg-3">
          <StatsCard title="Açık Issue" value={openIssues} icon={<TbAlertCircle />} color="#FF5630" />
        </div>
        <div className="col-6 col-lg-3">
          <StatsCard title="Aktif Sprint" value={activeSprints} icon={<TbPlayerPlay />} color="#00875A" />
        </div>
      </div>
      <div className="row g-3 mb-4">
        <div className="col-12 col-lg-6"><ProjectProgress /></div>
        <div className="col-12 col-lg-6"><PriorityBreakdown issues={state.issues} /></div>
      </div>
      <div className="row g-3">
        <div className="col-12"><RecentActivity /></div>
      </div>
    </div>
  );
}

// ─── Department Head Dashboard ───────────────────────────────────────────────
function DepartmentHeadDashboard({ state, currentUser }) {
  const visibleProjects = getVisibleProjects(state.projects, currentUser);
  const visibleProjectIds = visibleProjects.map(p => p.id);
  const unitIssues = state.issues.filter(i => visibleProjectIds.includes(i.projectId));
  const openIssues = unitIssues.filter(i => i.status !== 'Done').length;
  const activeSprints = state.sprints.filter(
    s => s.status === 'Active' && visibleProjectIds.includes(s.projectId)
  ).length;
  const unit = state.units.find(u => u.id === currentUser.unitId);

  return (
    <div>
      <h4 className="fw-bold mb-1">Birim Paneli</h4>
      {unit && <p className="text-muted mb-4">{unit.name}</p>}
      <div className="row g-3 mb-4">
        <div className="col-6 col-lg-4">
          <StatsCard title="Birim Projeleri" value={visibleProjects.length} icon={<TbFolder />} color="#0052CC" />
        </div>
        <div className="col-6 col-lg-4">
          <StatsCard title="Açık Issue" value={openIssues} icon={<TbAlertCircle />} color="#FF5630" />
        </div>
        <div className="col-6 col-lg-4">
          <StatsCard title="Aktif Sprint" value={activeSprints} icon={<TbPlayerPlay />} color="#00875A" />
        </div>
      </div>
      <div className="row g-3 mb-4">
        <div className="col-12 col-lg-6"><ProjectProgress unitId={currentUser.unitId} /></div>
        <div className="col-12 col-lg-6"><PriorityBreakdown issues={unitIssues} /></div>
      </div>
      <div className="row g-3">
        <div className="col-12"><RecentActivity /></div>
      </div>
    </div>
  );
}

// ─── Project Manager Dashboard ───────────────────────────────────────────────
function ProjectManagerDashboard({ state, currentUser }) {
  const myProject = state.projects.find(p => p.managerId === currentUser.id);
  const projectIssues = myProject
    ? state.issues.filter(i => i.projectId === myProject.id)
    : [];
  const openIssues = projectIssues.filter(i => i.status !== 'Done').length;
  const activeSprint = myProject
    ? state.sprints.find(s => s.projectId === myProject.id && s.status === 'Active')
    : null;

  // Assignee workload
  const assigneeMap = {};
  projectIssues.filter(i => i.assigneeId && i.status !== 'Done').forEach(issue => {
    assigneeMap[issue.assigneeId] = (assigneeMap[issue.assigneeId] || 0) + 1;
  });

  return (
    <div>
      <h4 className="fw-bold mb-1">Proje Paneli</h4>
      {myProject && <p className="text-muted mb-4">{myProject.name}</p>}
      {!myProject && <p className="text-muted mb-4">Henüz atanmış proje yok.</p>}
      <div className="row g-3 mb-4">
        <div className="col-6 col-lg-4">
          <StatsCard title="Toplam Issue" value={projectIssues.length} icon={<TbFolder />} color="#0052CC" />
        </div>
        <div className="col-6 col-lg-4">
          <StatsCard title="Açık Issue" value={openIssues} icon={<TbAlertCircle />} color="#FF5630" />
        </div>
        <div className="col-6 col-lg-4">
          <StatsCard
            title="Aktif Sprint"
            value={activeSprint ? activeSprint.name : 'Yok'}
            icon={<TbPlayerPlay />}
            color="#00875A"
          />
        </div>
      </div>
      {myProject && (
        <div className="row g-3 mb-4">
          <div className="col-12 col-lg-6"><ProjectProgress unitId={null} projectId={myProject.id} /></div>
          <div className="col-12 col-lg-6">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body">
                <h6 className="fw-semibold mb-3">Ekip İş Yükü</h6>
                {Object.keys(assigneeMap).length === 0 ? (
                  <p className="text-muted small">Atanmış açık issue yok.</p>
                ) : (
                  <ul className="list-unstyled mb-0">
                    {Object.entries(assigneeMap).map(([userId, count]) => {
                      const user = state.users.find(u => u.id === userId);
                      return (
                        <li key={userId} className="d-flex justify-content-between align-items-center mb-2">
                          <span className="small">{user?.name || userId}</span>
                          <span className="badge bg-primary rounded-pill">{count} issue</span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── External User Dashboard ─────────────────────────────────────────────────
function ExternalUserDashboard({ state, currentUser }) {
  const myRequests = getVisibleRequests(state.issues, currentUser);
  const openCount = myRequests.filter(r => r.status !== 'Done').length;

  const STATUS_COLORS_MAP = {
    'To Do': 'secondary',
    'In Progress': 'primary',
    'In Review': 'warning',
    'Done': 'success',
  };

  return (
    <div>
      <h4 className="fw-bold mb-4">Taleplerim</h4>
      <div className="row g-3 mb-4">
        <div className="col-6">
          <StatsCard title="Toplam Talep" value={myRequests.length} icon={<TbTicket />} color="#0052CC" />
        </div>
        <div className="col-6">
          <StatsCard title="Açık Talep" value={openCount} icon={<TbAlertCircle />} color="#FF5630" />
        </div>
      </div>
      <div className="card border-0 shadow-sm">
        <div className="card-body">
          <h6 className="fw-semibold mb-3">Talep Listesi</h6>
          {myRequests.length === 0 ? (
            <p className="text-muted small">Henüz talep oluşturmadınız.</p>
          ) : (
            <ul className="list-unstyled mb-0">
              {myRequests.map(req => {
                const unit = state.units.find(u => u.unitCode === req.unitCode);
                return (
                  <li key={req.id} className="d-flex justify-content-between align-items-center py-2 border-bottom">
                    <div>
                      <span className="fw-medium small">{req.number}</span>
                      <span className="text-muted small ms-2">{req.title}</span>
                      {unit && <span className="text-muted small ms-2">— {unit.name}</span>}
                    </div>
                    <span className={`badge bg-${STATUS_COLORS_MAP[req.status] || 'secondary'}`}>
                      {req.status}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Priority Breakdown (shared) ─────────────────────────────────────────────
function PriorityBreakdown({ issues }) {
  const priorityCounts = ['Highest', 'High', 'Medium', 'Low', 'Lowest'].map(priority => ({
    priority,
    count: issues.filter(i => i.priority === priority).length,
    color: PRIORITY_COLORS[priority],
  }));
  const maxCount = Math.max(...priorityCounts.map(p => p.count), 1);

  return (
    <div className="card border-0 shadow-sm h-100">
      <div className="card-body">
        <h6 className="card-title fw-semibold mb-3 d-flex align-items-center gap-2">
          <TbChartBar aria-hidden="true" />
          Öncelik Dağılımı
        </h6>
        <ul className="list-unstyled mb-0">
          {priorityCounts.map(({ priority, count, color }) => (
            <li key={priority} className="mb-2">
              <div className="d-flex align-items-center gap-2">
                <span className="text-end" style={{ width: 60, fontSize: '0.8rem', color }}>{priority}</span>
                <div className="flex-grow-1 bg-light rounded" style={{ height: 10 }}>
                  <div
                    className="rounded"
                    style={{ width: `${Math.round((count / maxCount) * 100)}%`, height: 10, backgroundColor: color, transition: 'width 0.3s ease' }}
                    role="progressbar"
                    aria-valuenow={count}
                    aria-valuemin={0}
                    aria-valuemax={maxCount}
                    aria-label={`${priority}: ${count}`}
                  />
                </div>
                <span className="text-muted" style={{ width: 24, fontSize: '0.8rem' }}>{count}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const { state } = useAppContext();
  const { currentUser } = useAuth();
  const { role } = usePermissions();

  if (!currentUser) return null;

  switch (role) {
    case ROLES.SYSTEM_ADMIN:
      return <AdminDashboard state={state} currentUser={currentUser} />;
    case ROLES.DEPARTMENT_HEAD:
      return <DepartmentHeadDashboard state={state} currentUser={currentUser} />;
    case ROLES.PROJECT_MANAGER:
      return <ProjectManagerDashboard state={state} currentUser={currentUser} />;
    case ROLES.EXTERNAL_USER:
      return <ExternalUserDashboard state={state} currentUser={currentUser} />;
    default:
      return <AdminDashboard state={state} currentUser={currentUser} />;
  }
}
