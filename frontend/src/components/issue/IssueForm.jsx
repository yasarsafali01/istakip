import React, { useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { useAuth } from '../../hooks/useAuth';
import { ACTIONS, PRIORITIES, STATUSES, ISSUE_TYPES } from '../../constants';
import { issuesApi } from '../../api/resources';
import { buildUnitCodeByProjectId, mapIssue } from '../../api/mappers';

// "Done" always goes through the dedicated completion flow (resolution note
// + optional inventory usage), not this general edit form.
const EDITABLE_STATUSES = STATUSES.filter((s) => s !== 'Done');

/**
 * Form for creating or editing an issue.
 *
 * @param {Object}   props
 * @param {string}   props.projectId   - The project this issue belongs to
 * @param {Object}   [props.issue]     - Existing issue object (edit mode)
 * @param {Function} [props.onSuccess] - Called with the saved issue
 * @param {Function} [props.onCancel]  - Called when the user cancels
 */
function IssueForm({ projectId, issue, onSuccess, onCancel }) {
  const { state, dispatch } = useAppContext();
  const { currentUser } = useAuth();
  const isEdit = Boolean(issue);

  const [title, setTitle] = useState(issue?.title ?? '');
  const [description, setDescription] = useState(issue?.description ?? '');
  const [type, setType] = useState(issue?.type ?? 'Task');
  const [priority, setPriority] = useState(issue?.priority ?? 'Medium');
  const [status, setStatus] = useState(issue?.status ?? 'To Do');
  const [assigneeId, setAssigneeId] = useState(issue?.assigneeId ?? '');
  const [sprintId, setSprintId] = useState(issue?.sprintId ?? '');
  const [errors, setErrors] = useState({});

  const projectSprints = state.sprints.filter(
    s => s.projectId === projectId && s.status !== 'Completed'
  );

  // Only users who belong to this project
  const project = state.projects.find(p => p.id === projectId);
  const projectUsers = state.users.filter(u => {
    if (u.role === 'System_Admin') return true;
    if (u.role === 'External_User') return false;
    if (u.role === 'Worker') return u.projectId === projectId;
    if (u.role === 'Project_Manager') return project?.managerId === u.id;
    if (u.role === 'Department_Head') return u.unitId === project?.unitId;
    return false;
  });

  function validate() {
    const newErrors = {};
    if (!title.trim()) newErrors.title = 'Başlık zorunludur.';
    return newErrors;
  }

  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    if (!currentUser) return;

    setSubmitting(true);
    try {
      const unitCodeByProjectId = buildUnitCodeByProjectId(state.projects, state.units);

      if (isEdit) {
        await issuesApi.update(issue.id, {
          title: title.trim(),
          description: description.trim(),
          type,
          priority,
        });
        if (status !== issue.status) {
          await issuesApi.updateStatus(issue.id, status);
        }
        if (assigneeId !== (issue.assigneeId || '')) {
          await issuesApi.updateAssignee(issue.id, assigneeId || null);
        }
        if (sprintId !== (issue.sprintId || '')) {
          await issuesApi.moveSprint(issue.id, sprintId || null);
        }
        const fresh = mapIssue(await issuesApi.get(issue.id), unitCodeByProjectId);
        dispatch({ type: ACTIONS.UPDATE_ISSUE, payload: fresh });
        onSuccess?.(fresh);
      } else {
        const created = await issuesApi.create({
          projectId,
          sprintId: sprintId || null,
          title: title.trim(),
          description: description.trim(),
          type,
          priority,
          assigneeId: assigneeId || null,
          isRequest: type === 'Request',
        });
        const mapped = mapIssue(created, unitCodeByProjectId);
        dispatch({ type: ACTIONS.ADD_ISSUE, payload: mapped });
        onSuccess?.(mapped);
      }
    } catch (err) {
      setErrors({ title: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {/* Title */}
      <div className="mb-3">
        <label htmlFor="issue-title" className="form-label fw-semibold">
          Başlık <span className="text-danger" aria-hidden="true">*</span>
        </label>
        <input
          id="issue-title"
          type="text"
          className={`form-control ${errors.title ? 'is-invalid' : ''}`}
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Issue başlığı…"
          autoFocus
          aria-required="true"
          aria-describedby={errors.title ? 'issue-title-error' : undefined}
        />
        {errors.title && (
          <div id="issue-title-error" className="invalid-feedback">{errors.title}</div>
        )}
      </div>

      {/* Description */}
      <div className="mb-3">
        <label htmlFor="issue-description" className="form-label fw-semibold">
          Açıklama
        </label>
        <textarea
          id="issue-description"
          className="form-control"
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={4}
          placeholder="Issue hakkında detaylı açıklama…"
        />
      </div>

      <div className="row g-3 mb-3">
        {/* Type */}
        <div className="col-6">
          <label htmlFor="issue-type" className="form-label fw-semibold">Tip</label>
          <select
            id="issue-type"
            className="form-select"
            value={type}
            onChange={e => setType(e.target.value)}
          >
            {ISSUE_TYPES.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {/* Priority */}
        <div className="col-6">
          <label htmlFor="issue-priority" className="form-label fw-semibold">Öncelik</label>
          <select
            id="issue-priority"
            className="form-select"
            value={priority}
            onChange={e => setPriority(e.target.value)}
          >
            {PRIORITIES.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="row g-3 mb-3">
        {/* Status */}
        <div className="col-6">
          <label htmlFor="issue-status" className="form-label fw-semibold">Durum</label>
          <select
            id="issue-status"
            className="form-select"
            value={status}
            onChange={e => setStatus(e.target.value)}
          >
            {EDITABLE_STATUSES.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* Assignee */}
        <div className="col-6">
          <label htmlFor="issue-assignee" className="form-label fw-semibold">Atanan Kişi</label>
          <select
            id="issue-assignee"
            className="form-select"
            value={assigneeId}
            onChange={e => setAssigneeId(e.target.value)}
          >
            <option value="">— Atanmamış —</option>
            {projectUsers.map(user => (
              <option key={user.id} value={user.id}>{user.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Sprint */}
      <div className="mb-4">
        <label htmlFor="issue-sprint" className="form-label fw-semibold">Sprint</label>
        <select
          id="issue-sprint"
          className="form-select"
          value={sprintId}
          onChange={e => setSprintId(e.target.value)}
        >
          <option value="">— Backlog —</option>
          {projectSprints.map(sprint => (
            <option key={sprint.id} value={sprint.id}>
              {sprint.name} {sprint.status === 'Active' ? '(Aktif)' : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Actions */}
      <div className="d-flex justify-content-end gap-2">
        {onCancel && (
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            İptal
          </button>
        )}
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? 'Kaydediliyor...' : isEdit ? 'Kaydet' : 'Issue Oluştur'}
        </button>
      </div>
    </form>
  );
}

export default IssueForm;
