import React, { useState } from 'react';
import { TbEdit, TbTrash, TbX, TbCheck } from 'react-icons/tb';
import { useAppContext } from '../../context/AppContext';
import { useAuth } from '../../hooks/useAuth';
import { usePermissions } from '../../hooks/usePermissions';
import { ACTIONS, PRIORITIES, STATUSES, ISSUE_TYPES, ACTIVITY_TYPES, ROLES } from '../../constants';
import { generateId } from '../../utils/issueUtils';
import { formatDate } from '../../utils/dateUtils';
import Avatar from '../common/Avatar';
import Badge from '../common/Badge';
import PriorityIcon from '../common/PriorityIcon';
import CommentSection from './CommentSection';
import ActivityFeed from './ActivityFeed';
import ConfirmDialog from '../common/ConfirmDialog';

/**
 * Full detail view for a single issue with inline editing support.
 *
 * @param {Object}   props
 * @param {Object}   props.issue     - The issue object to display
 * @param {Function} [props.onClose] - Called when the detail view should close
 */
function IssueDetail({ issue, onClose, readonly = false }) {
  const { state, dispatch } = useAppContext();
  const { currentUser } = useAuth();
  const { isExternalUser } = usePermissions();
  const [editMode, setEditMode] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Inline edit state
  const [title, setTitle] = useState(issue.title);
  const [description, setDescription] = useState(issue.description ?? '');
  const [type, setType] = useState(issue.type);
  const [priority, setPriority] = useState(issue.priority);
  const [status, setStatus] = useState(issue.status);
  const [assigneeId, setAssigneeId] = useState(issue.assigneeId ?? '');

  // Visible-to management state
  const [newVisibleUserId, setNewVisibleUserId] = useState('');

  const project = state.projects.find(p => p.id === issue.projectId);
  const assignee = state.users.find(u => u.id === issue.assigneeId);
  const reporter = state.users.find(u => u.id === issue.reporterId);
  const externalUsers = state.users.filter(u => u.role === ROLES.EXTERNAL_USER);

  // Only users who belong to this project (workers assigned to it, PM, department head, admin)
  const projectUsers = state.users.filter(u => {
    if (u.role === ROLES.SYSTEM_ADMIN) return true;
    if (u.role === ROLES.EXTERNAL_USER) return false;
    if (u.role === ROLES.WORKER) return u.projectId === issue.projectId;
    if (u.role === ROLES.PROJECT_MANAGER) return project?.managerId === u.id;
    if (u.role === ROLES.DEPARTMENT_HEAD) return u.unitId === project?.unitId;
    return false;
  });

  function handleSave() {
    if (!currentUser) return;
    const now = new Date().toISOString();
    const changes = [];

    if (issue.status !== status)
      changes.push({ type: ACTIVITY_TYPES.STATUS_CHANGE, desc: `Durum "${issue.status}" → "${status}" olarak değiştirildi` });
    if (issue.assigneeId !== (assigneeId || null)) {
      const newAssignee = state.users.find(u => u.id === assigneeId);
      changes.push({ type: ACTIVITY_TYPES.ASSIGNMENT, desc: newAssignee ? `${newAssignee.name}'a atandı` : 'Atama kaldırıldı' });
    }
    if (issue.title !== title || issue.description !== description || issue.priority !== priority || issue.type !== type)
      changes.push({ type: ACTIVITY_TYPES.FIELD_UPDATE, desc: 'Alan güncellendi' });

    dispatch({
      type: ACTIONS.UPDATE_ISSUE,
      payload: { id: issue.id, title, description, type, priority, status, assigneeId: assigneeId || null },
    });

    changes.forEach(({ type: actType, desc }) => {
      dispatch({
        type: ACTIONS.ADD_ACTIVITY,
        payload: {
          id: generateId(),
          issueId: issue.id,
          userId: currentUser.id,
          type: actType,
          description: desc,
          createdAt: now,
        },
      });
    });

    setEditMode(false);
  }

  function handleCancelEdit() {
    setTitle(issue.title);
    setDescription(issue.description ?? '');
    setType(issue.type);
    setPriority(issue.priority);
    setStatus(issue.status);
    setAssigneeId(issue.assigneeId ?? '');
    setEditMode(false);
  }

  function handleDelete() {
    dispatch({ type: ACTIONS.DELETE_ISSUE, payload: { issueId: issue.id } });
    onClose?.();
  }

  function handleAddVisible() {
    if (!newVisibleUserId) return;
    dispatch({
      type: ACTIONS.ADD_VISIBLE_USER,
      payload: { issueId: issue.id, userId: newVisibleUserId },
    });
    setNewVisibleUserId('');
  }

  // issue.number is already in 'UNITCODE-N' format
  const issueKey = issue.number || (project ? `${project.key}-?` : `#?`);

  return (
    <div>
      {/* Toolbar */}
      <div className="d-flex align-items-center gap-2 mb-3">
        <span className="text-muted small fw-semibold">{issueKey}</span>
        <div className="ms-auto d-flex gap-2">
          {!readonly && !editMode ? (
            <button
              className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1"
              onClick={() => setEditMode(true)}
              aria-label="Düzenle"
            >
              <TbEdit size={14} aria-hidden="true" />
              Düzenle
            </button>
          ) : !readonly && editMode ? (
            <>
              <button
                className="btn btn-sm btn-primary d-flex align-items-center gap-1"
                onClick={handleSave}
                aria-label="Kaydet"
              >
                <TbCheck size={14} aria-hidden="true" />
                Kaydet
              </button>
              <button
                className="btn btn-sm btn-secondary d-flex align-items-center gap-1"
                onClick={handleCancelEdit}
                aria-label="İptal"
              >
                <TbX size={14} aria-hidden="true" />
                İptal
              </button>
            </>
          ) : null}
          {!readonly && (
            <button
              className="btn btn-sm btn-outline-danger d-flex align-items-center gap-1"
              onClick={() => setShowDeleteConfirm(true)}
              aria-label="Sil"
            >
              <TbTrash size={14} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      <div className="row g-4">
        {/* Left column: title, description, comments, activity */}
        <div className="col-12 col-lg-8">
          {/* Title */}
          {editMode ? (
            <input
              className="form-control fw-bold fs-5 mb-3"
              value={title}
              onChange={e => setTitle(e.target.value)}
              aria-label="Issue başlığı"
            />
          ) : (
            <h5 className="fw-bold mb-3">{issue.title}</h5>
          )}

          {/* Description */}
          <div className="mb-4">
            <p className="text-muted small fw-semibold mb-1">Açıklama</p>
            {editMode ? (
              <textarea
                className="form-control"
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={5}
                aria-label="Issue açıklaması"
              />
            ) : (
              <p className="small" style={{ whiteSpace: 'pre-wrap' }}>
                {issue.description || <span className="text-muted fst-italic">Açıklama yok.</span>}
              </p>
            )}
          </div>

          <hr />

          {/* Comments */}
          <div className="mb-4">
            <CommentSection issueId={issue.id} />
          </div>

          <hr />

          {/* Activity */}
          <ActivityFeed issueId={issue.id} />
        </div>

        {/* Right column: meta fields */}
        <div className="col-12 col-lg-4">
          <div className="card border-0 bg-light p-3">
            {/* Status */}
            <div className="mb-3">
              <p className="text-muted small fw-semibold mb-1">Durum</p>
              {editMode ? (
                <select className="form-select form-select-sm" value={status} onChange={e => setStatus(e.target.value)}>
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              ) : (
                <Badge label={issue.status} type="status" />
              )}
            </div>

            {/* Type */}
            <div className="mb-3">
              <p className="text-muted small fw-semibold mb-1">Tip</p>
              {editMode ? (
                <select className="form-select form-select-sm" value={type} onChange={e => setType(e.target.value)}>
                  {ISSUE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              ) : (
                <Badge label="Talep" type="issueType" />
              )}
            </div>

            {/* Priority */}
            <div className="mb-3">
              <p className="text-muted small fw-semibold mb-1">Öncelik</p>
              {editMode ? (
                <select className="form-select form-select-sm" value={priority} onChange={e => setPriority(e.target.value)}>
                  {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              ) : (
                <PriorityIcon priority={issue.priority} showLabel />
              )}
            </div>

            {/* Assignee */}
            <div className="mb-3">
              <p className="text-muted small fw-semibold mb-1">Atanan Kişi</p>
              {editMode ? (
                <select className="form-select form-select-sm" value={assigneeId} onChange={e => setAssigneeId(e.target.value)}>
                  <option value="">— Atanmamış —</option>
                  {projectUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              ) : assignee ? (
                <div className="d-flex align-items-center gap-2">
                  <Avatar name={assignee.name} color={assignee.avatarColor} size={24} />
                  <span className="small">{assignee.name}</span>
                </div>
              ) : (
                <span className="text-muted small fst-italic">Atanmamış</span>
              )}
            </div>

            {/* Reporter */}
            <div className="mb-3">
              <p className="text-muted small fw-semibold mb-1">Raporlayan</p>
              {reporter ? (
                <div className="d-flex align-items-center gap-2">
                  <Avatar name={reporter.name} color={reporter.avatarColor} size={24} />
                  <span className="small">{reporter.name}</span>
                </div>
              ) : (
                <span className="text-muted small fst-italic">Bilinmiyor</span>
              )}
            </div>

            {/* Visible-to management (only for Request issues, non-external users, view mode) */}
            {issue.isRequest && !isExternalUser && !editMode && (
              <div className="mb-3">
                <p className="text-muted small fw-semibold mb-1">Görünür Kullanıcılar</p>
                <div className="d-flex gap-2 mb-2">
                  <select
                    className="form-select form-select-sm"
                    value={newVisibleUserId}
                    onChange={e => setNewVisibleUserId(e.target.value)}
                    aria-label="Görünür kullanıcı ekle"
                  >
                    <option value="">Kullanıcı ekle...</option>
                    {externalUsers
                      .filter(u => !issue.visibleTo.includes(u.id))
                      .map(u => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                  </select>
                  <button
                    className="btn btn-sm btn-outline-primary"
                    onClick={handleAddVisible}
                    disabled={!newVisibleUserId}
                    aria-label="Kullanıcı ekle"
                  >
                    Ekle
                  </button>
                </div>
                {issue.visibleTo.length > 0 && (
                  <ul className="list-unstyled mb-0">
                    {issue.visibleTo.map(uid => {
                      const u = state.users.find(x => x.id === uid);
                      return (
                        <li key={uid} className="small text-muted">• {u?.name || uid}</li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}

            {/* Dates */}
            <div className="mb-1">
              <p className="text-muted small fw-semibold mb-1">Oluşturulma</p>
              <p className="small mb-0">{formatDate(issue.createdAt)}</p>
            </div>
            <div>
              <p className="text-muted small fw-semibold mb-1">Güncelleme</p>
              <p className="small mb-0">{formatDate(issue.updatedAt)}</p>
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

export default IssueDetail;
