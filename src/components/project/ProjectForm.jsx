import React, { useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { ACTIONS, ROLES } from '../../constants';
import { generateId } from '../../utils/issueUtils';

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
  const { state, dispatch } = useAppContext();
  const isEdit = Boolean(project);

  const [name, setName] = useState(project?.name ?? '');
  const [unitId, setUnitId] = useState(project?.unitId ?? defaultUnitId ?? '');
  const [managerId, setManagerId] = useState(project?.managerId ?? '');
  const [description, setDescription] = useState(project?.description ?? '');
  const [hasInventory, setHasInventory] = useState(project?.hasInventory ?? false);
  const [errors, setErrors] = useState({});

  // If a unit is pre-selected, only show managers from that unit
  const projectManagers = state.users.filter(u =>
    u.role === ROLES.PROJECT_MANAGER && (unitId ? u.unitId === unitId : true)
  );

  function validate() {
    const errs = {};
    if (!name.trim()) errs.name = 'Proje adı zorunludur.';
    if (!unitId) errs.unitId = 'Lütfen bir birim seçin.';
    if (!managerId) errs.managerId = 'Lütfen bir proje yöneticisi seçin.';
    return errs;
  }

  function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    if (isEdit) {
      dispatch({
        type: ACTIONS.UPDATE_PROJECT,
        payload: {
          id: project.id,
          name: name.trim(),
          unitId,
          managerId,
          description: description.trim(),
          hasInventory,
        },
      });
      onSuccess?.({ ...project, name: name.trim(), unitId, managerId, description: description.trim(), hasInventory });
    } else {
      const newProject = {
        id: generateId(),
        name: name.trim(),
        unitId,
        managerId,
        description: description.trim(),
        hasInventory,
        createdAt: new Date().toISOString(),
      };
      dispatch({ type: ACTIONS.ADD_PROJECT, payload: newProject });
      onSuccess?.(newProject);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {/* Project Name */}
      <div className="mb-3">
        <label htmlFor="proj-name" className="form-label fw-semibold">
          Proje Adı <span className="text-danger" aria-hidden="true">*</span>
        </label>
        <input
          id="proj-name"
          type="text"
          className={`form-control ${errors.name ? 'is-invalid' : ''}`}
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Proje adı..."
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
          Birim <span className="text-danger" aria-hidden="true">*</span>
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
            <option value="">— Birim seçin —</option>
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
          Proje Yöneticisi <span className="text-danger" aria-hidden="true">*</span>
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

      {/* Description */}
      <div className="mb-4">
        <label htmlFor="proj-desc" className="form-label fw-semibold">Açıklama</label>
        <textarea
          id="proj-desc"
          className="form-control"
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={3}
          placeholder="Proje açıklaması..."
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
            Etkinleştirilirse proje menüsünde "Stok Takip" bölümü görünür.
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
        <button type="submit" className="btn btn-primary">
          {isEdit ? 'Değişiklikleri Kaydet' : 'Proje Oluştur'}
        </button>
      </div>
    </form>
  );
}

export default ProjectForm;
