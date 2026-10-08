import React, { useState, useEffect } from 'react';
import {
  TbCalendar,
  TbClock,
  TbFlag,
  TbTag,
  TbCircleCheck,
  TbEdit,
  TbCheck,
  TbX,
  TbUserPlus,
  TbTrash,
  TbCopy,
  TbArrowForwardUp,
  TbBan,
  TbPhone,
  TbPaperclip,
} from 'react-icons/tb';
import { useAppContext } from '../../context/AppContext';
import { useAuth } from '../../hooks/useAuth';
import { usePermissions } from '../../hooks/usePermissions';
import { ACTIONS, MANUAL_STATUSES, STATUS_LABELS, PRIORITIES, PRIORITY_LABELS, ROLES } from '../../constants';
import { canChangeAssignee } from '../../utils/permissionUtils';
import { issuesApi, commentsApi, activitiesApi, teamsApi, filesApi } from '../../api/resources';
import { buildUnitCodeByProjectId, mapIssue } from '../../api/mappers';
import { formatDate, timeAgo, formatTimeSpent } from '../../utils/dateUtils';
import { formatAnswer, formatBytes } from '../../utils/requestForm';
import { requestDurations, formatDuration } from '../../utils/durationUtils';
import Avatar from '../common/Avatar';
import Badge from '../common/Badge';
import PriorityIcon from '../common/PriorityIcon';
import SlaBadge from '../common/SlaBadge';
import StarRating from '../common/StarRating';
import CommentSection from '../issue/CommentSection';
import ActivityFeed from '../issue/ActivityFeed';
import ConfirmDialog from '../common/ConfirmDialog';
import TaskDoneModal from '../common/TaskDoneModal';
import ApprovalPanel from '../issue/ApprovalPanel';

/**
 * Full Jira-style request detail content.
 * Rendered inside RequestDetailModal.
 */
function RequestDetailContent({ request, onClose, onCloneSuccess }) {
  const { state, dispatch } = useAppContext();
  const { currentUser } = useAuth();
  const { can } = usePermissions();

  // ── Edit mode state ───────────────────────────────────────────────────────
  const [editMode, setEditMode] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPriority, setEditPriority] = useState('');
  const [editProjectId, setEditProjectId] = useState('');

  // ── Inline field edit state ───────────────────────────────────────────────
  const [editingStatus, setEditingStatus] = useState(false);
  const [editingAssignee, setEditingAssignee] = useState(false);
  const [editingTimeSpent, setEditingTimeSpent] = useState(false);
  const [editingResolvedAt, setEditingResolvedAt] = useState(false);
  const [timeSpentInput, setTimeSpentInput] = useState('');
  const [resolvedAtInput, setResolvedAtInput] = useState('');
  const [timeSpentError, setTimeSpentError] = useState('');
  const [activeTab, setActiveTab] = useState('comments');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDoneModal, setShowDoneModal] = useState(false);
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [forwardTargetId, setForwardTargetId] = useState('');
  const [forwardNote, setForwardNote] = useState('');
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [rating, setRating] = useState(0);
  const [ratingComment, setRatingComment] = useState('');
  const [ratingSubmitting, setRatingSubmitting] = useState(false);
  const [teams, setTeams] = useState([]);

  // ── Derived data ──────────────────────────────────────────────────────────
  const assignee = state.users.find((u) => u.id === request.assigneeId);
  const reporter = state.users.find((u) => u.id === request.reporterId);

  // Current project (may change during edit)
  const currentProjectId = editMode ? editProjectId : request.projectId;
  const project = state.projects.find((p) => p.id === currentProjectId) ||
                  state.projects.find((p) => p.id === request.projectId);
  const unit = state.units?.find((u) => u.unitCode === request.unitCode);

  const isExternalUser = currentUser?.role === ROLES.EXTERNAL_USER;
  const isOwnRequest = request.reporterId === currentUser?.id;
  const canAssign = canChangeAssignee(currentUser, request, state.projects);
  // Dış kullanıcı yalnızca kendi talebi üzerinde işlem yapabilir; diğer roller izinlerine göre
  const ownsIfExternal = !isExternalUser || isOwnRequest;
  const canEdit = !!currentUser && can('issue.edit') && ownsIfExternal;
  // Kimse kendi açmadığı talebi silemez (yöneticiler dahil)
  const canDelete = !!currentUser && can('issue.delete') && isOwnRequest;
  const canEditDates = !!currentUser && can('issue.dates');

  // Projects available for reassignment (same unit as the request)
  const unitProjects = state.projects.filter((p) => {
    if (!unit) return false;
    const projectUnit = state.units?.find((u) => u.id === p.unitId);
    return projectUnit?.unitCode === request.unitCode;
  });

  useEffect(() => {
    let cancelled = false;
    teamsApi.listByProject(request.projectId).then((list) => { if (!cancelled) setTeams(list); }).catch(() => {});
    return () => { cancelled = true; };
  }, [request.projectId]);

  // Users eligible for assignment: workers of the (possibly new) project, PM, dept head, admin
  const assignableUsers = state.users.filter((u) => {
    if (u.role === ROLES.EXTERNAL_USER) return false;
    const targetProjectId = editMode ? editProjectId : request.projectId;
    const targetProject = state.projects.find((p) => p.id === targetProjectId);
    if (u.role === ROLES.SYSTEM_ADMIN) return true;
    if (u.role === ROLES.WORKER) return u.projectId === targetProjectId;
    if (u.role === ROLES.PROJECT_MANAGER) return targetProject?.managerId === u.id;
    if (u.role === ROLES.DEPARTMENT_HEAD) return u.unitId === targetProject?.unitId;
    return false;
  });

  // ── Helpers ───────────────────────────────────────────────────────────────
  const unitCodeByProjectId = buildUnitCodeByProjectId(state.projects, state.units);

  async function refreshRequest() {
    const [fresh, activities] = await Promise.all([
      issuesApi.get(request.id),
      activitiesApi.listByIssue(request.id),
    ]);
    dispatch({ type: ACTIONS.UPDATE_ISSUE, payload: mapIssue(fresh, unitCodeByProjectId) });
    dispatch({ type: ACTIONS.SET_ACTIVITIES_FOR_ISSUE, payload: { issueId: request.id, activities } });
  }

  // ── Enter edit mode ───────────────────────────────────────────────────────
  function handleStartEdit() {
    setEditTitle(request.title);
    setEditDescription(request.description || '');
    setEditPriority(request.priority);
    setEditProjectId(request.projectId);
    setEditMode(true);
  }

  function handleCancelEdit() {
    setEditMode(false);
  }

  // ── Save full edit ────────────────────────────────────────────────────────
  async function handleSaveEdit() {
    if (!editTitle.trim()) return;
    try {
      await issuesApi.update(request.id, {
        title: editTitle.trim(),
        description: editDescription,
        priority: editPriority,
        projectId: editProjectId,
      });
      await refreshRequest();
      setEditMode(false);
    } catch (err) {
      window.alert(err.message);
    }
  }

  // ── Status change ─────────────────────────────────────────────────────────
  async function handleStatusChange(newStatus) {
    if (newStatus === request.status) { setEditingStatus(false); return; }
    if (newStatus === 'Done') {
      setShowDoneModal(true);
      setEditingStatus(false);
      return;
    }
    try {
      await issuesApi.updateStatus(request.id, newStatus);
      await refreshRequest();
    } catch (err) {
      window.alert(err.message);
    } finally {
      setEditingStatus(false);
    }
  }

  // ── Assignee change ───────────────────────────────────────────────────────
  // value is either "" (unassign), "u:<userId>" or "t:<teamId>"
  async function handleAssigneeChange(value) {
    if (!canAssign) return;
    try {
      if (value.startsWith('t:')) {
        await issuesApi.assignTeam(request.id, value.slice(2));
      } else {
        await issuesApi.updateAssignee(request.id, value.startsWith('u:') ? value.slice(2) : null);
      }
      await refreshRequest();
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
      await issuesApi.updateDates(request.id, request.resolvedAt || null, val);
      await refreshRequest();
      setEditingTimeSpent(false);
    } catch (err) {
      setTimeSpentError(err.message);
    }
  }

  // ── Resolved at ───────────────────────────────────────────────────────────
  async function handleResolvedAtSave() {
    const iso = resolvedAtInput ? new Date(resolvedAtInput).toISOString() : null;
    try {
      await issuesApi.updateDates(request.id, iso, request.timeSpent || 0);
      await refreshRequest();
    } catch (err) {
      window.alert(err.message);
    } finally {
      setEditingResolvedAt(false);
    }
  }

  // ── Klonla ────────────────────────────────────────────────────────────────
  // Requirement 18: yetkili kullanıcılar (ve External_User kendi talebini)
  // "Klonla" ile aynı içerikte yeni bir talep oluşturabilir.
  const canClone = !!currentUser && can('issue.clone') && ownsIfExternal;
  async function handleClone() {
    try {
      const cloned = await issuesApi.clone(request.id);
      dispatch({ type: ACTIONS.ADD_ISSUE, payload: mapIssue(cloned, unitCodeByProjectId) });
      onCloneSuccess?.(cloned.id);
    } catch (err) {
      window.alert(err.message);
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  async function handleDelete() {
    try {
      await issuesApi.delete(request.id);
      dispatch({ type: ACTIONS.DELETE_ISSUE, payload: { issueId: request.id } });
      onClose();
    } catch (err) {
      window.alert(err.message);
    }
  }

  // ── Geri çevir ────────────────────────────────────────────────────────────
  async function handleReject() {
    if (!canReject || !rejectReason.trim()) return;
    try {
      await issuesApi.updateStatus(request.id, 'Geri Çevrildi');
      await issuesApi.updateAssignee(request.id, reporter?.id || null);
      await commentsApi.create(request.id, `🚫 **Talep Geri Çevrildi**\n\n${rejectReason.trim()}`);
      await refreshRequest();
      setShowRejectModal(false);
      setRejectReason('');
    } catch (err) {
      window.alert(err.message);
    }
  }

  const canReject =
    currentUser &&
    [ROLES.SYSTEM_ADMIN, ROLES.DEPARTMENT_HEAD, ROLES.PROJECT_MANAGER].includes(currentUser.role) &&
    request.status !== 'Geri Çevrildi';

  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  // ── Yönlendir (Forward to another project) ───────────────────────────────
  const TERMINAL_STATUSES = ['Done', 'Geri Çevrildi', 'İptal Edildi', 'Yönlendirildi'];
  const isTerminal = TERMINAL_STATUSES.includes(request.status);
  const canForward = !!currentUser && can('issue.forward') && !isTerminal;
  const forwardTargets = state.projects.filter((p) => p.id !== request.projectId);

  async function handleForward() {
    if (!forwardTargetId) return;
    try {
      await issuesApi.forward(request.id, forwardTargetId, forwardNote.trim());
      await refreshRequest();
      setShowForwardModal(false);
      setForwardTargetId('');
      setForwardNote('');
    } catch (err) {
      window.alert(err.message);
    }
  }

  // ── İptal Et (requester withdraws their own open request) ────────────────
  const canCancel = !!currentUser && isOwnRequest && !isTerminal;
  async function handleCancel() {
    try {
      await issuesApi.cancel(request.id);
      await refreshRequest();
      setShowCancelConfirm(false);
    } catch (err) {
      window.alert(err.message);
    }
  }

  // ── Puanla (requester rates a completed request once) ────────────────────
  const canRate = !!currentUser && isOwnRequest && request.status === 'Done' && !request.ratedAt;
  async function handleRate() {
    if (!rating) return;
    setRatingSubmitting(true);
    try {
      await issuesApi.rate(request.id, rating, ratingComment.trim());
      await refreshRequest();
    } catch (err) {
      window.alert(err.message);
    } finally {
      setRatingSubmitting(false);
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
        <span className="text-primary small fw-semibold">{request.number}</span>
        <SlaBadge request={request} />
      </div>

      {/* Title */}
      {editMode ? (
        <input
          className="form-control fw-semibold fs-5 mb-3"
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          placeholder="Talep başlığı"
          autoFocus
        />
      ) : (
        <h5 className="fw-semibold mb-3">{request.title}</h5>
      )}

      {/* Action toolbar */}
      <div className="d-flex align-items-center gap-2 mb-4 flex-wrap">
        {/* Status buttons (view mode only) */}
        {!isExternalUser && !editMode && can('issue.status') && request.status !== 'Geri Çevrildi'
          && (request.status !== 'Onay Bekliyor' || can('issue.approve')) && (
          <>
            {editingStatus ? (
              <select
                className="form-select form-select-sm"
                style={{ width: 'auto' }}
                defaultValue={request.status}
                onChange={(e) => handleStatusChange(e.target.value)}
                onBlur={() => setEditingStatus(false)}
                autoFocus
              >
                {MANUAL_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
              </select>
            ) : (
              MANUAL_STATUSES.filter((s) => s !== request.status && s !== 'Geri Çevrildi').map((s) => (
                <button key={s} className="btn btn-sm btn-outline-secondary" onClick={() => handleStatusChange(s)}>
                  {STATUS_LABELS[s]}
                </button>
              ))
            )}
          </>
        )}

        <div className="ms-auto d-flex gap-2">
          {/* Edit / Save / Cancel */}
          {canEdit && !editMode && (
            <button className="btn btn-sm btn-outline-primary d-flex align-items-center gap-1" onClick={handleStartEdit}>
              <TbEdit size={14} /> Düzenle
            </button>
          )}
          {editMode && (
            <>
              <button className="btn btn-sm btn-primary d-flex align-items-center gap-1" onClick={handleSaveEdit} disabled={!editTitle.trim()}>
                <TbCheck size={14} /> Kaydet
              </button>
              <button className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1" onClick={handleCancelEdit}>
                <TbX size={14} /> İptal
              </button>
            </>
          )}

          {/* Assign button (view mode) */}
          {canAssign && !editMode && (
            <button className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1" onClick={() => setEditingAssignee(true)} title="Atama yap">
              <TbUserPlus size={14} /> Ata
            </button>
          )}

          {/* Klonla */}
          {canClone && !editMode && (
            <button className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1" onClick={handleClone} title="Talebi klonla">
              <TbCopy size={14} /> Klonla
            </button>
          )}

          {/* Yönlendir */}
          {canForward && !editMode && (
            <button className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1" onClick={() => setShowForwardModal(true)} title="Talebi başka bir müdürlüğe yönlendir">
              <TbArrowForwardUp size={14} /> Yönlendir
            </button>
          )}

          {/* İptal Et — talebi açan kişi kendi talebini geri çekebilir */}
          {canCancel && !editMode && (
            <button className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1" onClick={() => setShowCancelConfirm(true)} title="Talebi iptal et">
              <TbBan size={14} /> İptal Et
            </button>
          )}

          {/* Geri Çevir */}
          {canReject && !editMode && (
            <button
              className="btn btn-sm btn-outline-warning d-flex align-items-center gap-1"
              onClick={() => setShowRejectModal(true)}
              title="Talebi geri çevir"
            >
              <TbX size={14} /> Geri Çevir
            </button>
          )}

          {/* Delete — sadece talebi açan kullanıcı silebilir */}          {canDelete && !editMode && (
            <button className="btn btn-sm btn-outline-danger d-flex align-items-center gap-1" onClick={() => setShowDeleteConfirm(true)} title="Talebi sil">
              <TbTrash size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Onay bekleyen tamamlama — yönetici onaylar/reddeder */}
      <ApprovalPanel issue={request} />

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
                <Badge label="Talep" type="issueType" />
              </div>

              {/* Priority */}
              <div className="col-4 col-md-3 text-muted fw-medium d-flex align-items-center gap-1">
                <TbFlag size={13} /> Öncelik
              </div>
              <div className="col-8 col-md-9">
                {editMode ? (
                  <select
                    className="form-select form-select-sm"
                    style={{ width: 'auto' }}
                    value={editPriority}
                    onChange={(e) => setEditPriority(e.target.value)}
                  >
                    {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
                  </select>
                ) : (
                  <PriorityIcon priority={request.priority} showLabel size={13} />
                )}
              </div>

              {/* Status */}
              <div className="col-4 col-md-3 text-muted fw-medium d-flex align-items-center gap-1">
                <TbCircleCheck size={13} /> Durum
              </div>
              <div className="col-8 col-md-9">
                <Badge label={request.status} type="status" />
              </div>

              {/* Project (editable) */}
              <div className="col-4 col-md-3 text-muted fw-medium d-flex align-items-center gap-1">
                📁 Müdürlük
              </div>
              <div className="col-8 col-md-9">
                {editMode ? (
                  <select
                    className="form-select form-select-sm"
                    style={{ width: 'auto', minWidth: 200 }}
                    value={editProjectId}
                    onChange={(e) => setEditProjectId(e.target.value)}
                  >
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
                {canEditDates && !editMode && editingResolvedAt ? (
                  <div className="d-flex gap-1">
                    <input
                      type="date"
                      className="form-control form-control-sm"
                      style={{ width: 'auto' }}
                      defaultValue={request.resolvedAt ? request.resolvedAt.substring(0, 10) : ''}
                      onChange={(e) => setResolvedAtInput(e.target.value)}
                      autoFocus
                    />
                    <button className="btn btn-sm btn-primary" onClick={handleResolvedAtSave}>Kaydet</button>
                    <button className="btn btn-sm btn-outline-secondary" onClick={() => setEditingResolvedAt(false)}>İptal</button>
                  </div>
                ) : (
                  <span
                    role={canEditDates && !editMode ? 'button' : undefined}
                    tabIndex={canEditDates && !editMode ? 0 : undefined}
                    onClick={() => { if (canEditDates && !editMode) { setResolvedAtInput(request.resolvedAt ? request.resolvedAt.substring(0, 10) : ''); setEditingResolvedAt(true); } }}
                    onKeyDown={(e) => e.key === 'Enter' && canEditDates && !editMode && setEditingResolvedAt(true)}
                    style={{ cursor: canEditDates && !editMode ? 'pointer' : 'default' }}
                    title={canEditDates && !editMode ? 'Çözülüş tarihini düzenle' : undefined}
                  >
                    {request.resolvedAt ? formatDate(request.resolvedAt) : <span className="text-muted">—</span>}
                  </span>
                )}
              </div>

              {/* Time spent */}
              <div className="col-4 col-md-3 text-muted fw-medium d-flex align-items-center gap-1">
                <TbClock size={13} /> Harcanan Zaman
              </div>
              <div className="col-8 col-md-9">
                {canEditDates && !editMode && editingTimeSpent ? (
                  <div>
                    <div className="d-flex gap-1">
                      <input
                        type="number"
                        className={`form-control form-control-sm ${timeSpentError ? 'is-invalid' : ''}`}
                        placeholder="Dakika"
                        style={{ width: '100px' }}
                        defaultValue={request.timeSpent || ''}
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
                    role={canEditDates && !editMode ? 'button' : undefined}
                    tabIndex={canEditDates && !editMode ? 0 : undefined}
                    onClick={() => { if (canEditDates && !editMode) { setTimeSpentInput(String(request.timeSpent || '')); setEditingTimeSpent(true); } }}
                    onKeyDown={(e) => e.key === 'Enter' && canEditDates && !editMode && setEditingTimeSpent(true)}
                    style={{ cursor: canEditDates && !editMode ? 'pointer' : 'default' }}
                    title={canEditDates && !editMode ? 'Harcanan zamanı düzenle' : undefined}
                  >
                    {formatTimeSpent(request.timeSpent)}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Süreler: bekleme (açılış → işleme alınma), çözüm (işleme alınma → çözülme), toplam */}
          {(() => {
            const d = requestDurations(request);
            const cells = [
              { label: 'Bekleme Süresi', part: d.waiting, hint: 'Açıldığı andan işleme alınana kadar', color: '#D4A000' },
              { label: 'Çözüm Süresi', part: d.resolution, hint: 'İşleme alındığı andan çözülene kadar', color: '#FF991F' },
              { label: 'Toplam Süre', part: d.total, hint: 'Açıldığı andan çözülene kadar', color: '#00875A' },
            ];
            return (
              <div className="row g-2 mt-3">
                {cells.map(({ label, part, hint, color }) => (
                  <div className="col-4" key={label}>
                    <div className="rounded-3 border p-2 h-100" title={hint} style={{ borderLeft: `3px solid ${color}` }}>
                      <div className="text-muted fw-semibold" style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        {label}
                      </div>
                      <div className="fw-bold" style={{ color, fontSize: '1rem' }}>{formatDuration(part?.ms ?? null)}</div>
                      <div className="text-muted" style={{ fontSize: '0.7rem' }}>
                        {!part ? 'Kayıt yok' : part.ongoing ? 'devam ediyor' : hint}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}

          <hr className="my-3" />

          {/* Description */}
          <div className="mb-4">
            <h6 className="fw-semibold text-muted text-uppercase mb-2" style={{ fontSize: '0.75rem', letterSpacing: '0.05em' }}>
              Açıklama
            </h6>
            {editMode ? (
              <textarea
                className="form-control"
                rows={5}
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Talep açıklaması..."
              />
            ) : request.description ? (
              <p className="mb-0" style={{ whiteSpace: 'pre-wrap', fontSize: '0.9rem' }}>{request.description}</p>
            ) : (
              <p className="text-muted fst-italic mb-0" style={{ fontSize: '0.875rem' }}>Açıklama eklenmemiş.</p>
            )}
          </div>

          {/* Müdürlük talep formu cevapları (talep açılırken verilen) */}
          {(request.requestFormName || request.requestAnswers?.length > 0) && (
            <div className="mb-4">
              <h6 className="fw-semibold text-muted text-uppercase mb-2 d-flex align-items-center gap-2" style={{ fontSize: '0.75rem', letterSpacing: '0.05em' }}>
                Talep Bilgileri
                {request.requestFormName && (
                  <span className="badge bg-primary bg-opacity-10 text-primary text-capitalize" style={{ letterSpacing: 0 }}>
                    {request.requestFormName}
                  </span>
                )}
              </h6>
              {request.requestAnswers?.length > 0 && (
              <dl className="row mb-0 rounded border p-2 mx-0" style={{ fontSize: '0.875rem', background: '#F8FAFC' }}>
                {request.requestAnswers.map((a) => (
                  <React.Fragment key={a.questionId}>
                    <dt className="col-12 col-md-5 text-dark fw-semibold">{a.label}</dt>
                    <dd className="col-12 col-md-7 mb-2" style={{ whiteSpace: 'pre-wrap' }}>
                      {a.type === 'file' ? (
                        <div className="d-flex flex-column align-items-start gap-1">
                          {(a.value || []).map((file) => (
                            <button key={file.id} type="button"
                              className="btn btn-link btn-sm p-0 text-decoration-none d-flex align-items-center gap-1"
                              title="İndir"
                              onClick={() => filesApi.download(file.id, file.name).catch((err) => alert(err.message || 'Dosya indirilemedi'))}>
                              <TbPaperclip size={14} /> {file.name}
                              <span className="text-muted">({formatBytes(file.size)})</span>
                            </button>
                          ))}
                        </div>
                      ) : formatAnswer(a)}
                    </dd>
                  </React.Fragment>
                ))}
              </dl>
              )}
            </div>
          )}

          <hr className="my-3" />

          {/* Activity tabs */}
          <div>
            <h6 className="fw-semibold text-muted text-uppercase mb-3" style={{ fontSize: '0.75rem', letterSpacing: '0.05em' }}>
              Aktivite
            </h6>
            <ul className="nav nav-tabs mb-3" style={{ fontSize: '0.875rem' }}>
              <li className="nav-item">
                <button className={`nav-link py-1 px-3 ${activeTab === 'comments' ? 'active' : ''}`} onClick={() => setActiveTab('comments')}>Yorumlar</button>
              </li>
              <li className="nav-item">
                <button className={`nav-link py-1 px-3 ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>Geçmiş</button>
              </li>
              <li className="nav-item">
                <button className={`nav-link py-1 px-3 ${activeTab === 'all' ? 'active' : ''}`} onClick={() => setActiveTab('all')}>Tümü</button>
              </li>
            </ul>
            {(activeTab === 'comments' || activeTab === 'all') && (
              <div className="mb-3"><CommentSection issueId={request.id} /></div>
            )}
            {(activeTab === 'history' || activeTab === 'all') && (
              <ActivityFeed issueId={request.id} />
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
                  defaultValue={request.assigneeTeamId ? `t:${request.assigneeTeamId}` : request.assigneeId ? `u:${request.assigneeId}` : ''}
                  onChange={(e) => handleAssigneeChange(e.target.value)}
                  onBlur={() => setEditingAssignee(false)}
                  autoFocus
                >
                  <option value="">— Atanmamış —</option>
                  {assignableUsers.map((u) => (
                    <option key={u.id} value={`u:${u.id}`}>{u.name}</option>
                  ))}
                  {teams.length > 0 && (
                    <optgroup label="Ekipler">
                      {teams.map((t) => (
                        <option key={t.id} value={`t:${t.id}`}>{t.name}</option>
                      ))}
                    </optgroup>
                  )}
                </select>
              ) : (
                <div
                  className="d-flex align-items-center gap-2"
                  role={canAssign ? 'button' : undefined}
                  tabIndex={canAssign ? 0 : undefined}
                  onClick={() => canAssign && setEditingAssignee(true)}
                  onKeyDown={(e) => e.key === 'Enter' && canAssign && setEditingAssignee(true)}
                  style={{ cursor: canAssign ? 'pointer' : 'default' }}
                  title={canAssign ? 'Atanan kişiyi değiştir' : undefined}
                >
                  {assignee ? (
                    <>
                      <Avatar name={assignee.name} color={assignee.avatarColor} size={24} />
                      <div>
                        <div className="fw-medium">{assignee.name}</div>
                        {canAssign && <div className="text-primary" style={{ fontSize: '0.75rem' }}>Değiştir</div>}
                      </div>
                    </>
                  ) : request.assigneeTeamId ? (
                    <div>
                      <div className="fw-medium">{teams.find((t) => t.id === request.assigneeTeamId)?.name || 'Ekip'}</div>
                      {canAssign && <div className="text-primary" style={{ fontSize: '0.75rem' }}>Değiştir</div>}
                    </div>
                  ) : (
                    <div>
                      <span className="text-muted">Atanmamış</span>
                      {canAssign && <div className="text-primary" style={{ fontSize: '0.75rem', cursor: 'pointer' }}>Ata</div>}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Reporter */}
            <div className={request.contactName ? 'mb-3' : 'mb-1'}>
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

            {/* Yardım masası: bu talep, başka biri adına telefonla/yüz yüze açıldıysa */}
            {request.contactName && (
              <div className="mb-1">
                <p className="text-muted mb-1 small fw-semibold d-flex align-items-center gap-1">
                  <TbPhone size={12} /> Talep Eden Kişi
                </p>
                <div className="fw-medium">{request.contactName}</div>
                {request.contactPhone && <div className="text-muted small">{request.contactPhone}</div>}
              </div>
            )}
          </div>

          {/* Puanlama */}
          {(canRate || request.ratedAt) && (
            <div className="p-3 rounded mb-3" style={{ backgroundColor: '#F4F5F7', fontSize: '0.85rem' }}>
              <h6 className="fw-semibold text-muted text-uppercase mb-2" style={{ fontSize: '0.7rem', letterSpacing: '0.05em' }}>
                Çözüm Değerlendirmesi
              </h6>
              {request.ratedAt ? (
                <>
                  <StarRating value={request.rating} size={16} />
                  {request.ratingComment && <p className="text-muted small mt-2 mb-0 fst-italic">"{request.ratingComment}"</p>}
                </>
              ) : (
                <>
                  <StarRating value={rating} onRate={setRating} size={20} />
                  <textarea
                    className="form-control form-control-sm mt-2"
                    rows={2}
                    placeholder="İsteğe bağlı yorum..."
                    value={ratingComment}
                    onChange={(e) => setRatingComment(e.target.value)}
                  />
                  <button
                    className="btn btn-sm btn-primary mt-2"
                    disabled={!rating || ratingSubmitting}
                    onClick={handleRate}
                  >
                    {ratingSubmitting ? 'Gönderiliyor…' : 'Puanı Gönder'}
                  </button>
                </>
              )}
            </div>
          )}

          {/* Dates */}
          <div className="p-3 rounded" style={{ backgroundColor: '#F4F5F7', fontSize: '0.85rem' }}>
            <h6 className="fw-semibold text-muted text-uppercase mb-3" style={{ fontSize: '0.7rem', letterSpacing: '0.05em' }}>
              Tarihler
            </h6>
            <div className="mb-2">
              <p className="text-muted mb-0 small fw-semibold">Oluşturulma</p>
              <span title={formatDate(request.createdAt)}>{timeAgo(request.createdAt) || '—'}</span>
            </div>
            <div className="mb-2">
              <p className="text-muted mb-0 small fw-semibold">Güncelleme</p>
              <span title={formatDate(request.updatedAt)}>{timeAgo(request.updatedAt) || timeAgo(request.createdAt) || '—'}</span>
            </div>
          </div>
        </div>
      </div>
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="Talebi Sil"
        message={`"${request.title}" talebini silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.`}
        confirmText="Sil"
      />

      {/* Geri Çevir Modalı */}
      {showRejectModal && (
        <div
          className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999 }}
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
                rows={3}
                placeholder="Geri çevirme nedenini açıklayın..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                autoFocus
              />
            </div>
            <div className="d-flex gap-2 justify-content-end">
              <button className="btn btn-outline-secondary btn-sm" onClick={() => { setShowRejectModal(false); setRejectReason(''); }}>
                İptal
              </button>
              <button
                className="btn btn-warning btn-sm"
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
        issue={request}
        onConfirm={() => setShowDoneModal(false)}
        onCancel={() => setShowDoneModal(false)}
      />

      {/* Yönlendir Modalı */}
      {showForwardModal && (
        <div
          className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999 }}
        >
          <div className="bg-white rounded-3 shadow-lg p-4" style={{ width: '100%', maxWidth: 500 }}>
            <h6 className="fw-semibold mb-3">Talebi Yönlendir</h6>
            <p className="text-muted small mb-3">Talep seçtiğiniz müdürlüğe taşınır, ataması kaldırılır ve durumu "Yönlendirildi" olur.</p>
            <div className="mb-3">
              <label className="form-label small fw-semibold">Hedef Müdürlük <span className="text-danger">*</span></label>
              <select className="form-select" value={forwardTargetId} onChange={(e) => setForwardTargetId(e.target.value)} autoFocus>
                <option value="">— Müdürlük seçin —</option>
                {forwardTargets.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="mb-4">
              <label className="form-label small fw-semibold">Not (isteğe bağlı)</label>
              <textarea className="form-control" rows={2} value={forwardNote} onChange={(e) => setForwardNote(e.target.value)} />
            </div>
            <div className="d-flex gap-2 justify-content-end">
              <button className="btn btn-outline-secondary btn-sm" onClick={() => { setShowForwardModal(false); setForwardTargetId(''); setForwardNote(''); }}>İptal</button>
              <button className="btn btn-primary btn-sm" onClick={handleForward} disabled={!forwardTargetId}>Yönlendir</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={showCancelConfirm}
        onClose={() => setShowCancelConfirm(false)}
        onConfirm={handleCancel}
        title="Talebi İptal Et"
        message="Bu talebi iptal etmek istediğinizden emin misiniz? Bu işlem geri alınamaz."
        confirmText="İptal Et"
      />
    </div>
  );
}

export default RequestDetailContent;
