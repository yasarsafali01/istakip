import React from 'react';
import {
  TbFolder, TbAlertCircle, TbCalendar, TbTicket,
  TbCircleCheck, TbClock, TbChartBar, TbBuilding, TbLock,
} from 'react-icons/tb';
import { useAppContext } from '../../context/AppContext';
import { useAuth } from '../../hooks/useAuth';
import { usePermissions } from '../../hooks/usePermissions';
import { useState } from 'react';
import Board from '../board/Board';
import ProjectProgress from './ProjectProgress';
import RecentActivity from './RecentActivity';
import { PRIORITY_COLORS, ROLES } from '../../constants';
import { getVisibleProjects, getVisibleRequests } from '../../utils/permissionUtils';
import { formatDate } from '../../utils/dateUtils';

/* ── Sprint tarih aralığı formatla ──────────────────────────────────────────── */
function sprintDateRange(sprint) {
  if (!sprint) return 'Aktif dönem yok';
  const start = formatDate(sprint.startDate, 'd MMMM yyyy');
  const end = formatDate(sprint.endDate, 'd MMMM yyyy');
  if (start && end) return `${start} – ${end}`;
  return sprint.name || '—';
}

/* ── Modern istatistik kartı ─────────────────────────────────────────────────── */
function StatCard({ title, value, icon, bg, color }) {
  return (
    <div
      className="card border-0 shadow-sm h-100"
      style={{ borderLeft: `4px solid ${color}`, background: `linear-gradient(135deg, ${bg} 0%, #ffffff 100%)` }}
    >
      <div className="card-body py-3 px-4">
        <div className="d-flex align-items-center justify-content-between mb-2">
          <span
            className="fw-semibold text-muted"
            style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}
          >
            {title}
          </span>
          <div
            className="d-flex align-items-center justify-content-center rounded-circle"
            style={{ width: 36, height: 36, background: bg, flexShrink: 0 }}
          >
            <span style={{ color, fontSize: 18 }}>{icon}</span>
          </div>
        </div>
        <div className="fw-bold" style={{ fontSize: '2rem', lineHeight: 1, color }}>
          {value}
        </div>
      </div>
    </div>
  );
}

/* Aktif Dönem kartı — tarih aralığı gösterir */
function ActivePeriodCard({ sprint }) {
  const dateRange = sprintDateRange(sprint);
  return (
    <div
      className="card border-0 shadow-sm h-100"
      style={{ borderLeft: '4px solid #008DA6', background: 'linear-gradient(135deg, #E0F7FA 0%, #ffffff 100%)' }}
    >
      <div className="card-body py-3 px-4">
        <div className="d-flex align-items-center justify-content-between mb-2">
          <span
            className="fw-semibold text-muted"
            style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}
          >
            Aktif Dönem
          </span>
          <div
            className="d-flex align-items-center justify-content-center rounded-circle"
            style={{ width: 36, height: 36, background: '#E0F7FA', flexShrink: 0 }}
          >
            <span style={{ color: '#008DA6', fontSize: 18 }}><TbCalendar /></span>
          </div>
        </div>
        {sprint ? (
          <>
            <div className="fw-bold" style={{ fontSize: '1rem', lineHeight: 1.3, color: '#008DA6' }}>
              {sprint.name || 'Aktif Dönem'}
            </div>
            <div className="text-muted mt-1" style={{ fontSize: '0.75rem' }}>{dateRange}</div>
          </>
        ) : (
          <div className="fw-bold text-muted" style={{ fontSize: '1rem' }}>—</div>
        )}
      </div>
    </div>
  );
}

/* ── Admin Dashboard ─────────────────────────────────────────────────────────── */
function AdminDashboard({ state }) {
  const totalProjects = state.projects.length;
  const totalUnits = state.units.length;
  const activeSprint = state.sprints.find(s => s.status === 'Active');

  const allIssues = state.issues.filter(i => !i.isRequest);
  const requests = state.issues.filter(i => i.isRequest);
  const openRequests = requests.filter(r => r.status !== 'Done').length;
  const resolvedRequests = requests.filter(r => r.status === 'Done').length;
  const pendingIssues = allIssues.filter(i => !i.sprintId && i.status !== 'Done').length;

  return (
    <div>
      <h4 className="fw-bold mb-1">Ana Sayfa</h4>
      <p className="text-muted small mb-4">Sistem geneli özet</p>

      <div className="row g-3 mb-4">
        <div className="col-6 col-lg-2">
          <StatCard title="Birim Sayısı" value={totalUnits} icon={<TbBuilding />}
            bg="#EAF0FF" color="#6554C0" />
        </div>
        <div className="col-6 col-lg-2">
          <StatCard title="Bağlı Proje" value={totalProjects} icon={<TbFolder />}
            bg="#E6F0FF" color="#0052CC" />
        </div>
        <div className="col-6 col-lg-2">
          <ActivePeriodCard sprint={activeSprint} />
        </div>
        <div className="col-6 col-lg-2">
          <StatCard title="Toplam Talep" value={requests.length} icon={<TbTicket />}
            bg="#FFF4E5" color="#FF7700" />
        </div>
        <div className="col-6 col-lg-2">
          <StatCard title="Açık Talep" value={openRequests} icon={<TbAlertCircle />}
            bg="#FFF0F0" color="#DE350B" />
        </div>
        <div className="col-6 col-lg-2">
          <StatCard title="Çözülmüş Talep" value={resolvedRequests} icon={<TbCircleCheck />}
            bg="#E3FCEF" color="#00875A" />
        </div>
        <div className="col-6 col-lg-2">
          <StatCard title="Bekleyen İşler" value={pendingIssues} icon={<TbClock />}
            bg="#FFF8E1" color="#D4A000" />
        </div>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-12 col-lg-6"><ProjectProgress /></div>
        <div className="col-12 col-lg-6"><PriorityBreakdown issues={allIssues} /></div>
      </div>
      <div className="row g-3">
        <div className="col-12"><RecentActivity /></div>
      </div>
    </div>
  );
}

/* ── Department Head Dashboard ───────────────────────────────────────────────── */
function DepartmentHeadDashboard({ state, currentUser }) {
  const visibleProjects = getVisibleProjects(state.projects, currentUser);
  const visibleProjectIds = visibleProjects.map(p => p.id);
  const unit = state.units.find(u => u.id === currentUser.unitId);

  const activeSprint = state.sprints.find(
    s => s.status === 'Active' && visibleProjectIds.includes(s.projectId)
  );
  const unitIssues  = state.issues.filter(i => visibleProjectIds.includes(i.projectId) && !i.isRequest);
  const requests    = state.issues.filter(i => visibleProjectIds.includes(i.projectId) && i.isRequest);

  // İş istatistikleri (talepler hariç)
  const openIssues     = unitIssues.filter(i => i.status !== 'Done').length;
  const resolvedIssues = unitIssues.filter(i => i.status === 'Done').length;
  const pendingIssues  = unitIssues.filter(i => !i.sprintId && i.status !== 'Done').length;

  return (
    <div>
      <h4 className="fw-bold mb-1">Ana Sayfa</h4>
      {unit && <p className="text-muted small mb-4">{unit.name}</p>}

      <div className="row g-3 mb-4">
        <div className="col-6 col-lg-2">
          <StatCard title="Bağlı Proje" value={visibleProjects.length} icon={<TbFolder />}
            bg="#E6F0FF" color="#0052CC" />
        </div>
        <div className="col-6 col-lg-2">
          <ActivePeriodCard sprint={activeSprint} />
        </div>
        <div className="col-6 col-lg-2">
          <StatCard title="Toplam İş" value={unitIssues.length} icon={<TbTicket />}
            bg="#FFF4E5" color="#FF7700" />
        </div>
        <div className="col-6 col-lg-2">
          <StatCard title="Açık İşler" value={openIssues} icon={<TbAlertCircle />}
            bg="#FFF0F0" color="#DE350B" />
        </div>
        <div className="col-6 col-lg-2">
          <StatCard title="Tamamlanan" value={resolvedIssues} icon={<TbCircleCheck />}
            bg="#E3FCEF" color="#00875A" />
        </div>
        <div className="col-6 col-lg-2">
          <StatCard title="Bekleyen İşler" value={pendingIssues} icon={<TbClock />}
            bg="#FFF8E1" color="#D4A000" />
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

/* ── Project Manager Dashboard ───────────────────────────────────────────────── */
function ProjectManagerDashboard({ state, currentUser }) {
  const myProject = state.projects.find(p => p.managerId === currentUser.id);
  const projectIssues = myProject
    ? state.issues.filter(i => i.projectId === myProject.id && !i.isRequest)
    : [];
  const requests = myProject
    ? state.issues.filter(i => i.projectId === myProject.id && i.isRequest)
    : [];
  const activeSprint = myProject
    ? state.sprints.find(s => s.projectId === myProject.id && s.status === 'Active')
    : null;

  // İş istatistikleri (talepler hariç)
  const openIssues     = projectIssues.filter(i => i.status !== 'Done').length;
  const resolvedIssues = projectIssues.filter(i => i.status === 'Done').length;
  const pendingIssues  = projectIssues.filter(i => !i.sprintId && i.status !== 'Done').length;

  const assigneeMap = {};
  projectIssues.filter(i => i.assigneeId && i.status !== 'Done').forEach(issue => {
    assigneeMap[issue.assigneeId] = (assigneeMap[issue.assigneeId] || 0) + 1;
  });

  return (
    <div>
      <h4 className="fw-bold mb-1">Ana Sayfa</h4>
      {myProject && <p className="text-muted small mb-4">{myProject.name}</p>}
      {!myProject && <p className="text-muted small mb-4">Henüz atanmış proje yok.</p>}

      <div className="row g-3 mb-4">
        <div className="col-6 col-lg-2">
          <StatCard title="Bağlı Proje" value={myProject ? 1 : 0} icon={<TbFolder />}
            bg="#E6F0FF" color="#0052CC" />
        </div>
        <div className="col-6 col-lg-2">
          <ActivePeriodCard sprint={activeSprint} />
        </div>
        <div className="col-6 col-lg-2">
          <StatCard title="Toplam İş" value={projectIssues.length} icon={<TbTicket />}
            bg="#FFF4E5" color="#FF7700" />
        </div>
        <div className="col-6 col-lg-2">
          <StatCard title="Açık İşler" value={openIssues} icon={<TbAlertCircle />}
            bg="#FFF0F0" color="#DE350B" />
        </div>
        <div className="col-6 col-lg-2">
          <StatCard title="Tamamlanan" value={resolvedIssues} icon={<TbCircleCheck />}
            bg="#E3FCEF" color="#00875A" />
        </div>
        <div className="col-6 col-lg-2">
          <StatCard title="Bekleyen İşler" value={pendingIssues} icon={<TbClock />}
            bg="#FFF8E1" color="#D4A000" />
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
                          <span className="badge bg-primary rounded-pill">{count} iş</span>
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

      {/* Son Aktiviteler */}
      {myProject && (
        <div className="row g-3 mt-1">
          <div className="col-12">
            <RecentActivity projectId={myProject.id} />
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Worker Dashboard ────────────────────────────────────────────────────────── */
function WorkerDashboard({ state, currentUser }) {
  const myProject = state.projects.find(p => p.id === currentUser.projectId);
  const myIssues = myProject
    ? state.issues.filter(i => i.projectId === myProject.id && i.assigneeId === currentUser.id && !i.isRequest)
    : [];
  const activeSprint = myProject
    ? state.sprints.find(s => s.projectId === myProject.id && s.status === 'Active')
    : null;
  const openCount = myIssues.filter(i => i.status !== 'Done').length;
  const doneCount = myIssues.filter(i => i.status === 'Done').length;
  const pendingIssues = myIssues.filter(i => !i.sprintId && i.status !== 'Done').length;

  return (
    <div>
      <h4 className="fw-bold mb-1">Ana Sayfa</h4>
      {myProject && <p className="text-muted small mb-4">{myProject.name}</p>}

      {/* Kartlar */}
      <div className="row g-3 mb-4">
        <div className="col-6 col-lg-2">
          <StatCard title="Bağlı Proje" value={myProject ? 1 : 0} icon={<TbFolder />}
            bg="#E6F0FF" color="#0052CC" />
        </div>
        <div className="col-6 col-lg-2">
          <ActivePeriodCard sprint={activeSprint} />
        </div>
        <div className="col-6 col-lg-2">
          <StatCard title="Bana Atanan" value={myIssues.length} icon={<TbTicket />}
            bg="#FFF4E5" color="#FF7700" />
        </div>
        <div className="col-6 col-lg-2">
          <StatCard title="Açık İşler" value={openCount} icon={<TbAlertCircle />}
            bg="#FFF0F0" color="#DE350B" />
        </div>
        <div className="col-6 col-lg-2">
          <StatCard title="Tamamlanan" value={doneCount} icon={<TbCircleCheck />}
            bg="#E3FCEF" color="#00875A" />
        </div>
        <div className="col-6 col-lg-2">
          <StatCard title="Bekleyen İşler" value={pendingIssues} icon={<TbClock />}
            bg="#FFF8E1" color="#D4A000" />
        </div>
      </div>

      {myProject && (
        <>
          {/* Aktif İşler (Board) */}
          <div className="mb-4">
            <h5 className="fw-semibold mb-3 d-flex align-items-center gap-2">
              <span className="badge" style={{ backgroundColor: '#0052CC', color: '#fff', fontSize: '0.75rem' }}>
                {myProject.key}
              </span>
              Aktif İşler
            </h5>
            <WorkerBoardSection projectId={myProject.id} currentUserId={currentUser.id} />
          </div>

          <hr className="my-4" />

          {/* Backlog */}
          <div className="mb-4">
            <h5 className="fw-semibold mb-3">Backlog</h5>
            <WorkerBacklogSection projectId={myProject.id} currentUserId={currentUser.id} state={state} />
          </div>
        </>
      )}
    </div>
  );
}

/* Worker için Board bölümü — Board component'ini direkt kullanır, ay seçici dahil */
function WorkerBoardSection({ projectId, currentUserId }) {
  const { state } = useAppContext();
  const [boardSprintId, setBoardSprintId] = useState('active');

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

  const activeSprint = allSprints.find(s => s.status === 'Active');

  const resolvedSprint =
    boardSprintId === 'active'
      ? activeSprint ?? null
      : boardSprintId === 'all'
      ? null
      : allSprints.find(s => s.id === boardSprintId) ?? null;

  const resolvedSprintId = resolvedSprint?.id ?? null;
  const isReadonly = resolvedSprint?.status === 'Completed';

  const MONTH_NAMES = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

  return (
    <div>
      <div className="d-flex align-items-center gap-2 mb-3 flex-wrap">
        <label htmlFor="worker-board-sprint" className="form-label mb-0 small fw-semibold">Ay:</label>
        <select
          id="worker-board-sprint"
          className="form-select form-select-sm"
          value={boardSprintId}
          onChange={e => setBoardSprintId(e.target.value)}
          style={{ minWidth: 180 }}
        >
          <option value="active">Aktif Ay</option>
          <option value="all">Tümü (Kanban)</option>
          {allSprints.map(s => (
            <option key={s.id} value={s.id}>
              {s.name || `${MONTH_NAMES[(s.month || 1) - 1]} ${s.year}`}
              {s.status === 'Active' ? ' ✓' : s.status === 'Completed' ? ' 🔒' : ''}
            </option>
          ))}
        </select>
        {isReadonly && (
          <span className="badge d-flex align-items-center gap-1"
            style={{ background: '#DEEBFF', color: '#0747A6', fontSize: '0.75rem', padding: '5px 10px' }}>
            <TbLock size={13} /> Kapalı Ay — Salt Okunur
          </span>
        )}
      </div>
      {/* Board component — worker'ın kendi işleri assigneeFilter ile filtrelenir */}
      <Board
        projectId={projectId}
        sprintId={resolvedSprintId}
        readonly={isReadonly}
        defaultAssigneeFilter={currentUserId}
      />
    </div>
  );
}

/* Worker için Backlog bölümü — sadece kendine atanan bekleyen işler */
function WorkerBacklogSection({ projectId, currentUserId, state }) {
  const myBacklog = state.issues.filter(
    i => i.projectId === projectId && !i.sprintId && i.assigneeId === currentUserId && !i.isRequest && i.status !== 'Done'
  );

  if (myBacklog.length === 0) {
    return <p className="text-muted small">Backlog'da bekleyen işiniz yok.</p>;
  }

  return (
    <div className="card border-0 shadow-sm">
      <div className="card-body p-0">
        <table className="table table-sm table-hover mb-0" style={{ fontSize: '0.85rem' }}>
          <thead>
            <tr className="text-muted" style={{ fontSize: '0.75rem' }}>
              <th className="fw-semibold border-0 ps-3">No</th>
              <th className="fw-semibold border-0">Başlık</th>
              <th className="fw-semibold border-0">Öncelik</th>
              <th className="fw-semibold border-0">Açılış</th>
            </tr>
          </thead>
          <tbody>
            {myBacklog.map(issue => (
              <tr key={issue.id}>
                <td className="ps-3 align-middle text-muted small">{issue.number}</td>
                <td className="align-middle fw-medium">{issue.title}</td>
                <td className="align-middle">
                  <span style={{ fontSize: '0.72rem', fontWeight: 600, color: { Highest: '#DE350B', High: '#FF7700', Medium: '#D4A000', Low: '#2684FF', Lowest: '#00875A' }[issue.priority] || '#6B778C' }}>
                    {issue.priority}
                  </span>
                </td>
                <td className="align-middle text-muted small">
                  {issue.createdAt ? issue.createdAt.substring(0, 10) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* Küçük öncelik badge — artık kullanılmıyor, kaldırıldı */

/* ── External User Dashboard ─────────────────────────────────────────────────── */
function ExternalUserDashboard({ state, currentUser }) {
  const myRequests = getVisibleRequests(state.issues, currentUser);
  const openCount = myRequests.filter(r => r.status !== 'Done').length;
  const resolvedCount = myRequests.filter(r => r.status === 'Done').length;

  const STATUS_COLORS_MAP = {
    'To Do': 'secondary', 'In Progress': 'primary', 'In Review': 'warning', 'Done': 'success',
  };

  return (
    <div>
      <h4 className="fw-bold mb-4">Ana Sayfa</h4>
      <div className="row g-3 mb-4">
        <div className="col-6 col-lg-3">
          <StatCard title="Toplam Talep" value={myRequests.length} icon={<TbTicket />}
            bg="#E6F0FF" color="#0052CC" />
        </div>
        <div className="col-6 col-lg-3">
          <StatCard title="Açık Talep" value={openCount} icon={<TbAlertCircle />}
            bg="#FFF0F0" color="#DE350B" />
        </div>
        <div className="col-6 col-lg-3">
          <StatCard title="Çözülmüş" value={resolvedCount} icon={<TbCircleCheck />}
            bg="#E3FCEF" color="#00875A" />
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

/* ── Priority Breakdown ──────────────────────────────────────────────────────── */
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
          <TbChartBar aria-hidden="true" /> Öncelik Dağılımı
        </h6>
        <ul className="list-unstyled mb-0">
          {priorityCounts.map(({ priority, count, color }) => (
            <li key={priority} className="mb-2">
              <div className="d-flex align-items-center gap-2">
                <span style={{ width: 60, fontSize: '0.8rem', color, fontWeight: 600 }}>{priority}</span>
                <div className="flex-grow-1 rounded" style={{ height: 10, background: '#F4F5F7' }}>
                  <div className="rounded" style={{
                    width: `${Math.round((count / maxCount) * 100)}%`,
                    height: 10, backgroundColor: color, transition: 'width 0.3s ease'
                  }} />
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

/* ── Main Dashboard ──────────────────────────────────────────────────────────── */
export default function Dashboard() {
  const { state } = useAppContext();
  const { currentUser } = useAuth();
  const { role } = usePermissions();

  if (!currentUser) return null;

  switch (role) {
    case ROLES.SYSTEM_ADMIN:    return <AdminDashboard state={state} currentUser={currentUser} />;
    case ROLES.DEPARTMENT_HEAD: return <DepartmentHeadDashboard state={state} currentUser={currentUser} />;
    case ROLES.PROJECT_MANAGER: return <ProjectManagerDashboard state={state} currentUser={currentUser} />;
    case ROLES.WORKER:          return <WorkerDashboard state={state} currentUser={currentUser} />;
    case ROLES.EXTERNAL_USER:   return <ExternalUserDashboard state={state} currentUser={currentUser} />;
    default:                    return <AdminDashboard state={state} currentUser={currentUser} />;
  }
}

