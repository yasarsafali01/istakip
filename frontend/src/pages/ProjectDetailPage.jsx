import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link, Navigate } from 'react-router-dom';
import {
  TbLock, TbPlus, TbUsers, TbUsersGroup, TbAlertCircle, TbFlag, TbLayoutKanban, TbList, TbShieldCheck,
  TbClipboardList, TbHourglass, TbProgress, TbCircleCheck, TbCalendar,
} from 'react-icons/tb';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../hooks/useAuth';
import { canAccessProject, inProject } from '../utils/permissionUtils';
import { formatDate, timeAgo } from '../utils/dateUtils';
import Board from '../components/board/Board';
import Avatar from '../components/common/Avatar';
import PriorityIcon from '../components/common/PriorityIcon';
import IssueModal from '../components/issue/IssueModal';
import RequestDetailModal from '../components/request/RequestDetailModal';
import Modal from '../components/common/Modal';
import IssueForm from '../components/issue/IssueForm';
import EmptyState from '../components/common/EmptyState';
import HelpGuide from '../components/common/HelpGuide';
import { PRIORITIES, PRIORITY_LABELS, ROLES, ACTIONS } from '../constants';
import { issuesApi, sprintsApi, teamsApi } from '../api/resources';
import { buildUnitCodeByProjectId, mapIssue } from '../api/mappers';
import { usePermissions } from '../hooks/usePermissions';
import { sortSprintsByCurrentMonth, getMissingSprintMonths, getSprintName } from '../utils/sprintUtils';
import SprintForm from '../components/sprint/SprintForm';
import ApprovalsList from '../components/project/ApprovalsList';
import { Kpi, Panel, SlaPill } from '../components/dashboard/DashboardKit';

// "Aylık Dönem" seçicisinde tüm aylara atanmış işleri birlikte gösteren seçenek.
const ALL_MONTHS = '__all__';

const MONTH_NAMES = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

/* ── Ana sayfa ───────────────────────────────────────────────────────────────── */
function ProjectDetailPage() {
  const { can } = usePermissions();
  const { projectId } = useParams();
  const [searchParams] = useSearchParams();
  const { state } = useAppContext();
  const { currentUser } = useAuth();

  const tabParam = searchParams.get('tab');
  const tab = tabParam === 'backlog' ? 'backlog' : tabParam === 'approvals' ? 'approvals' : 'board';
  const [boardSprintId, setBoardSprintId] = useState('active');

  const project = state.projects.find((p) => p.id === projectId);

  // Ekip & Şablonlar moved under Yönetim; keep old bookmarked links working.
  if (tabParam === 'team') {
    return <Navigate to={`/teams-templates?project=${projectId}`} replace />;
  }

  if (!project) {
    return (
      <EmptyState
        title="Müdürlük bulunamadı"
        description="Bu müdürlük mevcut değil veya silinmiş olabilir."
        action={<Link to="/dashboard" className="btn btn-primary">Dashboard'a Dön</Link>}
      />
    );
  }

  if (!canAccessProject(project, currentUser)) {
    return <Navigate to="/dashboard" replace />;
  }

  const allSprints = sortSprintsByCurrentMonth(state.sprints.filter((s) => s.projectId === projectId));

  const activeSprint = allSprints.find((s) => s.status === 'Active');
  const pageTitle = tab === 'board' ? 'Aktif Talepler' : tab === 'approvals' ? 'Onay Bekleyenler' : 'Bekleyen Talepler';
  const backlogCount = state.issues.filter((i) => i.projectId === projectId && !i.sprintId && i.status !== 'Geri Çevrildi').length;
  const approvalCount = state.issues.filter((i) => i.projectId === projectId && i.status === 'Onay Bekliyor').length;

  return (
    <div>
      <div className="pg-head">
        <div style={{ minWidth: 0 }}>
          <div className="pg-head__title">
            <span className="rd-key">{project.key}</span>
            <h4 className="pg-head__name text-truncate">{project.name}</h4>
            <HelpGuide
              title={`${pageTitle} — Yardım Kılavuzu`}
              sections={
                currentUser?.role === ROLES.PROJECT_MANAGER ? [
                  { icon: '📊', title: 'İstatistikler', items: ['Sayfanın üstünde toplam, yapılacak, devam eden ve tamamlanan iş sayılarını görürsünüz.'] },
                  { icon: '📌', title: 'Board Görünümü', items: ['İşleri sütunlar arasında sürükleyerek durumlarını güncelleyebilirsiniz.', 'Ay seçici ile farklı dönemlerin board\'unu görüntüleyebilirsiniz.'] },
                  { icon: '📋', title: 'Bekleyen Talepler', items: ['Bekleyen talepleri öncelik, atanan kişi ve tarihe göre filtreleyebilirsiniz.', 'İşleri aktif aya atayabilirsiniz.', 'CSV dışa aktarma ve yazdırma özelliklerini kullanabilirsiniz.'] },
                  { icon: '➕', title: 'Talep Oluşturma', items: ['Bekleyen Talepler görünümünde "Talep Oluştur" butonuyla yeni iş ekleyebilirsiniz.'] },
                ] : currentUser?.role === ROLES.WORKER ? [
                  { icon: '📊', title: 'İstatistikler', items: ['Müdürlükteki toplam, yapılacak, devam eden ve tamamlanan iş sayılarını görürsünüz.'] },
                  { icon: '📌', title: 'Board Görünümü', items: ['Size atanan işleri sütunlar arasında sürükleyerek durumlarını güncelleyebilirsiniz.', 'Ay seçici ile farklı dönemleri görüntüleyebilirsiniz.'] },
                  { icon: '📋', title: 'Bekleyen Talepler', items: ['Bekleyen talepleri görüntüleyebilirsiniz.'] },
                ] : [
                  { icon: '📊', title: 'İstatistikler', items: ['Müdürlükteki toplam, yapılacak, devam eden ve tamamlanan iş sayılarını görürsünüz.'] },
                  { icon: '📌', title: 'Board Görünümü', items: ['Müdürlüğün aktif dönemindeki işleri görüntüleyebilirsiniz.'] },
                  { icon: '📋', title: 'Bekleyen Talepler', items: ['Bekleyen talepleri görüntüleyebilirsiniz.'] },
                ]
              }
            />
          </div>
          {project.description && <div className="pg-head__desc">{project.description}</div>}
        </div>
        <nav className="pg-tabs" aria-label="Müdürlük sayfaları">
          <Link to={`/projects/${projectId}?tab=board`} className={tab === 'board' ? 'active' : ''}>
            <TbLayoutKanban size={16} /> Aktif Talepler
          </Link>
          <Link to={`/projects/${projectId}?tab=backlog`} className={tab === 'backlog' ? 'active' : ''}>
            <TbList size={16} /> Bekleyen Talepler
            <span className="ds-count">{backlogCount}</span>
          </Link>
          {can('issue.approve') && (
            <Link to={`/projects/${projectId}?tab=approvals`} className={tab === 'approvals' ? 'active' : ''}>
              <TbShieldCheck size={16} /> Onay Bekleyenler
              {approvalCount > 0 && <span className="ds-count" style={{ background: 'var(--violet-soft)', color: 'var(--violet)' }}>{approvalCount}</span>}
            </Link>
          )}
        </nav>
      </div>

      {tab === 'board' && (
        <BoardView
          projectId={projectId}
          allSprints={allSprints}
          activeSprint={activeSprint}
          boardSprintId={boardSprintId}
          setBoardSprintId={setBoardSprintId}
        />
      )}

      {tab === 'approvals' && <ApprovalsList projectId={projectId} />}

      {tab === 'backlog' && (
        <BacklogTabView projectId={projectId} allSprints={allSprints} />
      )}

    </div>
  );
}

/* ── Board view ─────────────────────────────────────────────────────────────── */
function BoardView({ projectId, allSprints, activeSprint, boardSprintId, setBoardSprintId }) {
  const { state, dispatch } = useAppContext();
  const { can } = usePermissions();
  const [creatingMissingMonths, setCreatingMissingMonths] = useState(false);
  const missingMonths = getMissingSprintMonths(allSprints);

  async function handleCreateMissingMonths() {
    setCreatingMissingMonths(true);
    try {
      for (const { year, month } of missingMonths) {
        const created = await sprintsApi.create(projectId, { month, year });
        dispatch({ type: ACTIONS.ADD_SPRINT, payload: created });
      }
    } catch (err) {
      window.alert(err.message);
    } finally {
      setCreatingMissingMonths(false);
    }
  }

  const resolvedSprint =
    boardSprintId === 'active'
      ? activeSprint ?? null
      : boardSprintId === 'all'
      ? null
      : allSprints.find((s) => s.id === boardSprintId) ?? null;

  const resolvedSprintId = resolvedSprint?.id ?? null;
  const isReadonly = resolvedSprint?.status === 'Completed';

  // İstatistikler — seçili sprint veya tüm proje
  const sprintIssues = resolvedSprintId
    ? state.issues.filter(i => i.projectId === projectId && i.sprintId === resolvedSprintId && !i.isRequest && i.status !== 'Geri Çevrildi')
    : state.issues.filter(i => i.projectId === projectId && !i.isRequest && i.status !== 'Geri Çevrildi');

  const totalCount    = sprintIssues.length;
  const todoCount     = sprintIssues.filter(i => i.status === 'To Do').length;
  const inProgCount   = sprintIssues.filter(i => i.status === 'In Progress').length;
  const doneCount     = sprintIssues.filter(i => i.status === 'Done').length;

  return (
    <div>
      {/* İstatistik kartları */}
      <div className="row g-3 mb-3">
        <div className="col-6 col-lg-3"><Kpi label="Toplam iş" value={totalCount} icon={<TbClipboardList size={17} />} tone="navy"
          sub={resolvedSprint ? resolvedSprint.name : 'Tüm dönemler'} /></div>
        <div className="col-6 col-lg-3"><Kpi label="Yapılacak" value={todoCount} icon={<TbHourglass size={17} />} tone="orange" sub="Henüz başlanmadı" /></div>
        <div className="col-6 col-lg-3"><Kpi label="Devam eden" value={inProgCount} icon={<TbProgress size={17} />} tone="violet" sub="Üzerinde çalışılıyor" /></div>
        <div className="col-6 col-lg-3"><Kpi label="Tamamlanan" value={doneCount} icon={<TbCircleCheck size={17} />} tone="ok"
          sub={totalCount ? `%${Math.round((doneCount / totalCount) * 100)} tamamlandı` : 'Kayıt yok'} /></div>
      </div>

      {/* Ay seçici */}
      <div className="ds-bar mb-3">
        <TbCalendar size={17} style={{ color: 'var(--navy)' }} />
        <label htmlFor="board-sprint-select" className="ds-bar__label mb-0">Dönem</label>
        <select
          id="board-sprint-select"
          className="form-select form-select-sm"
          value={boardSprintId}
          onChange={(e) => setBoardSprintId(e.target.value)}
          style={{ width: 'auto', minWidth: 190 }}
        >
          <option value="active">Aktif Ay</option>
          <option value="all">Tümü (Kanban)</option>
          {allSprints.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name || `${MONTH_NAMES[(s.month || 1) - 1]} ${s.year}`}
              {s.status === 'Active' ? ' ✓' : s.status === 'Completed' ? ' 🔒' : ''}
            </option>
          ))}
        </select>
        {isReadonly && (
          <span className="ds-pill" style={{ background: 'var(--navy-soft)', color: 'var(--navy)' }}>
            <TbLock size={13} /> Kapalı ay — salt okunur
          </span>
        )}
        {totalCount > 0 && (
          <div className="d-flex align-items-center gap-2 ms-auto" style={{ minWidth: 180 }}>
            <span className="ds-bar__label">İlerleme</span>
            <div className="ds-meter flex-grow-1" style={{ minWidth: 100 }}>
              <span style={{ width: `${Math.round((doneCount / totalCount) * 100)}%`, background: 'var(--ok)' }} />
            </div>
          </div>
        )}
        {can('sprint.manage') && missingMonths.length > 0 && (
          <button
            type="button"
            className="btn btn-sm btn-outline-warning d-flex align-items-center gap-1"
            onClick={handleCreateMissingMonths}
            disabled={creatingMissingMonths}
            title={`Eksik aylar: ${missingMonths.map((m) => getSprintName(m.year, m.month)).join(', ')}`}
          >
            {creatingMissingMonths ? 'Oluşturuluyor…' : `${missingMonths.length} ay eksik — tümünü oluştur`}
          </button>
        )}
      </div>
      <Board projectId={projectId} sprintId={resolvedSprintId} readonly={isReadonly} />
    </div>
  );
}

/* ── Backlog tab view ────────────────────────────────────────────────────────── */
function BacklogTabView({ projectId, allSprints }) {
  const { state, dispatch } = useAppContext();
  const { can } = usePermissions();
  const [priorityFilter, setPriorityFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [sortBy, setSortBy] = useState('date_desc');
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [showAddMonthModal, setShowAddMonthModal] = useState(false);
  const [creatingMissingMonths, setCreatingMissingMonths] = useState(false);
  const missingMonths = getMissingSprintMonths(allSprints);

  // "Aylık Dönem" seçicisinde ay eksik görünmesin diye: son var olan aydan
  // bugüne kadar arada kalan tüm ayları tek seferde oluşturur.
  async function handleCreateMissingMonths() {
    setCreatingMissingMonths(true);
    try {
      for (const { year, month } of missingMonths) {
        const created = await sprintsApi.create(projectId, { month, year });
        dispatch({ type: ACTIONS.ADD_SPRINT, payload: created });
      }
    } catch (err) {
      window.alert(err.message);
    } finally {
      setCreatingMissingMonths(false);
    }
  }
  const [selectedSprintId, setSelectedSprintId] = useState(() => {
    const active = allSprints.find((s) => s.status === 'Active');
    return active ? active.id : (allSprints[0]?.id ?? '');
  });
  const [selectedIssueId, setSelectedIssueId] = useState(null);
  const [selectedRequestId, setSelectedRequestId] = useState(null);
  // Aktif aya atama — atanmamış ise önce kişi seçimi
  const [assignToSprintModal, setAssignToSprintModal] = useState(null); // issue objesi
  // Atama bir kişiye ya da müdürlüğün bir ekibine yapılabilir: "user:<id>" | "team:<id>"
  const [pendingTarget, setPendingTarget] = useState('');
  const [teams, setTeams] = useState([]);
  useEffect(() => {
    teamsApi.listByProject(projectId).then(setTeams).catch(() => setTeams([]));
  }, [projectId]);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Aktif sprint değişirse (proje değişimi vb.) default'u güncelle
  useEffect(() => {
    const active = allSprints.find((s) => s.status === 'Active');
    if (active) setSelectedSprintId(active.id);
    else if (allSprints.length > 0) setSelectedSprintId(allSprints[0].id);
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Veri ─────────────────────────────────────────────────────────────────
  const allProjectIssues = state.issues.filter((i) => i.projectId === projectId && i.status !== 'Geri Çevrildi');
  const backlogIssues = allProjectIssues.filter((i) => !i.sprintId);

  const activeSprint = allSprints.find((s) => s.status === 'Active') ?? null;

  // Aktif aya atama işlemi
  async function handleAssignToActiveSprint(issue) {
    if (!activeSprint) return;
    if (!issue.assigneeId && !issue.assigneeTeamId) {
      // Atanmamış — önce kişi/ekip seçimi modalı aç
      setPendingTarget('');
      setAssignToSprintModal(issue);
    } else {
      // Atanmış — direkt ata
      try {
        const updated = await issuesApi.moveSprint(issue.id, activeSprint.id);
        const unitCodeByProjectId = buildUnitCodeByProjectId(state.projects, state.units);
        dispatch({ type: ACTIONS.UPDATE_ISSUE, payload: mapIssue(updated, unitCodeByProjectId) });
      } catch (err) {
        window.alert(err.message);
      }
    }
  }

  async function confirmAssignToSprint() {
    if (!assignToSprintModal || !activeSprint) return;
    if (!pendingTarget) return;
    const [kind, targetId] = pendingTarget.split(':');
    try {
      // Önce kişiyi ya da ekibi ata
      if (kind === 'team') await issuesApi.assignTeam(assignToSprintModal.id, targetId);
      else await issuesApi.updateAssignee(assignToSprintModal.id, targetId);
      // Sonra sprinte ata
      const updated = await issuesApi.moveSprint(assignToSprintModal.id, activeSprint.id);
      const unitCodeByProjectId = buildUnitCodeByProjectId(state.projects, state.units);
      dispatch({ type: ACTIONS.UPDATE_ISSUE, payload: mapIssue(updated, unitCodeByProjectId) });
    } catch (err) {
      window.alert(err.message);
    } finally {
      setAssignToSprintModal(null);
      setPendingTarget('');
    }
  }

  // Backlog'daki benzersiz aylar (açılış tarihine göre)
  const backlogMonths = [...new Set(
    backlogIssues
      .filter((i) => i.createdAt)
      .map((i) => i.createdAt.substring(0, 7)) // "YYYY-MM"
  )].sort((a, b) => b.localeCompare(a));

  // Filtre + sıralama uygula
  const PRIORITY_ORDER = { High: 0, Medium: 1, Low: 2 };
  const filteredBacklog = backlogIssues
    .filter((i) => !priorityFilter || i.priority === priorityFilter)
    .filter((i) => !monthFilter || (i.createdAt && i.createdAt.startsWith(monthFilter)))
    .filter((i) => !assigneeFilter || i.assigneeId === assigneeFilter)
    .sort((a, b) => {
      if (sortBy === 'priority_asc') return (PRIORITY_ORDER[a.priority] ?? 5) - (PRIORITY_ORDER[b.priority] ?? 5);
      if (sortBy === 'priority_desc') return (PRIORITY_ORDER[b.priority] ?? 5) - (PRIORITY_ORDER[a.priority] ?? 5);
      if (sortBy === 'date_asc') return new Date(a.createdAt) - new Date(b.createdAt);
      return new Date(b.createdAt) - new Date(a.createdAt); // date_desc (varsayılan)
    });

  const project = state.projects.find((p) => p.id === projectId);
  const projectMembers = state.users.filter((u) => u.isActive !== false).filter(
    (u) => u.role !== ROLES.EXTERNAL_USER && (inProject(u, projectId) || project?.managerId === u.id)
  );

  // Öncelik sayıları — sadece backlog bekleyenler
  const priorityCounts = PRIORITIES.reduce((acc, p) => {
    acc[p] = backlogIssues.filter((i) => i.priority === p).length;
    return acc;
  }, {});

  // Seçili sprint — ya da "Tüm Aylar": herhangi bir aya atanmış tüm işler
  const isAllMonths = selectedSprintId === ALL_MONTHS;
  const selectedSprint = isAllMonths ? null : allSprints.find((s) => s.id === selectedSprintId);
  const hasSelection = isAllMonths || !!selectedSprint;
  const sprintIssues = isAllMonths
    ? state.issues.filter((i) => i.projectId === projectId && i.sprintId)
    : selectedSprint
      ? state.issues.filter((i) => i.projectId === projectId && i.sprintId === selectedSprintId)
      : [];
  const sprintDone = sprintIssues.filter((i) => i.status === 'Done').length;

  // Seçili sprintte çalışan kişiler
  const sprintMemberIds = [...new Set(sprintIssues.map((i) => i.assigneeId).filter(Boolean))];
  const sprintMembers = sprintMemberIds.map((id) => {
    const user = state.users.find((u) => u.id === id);
    const userIssues = sprintIssues.filter((i) => i.assigneeId === id);
    return { user, issues: userIssues, done: userIssues.filter((i) => i.status === 'Done').length };
  }).filter((m) => m.user);

  const sprintLabel = (s) => s
    ? (s.name || (s.month ? `${MONTH_NAMES[s.month - 1]} ${s.year}` : s.id))
    : (isAllMonths ? 'Tüm Aylar' : '');
  const sprintBadge = (s) => {
    if (!s) return null;
    const map = {
      Active:    { bg: '#E3FCEF', color: '#006644', label: 'Aktif' },
      Completed: { bg: '#DEEBFF', color: '#0747A6', label: 'Kapalı' },
      Planned:   { bg: '#DFE1E6', color: '#42526E', label: 'Planlandı' },
    };
    return map[s.status] || map.Planned;
  };

  // ── Dışa aktarma ─────────────────────────────────────────────────────────
  function exportCSV() {
    const headers = ['No', 'Başlık', 'Öncelik', 'Atanan', 'Açılış Tarihi'];
    const rows = filteredBacklog.map((issue) => {
      const assignee = state.users.find((u) => u.id === issue.assigneeId);
      return [
        issue.number,
        `"${issue.title.replace(/"/g, '""')}"`,
        issue.priority,
        assignee ? assignee.name : 'Atanmamış',
        issue.createdAt ? issue.createdAt.substring(0, 10) : '',
      ].join(',');
    });
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bekleyen-talepler-${new Date().toISOString().substring(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function printTable() {
    const project = state.projects.find((p) => p.id === projectId);
    const rows = filteredBacklog.map((issue) => {
      const assignee = state.users.find((u) => u.id === issue.assigneeId);
      return `<tr>
        <td>${issue.number}</td>
        <td>${issue.title}</td>
        <td>${PRIORITY_LABELS[issue.priority] || issue.priority}</td>
        <td>${assignee ? assignee.name : 'Atanmamış'}</td>
        <td>${issue.createdAt ? issue.createdAt.substring(0, 10) : ''}</td>
      </tr>`;
    }).join('');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
      <title>Bekleyen Talepler — ${project?.name || ''}</title>
      <style>body{font-family:sans-serif;font-size:12px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:6px 8px;text-align:left}th{background:#f4f5f7;font-weight:600}</style>
    </head><body>
      <h2>${project?.name || ''} — Bekleyen Talepler</h2>
      <p>Tarih: ${new Date().toLocaleDateString('tr-TR')}</p>
      <table><thead><tr><th>No</th><th>Başlık</th><th>Öncelik</th><th>Atanan</th><th>Açılış Tarihi</th></tr></thead>
      <tbody>${rows}</tbody></table>
    </body></html>`;
    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
    win.print();
  }

  return (
    <div>
      {/* ── Satır 1: öncelik göstergeleri (tıklayınca tabloyu süzer) ── */}
      <div className="row g-3 mb-3">
        <div className="col-6 col-md-3">
          <Kpi label="Bekleyen" value={backlogIssues.length} icon={<TbAlertCircle size={17} />} tone="navy"
            sub={`${backlogIssues.filter((i) => !i.assigneeId && !i.assigneeTeamId).length} tanesi atanmamış`} />
        </div>
        {PRIORITIES.map((p) => {
          const tone = { High: 'danger', Medium: 'warn', Low: 'navy' }[p] || 'navy';
          const isActive = priorityFilter === p;
          return (
            <div key={p} className="col-6 col-md-3">
              <div style={{ height: '100%', borderRadius: 14, outline: isActive ? '2px solid var(--navy)' : 'none', outlineOffset: 2 }}>
                <Kpi label={`${PRIORITY_LABELS[p]} öncelik`} value={priorityCounts[p]} icon={<TbFlag size={17} />} tone={tone}
                  sub={isActive ? 'Süzülüyor · kaldırmak için tıklayın' : 'Tıklayın: tabloyu süz'}
                  onClick={() => setPriorityFilter(isActive ? '' : p)} />
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Satır 2: Aylık dönem | Personel & işler ── */}
      <div className="row g-3 mb-3 align-items-stretch">
        <div className="col-12 col-lg-4">
          <Panel title="Aylık dönem" icon={<TbCalendar size={17} className="text-primary" />}
            action={can('sprint.manage') && (
              <button type="button" className="btn btn-sm btn-link p-0 text-decoration-none d-flex align-items-center gap-1"
                style={{ fontSize: '0.78rem' }} onClick={() => setShowAddMonthModal(true)}>
                <TbPlus size={13} /> Ay ekle
              </button>
            )}>
            <select
              className="form-select form-select-sm mb-2"
              value={selectedSprintId}
              onChange={(e) => setSelectedSprintId(e.target.value)}
            >
              <option value="">— Ay seçin —</option>
              <option value={ALL_MONTHS}>Tüm Aylar</option>
              {allSprints.map((s) => (
                <option key={s.id} value={s.id}>
                  {sprintLabel(s)}{s.status === 'Active' ? ' ✓' : s.status === 'Completed' ? ' 🔒' : ''}
                </option>
              ))}
            </select>
            {can('sprint.manage') && missingMonths.length > 0 && (
              <button
                type="button"
                className="btn btn-sm btn-outline-warning w-100 mb-2"
                style={{ fontSize: '0.76rem' }}
                onClick={handleCreateMissingMonths}
                disabled={creatingMissingMonths}
                title={`Eksik aylar: ${missingMonths.map((m) => getSprintName(m.year, m.month)).join(', ')}`}
              >
                {creatingMissingMonths ? 'Oluşturuluyor…' : `${missingMonths.length} ay eksik — tümünü oluştur`}
              </button>
            )}
            {hasSelection && (() => {
              const badge = selectedSprint && sprintBadge(selectedSprint);
              const pct = sprintIssues.length ? Math.round((sprintDone / sprintIssues.length) * 100) : 0;
              return (
                <div className="mt-1">
                  <div className="d-flex align-items-center gap-2 mb-2">
                    <span className="fw-semibold small">{sprintLabel(selectedSprint)}</span>
                    {badge && <span className="ds-pill" style={{ background: badge.bg, color: badge.color }}>{badge.label}</span>}
                    <span className="ms-auto fw-semibold small">%{pct}</span>
                  </div>
                  <div className="ds-meter mb-3"><span style={{ width: `${pct}%`, background: 'var(--ok)' }} /></div>
                  <div className="row g-2 text-center">
                    {[
                      ['Toplam', sprintIssues.length, 'var(--navy)'],
                      ['Tamamlanan', sprintDone, 'var(--ok)'],
                      ['Devam eden', sprintIssues.length - sprintDone, 'var(--orange)'],
                    ].map(([label, n, color]) => (
                      <div key={label} className="col-4">
                        <div className="rd-duration" style={{ padding: '8px 6px' }}>
                          <div className="fw-bold" style={{ color, fontSize: '1.15rem' }}>{n}</div>
                          <div className="rd-duration__hint">{label}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </Panel>
        </div>

        <div className="col-12 col-lg-8">
          <Panel title={hasSelection ? `${sprintLabel(selectedSprint)} — personel ve işler` : 'Personel ve işler'}
            icon={<TbUsers size={17} className="text-primary" />} hint={`${projectMembers.length} personel`}>
            {!hasSelection ? (
              <div className="ds-panel__empty">Personel bilgisi için bir ay seçin.</div>
            ) : sprintMembers.length === 0 ? (
              <div className="ds-panel__empty">{isAllMonths ? 'Hiçbir aya atanmış iş yok.' : 'Bu ayda atanmış iş yok.'}</div>
            ) : (
              <div className="row g-2">
                {sprintMembers.map(({ user, issues, done }) => {
                  const pct = issues.length ? Math.round((done / issues.length) * 100) : 0;
                  return (
                    <div key={user.id} className="col-12 col-sm-6">
                      <Link to={`/personnel/${user.id}`} className="d-flex align-items-center gap-2 p-2 text-decoration-none"
                        style={{ border: '1px solid #edf1f6', borderRadius: 12, background: '#fafbfd', color: 'var(--ink)' }}>
                        <Avatar name={user.name} color={user.avatarColor} size={34} />
                        <div className="flex-grow-1" style={{ minWidth: 0 }}>
                          <div className="d-flex justify-content-between align-items-center">
                            <span className="fw-semibold small text-truncate">{user.name}</span>
                            <span className="small text-muted ms-2" style={{ whiteSpace: 'nowrap' }}>{done}/{issues.length}</span>
                          </div>
                          <div className="ds-meter mt-1"><span style={{ width: `${pct}%`, background: 'var(--ok)' }} /></div>
                        </div>
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>
        </div>
      </div>

      {/* ── Satır 3: Bekleyen işler tablosu ──────────────────────────────── */}
      <div className="ds-panel mb-4">
        <div className="ds-panel__body pt-3">
          {/* Modern filtre çubuğu */}
          <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
            <h6 className="ds-panel__title">
              <TbList size={17} className="text-primary" /> Bekleyen talepler <span className="ds-count">{filteredBacklog.length}</span>
            </h6>
            <div className="d-flex align-items-center gap-2 flex-wrap">
              {/* Atanan kişi pill */}
              <FilterPill
                label="Atanan"
                icon="👤"
                active={!!assigneeFilter}
                activeLabel={assigneeFilter ? (state.users.find(u => u.id === assigneeFilter)?.name || '') : ''}
                onClear={() => setAssigneeFilter('')}
              >
                <div className="p-2" style={{ minWidth: 170 }}>
                  <button
                    className={`btn btn-sm w-100 text-start mb-1 ${!assigneeFilter ? 'btn-primary' : 'btn-light'}`}
                    style={{ fontSize: '0.82rem' }}
                    onClick={() => setAssigneeFilter('')}
                  >
                    Tüm Kişiler
                  </button>
                  {projectMembers.map((u) => (
                    <button
                      key={u.id}
                      className={`btn btn-sm w-100 text-start mb-1 ${assigneeFilter === u.id ? 'btn-primary' : 'btn-light'}`}
                      style={{ fontSize: '0.82rem' }}
                      onClick={() => setAssigneeFilter(u.id)}
                    >
                      {u.name}
                    </button>
                  ))}
                </div>
              </FilterPill>

              {/* Öncelik pill */}
              <FilterPill
                label="Öncelik"
                icon="⚑"
                active={!!priorityFilter}
                activeLabel={priorityFilter}
                onClear={() => setPriorityFilter('')}
              >
                <div className="p-2" style={{ minWidth: 160 }}>
                  {['', ...PRIORITIES].map((p) => (
                    <button
                      key={p || '__all__'}
                      className={`btn btn-sm w-100 text-start mb-1 ${priorityFilter === p ? 'btn-primary' : 'btn-light'}`}
                      style={{ fontSize: '0.82rem' }}
                      onClick={() => setPriorityFilter(p)}
                    >
                      {p ? PRIORITY_LABELS[p] : 'Tüm Öncelikler'}
                    </button>
                  ))}
                </div>
              </FilterPill>

              {/* Ay pill */}
              <FilterPill
                label="Açılış Tarihi"
                icon="📅"
                active={!!monthFilter}
                activeLabel={monthFilter ? `${MONTH_NAMES[parseInt(monthFilter.split('-')[1], 10) - 1]} ${monthFilter.split('-')[0]}` : ''}
                onClear={() => setMonthFilter('')}
              >
                <div className="p-2" style={{ minWidth: 170 }}>
                  <button
                    className={`btn btn-sm w-100 text-start mb-1 ${!monthFilter ? 'btn-primary' : 'btn-light'}`}
                    style={{ fontSize: '0.82rem' }}
                    onClick={() => setMonthFilter('')}
                  >
                    Tüm Aylar
                  </button>
                  {backlogMonths.map((ym) => {
                    const [year, month] = ym.split('-');
                    return (
                      <button
                        key={ym}
                        className={`btn btn-sm w-100 text-start mb-1 ${monthFilter === ym ? 'btn-primary' : 'btn-light'}`}
                        style={{ fontSize: '0.82rem' }}
                        onClick={() => setMonthFilter(ym)}
                      >
                        {MONTH_NAMES[parseInt(month, 10) - 1]} {year}
                      </button>
                    );
                  })}
                </div>
              </FilterPill>

              {/* Sırala pill */}
              <FilterPill
                label="Sırala"
                icon="↕"
                active={sortBy !== 'date_desc'}
                activeLabel={
                  sortBy === 'date_asc' ? 'Tarih ↑' :
                  sortBy === 'priority_asc' ? 'Öncelik ↑' :
                  sortBy === 'priority_desc' ? 'Öncelik ↓' : ''
                }
                onClear={() => setSortBy('date_desc')}
              >
                <div className="p-2" style={{ minWidth: 200 }}>
                  {[
                    { value: 'date_desc', label: 'Tarih: Yeniden Eskiye' },
                    { value: 'date_asc',  label: 'Tarih: Eskiden Yeniye' },
                    { value: 'priority_asc',  label: 'Öncelik: Yüksekten Düşüğe' },
                    { value: 'priority_desc', label: 'Öncelik: Düşükten Yükseğe' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      className={`btn btn-sm w-100 text-start mb-1 ${sortBy === opt.value ? 'btn-primary' : 'btn-light'}`}
                      style={{ fontSize: '0.82rem' }}
                      onClick={() => setSortBy(opt.value)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </FilterPill>

              {/* Aktif filtre temizle */}
              {(priorityFilter || monthFilter || sortBy !== 'date_desc' || assigneeFilter) && (
                <button
                  className="btn btn-sm btn-link text-danger p-0 text-decoration-none"
                  style={{ fontSize: '0.8rem' }}
                  onClick={() => { setPriorityFilter(''); setMonthFilter(''); setSortBy('date_desc'); setAssigneeFilter(''); }}
                >
                  Temizle
                </button>
              )}

              {/* Dışa Aktar pill */}
              <FilterPill
                label="Dışa Aktar"
                icon="↗"
                active={false}
                activeLabel=""
                onClear={() => {}}
              >
                <div className="p-2" style={{ minWidth: 180 }}>
                  <button
                    className="btn btn-sm btn-light w-100 text-start mb-1 d-flex align-items-center gap-2"
                    style={{ fontSize: '0.82rem' }}
                    onClick={exportCSV}
                  >
                    <span>📊</span> Excel (CSV) olarak aktar
                  </button>
                  <button
                    className="btn btn-sm btn-light w-100 text-start mb-1 d-flex align-items-center gap-2"
                    style={{ fontSize: '0.82rem' }}
                    onClick={printTable}
                  >
                    <span>🖨️</span> Yazdır / PDF
                  </button>
                </div>
              </FilterPill>

              <button className="btn btn-sm btn-primary d-flex align-items-center gap-1 ms-1" onClick={() => setShowCreateModal(true)}>
                <TbPlus size={14} /> Talep Oluştur
              </button>
            </div>
          </div>
          {filteredBacklog.length === 0 ? (
            <div className="ds-panel__empty">{priorityFilter ? `${PRIORITY_LABELS[priorityFilter]} öncelikli bekleyen talep yok.` : 'Bekleyen talep yok.'}</div>
          ) : (
            <div className="table-responsive">
              <table className="ds-table">
                <thead>
                  <tr>
                    <th>Talep</th>
                    <th>Öncelik</th>
                    <th>Atanan</th>
                    <th>Açılış</th>
                    {activeSprint && <th></th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredBacklog.map((issue) => {
                    const assignee = state.users.find((u) => u.id === issue.assigneeId);
                    const team = !assignee && teams.find((t) => t.id === issue.assigneeTeamId);
                    return (
                      <tr key={issue.id} onClick={() => (issue.isRequest ? setSelectedRequestId(issue.id) : setSelectedIssueId(issue.id))}>
                        <td style={{ maxWidth: 420 }}>
                          <div className="d-flex align-items-center gap-2">
                            <span className="kb-card__key flex-shrink-0">{issue.number}</span>
                            <span className="fw-semibold text-truncate">{issue.title}</span>
                          </div>
                          <div className="d-flex align-items-center gap-2 mt-1">
                            {issue.requestFormName && (
                              <span className="ds-pill" style={{ background: 'var(--navy-soft)', color: 'var(--navy)', padding: '1px 8px' }}>{issue.requestFormName}</span>
                            )}
                            {!issue.isRequest && <span className="ds-pill" style={{ background: '#f1f5f9', color: '#475569', padding: '1px 8px' }}>İç iş</span>}
                            <SlaPill issue={issue} />
                          </div>
                        </td>
                        <td><PriorityIcon priority={issue.priority} showLabel size={13} /></td>
                        <td>
                          {assignee ? (
                            <div className="d-flex align-items-center gap-2"><Avatar name={assignee.name} color={assignee.avatarColor} size={24} /><span className="fw-medium">{assignee.name}</span></div>
                          ) : team ? (
                            <div className="d-flex align-items-center gap-2"><TbUsersGroup size={18} style={{ color: 'var(--navy)' }} /><span className="fw-medium">{team.name}</span></div>
                          ) : <span className="ds-pill" style={{ background: 'var(--orange-soft)', color: 'var(--orange)' }}>Atanmamış</span>}
                        </td>
                        <td className="text-muted" style={{ whiteSpace: 'nowrap' }}><span title={formatDate(issue.createdAt)}>{timeAgo(issue.createdAt)}</span></td>
                        {activeSprint && (
                          <td className="text-end">
                            <button
                              className="btn btn-sm btn-outline-primary"
                              style={{ fontSize: '0.75rem', whiteSpace: 'nowrap', borderRadius: 9, fontWeight: 600 }}
                              onClick={(e) => { e.stopPropagation(); handleAssignToActiveSprint(issue); }}
                              title={`${activeSprint.name} aktif ayına ata`}
                            >
                              + Aktif aya ata
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <IssueModal isOpen={Boolean(selectedIssueId)} onClose={() => setSelectedIssueId(null)} issueId={selectedIssueId} />
      <RequestDetailModal isOpen={Boolean(selectedRequestId)} onClose={() => setSelectedRequestId(null)} requestId={selectedRequestId} />
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Yeni Talep Oluştur" size="lg">
        <IssueForm projectId={projectId} onSuccess={() => setShowCreateModal(false)} onCancel={() => setShowCreateModal(false)} />
      </Modal>

      {/* Aktif aya atama — atanmamış ise kişi seçimi */}
      {assignToSprintModal && (
        <Modal
          isOpen={true}
          onClose={() => { setAssignToSprintModal(null); setPendingTarget(''); }}
          title="Aktif Aya Ata"
        >
          <div>
            <p className="text-muted small mb-3">
              <strong>{assignToSprintModal.number}</strong> — {assignToSprintModal.title}
            </p>
            <p className="small mb-3">
              Bu iş atanmamış. <strong>{activeSprint?.name}</strong> aktif ayına atamadan önce bir kişi ya da ekip seçin.
            </p>
            <div className="mb-4">
              <label className="form-label fw-semibold small">Atanacak Kişi / Ekip <span className="text-danger">*</span></label>
              <select
                className="form-select"
                value={pendingTarget}
                onChange={(e) => setPendingTarget(e.target.value)}
                autoFocus
              >
                <option value="">— Kişi veya ekip seçin —</option>
                <optgroup label="Kişiler">
                  {projectMembers.map((u) => (
                    <option key={u.id} value={`user:${u.id}`}>{u.name}</option>
                  ))}
                </optgroup>
                {teams.length > 0 && (
                  <optgroup label="Ekipler">
                    {teams.map((t) => (
                      <option key={t.id} value={`team:${t.id}`}>{t.name} ({t.memberIds.length} üye)</option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>
            <div className="d-flex gap-2 justify-content-end">
              <button className="btn btn-outline-secondary btn-sm" onClick={() => { setAssignToSprintModal(null); setPendingTarget(''); }}>
                İptal
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={confirmAssignToSprint}
                disabled={!pendingTarget}
              >
                Ata ve Aktif Aya Ekle
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Yeni ay ekle */}
      <Modal
        isOpen={showAddMonthModal}
        onClose={() => setShowAddMonthModal(false)}
        title="Yeni Aylık Dönem Ekle"
      >
        <SprintForm
          projectId={projectId}
          onSuccess={(created) => { setShowAddMonthModal(false); if (created?.id) setSelectedSprintId(created.id); }}
          onCancel={() => setShowAddMonthModal(false)}
        />
      </Modal>
    </div>
  );
}

export default ProjectDetailPage;

/* ── FilterPill — modern dropdown pill butonu ────────────────────────────────── */
function FilterPill({ label, icon, active, activeLabel, onClear, children }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="position-relative" style={{ display: 'inline-block' }}>
      <button
        type="button"
        className={`ds-filter ${active ? 'ds-filter--on' : ''}`}
        onClick={() => setOpen((v) => !v)}
      >
        <span>{icon}</span>
        <span>{active && activeLabel ? activeLabel : label}</span>
        {active && (
          <span
            role="button"
            style={{ marginLeft: 4, fontWeight: 700, fontSize: '0.9rem', lineHeight: 1 }}
            onClick={(e) => { e.stopPropagation(); onClear(); setOpen(false); }}
            title="Filtreyi temizle"
          >
            ×
          </span>
        )}
        {!active && <span style={{ fontSize: '0.65rem', marginLeft: 2 }}>▾</span>}
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            className="position-fixed top-0 start-0 w-100 h-100"
            style={{ zIndex: 1040 }}
            onClick={() => setOpen(false)}
          />
          {/* Dropdown */}
          <div className="ds-menu" onClick={() => setOpen(false)}>
            {children}
          </div>
        </>
      )}
    </div>
  );
}
