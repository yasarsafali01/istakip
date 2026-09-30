import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link, Navigate } from 'react-router-dom';
import { TbLock, TbPlus, TbUsers, TbAlertCircle, TbFlag, TbTrash, TbTemplate } from 'react-icons/tb';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../hooks/useAuth';
import { canAccessProject } from '../utils/permissionUtils';
import { formatDate, timeAgo } from '../utils/dateUtils';
import Board from '../components/board/Board';
import Avatar from '../components/common/Avatar';
import PriorityIcon from '../components/common/PriorityIcon';
import Badge from '../components/common/Badge';
import IssueModal from '../components/issue/IssueModal';
import RequestDetailModal from '../components/request/RequestDetailModal';
import Modal from '../components/common/Modal';
import IssueForm from '../components/issue/IssueForm';
import EmptyState from '../components/common/EmptyState';
import HelpGuide from '../components/common/HelpGuide';
import { PRIORITIES, PRIORITY_LABELS, ROLES, ACTIONS } from '../constants';
import { issuesApi, teamsApi, templatesApi, sprintsApi } from '../api/resources';
import { buildUnitCodeByProjectId, mapIssue } from '../api/mappers';
import { usePermissions } from '../hooks/usePermissions';
import { sortSprintsByCurrentMonth, getMissingSprintMonths, getSprintName } from '../utils/sprintUtils';
import SprintForm from '../components/sprint/SprintForm';

const MONTH_NAMES = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

const PRIORITY_BG = {
  Highest: { light: '#FFF0F0', dark: '#DE350B' },
  High:    { light: '#FFF4E5', dark: '#FF7700' },
  Medium:  { light: '#FFFAE5', dark: '#D4A000' },
  Low:     { light: '#EAF2FF', dark: '#2684FF' },
  Lowest:  { light: '#E6FBF4', dark: '#00875A' },
};

/* ── Ana sayfa ───────────────────────────────────────────────────────────────── */
function ProjectDetailPage() {
  const { projectId } = useParams();
  const [searchParams] = useSearchParams();
  const { state } = useAppContext();
  const { currentUser } = useAuth();

  const tabParam = searchParams.get('tab');
  const tab = tabParam === 'backlog' ? 'backlog' : tabParam === 'team' ? 'team' : 'board';
  const [boardSprintId, setBoardSprintId] = useState('active');

  const project = state.projects.find((p) => p.id === projectId);

  if (!project) {
    return (
      <EmptyState
        title="Proje bulunamadı"
        description="Bu proje mevcut değil veya silinmiş olabilir."
        action={<Link to="/dashboard" className="btn btn-primary">Dashboard'a Dön</Link>}
      />
    );
  }

  if (!canAccessProject(project, currentUser)) {
    return <Navigate to="/dashboard" replace />;
  }

  const allSprints = sortSprintsByCurrentMonth(state.sprints.filter((s) => s.projectId === projectId));

  const activeSprint = allSprints.find((s) => s.status === 'Active');
  const pageTitle = tab === 'board' ? 'Aktif İşler' : tab === 'team' ? 'Ekip & Şablonlar' : 'Backlog';

  return (
    <div>
      <div className="mb-4">
        <div className="d-flex align-items-center gap-2 mb-1">
          <span className="badge" style={{ backgroundColor: '#2563eb', color: '#fff', fontSize: '0.75rem' }}>
            {project.key}
          </span>
          <h4 className="fw-bold mb-0">{project.name}</h4>
          <span className="text-muted small">/ {pageTitle}</span>
          <HelpGuide
            title={`${pageTitle} — Yardım Kılavuzu`}
            sections={
              currentUser?.role === ROLES.PROJECT_MANAGER ? [
                { icon: '📊', title: 'İstatistikler', items: ['Sayfanın üstünde toplam, yapılacak, devam eden ve tamamlanan iş sayılarını görürsünüz.'] },
                { icon: '📌', title: 'Board Görünümü', items: ['İşleri sütunlar arasında sürükleyerek durumlarını güncelleyebilirsiniz.', 'Ay seçici ile farklı dönemlerin board\'unu görüntüleyebilirsiniz.'] },
                { icon: '📋', title: 'Backlog', items: ['Bekleyen işleri öncelik, atanan kişi ve tarihe göre filtreleyebilirsiniz.', 'İşleri aktif aya atayabilirsiniz.', 'CSV dışa aktarma ve yazdırma özelliklerini kullanabilirsiniz.'] },
                { icon: '➕', title: 'Issue Oluşturma', items: ['Backlog görünümünde "Issue Oluştur" butonuyla yeni iş ekleyebilirsiniz.'] },
              ] : currentUser?.role === ROLES.WORKER ? [
                { icon: '📊', title: 'İstatistikler', items: ['Projedeki toplam, yapılacak, devam eden ve tamamlanan iş sayılarını görürsünüz.'] },
                { icon: '📌', title: 'Board Görünümü', items: ['Size atanan işleri sütunlar arasında sürükleyerek durumlarını güncelleyebilirsiniz.', 'Ay seçici ile farklı dönemleri görüntüleyebilirsiniz.'] },
                { icon: '📋', title: 'Backlog', items: ['Bekleyen işleri görüntüleyebilirsiniz.'] },
              ] : [
                { icon: '📊', title: 'İstatistikler', items: ['Projedeki toplam, yapılacak, devam eden ve tamamlanan iş sayılarını görürsünüz.'] },
                { icon: '📌', title: 'Board Görünümü', items: ['Projenin aktif dönemindeki işleri görüntüleyebilirsiniz.'] },
                { icon: '📋', title: 'Backlog', items: ['Bekleyen işleri görüntüleyebilirsiniz.'] },
              ]
            }
          />
        </div>
        {project.description && <p className="text-muted small mb-0">{project.description}</p>}
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

      {tab === 'backlog' && (
        <BacklogTabView projectId={projectId} allSprints={allSprints} />
      )}

      {tab === 'team' && <TeamTabView projectId={projectId} />}
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
  const inProgCount   = sprintIssues.filter(i => i.status === 'In Progress' || i.status === 'In Review').length;
  const doneCount     = sprintIssues.filter(i => i.status === 'Done').length;

  return (
    <div>
      {/* İstatistik kartları */}
      <div className="row g-3 mb-4">
        <div className="col-6 col-lg-3">
          <div className="card border-0 shadow-sm h-100"
            style={{ borderLeft: '4px solid #2563eb', background: 'linear-gradient(135deg, #EAF0FB 0%, #ffffff 100%)' }}>
            <div className="card-body py-3 px-4">
              <div className="d-flex align-items-center justify-content-between mb-2">
                <span className="fw-semibold text-muted" style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Toplam İş</span>
                <div className="d-flex align-items-center justify-content-center rounded-circle"
                  style={{ width: 36, height: 36, background: '#EAF0FB', flexShrink: 0 }}>
                  <span style={{ color: '#2563eb', fontSize: 18 }}>📋</span>
                </div>
              </div>
              <div className="fw-bold" style={{ fontSize: '2rem', lineHeight: 1, color: '#2563eb' }}>{totalCount}</div>
            </div>
          </div>
        </div>
        <div className="col-6 col-lg-3">
          <div className="card border-0 shadow-sm h-100"
            style={{ borderLeft: '4px solid #DFE1E6', background: 'linear-gradient(135deg, #F4F5F7 0%, #ffffff 100%)' }}>
            <div className="card-body py-3 px-4">
              <div className="d-flex align-items-center justify-content-between mb-2">
                <span className="fw-semibold text-muted" style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Yapılacak</span>
                <div className="d-flex align-items-center justify-content-center rounded-circle"
                  style={{ width: 36, height: 36, background: '#F4F5F7', flexShrink: 0 }}>
                  <span style={{ color: '#6B778C', fontSize: 18 }}>⏳</span>
                </div>
              </div>
              <div className="fw-bold" style={{ fontSize: '2rem', lineHeight: 1, color: '#6B778C' }}>{todoCount}</div>
            </div>
          </div>
        </div>
        <div className="col-6 col-lg-3">
          <div className="card border-0 shadow-sm h-100"
            style={{ borderLeft: '4px solid #FF991F', background: 'linear-gradient(135deg, #FFF4E5 0%, #ffffff 100%)' }}>
            <div className="card-body py-3 px-4">
              <div className="d-flex align-items-center justify-content-between mb-2">
                <span className="fw-semibold text-muted" style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Devam Eden</span>
                <div className="d-flex align-items-center justify-content-center rounded-circle"
                  style={{ width: 36, height: 36, background: '#FFF4E5', flexShrink: 0 }}>
                  <span style={{ color: '#FF991F', fontSize: 18 }}>⚙️</span>
                </div>
              </div>
              <div className="fw-bold" style={{ fontSize: '2rem', lineHeight: 1, color: '#FF991F' }}>{inProgCount}</div>
            </div>
          </div>
        </div>
        <div className="col-6 col-lg-3">
          <div className="card border-0 shadow-sm h-100"
            style={{ borderLeft: '4px solid #00875A', background: 'linear-gradient(135deg, #E3FCEF 0%, #ffffff 100%)' }}>
            <div className="card-body py-3 px-4">
              <div className="d-flex align-items-center justify-content-between mb-2">
                <span className="fw-semibold text-muted" style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tamamlanan</span>
                <div className="d-flex align-items-center justify-content-center rounded-circle"
                  style={{ width: 36, height: 36, background: '#E3FCEF', flexShrink: 0 }}>
                  <span style={{ color: '#00875A', fontSize: 18 }}>✅</span>
                </div>
              </div>
              <div className="fw-bold" style={{ fontSize: '2rem', lineHeight: 1, color: '#00875A' }}>{doneCount}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Ay seçici */}
      <div className="d-flex align-items-center gap-2 mb-3 flex-wrap">
        <label htmlFor="board-sprint-select" className="form-label mb-0 small fw-semibold">Ay:</label>
        <select
          id="board-sprint-select"
          className="form-select form-select-sm"
          value={boardSprintId}
          onChange={(e) => setBoardSprintId(e.target.value)}
          style={{ minWidth: 180 }}
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
          <span className="badge d-flex align-items-center gap-1"
            style={{ background: '#DEEBFF', color: '#0747A6', fontSize: '0.75rem', padding: '5px 10px' }}>
            <TbLock size={13} /> Kapalı Ay — Salt Okunur
          </span>
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
  const [pendingAssigneeId, setPendingAssigneeId] = useState('');
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
    if (!issue.assigneeId) {
      // Atanmamış — önce kişi seçimi modalı aç
      setPendingAssigneeId('');
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
    if (!pendingAssigneeId) return;
    try {
      // Önce kişiyi ata
      await issuesApi.updateAssignee(assignToSprintModal.id, pendingAssigneeId);
      // Sonra sprinte ata
      const updated = await issuesApi.moveSprint(assignToSprintModal.id, activeSprint.id);
      const unitCodeByProjectId = buildUnitCodeByProjectId(state.projects, state.units);
      dispatch({ type: ACTIONS.UPDATE_ISSUE, payload: mapIssue(updated, unitCodeByProjectId) });
    } catch (err) {
      window.alert(err.message);
    } finally {
      setAssignToSprintModal(null);
      setPendingAssigneeId('');
    }
  }

  // Backlog'daki benzersiz aylar (açılış tarihine göre)
  const backlogMonths = [...new Set(
    backlogIssues
      .filter((i) => i.createdAt)
      .map((i) => i.createdAt.substring(0, 7)) // "YYYY-MM"
  )].sort((a, b) => b.localeCompare(a));

  // Filtre + sıralama uygula
  const PRIORITY_ORDER = { Highest: 0, High: 1, Medium: 2, Low: 3, Lowest: 4 };
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
  const projectMembers = state.users.filter(
    (u) => u.role !== ROLES.EXTERNAL_USER && (u.projectId === projectId || project?.managerId === u.id)
  );

  // Öncelik sayıları — sadece backlog bekleyenler
  const priorityCounts = PRIORITIES.reduce((acc, p) => {
    acc[p] = backlogIssues.filter((i) => i.priority === p).length;
    return acc;
  }, {});

  // Seçili sprint
  const selectedSprint = allSprints.find((s) => s.id === selectedSprintId);
  const sprintIssues = selectedSprint
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

  const sprintLabel = (s) => s ? (s.name || (s.month ? `${MONTH_NAMES[s.month - 1]} ${s.year}` : s.id)) : '';
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
    a.download = `bekleyen-isler-${new Date().toISOString().substring(0, 10)}.csv`;
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
      <title>Bekleyen İşler — ${project?.name || ''}</title>
      <style>body{font-family:sans-serif;font-size:12px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:6px 8px;text-align:left}th{background:#f4f5f7;font-weight:600}</style>
    </head><body>
      <h2>${project?.name || ''} — Bekleyen İşler</h2>
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
      {/* ── Satır 1: Çalışan (col-2) | Aylık Dönem (col-3) | Personel (col-7) */}
      <div className="row g-3 mb-4 align-items-stretch">

        {/* Toplam Çalışan */}
        <div className="col-12 col-md-2">
          <div className="card border-0 shadow-sm h-100" style={{ borderLeft: '4px solid #2563eb' }}>
            <div className="card-body d-flex flex-column align-items-center justify-content-center py-3 text-center">
              <TbUsers size={28} className="text-primary mb-2 opacity-75" />
              <div className="fw-bold fs-2 lh-1">{projectMembers.length}</div>
              <div className="text-muted small mt-1">Toplam Çalışan</div>
            </div>
          </div>
        </div>

        {/* Aylık Dönem Seçimi */}
        <div className="col-12 col-md-3">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body py-3">
              <div className="d-flex align-items-center justify-content-between mb-2">
                <div className="text-muted fw-semibold" style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Aylık Dönem
                </div>
                {can('sprint.manage') && (
                  <button
                    type="button"
                    className="btn btn-sm btn-link p-0"
                    style={{ fontSize: '0.72rem' }}
                    onClick={() => setShowAddMonthModal(true)}
                    title="Yeni ay ekle"
                  >
                    <TbPlus size={13} /> Ay Ekle
                  </button>
                )}
              </div>
              <select
                className="form-select form-select-sm mb-2"
                value={selectedSprintId}
                onChange={(e) => setSelectedSprintId(e.target.value)}
              >
                <option value="">— Ay seçin —</option>
                {allSprints.map((s) => (
                  <option key={s.id} value={s.id}>
                    {sprintLabel(s)}{s.status === 'Active' ? ' ✓' : s.status === 'Completed' ? ' 🔒' : ''}
                  </option>
                ))}
              </select>
              {can('sprint.manage') && missingMonths.length > 0 && (
                <button
                  type="button"
                  className="btn btn-sm btn-outline-warning w-100 d-flex align-items-center justify-content-center gap-1 mb-3"
                  style={{ fontSize: '0.72rem' }}
                  onClick={handleCreateMissingMonths}
                  disabled={creatingMissingMonths}
                  title={`Eksik aylar: ${missingMonths.map((m) => getSprintName(m.year, m.month)).join(', ')}`}
                >
                  {creatingMissingMonths
                    ? 'Oluşturuluyor…'
                    : `${missingMonths.length} ay eksik — tümünü oluştur`}
                </button>
              )}
              {selectedSprint && (() => {
                const badge = sprintBadge(selectedSprint);
                return (
                  <div>
                    <div className="d-flex align-items-center gap-2 mb-2">
                      <span className="fw-semibold small">{sprintLabel(selectedSprint)}</span>
                      <span className="badge" style={{ backgroundColor: badge.bg, color: badge.color, fontSize: '0.6rem' }}>{badge.label}</span>
                    </div>
                    <div className="d-flex gap-3">
                      <div className="text-center">
                        <div className="fw-bold fs-5 text-primary">{sprintIssues.length}</div>
                        <div className="text-muted" style={{ fontSize: '0.7rem' }}>Toplam</div>
                      </div>
                      <div className="text-center">
                        <div className="fw-bold fs-5 text-success">{sprintDone}</div>
                        <div className="text-muted" style={{ fontSize: '0.7rem' }}>Tamamlanan</div>
                      </div>
                      <div className="text-center">
                        <div className="fw-bold fs-5 text-warning">{sprintIssues.length - sprintDone}</div>
                        <div className="text-muted" style={{ fontSize: '0.7rem' }}>Devam Eden</div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>

        {/* Seçili aya ait personel */}
        <div className="col-12 col-md-7">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body py-3">
              {!selectedSprint ? (
                <div className="text-muted small d-flex align-items-center justify-content-center h-100">
                  Personel bilgisi için bir ay seçin.
                </div>
              ) : sprintMembers.length === 0 ? (
                <div className="text-muted small">Bu ayda atanmış iş yok.</div>
              ) : (
                <>
                  <div className="text-muted fw-semibold mb-3" style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {sprintLabel(selectedSprint)} — Personel & İşler
                  </div>
                  <div className="row g-2">
                    {sprintMembers.map(({ user, issues, done }) => (
                      <div key={user.id} className="col-12 col-sm-6">
                        <div className="d-flex align-items-start gap-2 p-2 rounded" style={{ background: '#F4F5F7' }}>
                          <Avatar name={user.name} color={user.avatarColor} size={32} />
                          <div style={{ minWidth: 0 }}>
                            <div className="fw-medium small text-truncate">{user.name}</div>
                            <div className="d-flex gap-2 mt-1">
                              <span className="badge bg-primary bg-opacity-10 text-primary" style={{ fontSize: '0.65rem' }}>{issues.length} iş</span>
                              <span className="badge bg-success bg-opacity-10 text-success" style={{ fontSize: '0.65rem' }}>{done} tamamlandı</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Satır 2: Öncelik kartları (backlog bekleyenler) ───────────────── */}
      <div className="row g-3 mb-4">
        <div className="col-6 col-md-2">
          <div className="card border-0 shadow-sm h-100" style={{ borderLeft: '4px solid #6B778C' }}>
            <div className="card-body py-3 px-3">
              <div className="d-flex align-items-center gap-1 mb-1">
                <TbAlertCircle size={14} className="text-secondary" />
                <span className="text-muted" style={{ fontSize: '0.72rem', fontWeight: 600 }}>Bekleyen</span>
              </div>
              <div className="fw-bold fs-4">{backlogIssues.length}</div>
            </div>
          </div>
        </div>
        {PRIORITIES.map((p) => {
          const bg = PRIORITY_BG[p];
          const isActive = priorityFilter === p;
          return (
            <div key={p} className="col-6 col-md-2">
              <div
                className="card border-0 shadow-sm h-100"
                style={{ background: isActive ? bg.dark : bg.light, borderLeft: `4px solid ${bg.dark}`, cursor: 'pointer', transition: 'background 0.15s' }}
                onClick={() => setPriorityFilter(isActive ? '' : p)}
                title={`${PRIORITY_LABELS[p]} öncelikli bekleyen işleri filtrele`}
              >
                <div className="card-body py-3 px-3">
                  <div className="d-flex align-items-center gap-1 mb-1">
                    <TbFlag size={13} style={{ color: isActive ? '#fff' : bg.dark }} />
                    <span style={{ fontSize: '0.72rem', fontWeight: 600, color: isActive ? '#fff' : bg.dark }}>{PRIORITY_LABELS[p]}</span>
                  </div>
                  <div className="fw-bold fs-4" style={{ color: isActive ? '#fff' : bg.dark }}>{priorityCounts[p]}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Satır 3: Bekleyen işler tablosu ──────────────────────────────── */}
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-body">
          {/* Modern filtre çubuğu */}
          <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
            <h6 className="fw-semibold mb-0">
              Bekleyen İşler <span className="text-muted fw-normal small ms-1">({filteredBacklog.length})</span>
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
                <TbPlus size={14} /> Issue Oluştur
              </button>
            </div>
          </div>
          {filteredBacklog.length === 0 ? (
            <p className="text-muted small mb-0">{priorityFilter ? `${PRIORITY_LABELS[priorityFilter]} öncelikli bekleyen iş yok.` : 'Bekleyen iş yok.'}</p>
          ) : (
            <div className="table-responsive">
              <table className="table table-sm table-hover mb-0" style={{ fontSize: '0.85rem' }}>
                <thead>
                  <tr className="text-muted" style={{ fontSize: '0.75rem' }}>
                    <th className="fw-semibold border-0 ps-0">Başlık</th>
                    <th className="fw-semibold border-0">Öncelik</th>
                    <th className="fw-semibold border-0">Atanan</th>
                    <th className="fw-semibold border-0">Açılış Tarihi</th>
                    {activeSprint && <th className="fw-semibold border-0"></th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredBacklog.map((issue) => {
                    const assignee = state.users.find((u) => u.id === issue.assigneeId);
                    return (
                      <tr key={issue.id}>
                        <td className="ps-0 align-middle">
                          <button className="btn btn-link p-0 text-start text-decoration-none" style={{ fontSize: '0.85rem' }} onClick={() => issue.isRequest ? setSelectedRequestId(issue.id) : setSelectedIssueId(issue.id)}>
                            <span className="text-muted me-1" style={{ fontSize: '0.72rem' }}>{issue.number}</span>
                            <span className="fw-medium">{issue.title}</span>
                            {issue.isRequest && <span className="ms-2 badge" style={{ backgroundColor: '#6f42c1', color: '#fff', fontSize: '0.65rem' }}>Talep</span>}
                          </button>
                        </td>
                        <td className="align-middle"><PriorityIcon priority={issue.priority} showLabel size={13} /></td>
                        <td className="align-middle">
                          {assignee ? (
                            <div className="d-flex align-items-center gap-2"><Avatar name={assignee.name} color={assignee.avatarColor} size={22} /><span>{assignee.name}</span></div>
                          ) : <span className="text-muted fst-italic">Atanmamış</span>}
                        </td>
                        <td className="align-middle text-muted"><span title={formatDate(issue.createdAt)}>{timeAgo(issue.createdAt)}</span></td>
                        {activeSprint && (
                          <td className="align-middle text-end">
                            <button
                              className="btn btn-sm btn-outline-primary"
                              style={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}
                              onClick={() => handleAssignToActiveSprint(issue)}
                              title={`${activeSprint.name} aktif ayına ata`}
                            >
                              + Aktif Aya Ata
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

      {/* ── Satır 4: Tamamlanmış Aylar ───────────────────────────────────── */}
      {allSprints.filter((s) => s.status === 'Completed').length > 0 && (
        <CompletedSprintsSection
          projectId={projectId}
          completedSprints={allSprints.filter((s) => s.status === 'Completed')}
          state={state}
          onIssueClick={setSelectedIssueId}
        />
      )}

      <IssueModal isOpen={Boolean(selectedIssueId)} onClose={() => setSelectedIssueId(null)} issueId={selectedIssueId} />
      <RequestDetailModal isOpen={Boolean(selectedRequestId)} onClose={() => setSelectedRequestId(null)} requestId={selectedRequestId} />
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Yeni Issue Oluştur" size="lg">
        <IssueForm projectId={projectId} onSuccess={() => setShowCreateModal(false)} onCancel={() => setShowCreateModal(false)} />
      </Modal>

      {/* Aktif aya atama — atanmamış ise kişi seçimi */}
      {assignToSprintModal && (
        <Modal
          isOpen={true}
          onClose={() => { setAssignToSprintModal(null); setPendingAssigneeId(''); }}
          title="Aktif Aya Ata"
        >
          <div>
            <p className="text-muted small mb-3">
              <strong>{assignToSprintModal.number}</strong> — {assignToSprintModal.title}
            </p>
            <p className="small mb-3">
              Bu iş atanmamış. <strong>{activeSprint?.name}</strong> aktif ayına atamadan önce bir kişi seçin.
            </p>
            <div className="mb-4">
              <label className="form-label fw-semibold small">Atanacak Kişi <span className="text-danger">*</span></label>
              <select
                className="form-select"
                value={pendingAssigneeId}
                onChange={(e) => setPendingAssigneeId(e.target.value)}
                autoFocus
              >
                <option value="">— Kişi seçin —</option>
                {state.users
                  .filter((u) => u.role !== ROLES.EXTERNAL_USER && (u.projectId === projectId || state.projects.find((p) => p.id === projectId)?.managerId === u.id))
                  .map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))
                }
              </select>
            </div>
            <div className="d-flex gap-2 justify-content-end">
              <button className="btn btn-outline-secondary btn-sm" onClick={() => { setAssignToSprintModal(null); setPendingAssigneeId(''); }}>
                İptal
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={confirmAssignToSprint}
                disabled={!pendingAssigneeId}
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

/* ── Tamamlanmış Aylar ───────────────────────────────────────────────────────── */
function CompletedSprintsSection({ projectId, completedSprints, state, onIssueClick }) {
  const [selectedId, setSelectedId] = useState(null);
  const sprintIssues = selectedId
    ? state.issues.filter((i) => i.projectId === projectId && i.sprintId === selectedId)
    : [];

  return (
    <div className="card border-0 shadow-sm">
      <div className="card-body">
        <h6 className="fw-semibold mb-3">Tamamlanmış Aylar</h6>
        <div className="row g-3">
          <div className="col-12 col-md-4">
            <ul className="list-unstyled mb-0">
              {completedSprints.map((sprint) => {
                const label = sprint.name || (sprint.month ? `${MONTH_NAMES[sprint.month - 1]} ${sprint.year}` : sprint.id);
                const total = state.issues.filter((i) => i.sprintId === sprint.id).length;
                const done = state.issues.filter((i) => i.sprintId === sprint.id && i.status === 'Done').length;
                const isSel = selectedId === sprint.id;
                return (
                  <li key={sprint.id}>
                    <button
                      className={`btn w-100 text-start d-flex align-items-center justify-content-between px-3 py-2 mb-1 rounded ${isSel ? 'btn-primary' : 'btn-outline-secondary'}`}
                      style={{ fontSize: '0.83rem' }}
                      onClick={() => setSelectedId(isSel ? null : sprint.id)}
                    >
                      <span className="d-flex align-items-center gap-2"><TbLock size={13} />{label}</span>
                      <span className={`badge ${isSel ? 'bg-white text-primary' : 'bg-secondary'}`} style={{ fontSize: '0.65rem' }}>{done}/{total}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="col-12 col-md-8">
            {!selectedId ? (
              <div className="text-muted small d-flex align-items-center justify-content-center h-100 py-4">Detayları görmek için bir ay seçin.</div>
            ) : sprintIssues.length === 0 ? (
              <p className="text-muted small">Bu ayda issue yok.</p>
            ) : (
              <div className="table-responsive">
                <table className="table table-sm table-hover mb-0" style={{ fontSize: '0.85rem' }}>
                  <thead>
                    <tr className="text-muted" style={{ fontSize: '0.75rem' }}>
                      <th className="fw-semibold border-0 ps-0">Başlık</th>
                      <th className="fw-semibold border-0">Durum</th>
                      <th className="fw-semibold border-0">Öncelik</th>
                      <th className="fw-semibold border-0">Atanan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sprintIssues.map((issue) => {
                      const assignee = state.users.find((u) => u.id === issue.assigneeId);
                      return (
                        <tr key={issue.id}>
                          <td className="ps-0 align-middle">
                            <button className="btn btn-link p-0 text-start text-decoration-none" style={{ fontSize: '0.85rem' }} onClick={() => onIssueClick(issue.id)}>
                              <span className="text-muted me-1" style={{ fontSize: '0.72rem' }}>{issue.number}</span>
                              <span className="fw-medium">{issue.title}</span>
                            </button>
                          </td>
                          <td className="align-middle"><Badge label={issue.status} type="status" /></td>
                          <td className="align-middle"><PriorityIcon priority={issue.priority} showLabel size={13} /></td>
                          <td className="align-middle">
                            {assignee ? (
                              <div className="d-flex align-items-center gap-2"><Avatar name={assignee.name} color={assignee.avatarColor} size={22} /><span>{assignee.name}</span></div>
                            ) : <span className="text-muted fst-italic">—</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
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
        className="btn btn-sm d-flex align-items-center gap-1"
        style={{
          border: active ? '1.5px solid #2563eb' : '1.5px solid #DFE1E6',
          borderRadius: 20,
          padding: '4px 12px',
          fontSize: '0.82rem',
          fontWeight: active ? 600 : 400,
          background: active ? '#EAF2FF' : '#fff',
          color: active ? '#2563eb' : '#42526E',
          whiteSpace: 'nowrap',
        }}
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
          <div
            className="position-absolute bg-white rounded shadow"
            style={{ zIndex: 1050, top: '110%', right: 0, minWidth: 160, border: '1px solid #DFE1E6' }}
            onClick={() => setOpen(false)}
          >
            {children}
          </div>
        </>
      )}
    </div>
  );
}

/* ── Ekip & Şablonlar sekmesi ────────────────────────────────────────────────── */
function TeamTabView({ projectId }) {
  const { state } = useAppContext();
  const { can } = usePermissions();
  const [teams, setTeams] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newTeamName, setNewTeamName] = useState('');
  const [newMemberByTeam, setNewMemberByTeam] = useState({});
  const [tmplForm, setTmplForm] = useState({ title: '', body: '' });

  const canManageTeams = can('team.manage');
  const canManageTemplates = can('template.manage');

  const projectUsers = state.users.filter((u) => u.role !== ROLES.EXTERNAL_USER);

  function load() {
    setLoading(true);
    Promise.all([teamsApi.listByProject(projectId), templatesApi.listByProject(projectId, true)])
      .then(([t, tmpl]) => { setTeams(t); setTemplates(tmpl); })
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function createTeam(e) {
    e.preventDefault();
    if (!newTeamName.trim()) return;
    await teamsApi.create(projectId, newTeamName.trim());
    setNewTeamName('');
    load();
  }
  async function deleteTeam(id) {
    if (!window.confirm('Bu ekibi silmek istediğinizden emin misiniz?')) return;
    await teamsApi.delete(id);
    load();
  }
  async function addMember(teamId) {
    const userId = newMemberByTeam[teamId];
    if (!userId) return;
    await teamsApi.addMember(teamId, userId);
    setNewMemberByTeam((s) => ({ ...s, [teamId]: '' }));
    load();
  }
  async function removeMember(teamId, userId) {
    await teamsApi.removeMember(teamId, userId);
    load();
  }

  async function createTemplate(e) {
    e.preventDefault();
    if (!tmplForm.title.trim() || !tmplForm.body.trim()) return;
    await templatesApi.create(projectId, { title: tmplForm.title.trim(), body: tmplForm.body.trim() });
    setTmplForm({ title: '', body: '' });
    load();
  }
  async function toggleTemplateActive(t) {
    await templatesApi.update(t.id, { title: t.title, body: t.body, sortOrder: t.sortOrder, isActive: !t.isActive });
    load();
  }
  async function deleteTemplate(id) {
    if (!window.confirm('Bu şablonu silmek istediğinizden emin misiniz?')) return;
    await templatesApi.delete(id);
    load();
  }

  if (loading) return <div className="text-center py-5"><span className="spinner-border text-primary" /></div>;

  return (
    <div className="row g-4">
      {/* Ekipler */}
      <div className="col-lg-6">
        <div className="card border-0 shadow-sm">
          <div className="card-body">
            <h6 className="fw-semibold d-flex align-items-center gap-2 mb-3">
              <TbUsers size={16} /> Ekipler
            </h6>
            <p className="text-muted small">Konulara/işlere tek tek kişi yerine bir ekip atayabilirsiniz.</p>

            {canManageTeams && (
              <form className="d-flex gap-2 mb-3" onSubmit={createTeam}>
                <input className="form-control form-control-sm" placeholder="Yeni ekip adı" value={newTeamName} onChange={(e) => setNewTeamName(e.target.value)} />
                <button className="btn btn-primary btn-sm d-flex align-items-center gap-1 flex-shrink-0" type="submit">
                  <TbPlus size={14} /> Ekle
                </button>
              </form>
            )}

            {teams.length === 0 ? (
              <p className="text-muted small fst-italic">Henüz ekip oluşturulmadı.</p>
            ) : (
              teams.map((t) => (
                <div key={t.id} className="border rounded-3 p-2 mb-2">
                  <div className="d-flex align-items-center justify-content-between mb-2">
                    <span className="fw-medium small">{t.name}</span>
                    {canManageTeams && (
                      <button className="btn btn-sm btn-link text-danger p-0" onClick={() => deleteTeam(t.id)} title="Ekibi sil">
                        <TbTrash size={14} />
                      </button>
                    )}
                  </div>
                  <div className="d-flex flex-wrap gap-1 mb-2">
                    {t.memberIds.length === 0 && <span className="text-muted" style={{ fontSize: 12 }}>Üye yok</span>}
                    {t.memberIds.map((uid) => {
                      const u = state.users.find((x) => x.id === uid);
                      return (
                        <span key={uid} className="badge text-bg-light border d-flex align-items-center gap-1" style={{ fontSize: 11 }}>
                          {u?.name || uid}
                          {canManageTeams && (
                            <span role="button" onClick={() => removeMember(t.id, uid)} style={{ cursor: 'pointer' }}>×</span>
                          )}
                        </span>
                      );
                    })}
                  </div>
                  {canManageTeams && (
                    <div className="d-flex gap-1">
                      <select
                        className="form-select form-select-sm"
                        value={newMemberByTeam[t.id] || ''}
                        onChange={(e) => setNewMemberByTeam((s) => ({ ...s, [t.id]: e.target.value }))}
                      >
                        <option value="">— Üye ekle —</option>
                        {projectUsers.filter((u) => !t.memberIds.includes(u.id)).map((u) => (
                          <option key={u.id} value={u.id}>{u.name}</option>
                        ))}
                      </select>
                      <button className="btn btn-sm btn-outline-secondary flex-shrink-0" onClick={() => addMember(t.id)}>Ekle</button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Cevap Şablonları */}
      <div className="col-lg-6">
        <div className="card border-0 shadow-sm">
          <div className="card-body">
            <h6 className="fw-semibold d-flex align-items-center gap-2 mb-3">
              <TbTemplate size={16} /> Cevap Şablonları
            </h6>
            <p className="text-muted small">
              Yorum kutusuna eklenebilecek hazır yanıtlar. Yer tutucular: <code>{'{TalepNo}'}</code>, <code>{'{TalepEdenAdı}'}</code>, <code>{'{ProjeAdı}'}</code>, <code>{'{BenimAdım}'}</code>.
            </p>

            {canManageTemplates && (
              <form className="mb-3" onSubmit={createTemplate}>
                <input
                  className="form-control form-control-sm mb-2"
                  placeholder="Şablon başlığı"
                  value={tmplForm.title}
                  onChange={(e) => setTmplForm((s) => ({ ...s, title: e.target.value }))}
                />
                <textarea
                  className="form-control form-control-sm mb-2"
                  rows={2}
                  placeholder="Şablon metni"
                  value={tmplForm.body}
                  onChange={(e) => setTmplForm((s) => ({ ...s, body: e.target.value }))}
                />
                <button className="btn btn-primary btn-sm d-flex align-items-center gap-1" type="submit">
                  <TbPlus size={14} /> Şablon Ekle
                </button>
              </form>
            )}

            {templates.length === 0 ? (
              <p className="text-muted small fst-italic">Henüz şablon eklenmedi.</p>
            ) : (
              templates.map((t) => (
                <div key={t.id} className="border rounded-3 p-2 mb-2" style={{ opacity: t.isActive ? 1 : 0.55 }}>
                  <div className="d-flex align-items-center justify-content-between">
                    <span className="fw-medium small">{t.title}</span>
                    {canManageTemplates && (
                      <div className="d-flex gap-2">
                        <button className="btn btn-sm btn-link p-0" style={{ fontSize: 11 }} onClick={() => toggleTemplateActive(t)}>
                          {t.isActive ? 'Pasifleştir' : 'Aktifleştir'}
                        </button>
                        <button className="btn btn-sm btn-link text-danger p-0" onClick={() => deleteTemplate(t.id)}>
                          <TbTrash size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                  <p className="text-muted mb-0" style={{ fontSize: 12, whiteSpace: 'pre-wrap' }}>{t.body}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
