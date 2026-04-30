import React, { useState } from 'react';
import {
  TbCopy,
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
import { usePermissions } from '../../hooks/usePermissions';
import {
  ACTIONS,
  ACTIVITY_TYPES,
  STATUSES,
  PRIORITIES,
  ISSUE_TYPES,
  ROLES,
} from '../../constants';
import { canChangeAssignee } from '../../utils/permissionUtils';
import { generateId, getNextIssueNumber } from '../../utils/issueUtils';
import { formatDate, timeAgo, formatTimeSpent } from '../../utils/dateUtils';
import Avatar from '../common/Avatar';
import Badge from '../common/Badge';
import PriorityIcon from '../common/PriorityIcon';
import CommentSection from './CommentSection';
import ActivityFeed from './ActivityFeed';
import ConfirmDialog from '../common/ConfirmDialog';

/**
 * Unified Jira-style detail content for ALL issue types (Task, Bug, Story, Epic, Request).
 * Rendered inside IssueModal (and RequestDetailModal for requests).
 *
 * @param {Object}   props
 * @param {Object}   props.issue            - The issue object
 * @param {Function} props.onClose          - Close the parent modal
 * @param {boolean}  [props.readonly]       - Disable editing
 * @param {Function} [props.onCloneSuccess] - Called with newId after clone (requests only)
 */
function IssueDetailContent({ issue, onClose, readonly = false, onCloneSuccess }) {
  const { state, dispatch } = useAppContext();
  const { currentUser } = useAuth();
  const { isExternalUser } = usePermissions();

  // ── Edit mode ─────────────────────────────────────────────────────────────
  const [editMode, setEditMode] = useState(false);
  const [title, setTitle] = useState(issue.title);
  const [description, setDescription] = useState(issue.description ?? '');
  const [editType, setEditType] = useState(issue.type);
  const [editPriority, setEditPriority] = useState(issue.priority);
  const [editStatus, setEditStatus] = useState(issue.status);
  const [editAssigneeId, setEditAssigneeId] = useState(issue.assigneeId ?? '');
  const [editProjectId, setEditProjectId] = useState(issue.projectId ?? '');

  // ── Inline field editing (non-edit-mode) ─────────────────────────────────
  const [editingStatus, setEditingStatus] = useState(false);
  const [editingAssignee, setEditingAssignee] = useState(false);
  const [editingTimeSpent, setEditingTimeSpent] = useState(false);
  const [editingResolvedAt, setEditingResolvedAt] = useState(false);
  const [timeSpentInput, setTimeSpentInput] = useState('');
  const [resolvedAtInput, setResolvedAtInput] = useState('');
  const [timeSpentError, setTimeSpentError] = useState('');

  // ── Other state ───────────────────────────────────────────────────────────
  const [cloning, setCloning] = useState(false);
  const [activeTab, setActiveTab] = useState('comments');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [newVisibleUserId, setNewVisibleUserId] = useState('');

  // ── Derived data ──────────────────────────────────────────────────────────
  const assignee = state.users.find((u) => u.id === issue.assigneeId);
  const reporter = state.users.find((u) => u.id === issue.reporterId);
  const project = state.projects.find((p) => p.id === issue.projectId);
  const unit = state.units?.find((u) => u.unitCode === issue.unitCode);
  const externalUsers = state.users.filter((u) => u.role === ROLES.EXTERNAL_USER);
  const unitProjects = state.projects.filter((p) => unit ? p.unitId === unit.id : false);

  const canAssign = canChangeAssignee(currentUser, issue, state.projects);
  const canEditDates =
    currentUser &&
    [ROLES.SYSTEM_ADMIN, ROLES.DEPARTMENT_HEAD, ROLES.PROJECT_MANAGER].includes(
      currentUser.role
    );
  const canClone =
    issue.isRequest && (!isExternalUser || issue.reporterId === currentUser?.id);

  const assignableUsers = state.users.filter((u) => {
    if (u.role === ROLES.EXTERNAL_USER) return false;
    if (currentUser?.role === ROLES.SYSTEM_ADMIN) return true;
    if (u.role === ROLES.WORKER) return u.projectId === issue.projectId;
    if (u.role === ROLES.PROJECT_MANAGER) return project?.managerId === u.id;
    if (u.role === ROLES.DEPARTMENT_HEAD) return u.unitId === project?.unitId;
    return false;
  });

  // ── Helpers ───────────────────────────────────────────────────────────────
  function dispatchActivity(description, type = ACTIVITY_TYPES.FIELD_UPDATE) {
    if (!currentUser) return;
    dispatch({
      type: ACTIONS.ADD_ACTIVITY,
      payload: {
        id: generateId(),
        issueId: issue.id,
        userId: currentUser.id,
        type,
        description,
        createdAt: new Date().toISOString(),
      },
    });
  }

  // ── Full edit save ────────────────────────────────────────────────────────
  function handleSave() {
    if (!currentUser) return;
    const projectChanged = issue.projectId !== editProjectId;
    const changes = [];
    if (issue.status !== editStatus)
      changes.push({ type: ACTIVITY_TYPES.STATUS_CHANGE, desc: `Durum "${issue.status}" → "${editStatus}" olarak değiştirildi` });
    if (issue.assigneeId !== (editAssigneeId || null)) {
      const newUser = state.users.find((u) => u.id === editAssigneeId);
      changes.push({ type: ACTIVITY_TYPES.ASSIGNMENT, desc: newUser ? `${newUser.name}'a atandı` : 'Atama kaldırıldı' });
    }
    if (issue.title !== title || issue.description !== description || issue.priority !== editPriority || issue.type !== editType)
      changes.push({ type: ACTIVITY_TYPES.FIELD_UPDATE, desc: 'Alan güncellendi' });
    if (projectChanged) {
      const oldProj = state.projects.find((p) => p.id === issue.projectId);
      const newProj = state.projects.find((p) => p.id === editProjectId);
      changes.push({ type: ACTIVITY_TYPES.FIELD_UPDATE, desc: `Proje "${oldProj?.name || '?'}" → "${newProj?.name || '?'}" olarak değiştirildi` });
    }

    const newProject = state.projects.find((p) => p.id === editProjectId);
    const newUnitCode = newProject
      ? state.units?.find((u) => u.id === newProject.unitId)?.unitCode || issue.unitCode
      : issue.unitCode;

    dispatch({
      type: ACTIONS.UPDATE_ISSUE,
      payload: {
        id: issue.id,
        title,
        description,
        type: editType,
        priority: editPriority,
        status: editStatus,
        assigneeId: editAssigneeId || null,
        projectId: editProjectId,
        unitCode: newUnitCode,
      },
    });
    changes.forEach(({ type: t, desc }) => dispatchActivity(desc, t));
    setEditMode(false);

    // Proje değiştiyse modal'ı kapat — eski projede tekrar düzenleme yapılmasın
    if (projectChanged) {
      onClose?.();
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
    setEditMode(false);
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  function handleDelete() {
    dispatch({ type: ACTIONS.DELETE_ISSUE, payload: { issueId: issue.id } });
    onClose?.();
  }

  // ── Inline status change ──────────────────────────────────────────────────
  function handleStatusChange(newStatus) {
    if (newStatus === issue.status) { setEditingStatus(false); return; }
    dispatch({ type: ACTIONS.MOVE_ISSUE, payload: { issueId: issue.id, newStatus } });
    dispatchActivity(`Durum "${issue.status}" → "${newStatus}" olarak değiştirildi`, ACTIVITY_TYPES.STATUS_CHANGE);
    setEditingStatus(false);
  }

  // ── Inline assignee change ────────────────────────────────────────────────
  function handleAssigneeChange(newAssigneeId) {
    if (!canAssign) return;
    const oldName = assignee?.name ?? 'Atanmamış';
    const newUser = state.users.find((u) => u.id === newAssigneeId);
    dispatch({ type: ACTIONS.UPDATE_REQUEST_ASSIGNEE, payload: { issueId: issue.id, assigneeId: newAssigneeId || null } });
    dispatchActivity(`Atama değiştirildi: ${oldName} → ${newUser?.name ?? 'Atanmamış'}`, ACTIVITY_TYPES.ASSIGNMENT);
    setEditingAssignee(false);
  }

  // ── Time spent ────────────────────────────────────────────────────────────
  function handleTimeSpentSave() {
    const val = parseInt(timeSpentInput, 10);
    if (isNaN(val) || val < 0) { setTimeSpentError('Harcanan zaman negatif olamaz'); return; }
    setTimeSpentError('');
    dispatch({ type: ACTIONS.UPDATE_REQUEST_DATES, payload: { issueId: issue.id, resolvedAt: issue.resolvedAt, timeSpent: val } });
    dispatchActivity(`Harcanan zaman güncellendi: ${val} dakika`);
    setEditingTimeSpent(false);
  }

  // ── Resolved at ───────────────────────────────────────────────────────────
  function handleResolvedAtSave() {
    const iso = resolvedAtInput ? new Date(resolvedAtInput).toISOString() : null;
    dispatch({ type: ACTIONS.UPDATE_REQUEST_DATES, payload: { issueId: issue.id, resolvedAt: iso, timeSpent: issue.timeSpent } });
    dispatchActivity(`Çözülüş tarihi güncellendi: ${iso ? formatDate(iso) : '—'}`);
    setEditingResolvedAt(false);
  }

  // ── Clone (requests only) ─────────────────────────────────────────────────
  function handleClone() {
    if (cloning) return;
    setCloning(true);
    const newId = generateId();
    const newNumber = getNextIssueNumber(state.issues, issue.unitCode);
    dispatch({ type: ACTIONS.CLONE_REQUEST, payload: { sourceIssueId: issue.id, newId, newNumber, clonedAt: new Date().toISOString() } });
    setCloning(false);
    onClose();
    if (onCloneSuccess) onCloneSuccess(newId);
  }

  // ── Visible-to ────────────────────────────────────────────────────────────
  function handleAddVisible() {
    if (!newVisibleUserId) return;
    dispatch({ type: ACTIONS.ADD_VISIBLE_USER, payload: { issueId: issue.id, userId: newVisibleUserId } });
    setNewVisibleUserId('');
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
        {!readonly && !editMode && !isExternalUser && (
          editingStatus ? (
            <select
              className="form-select form-select-sm"
              style={{ width: 'auto' }}
              defaultValue={issue.status}
              onChange={(e) => handleStatusChange(e.target.value)}
              onBlur={() => setEditingStatus(false)}
              autoFocus
            >
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          ) : (
            STATUSES.filter((s) => s !== issue.status).map((s) => (
              <button key={s} className="btn btn-sm btn-outline-secondary" onClick={() => handleStatusChange(s)}>
                {s}
              </button>
            ))
          )
        )}

        <div className="ms-auto d-flex gap-2">
          {/* Edit / Save / Cancel */}
          {!readonly && !isExternalUser && (
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
              <button className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1" onClick={() => setEditMode(true)}>
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

          {/* Clone (requests only) */}
          {canClone && !editMode && (
            <button
              className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1"
              onClick={handleClone}
              disabled={cloning}
            >
              <TbCopy size={14} /> Klonla
            </button>
          )}

          {/* Delete */}
          {!readonly && !isExternalUser && !editMode && (
            <button
              className="btn btn-sm btn-outline-danger d-flex align-items-center gap-1"
              onClick={() => setShowDeleteConfirm(true)}
            >
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
                {editMode ? (
                  <select className="form-select form-select-sm" value={editType} onChange={(e) => setEditType(e.target.value)}>
                    {ISSUE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                ) : (
                  <Badge label={issue.type} type="issueType" />
                )}
              </div>

              {/* Priority */}
              <div className="col-4 col-md-3 text-muted fw-medium d-flex align-items-center gap-1">
                <TbFlag size={13} /> Öncelik
              </div>
              <div className="col-8 col-md-9">
                {editMode ? (
                  <select className="form-select form-select-sm" value={editPriority} onChange={(e) => setEditPriority(e.target.value)}>
                    {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
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
                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                ) : (
                  <Badge label={issue.status} type="status" />
                )}
              </div>

              {/* Project — her issue için göster, edit modunda değiştirilebilir */}
              <div className="col-4 col-md-3 text-muted fw-medium d-flex align-items-center gap-1">
                📁 Proje
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
                    {unitProjects.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                ) : (
                  <span className="small">{project?.name || '—'}</span>
                )}
              </div>

              {/* Project (requests only) */}
              {issue.isRequest && (
                <>
                  <div className="col-4 col-md-3 text-muted fw-medium d-flex align-items-center gap-1">
                    📁 Proje
                  </div>
                  <div className="col-8 col-md-9">
                    {editMode ? (
                      <select
                        className="form-select form-select-sm"
                        data-testid="project-select"
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
                </>
              )}

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
              ) : editMode ? (
                <select
                  className="form-select form-select-sm"
                  value={editAssigneeId}
                  onChange={(e) => setEditAssigneeId(e.target.value)}
                >
                  <option value="">— Atanmamış —</option>
                  {state.users
                    .filter((u) => {
                      if (u.role === ROLES.EXTERNAL_USER) return false;
                      const targetProject = state.projects.find((p) => p.id === editProjectId);
                      if (u.role === ROLES.WORKER) return u.projectId === editProjectId;
                      if (u.role === ROLES.PROJECT_MANAGER) return targetProject?.managerId === u.id;
                      if (u.role === ROLES.DEPARTMENT_HEAD) return u.unitId === targetProject?.unitId;
                      if (u.role === ROLES.SYSTEM_ADMIN) return true;
                      return false;
                    })
                    .map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
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

            {/* Visible-to (requests only, non-external, non-edit-mode) */}
            {issue.isRequest && !isExternalUser && !editMode && (
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
        title="Issue'yu Sil"
        message={`"${issue.title}" issue'sunu silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.`}
        confirmText="Sil"
      />
    </div>
  );
}

export default IssueDetailContent;
