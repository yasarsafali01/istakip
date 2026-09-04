import React, { useState } from 'react';
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
} from 'react-icons/tb';
import { useAppContext } from '../../context/AppContext';
import { useAuth } from '../../hooks/useAuth';
import { ACTIONS, STATUSES, PRIORITIES, ROLES } from '../../constants';
import { canChangeAssignee } from '../../utils/permissionUtils';
import { issuesApi, commentsApi, activitiesApi } from '../../api/resources';
import { buildUnitCodeByProjectId, mapIssue } from '../../api/mappers';
import { formatDate, timeAgo, formatTimeSpent } from '../../utils/dateUtils';
import Avatar from '../common/Avatar';
import Badge from '../common/Badge';
import PriorityIcon from '../common/PriorityIcon';
import CommentSection from '../issue/CommentSection';
import ActivityFeed from '../issue/ActivityFeed';
import ConfirmDialog from '../common/ConfirmDialog';
import TaskDoneModal from '../common/TaskDoneModal';

/**
 * Full Jira-style request detail content.
 * Rendered inside RequestDetailModal.
 */
function RequestDetailContent({ request, onClose, onCloneSuccess }) {
  const { state, dispatch } = useAppContext();
  const { currentUser } = useAuth();

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
  const canEdit = currentUser && (
    [ROLES.SYSTEM_ADMIN, ROLES.DEPARTMENT_HEAD, ROLES.PROJECT_MANAGER].includes(currentUser.role) ||
    isOwnRequest
  );
  // Silme: canEdit ile aynı kural (bkz. .kiro/specs/jira-clone-frontend bugfix — Hata 4/5)
  const canDelete = canEdit;
  const canEditDates = canEdit && !isExternalUser;

  // Projects available for reassignment (same unit as the request)
  const unitProjects = state.projects.filter((p) => {
    if (!unit) return false;
    const projectUnit = state.units?.find((u) => u.id === p.unitId);
    return projectUnit?.unitCode === request.unitCode;
  });

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
  async function handleAssigneeChange(newAssigneeId) {
    if (!canAssign) return;
    try {
      await issuesApi.updateAssignee(request.id, newAssigneeId || null);
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
  const canClone = canEdit;
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
        {!isExternalUser && !editMode && request.status !== 'Geri Çevrildi' && (
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
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            ) : (
              STATUSES.filter((s) => s !== request.status && s !== 'Geri Çevrildi').map((s) => (
                <button key={s} className="btn btn-sm btn-outline-secondary" onClick={() => handleStatusChange(s)}>
                  {s}
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
                    {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
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
                📁 Proje
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
                  defaultValue={request.assigneeId ?? ''}
                  onChange={(e) => handleAssigneeChange(e.target.value)}
                  onBlur={() => setEditingAssignee(false)}
                  autoFocus
                >
                  <option value="">— Atanmamış —</option>
                  {assignableUsers.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
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
          </div>

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
    </div>
  );
}

export default RequestDetailContent;
