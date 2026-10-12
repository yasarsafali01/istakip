import React, { useEffect, useState } from 'react';
import {
  TbCalendar,
  TbClock,
  TbFlag,
  TbTag,
  TbCircleCheck,
  TbUserPlus,
  TbEdit,
  TbCheck,
  TbX,
  TbTrash,
} from 'react-icons/tb';
import { useAppContext } from '../../context/AppContext';
import { useAuth } from '../../hooks/useAuth';
import {
  ACTIONS,
  MANUAL_STATUSES,
  STATUS_LABELS,
  PRIORITIES,
  ISSUE_TYPES,
  ROLES,
  PRIORITY_LABELS,
} from '../../constants';
import { issuesApi, commentsApi, activitiesApi } from '../../api/resources';
import { buildUnitCodeByProjectId, mapIssue } from '../../api/mappers';
import { formatDate, timeAgo, formatTimeSpent } from '../../utils/dateUtils';
import Avatar from '../common/Avatar';
import Badge from '../common/Badge';
import PriorityIcon from '../common/PriorityIcon';
import CommentSection from './CommentSection';
import ActivityFeed from './ActivityFeed';
import ConfirmDialog from '../common/ConfirmDialog';
import TaskDoneModal from '../common/TaskDoneModal';
import ApprovalPanel from './ApprovalPanel';

/**
 * Unified Jira-style detail content for ALL issue types (Task, Bug, Story, Epic, Request).
 * Rendered inside IssueModal (and RequestDetailModal for requests).
 *
 * @param {Object}   props
 * @param {Object}   props.issue            - The issue object
 * @param {Function} props.onClose          - Close the parent modal
 * @param {boolean}  [props.readonly]       - Disable editing
 */
function IssueDetailContent({ issue, onClose, readonly = false }) {
  const { state, dispatch } = useAppContext();
  const { currentUser } = useAuth();

  // ── Edit mode ─────────────────────────────────────────────────────────────
  const [editMode, setEditMode] = useState(false);
  const [title, setTitle] = useState(issue.title);
  const [description, setDescription] = useState(issue.description ?? '');
  const [editType, setEditType] = useState(issue.type);
  const [editPriority, setEditPriority] = useState(issue.priority);
  const [editStatus, setEditStatus] = useState(issue.status);
  const [editAssigneeId, setEditAssigneeId] = useState(issue.assigneeId ?? '');
  const [editProjectId, setEditProjectId] = useState(issue.projectId ?? '');
  const [editUnitId, setEditUnitId] = useState('');

  // ── Inline field editing (non-edit-mode) ─────────────────────────────────
  const [editingStatus, setEditingStatus] = useState(false);
  const [editingAssignee, setEditingAssignee] = useState(false);
  const [editingTimeSpent, setEditingTimeSpent] = useState(false);
  const [editingResolvedAt, setEditingResolvedAt] = useState(false);
  const [timeSpentInput, setTimeSpentInput] = useState('');
  const [resolvedAtInput, setResolvedAtInput] = useState('');
  const [timeSpentError, setTimeSpentError] = useState('');

  // ── Other state ───────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('comments');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDoneModal, setShowDoneModal] = useState(false);
  const [newVisibleUserId, setNewVisibleUserId] = useState('');
  // Atama modalı (talep + PM/DH için yorum ile birlikte)
  const [assignModal, setAssignModal] = useState(false);
  const [pendingAssigneeId, setPendingAssigneeId] = useState('');
  const [assignComment, setAssignComment] = useState('');
  // Talebi geri çevirme modalı
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  // ── Derived data ──────────────────────────────────────────────────────────
  const assignee = state.users.find((u) => u.id === issue.assigneeId);
  const reporter = state.users.find((u) => u.id === issue.reporterId);
  const project = state.projects.find((p) => p.id === issue.projectId);
  const unit = state.units?.find((u) => u.unitCode === issue.unitCode);
  const externalUsers = state.users.filter((u) => u.isActive !== false).filter((u) => u.role === ROLES.EXTERNAL_USER);
  const unitProjects = state.projects.filter((p) => {
    const targetUnitId = editMode ? editUnitId : (unit?.id ?? '');
    return targetUnitId ? p.unitId === targetUnitId : false;
  });

  // Ne yapılabileceğine backend karar verir (allowedActions); web ve mobil aynı
  // bayrakları kullanır, kurallar istemcide tekrar yazılmaz.
  const actions = issue.allowedActions || {};
  const canAssign = !readonly && !!actions.assign;
  const canEditDates = !readonly && !!actions.editDates;
  const canEdit = !readonly && !!actions.edit;
  const canDelete = !readonly && !!actions.delete;
  const canReject = !readonly && !!actions.reject;
  const canChangeStatus = !readonly && !!actions.changeStatus;
  const canShare = !readonly && !!actions.share;

  // Atanabilecek kişiler backend'den gelir; düzenlemede müdürlük değişirse yenisine göre.
  const [assignableUsers, setAssignableUsers] = useState([]);
  const assigneeProjectId = editMode ? editProjectId : issue.projectId;
  useEffect(() => {
    if (!canAssign) return undefined;
    let cancelled = false;
    issuesApi.assignees(issue.id, assigneeProjectId !== issue.projectId ? assigneeProjectId : undefined)
      .then((opts) => { if (!cancelled) setAssignableUsers(opts.users); })
      .catch(() => { if (!cancelled) setAssignableUsers([]); });
    return () => { cancelled = true; };
  }, [issue.id, issue.projectId, assigneeProjectId, canAssign]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const unitCodeByProjectId = buildUnitCodeByProjectId(state.projects, state.units);

  // Re-fetches this issue and its activity log after a mutation and pushes
  // both into shared state (comments/activities are fetched on demand, not
  // eagerly hydrated — see AppContext).
  async function refreshIssue() {
    const [fresh, activities] = await Promise.all([
      issuesApi.get(issue.id),
      activitiesApi.listByIssue(issue.id),
    ]);
    dispatch({ type: ACTIONS.UPDATE_ISSUE, payload: mapIssue(fresh, unitCodeByProjectId) });
    dispatch({ type: ACTIONS.SET_ACTIVITIES_FOR_ISSUE, payload: { issueId: issue.id, activities } });
  }

  // ── Full edit save ────────────────────────────────────────────────────────
  async function handleSave() {
    if (!currentUser) return;
    const projectChanged = issue.projectId !== editProjectId;
    const statusChanged = issue.status !== editStatus;
    const assigneeChanged = canAssign && issue.assigneeId !== (editAssigneeId || null);

    try {
      await issuesApi.update(issue.id, {
        title,
        description,
        type: editType,
        priority: editPriority,
        projectId: editProjectId,
      });
      if (statusChanged) {
        await issuesApi.updateStatus(issue.id, editStatus);
      }
      if (assigneeChanged) {
        await issuesApi.updateAssignee(issue.id, editAssigneeId || null);
      }
      await refreshIssue();
      setEditMode(false);

      // Proje değiştiyse modal'ı kapat — eski projede tekrar düzenleme yapılmasın
      if (projectChanged) {
        onClose?.();
      }
    } catch (err) {
      window.alert(err.message);
    }
  }

  function handleCancelEdit() {
    setTitle(issue.title);
    setDescription(issue.description ?? '');
    setEditType(issue.type);
    setEditPriority(issue.priority);
    setEditStatus(issue.status);
    setEditAssigneeId(issue.assigneeId ?? '');
    setEditProjectId(issue.projectId ?? '');
    setEditUnitId(unit?.id ?? '');
    setEditMode(false);
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  async function handleDelete() {
    try {
      await issuesApi.delete(issue.id);
      dispatch({ type: ACTIONS.DELETE_ISSUE, payload: { issueId: issue.id } });
      onClose?.();
    } catch (err) {
      window.alert(err.message);
    }
  }

  // ── Inline status change ──────────────────────────────────────────────────
  async function handleStatusChange(newStatus) {
    if (newStatus === issue.status) { setEditingStatus(false); return; }
    if (newStatus === 'Done') {
      setShowDoneModal(true);
      setEditingStatus(false);
      return;
    }
    try {
      await issuesApi.updateStatus(issue.id, newStatus);
      await refreshIssue();
    } catch (err) {
      window.alert(err.message);
    } finally {
      setEditingStatus(false);
    }
  }

  // ── Inline assignee change ────────────────────────────────────────────────
  // PM ve DH için yorum ile birlikte atama modalı açılır
  const canAssignWithComment =
    canAssign &&
    [ROLES.PROJECT_MANAGER, ROLES.DEPARTMENT_HEAD, ROLES.SYSTEM_ADMIN].includes(currentUser?.role);

  function openAssignModal(newAssigneeId) {
    setPendingAssigneeId(newAssigneeId);
    setAssignComment('');
    setAssignModal(true);
    setEditingAssignee(false);
  }

  async function confirmAssign() {
    if (!canAssign) return;
    try {
      await issuesApi.updateAssignee(issue.id, pendingAssigneeId || null);
      if (assignComment.trim()) {
        await commentsApi.create(issue.id, assignComment.trim());
      }
      await refreshIssue();
    } catch (err) {
      window.alert(err.message);
    } finally {
      setAssignModal(false);
      setPendingAssigneeId('');
      setAssignComment('');
    }
  }

  async function handleAssigneeChange(newAssigneeId) {
    if (!canAssign) return;
    if (canAssignWithComment) {
      openAssignModal(newAssigneeId);
      return;
    }
    try {
      await issuesApi.updateAssignee(issue.id, newAssigneeId || null);
      await refreshIssue();
    } catch (err) {
      window.alert(err.message);
    } finally {
      setEditingAssignee(false);
    }
  }

  // ── Time spent ────────────────────────────────────────────────────────────
  async function handleTimeSpentSave() {
    const val = parseInt(timeSpentInput, 10);
    if (isNaN(val) || val < 0) { setTimeSpentError('Harcanan zaman negatif olamaz'); return; }
    setTimeSpentError('');
    try {
      await issuesApi.updateDates(issue.id, issue.resolvedAt || null, val);
      await refreshIssue();
      setEditingTimeSpent(false);
    } catch (err) {
      setTimeSpentError(err.message);
    }
  }

  // ── Resolved at ───────────────────────────────────────────────────────────
  async function handleResolvedAtSave() {
    const iso = resolvedAtInput ? new Date(resolvedAtInput).toISOString() : null;
    try {
      await issuesApi.updateDates(issue.id, iso, issue.timeSpent || 0);
      await refreshIssue();
    } catch (err) {
      window.alert(err.message);
    } finally {
      setEditingResolvedAt(false);
    }
  }

  // ── Visible-to ────────────────────────────────────────────────────────────
  async function handleAddVisible() {
    if (!newVisibleUserId) return;
    try {
      await issuesApi.addVisibleUser(issue.id, newVisibleUserId);
      await refreshIssue();
      setNewVisibleUserId('');
    } catch (err) {
      window.alert(err.message);
    }
  }

  // ── Geri çevir ────────────────────────────────────────────────────────────
  async function handleReject() {
    if (!canReject || !rejectReason.trim()) return;
    try {
      // "Geri Çevrildi" durumuna al ve açana geri ata
      await issuesApi.updateStatus(issue.id, 'Geri Çevrildi');
      await issuesApi.updateAssignee(issue.id, reporter?.id || null);
      // Ret açıklamasını yorum olarak ekle
      await commentsApi.create(issue.id, `🚫 **Talep Geri Çevrildi**\n\n${rejectReason.trim()}`);
      await refreshIssue();
      setShowRejectModal(false);
      setRejectReason('');
    } catch (err) {
      window.alert(err.message);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Breadcrumb */}
      <div className="d-flex align-items-center gap-2 mb-2">
        {unit && <span className="text-muted small">{unit.name}</span>}
        {unit && <span className="text-muted small">/</span>}
        {project && <span className="text-muted small">{project.name}</span>}
        {project && <span className="text-muted small">/</span>}
        <span className="text-primary small fw-semibold">{issue.number}</span>
      </div>

      {/* Title */}
      {editMode ? (
        <input
          className="form-control fw-bold fs-5 mb-3"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          aria-label="Başlık"
        />
      ) : (
        <h5 className="fw-semibold mb-3">{issue.title}</h5>
      )}

      {/* Action toolbar */}
      <div className="d-flex align-items-center gap-2 mb-4 flex-wrap">
        {/* Status transition buttons (non-edit-mode, non-readonly, non-external) */}
        {!editMode && canChangeStatus && (
          editingStatus ? (
            <select
              className="form-select form-select-sm"
              style={{ width: 'auto' }}
              defaultValue={issue.status}
              onChange={(e) => handleStatusChange(e.target.value)}
              onBlur={() => setEditingStatus(false)}
              autoFocus
            >
              {MANUAL_STATUSES.filter((s) => s !== 'Geri Çevrildi').map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
            </select>
          ) : (
            MANUAL_STATUSES.filter((s) => s !== issue.status && s !== 'Geri Çevrildi').map((s) => (
              <button key={s} className="btn btn-sm btn-outline-secondary" onClick={() => handleStatusChange(s)}>
                {STATUS_LABELS[s]}
              </button>
            ))
          )
        )}

        <div className="ms-auto d-flex gap-2">
          {/* Edit / Save / Cancel */}
          {canEdit && (
            editMode ? (
              <>
                <button className="btn btn-sm btn-primary d-flex align-items-center gap-1" onClick={handleSave}>
                  <TbCheck size={14} /> Kaydet
                </button>
                <button className="btn btn-sm btn-secondary d-flex align-items-center gap-1" onClick={handleCancelEdit}>
                  <TbX size={14} /> İptal
                </button>
              </>
            ) : (
              <button className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1" onClick={() => { setEditUnitId(unit?.id ?? ''); setEditMode(true); }}>
                <TbEdit size={14} /> Düzenle
              </button>
            )
          )}

          {/* Assign button */}
          {!readonly && canAssign && !editMode && (
            <button
              className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1"
              onClick={() => setEditingAssignee(true)}
            >
              <TbUserPlus size={14} /> Ata
            </button>
          )}

          {/* Geri Çevir (PM/DH/Admin, not own issue) */}
          {canReject && !editMode && (
            <button
              className="btn btn-sm btn-outline-warning d-flex align-items-center gap-1"
              onClick={() => setShowRejectModal(true)}
              title="Talebi geri çevir"
            >
              <TbX size={14} /> Geri Çevir
            </button>
          )}

          {/* Delete */}
          {canDelete && !editMode && (
            <button
              className="btn btn-sm btn-outline-danger d-flex align-items-center gap-1"
              onClick={() => setShowDeleteConfirm(true)}
              aria-label="Sil"
              title="Sil"
            >
              <TbTrash size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Onay bekleyen tamamlama — yönetici onaylar/reddeder */}
      <ApprovalPanel issue={issue} />

      {/* Two-column layout */}
      <div className="row g-4">
        {/* Left column */}
        <div className="col-12 col-lg-8">

          {/* Details grid */}
          <div className="mb-4">
            <h6 className="fw-semibold text-muted text-uppercase mb-3" style={{ fontSize: '0.75rem', letterSpacing: '0.05em' }}>
              Detaylar
            </h6>
            <div className="row g-2" style={{ fontSize: '0.875rem' }}>

              {/* Type */}
              <div className="col-4 col-md-3 text-muted fw-medium d-flex align-items-center gap-1">
                <TbTag size={13} /> Tip
              </div>
              <div className="col-8 col-md-9">
                {editMode ? (
                  <select className="form-select form-select-sm" value={editType} onChange={(e) => setEditType(e.target.value)}>
                    {ISSUE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                ) : (
                  <Badge label="Talep" type="issueType" />
                )}
              </div>

              {/* Priority */}
              <div className="col-4 col-md-3 text-muted fw-medium d-flex align-items-center gap-1">
                <TbFlag size={13} /> Öncelik
              </div>
              <div className="col-8 col-md-9">
                {editMode ? (
                  <select className="form-select form-select-sm" value={editPriority} onChange={(e) => setEditPriority(e.target.value)}>
                    {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
                  </select>
                ) : (
                  <PriorityIcon priority={issue.priority} showLabel size={13} />
                )}
              </div>

              {/* Status */}
              <div className="col-4 col-md-3 text-muted fw-medium d-flex align-items-center gap-1">
                <TbCircleCheck size={13} /> Durum
              </div>
              <div className="col-8 col-md-9">
                {editMode ? (
                  <select className="form-select form-select-sm" value={editStatus} onChange={(e) => setEditStatus(e.target.value)}>
                    {MANUAL_STATUSES.filter((s) => s !== 'Done').map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                  </select>
                ) : (
                  <Badge label={issue.status} type="status" />
                )}
              </div>

              {/* Project — edit modunda değiştirilebilir */}
              {editMode && (
                <>
                  <div className="col-4 col-md-3 text-muted fw-medium d-flex align-items-center gap-1">
                    🏢 Daire Başkanlığı
                  </div>
                  <div className="col-8 col-md-9">
                    <select
                      className="form-select form-select-sm"
                      style={{ width: 'auto', minWidth: 200 }}
                      value={editUnitId}
                      onChange={(e) => { setEditUnitId(e.target.value); setEditProjectId(''); setEditAssigneeId(''); }}
                    >
                      <option value="">— Daire başkanlığı seçin —</option>
                      {state.units.map((u) => (
                        <option key={u.id} value={u.id}>{u.name} ({u.unitCode})</option>
                      ))}
                    </select>
                  </div>
                </>
              )}
              <div className="col-4 col-md-3 text-muted fw-medium d-flex align-items-center gap-1">
                📁 Müdürlük
              </div>
              <div className="col-8 col-md-9">
                {editMode ? (
                  <select
                    className="form-select form-select-sm"
                    data-testid="project-select"
                    style={{ width: 'auto', minWidth: 200 }}
                    value={editProjectId}
                    onChange={(e) => { setEditProjectId(e.target.value); setEditAssigneeId(''); }}
                  >
                    <option value="">— Müdürlük seçin —</option>
                    {unitProjects.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                ) : (
                  <span className="small">{project?.name || '—'}</span>
                )}
              </div>

              {/* Resolved at */}
              <div className="col-4 col-md-3 text-muted fw-medium d-flex align-items-center gap-1">
                <TbCalendar size={13} /> Çözülüş
              </div>
              <div className="col-8 col-md-9">
                {canEditDates && editingResolvedAt ? (
                  <div className="d-flex gap-1">
                    <input
                      type="date"
                      className="form-control form-control-sm"
                      style={{ width: 'auto' }}
                      defaultValue={issue.resolvedAt ? issue.resolvedAt.substring(0, 10) : ''}
                      onChange={(e) => setResolvedAtInput(e.target.value)}
                      autoFocus
                    />
                    <button className="btn btn-sm btn-primary" onClick={handleResolvedAtSave}>Kaydet</button>
                    <button className="btn btn-sm btn-outline-secondary" onClick={() => setEditingResolvedAt(false)}>İptal</button>
                  </div>
                ) : (
                  <span
                    role={canEditDates ? 'button' : undefined}
                    tabIndex={canEditDates ? 0 : undefined}
                    onClick={() => { if (canEditDates) { setResolvedAtInput(issue.resolvedAt ? issue.resolvedAt.substring(0, 10) : ''); setEditingResolvedAt(true); } }}
                    onKeyDown={(e) => e.key === 'Enter' && canEditDates && setEditingResolvedAt(true)}
                    style={{ cursor: canEditDates ? 'pointer' : 'default' }}
                    title={canEditDates ? 'Çözülüş tarihini düzenle' : undefined}
                  >
                    {issue.resolvedAt ? formatDate(issue.resolvedAt) : <span className="text-muted">—</span>}
                  </span>
                )}
              </div>

              {/* Time spent */}
              <div className="col-4 col-md-3 text-muted fw-medium d-flex align-items-center gap-1">
                <TbClock size={13} /> Harcanan Zaman
              </div>
              <div className="col-8 col-md-9">
                {canEditDates && editingTimeSpent ? (
                  <div>
                    <div className="d-flex gap-1">
                      <input
                        type="number"
                        className={`form-control form-control-sm ${timeSpentError ? 'is-invalid' : ''}`}
                        placeholder="Dakika"
                        style={{ width: '100px' }}
                        defaultValue={issue.timeSpent || ''}
                        onChange={(e) => { setTimeSpentInput(e.target.value); setTimeSpentError(''); }}
                        min={0}
                        autoFocus
                      />
                      <button className="btn btn-sm btn-primary" onClick={handleTimeSpentSave}>Kaydet</button>
                      <button className="btn btn-sm btn-outline-secondary" onClick={() => { setEditingTimeSpent(false); setTimeSpentError(''); }}>İptal</button>
                    </div>
                    {timeSpentError && <div className="invalid-feedback d-block mt-1">{timeSpentError}</div>}
                  </div>
                ) : (
                  <span
                    role={canEditDates ? 'button' : undefined}
                    tabIndex={canEditDates ? 0 : undefined}
                    onClick={() => { if (canEditDates) { setTimeSpentInput(String(issue.timeSpent || '')); setEditingTimeSpent(true); } }}
                    onKeyDown={(e) => e.key === 'Enter' && canEditDates && setEditingTimeSpent(true)}
                    style={{ cursor: canEditDates ? 'pointer' : 'default' }}
                    title={canEditDates ? 'Harcanan zamanı düzenle' : undefined}
                  >
                    {formatTimeSpent(issue.timeSpent)}
                  </span>
                )}
              </div>
            </div>
          </div>

          <hr className="my-3" />

          {/* Description */}
          <div className="mb-4">
            <h6 className="fw-semibold text-muted text-uppercase mb-2" style={{ fontSize: '0.75rem', letterSpacing: '0.05em' }}>
              Açıklama
            </h6>
            {editMode ? (
              <textarea
                className="form-control"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                aria-label="Açıklama"
              />
            ) : issue.description ? (
              <p className="mb-0" style={{ whiteSpace: 'pre-wrap', fontSize: '0.9rem' }}>{issue.description}</p>
            ) : (
              <p className="text-muted fst-italic mb-0" style={{ fontSize: '0.875rem' }}>Açıklama eklenmemiş.</p>
            )}
          </div>

          <hr className="my-3" />

          {/* Activity tabs */}
          <div>
            <h6 className="fw-semibold text-muted text-uppercase mb-3" style={{ fontSize: '0.75rem', letterSpacing: '0.05em' }}>
              Aktivite
            </h6>
            <ul className="nav nav-tabs mb-3" style={{ fontSize: '0.875rem' }}>
              {['comments', 'history', 'all'].map((tab) => (
                <li key={tab} className="nav-item">
                  <button
                    className={`nav-link py-1 px-3 ${activeTab === tab ? 'active' : ''}`}
                    onClick={() => setActiveTab(tab)}
                  >
                    {tab === 'comments' ? 'Yorumlar' : tab === 'history' ? 'Geçmiş' : 'Tümü'}
                  </button>
                </li>
              ))}
            </ul>
            {(activeTab === 'comments' || activeTab === 'all') && (
              <div className="mb-3"><CommentSection issueId={issue.id} /></div>
            )}
            {(activeTab === 'history' || activeTab === 'all') && (
              <ActivityFeed issueId={issue.id} />
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="col-12 col-lg-4">

          {/* People */}
          <div className="p-3 rounded mb-3" style={{ backgroundColor: '#F4F5F7', fontSize: '0.85rem' }}>
            <h6 className="fw-semibold text-muted text-uppercase mb-3" style={{ fontSize: '0.7rem', letterSpacing: '0.05em' }}>
              Kişiler
            </h6>

            {/* Assignee */}
            <div className="mb-3">
              <p className="text-muted mb-1 small fw-semibold">Atanan Kişi</p>
              {canAssign && editingAssignee ? (
                <select
                  className="form-select form-select-sm"
                  defaultValue={issue.assigneeId ?? ''}
                  onChange={(e) => handleAssigneeChange(e.target.value)}
                  onBlur={() => setEditingAssignee(false)}
                  autoFocus
                >
                  <option value="">— Atanmamış —</option>
                  {assignableUsers.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              ) : editMode && canAssign ? (
                <select
                  className="form-select form-select-sm"
                  value={editAssigneeId}
                  onChange={(e) => setEditAssigneeId(e.target.value)}
                >
                  <option value="">— Atanmamış —</option>
                  {assignableUsers.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              ) : (
                <div className="d-flex align-items-center gap-2">
                  {assignee ? (
                    <>
                      <Avatar name={assignee.name} color={assignee.avatarColor} size={24} />
                      <div>
                        <div className="fw-medium">{assignee.name}</div>
                        {canAssign && (
                          <div
                            className="text-primary"
                            role="button"
                            tabIndex={0}
                            style={{ fontSize: '0.75rem', cursor: 'pointer' }}
                            onClick={() => handleAssigneeChange(currentUser.id)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAssigneeChange(currentUser.id)}
                          >
                            Kendime ata
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div>
                      <span className="text-muted">Atanmamış</span>
                      {canAssign && (
                        <div
                          className="text-primary"
                          role="button"
                          tabIndex={0}
                          style={{ fontSize: '0.75rem', cursor: 'pointer' }}
                          onClick={() => handleAssigneeChange(currentUser.id)}
                          onKeyDown={(e) => e.key === 'Enter' && handleAssigneeChange(currentUser.id)}
                        >
                          Kendime ata
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Reporter */}
            <div className="mb-1">
              <p className="text-muted mb-1 small fw-semibold">Raporlayan</p>
              <div className="d-flex align-items-center gap-2">
                {reporter ? (
                  <>
                    <Avatar name={reporter.name} color={reporter.avatarColor} size={24} />
                    <span className="fw-medium">{reporter.name}</span>
                  </>
                ) : (
                  <span className="text-muted">—</span>
                )}
              </div>
            </div>

            {/* Visible-to (non-external, non-edit-mode) */}
            {canShare && !editMode && (
              <div className="mt-3">
                <p className="text-muted mb-1 small fw-semibold">Görünür Kullanıcılar</p>
                <div className="d-flex gap-2 mb-2">
                  <select
                    className="form-select form-select-sm"
                    value={newVisibleUserId}
                    onChange={(e) => setNewVisibleUserId(e.target.value)}
                  >
                    <option value="">Kullanıcı ekle...</option>
                    {externalUsers
                      .filter((u) => !issue.visibleTo?.includes(u.id))
                      .map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                  <button className="btn btn-sm btn-outline-primary" onClick={handleAddVisible} disabled={!newVisibleUserId}>
                    Ekle
                  </button>
                </div>
                {issue.visibleTo?.length > 0 && (
                  <ul className="list-unstyled mb-0">
                    {issue.visibleTo.map((uid) => {
                      const u = state.users.find((x) => x.id === uid);
                      return <li key={uid} className="small text-muted">• {u?.name || uid}</li>;
                    })}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* Dates */}
          <div className="p-3 rounded" style={{ backgroundColor: '#F4F5F7', fontSize: '0.85rem' }}>
            <h6 className="fw-semibold text-muted text-uppercase mb-3" style={{ fontSize: '0.7rem', letterSpacing: '0.05em' }}>
              Tarihler
            </h6>
            <div className="mb-2">
              <p className="text-muted mb-0 small fw-semibold">Oluşturulma</p>
              <span title={formatDate(issue.createdAt)}>{timeAgo(issue.createdAt) || '—'}</span>
            </div>
            <div>
              <p className="text-muted mb-0 small fw-semibold">Güncelleme</p>
              <span title={formatDate(issue.updatedAt)}>{timeAgo(issue.updatedAt) || timeAgo(issue.createdAt) || '—'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Delete confirmation */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="Talebi Sil"
        message={`"${issue.title}" talebini silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.`}
        confirmText="Sil"
      />

      {/* Atama + yorum modalı (PM / DH / Admin için) */}
      {assignModal && (
        <div
          className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
          style={{ background: 'rgba(0,0,0,0.45)', zIndex: 2000 }}
          onClick={(e) => { if (e.target === e.currentTarget) setAssignModal(false); }}
        >
          <div className="bg-white rounded-3 shadow-lg p-4" style={{ width: '100%', maxWidth: 460 }}>
            <h6 className="fw-semibold mb-3">Talebi Ata</h6>
            <p className="text-muted small mb-3">
              <strong>{state.users.find(u => u.id === pendingAssigneeId)?.name ?? 'Atanmamış'}</strong> kişisine atanacak.
            </p>

            {/* Kişi değiştir */}
            <div className="mb-3">
              <label className="form-label small fw-semibold">Atanan Kişi</label>
              <select
                className="form-select form-select-sm"
                value={pendingAssigneeId}
                onChange={e => setPendingAssigneeId(e.target.value)}
              >
                <option value="">— Atanmamış —</option>
                {assignableUsers.map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>

            {/* İsteğe bağlı yorum */}
            <div className="mb-4">
              <label className="form-label small fw-semibold">
                Yorum <span className="text-muted fw-normal">(isteğe bağlı)</span>
              </label>
              <textarea
                className="form-control form-control-sm"
                rows={3}
                placeholder="Atama hakkında bir not ekleyin..."
                value={assignComment}
                onChange={e => setAssignComment(e.target.value)}
              />
            </div>

            <div className="d-flex justify-content-end gap-2">
              <button className="btn btn-sm btn-outline-secondary" onClick={() => setAssignModal(false)}>
                İptal
              </button>
              <button className="btn btn-sm btn-primary" onClick={confirmAssign}>
                Ata{assignComment.trim() ? ' ve Yorum Gönder' : ''}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Talebi Geri Çevir modalı */}
      {showRejectModal && (
        <div
          className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
          style={{ background: 'rgba(0,0,0,0.45)', zIndex: 2000 }}
          onClick={(e) => { if (e.target === e.currentTarget) { setShowRejectModal(false); setRejectReason(''); } }}
        >
          <div className="bg-white rounded-3 shadow-lg p-4" style={{ width: '100%', maxWidth: 500 }}>
            <h6 className="fw-semibold mb-3">Talebi Geri Çevir</h6>
            <p className="text-muted small mb-3">
              Bu talep <strong>{reporter?.name || 'açan kişiye'}</strong> geri gönderilecek ve durumu <strong>"Geri Çevrildi"</strong> olarak ayarlanacak.
            </p>

            <div className="mb-4">
              <label className="form-label small fw-semibold">
                Geri Çevirme Nedeni <span className="text-danger">*</span>
              </label>
              <textarea
                className="form-control"
                rows={4}
                placeholder="Talebin neden geri çevrildiğini açıklayın (örn: Yanlış ekibe yönlendirildi, eksik bilgi, vb.)"
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                autoFocus
              />
              <small className="text-muted">Bu açıklama talebe yorum olarak eklenecektir.</small>
            </div>

            <div className="d-flex justify-content-end gap-2">
              <button
                className="btn btn-sm btn-outline-secondary"
                onClick={() => { setShowRejectModal(false); setRejectReason(''); }}
              >
                İptal
              </button>
              <button
                className="btn btn-sm btn-warning"
                onClick={handleReject}
                disabled={!rejectReason.trim()}
              >
                Geri Çevir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Task Done Modal */}
      <TaskDoneModal
        isOpen={showDoneModal}
        issue={issue}
        onConfirm={() => setShowDoneModal(false)}
        onCancel={() => setShowDoneModal(false)}
      />
    </div>
  );
}

export default IssueDetailContent;
