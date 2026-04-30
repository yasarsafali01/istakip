import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link, Navigate } from 'react-router-dom';
import { TbLock, TbPlus, TbUsers, TbAlertCircle, TbFlag } from 'react-icons/tb';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../hooks/useAuth';
import { canAccessProject } from '../utils/permissionUtils';
import { formatDate, timeAgo } from '../utils/dateUtils';
import Board from '../components/board/Board';
import Avatar from '../components/common/Avatar';
import PriorityIcon from '../components/common/PriorityIcon';
import Badge from '../components/common/Badge';
import IssueModal from '../components/issue/IssueModal';
import Modal from '../components/common/Modal';
import IssueForm from '../components/issue/IssueForm';
import EmptyState from '../components/common/EmptyState';
import { PRIORITIES, ROLES } from '../constants';

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

  const tab = searchParams.get('tab') === 'backlog' ? 'backlog' : 'board';
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

  const allSprints = state.sprints
    .filter((s) => s.projectId === projectId)
    .sort((a, b) => {
      const aYear = a.year ?? new Date(a.startDate).getFullYear();
      const bYear = b.year ?? new Date(b.startDate).getFullYear();
      const aMonth = a.month ?? new Date(a.startDate).getMonth() + 1;
      const bMonth = b.month ?? new Date(b.startDate).getMonth() + 1;
      if (aYear !== bYear) return bYear - aYear;
      return bMonth - aMonth;
    });

  const activeSprint = allSprints.find((s) => s.status === 'Active');
  const pageTitle = tab === 'board' ? 'Aktif İşler' : 'Backlog';

  return (
    <div>
      <div className="mb-4">
        <div className="d-flex align-items-center gap-2 mb-1">
          <span className="badge" style={{ backgroundColor: '#0052CC', color: '#fff', fontSize: '0.75rem' }}>
            {project.key}
          </span>
          <h4 className="fw-bold mb-0">{project.name}</h4>
          <span className="text-muted small">/ {pageTitle}</span>
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
    </div>
  );
}

/* ── Board view ─────────────────────────────────────────────────────────────── */
function BoardView({ projectId, allSprints, activeSprint, boardSprintId, setBoardSprintId }) {
  const resolvedSprint =
    boardSprintId === 'active'
      ? activeSprint ?? null
      : boardSprintId === 'all'
      ? null
      : allSprints.find((s) => s.id === boardSprintId) ?? null;

  const resolvedSprintId = resolvedSprint?.id ?? null;
  const isReadonly = resolvedSprint?.status === 'Completed';

  return (
    <div>
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
      </div>
      <Board projectId={projectId} sprintId={resolvedSprintId} readonly={isReadonly} />
    </div>
  );
}

/* ── Backlog tab view ────────────────────────────────────────────────────────── */
function BacklogTabView({ projectId, allSprints }) {
  const { state } = useAppContext();
  const [priorityFilter, setPriorityFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [sortBy, setSortBy] = useState('date_desc');
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [selectedSprintId, setSelectedSprintId] = useState(() => {
    const active = allSprints.find((s) => s.status === 'Active');
    return active ? active.id : (allSprints[0]?.id ?? '');
  });
  const [selectedIssueId, setSelectedIssueId] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Aktif sprint değişirse (proje değişimi vb.) default'u güncelle
  useEffect(() => {
    const active = allSprints.find((s) => s.status === 'Active');
    if (active) setSelectedSprintId(active.id);
    else if (allSprints.length > 0) setSelectedSprintId(allSprints[0].id);
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Veri ─────────────────────────────────────────────────────────────────
  const allProjectIssues = state.issues.filter((i) => i.projectId === projectId && !i.isRequest);
  const backlogIssues = allProjectIssues.filter((i) => !i.sprintId);

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
        <td>${issue.priority}</td>
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
          <div className="card border-0 shadow-sm h-100" style={{ borderLeft: '4px solid #0052CC' }}>
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
              <div className="text-muted fw-semibold mb-2" style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Aylık Dönem
              </div>
              <select
                className="form-select form-select-sm mb-3"
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
                title={`${p} öncelikli bekleyen işleri filtrele`}
              >
                <div className="card-body py-3 px-3">
                  <div className="d-flex align-items-center gap-1 mb-1">
                    <TbFlag size={13} style={{ color: isActive ? '#fff' : bg.dark }} />
                    <span style={{ fontSize: '0.72rem', fontWeight: 600, color: isActive ? '#fff' : bg.dark }}>{p}</span>
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
                      {p || 'Tüm Öncelikler'}
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
            <p className="text-muted small mb-0">{priorityFilter ? `${priorityFilter} öncelikli bekleyen iş yok.` : 'Bekleyen iş yok.'}</p>
          ) : (
            <div className="table-responsive">
              <table className="table table-sm table-hover mb-0" style={{ fontSize: '0.85rem' }}>
                <thead>
                  <tr className="text-muted" style={{ fontSize: '0.75rem' }}>
                    <th className="fw-semibold border-0 ps-0">Başlık</th>
                    <th className="fw-semibold border-0">Öncelik</th>
                    <th className="fw-semibold border-0">Atanan</th>
                    <th className="fw-semibold border-0">Açılış Tarihi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBacklog.map((issue) => {
                    const assignee = state.users.find((u) => u.id === issue.assigneeId);
                    return (
                      <tr key={issue.id}>
                        <td className="ps-0 align-middle">
                          <button className="btn btn-link p-0 text-start text-decoration-none" style={{ fontSize: '0.85rem' }} onClick={() => setSelectedIssueId(issue.id)}>
                            <span className="text-muted me-1" style={{ fontSize: '0.72rem' }}>{issue.number}</span>
                            <span className="fw-medium">{issue.title}</span>
                          </button>
                        </td>
                        <td className="align-middle"><PriorityIcon priority={issue.priority} showLabel size={13} /></td>
                        <td className="align-middle">
                          {assignee ? (
                            <div className="d-flex align-items-center gap-2"><Avatar name={assignee.name} color={assignee.avatarColor} size={22} /><span>{assignee.name}</span></div>
                          ) : <span className="text-muted fst-italic">Atanmamış</span>}
                        </td>
                        <td className="align-middle text-muted"><span title={formatDate(issue.createdAt)}>{timeAgo(issue.createdAt)}</span></td>
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
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Yeni Issue Oluştur" size="lg">
        <IssueForm projectId={projectId} onSuccess={() => setShowCreateModal(false)} onCancel={() => setShowCreateModal(false)} />
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
          border: active ? '1.5px solid #0052CC' : '1.5px solid #DFE1E6',
          borderRadius: 20,
          padding: '4px 12px',
          fontSize: '0.82rem',
          fontWeight: active ? 600 : 400,
          background: active ? '#EAF2FF' : '#fff',
          color: active ? '#0052CC' : '#42526E',
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
