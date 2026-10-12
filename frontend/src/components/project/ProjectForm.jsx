import React, { useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { ACTIONS, ROLES } from '../../constants';
import { projectsApi } from '../../api/resources';
import { inProject } from '../../utils/permissionUtils';
import Avatar from '../common/Avatar';

/**
 * Form for creating or editing a project.
 *
 * @param {Object}   props
 * @param {Object}   [props.project]      - Existing project to edit (omit for create mode)
 * @param {Function} props.onSuccess      - Called after successful submission
 * @param {Function} props.onCancel       - Called when the user cancels
 * @param {string}   [props.defaultUnitId] - Pre-selected unit ID (create mode only)
 */
function ProjectForm({ project, onSuccess, onCancel, defaultUnitId }) {
  const { state, dispatch, hydrateAll } = useAppContext();
  const isEdit = Boolean(project);

  const [name, setName] = useState(project?.name ?? '');
  const [unitId, setUnitId] = useState(project?.unitId ?? defaultUnitId ?? '');
  const [managerId, setManagerId] = useState(project?.managerId ?? '');
  const [description, setDescription] = useState(project?.description ?? '');
  const [hasInventory, setHasInventory] = useState(project?.hasInventory ?? false);
  const [errors, setErrors] = useState({});
  const [staffIds, setStaffIds] = useState(() =>
    project ? state.users.filter((u) => u.isActive !== false && inProject(u, project.id)).map((u) => u.id) : []
  );
  const [staffQuery, setStaffQuery] = useState('');

  // Personnel: anyone active in the daire başkanlığı; one person may serve in
  // several müdürlükler. Someone whose only müdürlük is this one can't be
  // unticked (everyone belongs to at least one müdürlük).
  const projectIdsOf = (u) => (u.projectIds?.length ? u.projectIds : [u.projectId]).filter(Boolean);
  const unitStaff = state.users.filter(
    (u) => u.isActive !== false && u.role !== ROLES.EXTERNAL_USER && unitId && u.unitId === unitId
  );
  const lockedIds = new Set(
    project ? unitStaff.filter((u) => projectIdsOf(u).length === 1 && projectIdsOf(u)[0] === project.id).map((u) => u.id) : []
  );
  const shownStaff = unitStaff.filter((u) => {
    const q = staffQuery.trim().toLocaleLowerCase('tr');
    return !q || u.name.toLocaleLowerCase('tr').includes(q) || u.email.toLowerCase().includes(q);
  });
  const toggleStaff = (id) =>
    setStaffIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  // If a unit is pre-selected, only show managers from that unit
  const projectManagers = state.users.filter((u) => u.isActive !== false).filter(u =>
    u.role === ROLES.PROJECT_MANAGER && (unitId ? u.unitId === unitId : true)
  );

  function validate() {
    const errs = {};
    if (!name.trim()) errs.name = 'Müdürlük adı zorunludur.';
    if (!unitId) errs.unitId = 'Lütfen bir daire başkanlığı seçin.';
    if (!managerId) errs.managerId = 'Lütfen bir müdür seçin.';
    return errs;
  }

  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    setSubmitting(true);
    try {
      if (isEdit) {
        const updated = await projectsApi.update(project.id, {
          name: name.trim(),
          managerId,
          description: description.trim(),
          hasInventory,
        });
        dispatch({ type: ACTIONS.UPDATE_PROJECT, payload: updated });
        await projectsApi.setMembers(project.id, staffIds);
        await hydrateAll();
        onSuccess?.(updated);
      } else {
        const created = await projectsApi.create({
          name: name.trim(),
          unitId,
          managerId,
          description: description.trim(),
          hasInventory,
        });
        dispatch({ type: ACTIONS.ADD_PROJECT, payload: created });
        if (staffIds.length > 0) {
          await projectsApi.setMembers(created.id, staffIds);
          await hydrateAll();
        }
        onSuccess?.(created);
      }
    } catch (err) {
      setErrors({ name: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {/* Project Name */}
      <div className="mb-3">
        <label htmlFor="proj-name" className="form-label fw-semibold">
          Müdürlük Adı <span className="text-danger" aria-hidden="true">*</span>
        </label>
        <input
          id="proj-name"
          type="text"
          className={`form-control ${errors.name ? 'is-invalid' : ''}`}
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Müdürlük adı..."
          autoFocus
          aria-required="true"
          aria-describedby={errors.name ? 'proj-name-error' : undefined}
        />
        {errors.name && (
          <div id="proj-name-error" className="invalid-feedback">{errors.name}</div>
        )}
      </div>

      {/* Unit */}
      <div className="mb-3">
        <label htmlFor="proj-unit" className="form-label fw-semibold">
          Daire Başkanlığı <span className="text-danger" aria-hidden="true">*</span>
        </label>
        {(defaultUnitId || isEdit) ? (
          <input
            id="proj-unit"
            type="text"
            className="form-control"
            value={state.units.find(u => u.id === unitId)?.name || ''}
            readOnly
            style={{ backgroundColor: '#f8f9fa' }}
          />
        ) : (
          <select
            id="proj-unit"
            className={`form-select ${errors.unitId ? 'is-invalid' : ''}`}
            value={unitId}
            onChange={e => { setUnitId(e.target.value); setManagerId(''); }}
            aria-required="true"
            aria-describedby={errors.unitId ? 'proj-unit-error' : undefined}
          >
            <option value="">— Daire başkanlığı seçin —</option>
            {state.units.map(u => (
              <option key={u.id} value={u.id}>{u.name} ({u.unitCode})</option>
            ))}
          </select>
        )}
        {errors.unitId && (
          <div id="proj-unit-error" className="invalid-feedback">{errors.unitId}</div>
        )}
      </div>

      {/* Project Manager */}
      <div className="mb-3">
        <label htmlFor="proj-manager" className="form-label fw-semibold">
          Müdür <span className="text-danger" aria-hidden="true">*</span>
        </label>
        <select
          id="proj-manager"
          className={`form-select ${errors.managerId ? 'is-invalid' : ''}`}
          value={managerId}
          onChange={e => setManagerId(e.target.value)}
          aria-required="true"
          aria-describedby={errors.managerId ? 'proj-manager-error' : undefined}
        >
          <option value="">— Yönetici seçin —</option>
          {projectManagers.map(u => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>
        {errors.managerId && (
          <div id="proj-manager-error" className="invalid-feedback">{errors.managerId}</div>
        )}
      </div>

      {/* Personel — daire başkanlığının tüm kullanıcıları, çoklu seçim */}
      <div className="mb-3">
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-1">
          <span className="form-label fw-semibold mb-0">
            Personel <span className="text-muted fw-normal small">({staffIds.length} seçili)</span>
          </span>
          <input
            className="form-control form-control-sm"
            style={{ maxWidth: 220 }}
            placeholder="Personel ara…"
            value={staffQuery}
            onChange={(e) => setStaffQuery(e.target.value)}
            aria-label="Personel ara"
          />
        </div>
        {!unitId ? (
          <div className="form-text">Personel seçmek için önce daire başkanlığını seçin.</div>
        ) : unitStaff.length === 0 ? (
          <div className="form-text">Bu daire başkanlığında henüz kullanıcı yok.</div>
        ) : (
          <div className="border rounded-3 p-2" style={{ maxHeight: 260, overflowY: 'auto' }}>
            {shownStaff.map((u) => {
              const locked = lockedIds.has(u.id);
              const others = projectIdsOf(u)
                .filter((id) => id !== project?.id)
                .map((id) => state.projects.find((p) => p.id === id)?.name)
                .filter(Boolean);
              return (
                <label
                  key={u.id}
                  htmlFor={`proj-staff-${u.id}`}
                  className="d-flex align-items-center gap-2 px-2 py-1 rounded-2"
                  style={{ cursor: locked ? 'default' : 'pointer' }}
                  title={locked ? 'Başka müdürlüğü olmadığı için bu müdürlükten çıkarılamaz' : undefined}
                >
                  <input
                    id={`proj-staff-${u.id}`}
                    type="checkbox"
                    className="form-check-input m-0"
                    checked={staffIds.includes(u.id)}
                    disabled={locked}
                    onChange={() => toggleStaff(u.id)}
                  />
                  <Avatar name={u.name} color={u.avatarColor} size={24} />
                  <span className="small fw-medium">{u.name}</span>
                  {others.length > 0 && (
                    <span className="text-muted text-truncate" style={{ fontSize: 11 }}>· {others.join(', ')}</span>
                  )}
                </label>
              );
            })}
            {shownStaff.length === 0 && <div className="text-muted small px-2">Eşleşen personel yok.</div>}
          </div>
        )}
        <div className="form-text">Bir personel birden fazla müdürlükte görev alabilir.</div>
      </div>

      {/* Description */}
      <div className="mb-4">
        <label htmlFor="proj-desc" className="form-label fw-semibold">Açıklama</label>
        <textarea
          id="proj-desc"
          className="form-control"
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={3}
          placeholder="Müdürlük açıklaması..."
        />
      </div>

      {/* Stok Takip */}
      <div className="mb-4">
        <div className="form-check form-switch">
          <input
            className="form-check-input"
            type="checkbox"
            role="switch"
            id="proj-has-inventory"
            checked={hasInventory}
            onChange={e => setHasInventory(e.target.checked)}
          />
          <label className="form-check-label fw-semibold" htmlFor="proj-has-inventory">
            Stok Takip İsteniyor mu?
          </label>
          <div className="form-text">
            Etkinleştirilirse müdürlük menüsünde "Stok Takip" bölümü görünür.
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="d-flex justify-content-end gap-2">
        {onCancel && (
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            İptal
          </button>
        )}
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? 'Kaydediliyor...' : isEdit ? 'Değişiklikleri Kaydet' : 'Müdürlük Oluştur'}
        </button>
      </div>
    </form>
  );
}

export default ProjectForm;
