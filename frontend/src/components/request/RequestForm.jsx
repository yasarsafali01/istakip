import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';
import { useAuth } from '../../hooks/useAuth';
import { ACTIONS } from '../../constants';
import { issuesApi } from '../../api/resources';
import { buildUnitCodeByProjectId, mapIssue } from '../../api/mappers';

export default function RequestForm({ onClose, defaultUnitId = '' }) {
  const { state, dispatch } = useAppContext();
  const { currentUser } = useAuth();

  const [unitId, setUnitId] = useState(defaultUnitId || currentUser?.unitId || '');
  const [projectId, setProjectId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('Medium');
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Projects belonging to the selected unit
  const unitProjects = unitId
    ? state.projects.filter(p => p.unitId === unitId)
    : [];

  // Auto-select project when unit is pre-filled and has exactly one project
  useEffect(() => {
    if (defaultUnitId && unitProjects.length === 1) {
      setProjectId(unitProjects[0].id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultUnitId, unitProjects.length]);

  function handleUnitChange(e) {
    const newUnitId = e.target.value;
    setUnitId(newUnitId);
    setProjectId(''); // reset project when unit changes
    // Auto-select if the new unit has exactly one project
    const projects = state.projects.filter(p => p.unitId === newUnitId);
    if (projects.length === 1) {
      setProjectId(projects[0].id);
    }
  }

  function validate() {
    const errs = {};
    if (!title.trim()) errs.title = 'Talep başlığı zorunludur.';
    if (!unitId) errs.unitId = 'Lütfen bir birim seçin.';
    if (!projectId) errs.projectId = 'Lütfen bir proje seçin.';
    return errs;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    if (!currentUser) return;

    setSubmitting(true);
    try {
      const created = await issuesApi.create({
        projectId,
        title: title.trim(),
        description: description.trim(),
        priority,
        isRequest: true,
      });
      const unitCodeByProjectId = buildUnitCodeByProjectId(state.projects, state.units);
      dispatch({ type: ACTIONS.ADD_ISSUE, payload: mapIssue(created, unitCodeByProjectId) });
      onClose();
    } catch (err) {
      setErrors({ title: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {/* Birim */}
      <div className="mb-3">
        <label htmlFor="req-unit" className="form-label fw-medium">
          Birim <span className="text-danger">*</span>
        </label>
        <select
          id="req-unit"
          className={`form-select ${errors.unitId ? 'is-invalid' : ''}`}
          value={unitId}
          onChange={handleUnitChange}
        >
          <option value="">— Birim seçin —</option>
          {state.units.map(u => (
            <option key={u.id} value={u.id}>{u.name} ({u.unitCode})</option>
          ))}
        </select>
        {errors.unitId && <div className="invalid-feedback">{errors.unitId}</div>}
      </div>

      {/* Proje — sadece birim seçilince görünür */}
      {unitId && (
        <div className="mb-3">
          <label htmlFor="req-project" className="form-label fw-medium">
            Proje <span className="text-danger">*</span>
          </label>
          {unitProjects.length === 0 ? (
            <div className="alert alert-warning py-2 small mb-0">
              Bu birime ait proje bulunamadı.
            </div>
          ) : (
            <select
              id="req-project"
              className={`form-select ${errors.projectId ? 'is-invalid' : ''}`}
              value={projectId}
              onChange={e => setProjectId(e.target.value)}
            >
              <option value="">— Proje seçin —</option>
              {unitProjects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}
          {errors.projectId && <div className="invalid-feedback">{errors.projectId}</div>}
        </div>
      )}

      {/* Başlık */}
      <div className="mb-3">
        <label htmlFor="req-title" className="form-label fw-medium">
          Başlık <span className="text-danger">*</span>
        </label>
        <input
          id="req-title"
          type="text"
          className={`form-control ${errors.title ? 'is-invalid' : ''}`}
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Talebinizi kısaca açıklayın"
        />
        {errors.title && <div className="invalid-feedback">{errors.title}</div>}
      </div>

      {/* Açıklama */}
      <div className="mb-3">
        <label htmlFor="req-desc" className="form-label fw-medium">Açıklama</label>
        <textarea
          id="req-desc"
          className="form-control"
          rows={4}
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Talebinizi detaylı açıklayın..."
        />
      </div>

      {/* Öncelik */}
      <div className="mb-4">
        <label htmlFor="req-priority" className="form-label fw-medium">Öncelik</label>
        <select
          id="req-priority"
          className="form-select"
          value={priority}
          onChange={e => setPriority(e.target.value)}
        >
          {['Highest', 'High', 'Medium', 'Low', 'Lowest'].map(p => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>

      <div className="d-flex gap-2 justify-content-end">
        <button type="button" className="btn btn-outline-secondary" onClick={onClose}>İptal</button>
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? 'Gönderiliyor...' : 'Talep Oluştur'}
        </button>
      </div>
    </form>
  );
}
