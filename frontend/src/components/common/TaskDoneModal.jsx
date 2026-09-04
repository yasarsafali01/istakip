import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { useAppContext } from '../../context/AppContext';
import { ACTIONS } from '../../constants';
import { validate } from '../../utils/taskDoneValidation';
import { issuesApi, inventoryApi } from '../../api/resources';
import { buildUnitCodeByProjectId, mapIssue } from '../../api/mappers';

/**
 * Modal shown when a task/issue is moved to "Done" status.
 * Collects resolution note and optional equipment usage, then dispatches
 * the necessary actions to update state.
 *
 * @param {Object}   props
 * @param {boolean}  props.isOpen     - Whether the modal is visible
 * @param {Object}   props.issue      - The issue/request being completed
 * @param {Function} props.onConfirm  - Called after successful confirmation
 * @param {Function} props.onCancel   - Called when user cancels
 */
function TaskDoneModal({ isOpen, issue, onConfirm, onCancel }) {
  const { state, dispatch } = useAppContext();

  // ── Form state ─────────────────────────────────────────────────────────────
  const [resolutionNote, setResolutionNote] = useState('');
  const [usedEquipment, setUsedEquipment] = useState(false);
  const [selectedEquipmentId, setSelectedEquipmentId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [errors, setErrors] = useState({});
  const [showStockWarning, setShowStockWarning] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // ── Derived data ───────────────────────────────────────────────────────────
  const project = state.projects.find((p) => p.id === issue?.projectId);
  const projectInventory = (state.inventory || []).filter(
    (item) => item.projectId === issue?.projectId
  );
  const selectedEquipment = projectInventory.find((item) => item.id === selectedEquipmentId);

  // Reset form when modal opens/closes; load this project's inventory once
  // (it's fetched on demand, not eagerly hydrated).
  useEffect(() => {
    if (!isOpen) {
      setResolutionNote('');
      setUsedEquipment(false);
      setSelectedEquipmentId('');
      setQuantity('');
      setErrors({});
      setShowStockWarning(false);
      setSubmitting(false);
      return;
    }
    if (project?.hasInventory && issue?.projectId) {
      inventoryApi.listByProject(issue.projectId).then((inventory) => {
        dispatch({ type: ACTIONS.SET_INVENTORY_FOR_PROJECT, payload: { projectId: issue.projectId, inventory } });
      }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // ── Confirm flow ───────────────────────────────────────────────────────────
  async function submit() {
    setSubmitting(true);
    try {
      const payload = { resolutionNote: resolutionNote.trim(), usedEquipment };
      if (usedEquipment && selectedEquipmentId) {
        payload.equipmentId = selectedEquipmentId;
        payload.quantity = parseInt(quantity, 10);
      }
      const { issue: updated } = await issuesApi.complete(issue.id, payload);
      const unitCodeByProjectId = buildUnitCodeByProjectId(state.projects, state.units);
      dispatch({ type: ACTIONS.UPDATE_ISSUE, payload: mapIssue(updated, unitCodeByProjectId) });
      onConfirm();
    } catch (err) {
      setErrors({ resolutionNote: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  function handleConfirm() {
    // 1. Validate form
    const validationErrors = validate({
      resolutionNote,
      usedEquipment,
      selectedEquipmentId,
      quantity,
    });
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    // 2. Warn (but don't block) if the locally-known stock looks insufficient
    // — the backend performs the actual deduction and allows it regardless.
    if (usedEquipment && selectedEquipment && !showStockWarning) {
      const requestedQty = parseInt(quantity, 10);
      if (selectedEquipment.quantity < requestedQty) {
        setShowStockWarning(true);
        return;
      }
    }

    submit();
  }

  // ── Cancel flow ────────────────────────────────────────────────────────────
  function handleCancel() {
    setResolutionNote('');
    setUsedEquipment(false);
    setSelectedEquipmentId('');
    setQuantity('');
    setErrors({});
    setShowStockWarning(false);
    onCancel();
  }

  // ── Stock warning: continue anyway ────────────────────────────────────────
  function handleStockWarningContinue() {
    setShowStockWarning(false);
    submit();
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  if (!issue) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleCancel}
      title="Görevi Tamamla"
      size="lg"
      id="task-done-modal-title"
    >
      {/* Stock warning overlay */}
      {showStockWarning && (
        <div className="alert alert-warning mb-4" role="alert">
          <strong>Stok Yetersiz!</strong>{' '}
          {`Stok miktarı yetersiz. Mevcut: ${selectedEquipment?.quantity ?? 0}, Talep edilen: ${parseInt(quantity, 10) || 0}`}
          <div className="mt-3 d-flex gap-2">
            <button
              type="button"
              className="btn btn-sm btn-warning"
              onClick={handleStockWarningContinue}
            >
              Devam Et
            </button>
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              onClick={() => setShowStockWarning(false)}
            >
              İptal
            </button>
          </div>
        </div>
      )}

      {/* Resolution note */}
      <div className="mb-4">
        <label htmlFor="resolution-note" className="form-label fw-semibold">
          Çözüm İçeriği <span className="text-danger">*</span>
        </label>
        <textarea
          id="resolution-note"
          className={`form-control ${errors.resolutionNote ? 'is-invalid' : ''}`}
          rows={5}
          placeholder="Yapılan işi ve çözümü açıklayın... (en az 10 karakter)"
          value={resolutionNote}
          onChange={(e) => {
            setResolutionNote(e.target.value);
            if (errors.resolutionNote) {
              setErrors((prev) => ({ ...prev, resolutionNote: undefined }));
            }
          }}
          maxLength={2000}
        />
        {errors.resolutionNote && (
          <div className="invalid-feedback">{errors.resolutionNote}</div>
        )}
        <div className="form-text text-end">
          {resolutionNote.length} / 2000
        </div>
      </div>

      {/* Equipment section — only shown when project.hasInventory === true */}
      {project?.hasInventory === true && (
        <div className="mb-4">
          <p className="fw-semibold mb-2">Teçhizat kullandınız mı?</p>
          <div className="d-flex gap-4 mb-3">
            <div className="form-check">
              <input
                className="form-check-input"
                type="radio"
                name="usedEquipment"
                id="equipment-no"
                value="no"
                checked={!usedEquipment}
                onChange={() => {
                  setUsedEquipment(false);
                  setSelectedEquipmentId('');
                  setQuantity('');
                  setErrors((prev) => ({
                    ...prev,
                    selectedEquipmentId: undefined,
                    quantity: undefined,
                  }));
                }}
              />
              <label className="form-check-label" htmlFor="equipment-no">
                Hayır
              </label>
            </div>
            <div className="form-check">
              <input
                className="form-check-input"
                type="radio"
                name="usedEquipment"
                id="equipment-yes"
                value="yes"
                checked={usedEquipment}
                onChange={() => setUsedEquipment(true)}
              />
              <label className="form-check-label" htmlFor="equipment-yes">
                Evet
              </label>
            </div>
          </div>

          {/* Equipment detail fields — only when usedEquipment === true */}
          {usedEquipment && (
            <div className="row g-3">
              <div className="col-12 col-md-7">
                <label htmlFor="equipment-select" className="form-label fw-semibold">
                  Teçhizat Adı <span className="text-danger">*</span>
                </label>
                <select
                  id="equipment-select"
                  className={`form-select ${errors.selectedEquipmentId ? 'is-invalid' : ''}`}
                  value={selectedEquipmentId}
                  onChange={(e) => {
                    setSelectedEquipmentId(e.target.value);
                    if (errors.selectedEquipmentId) {
                      setErrors((prev) => ({ ...prev, selectedEquipmentId: undefined }));
                    }
                  }}
                >
                  <option value="">— Teçhizat seçin —</option>
                  {projectInventory.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} (Stok: {item.quantity} {item.unit})
                    </option>
                  ))}
                </select>
                {errors.selectedEquipmentId && (
                  <div className="invalid-feedback">{errors.selectedEquipmentId}</div>
                )}
              </div>

              <div className="col-12 col-md-5">
                <label htmlFor="equipment-quantity" className="form-label fw-semibold">
                  Kullanılan Adet <span className="text-danger">*</span>
                </label>
                <input
                  id="equipment-quantity"
                  type="number"
                  className={`form-control ${errors.quantity ? 'is-invalid' : ''}`}
                  placeholder="Adet girin"
                  value={quantity}
                  min={1}
                  step={1}
                  onChange={(e) => {
                    setQuantity(e.target.value);
                    if (errors.quantity) {
                      setErrors((prev) => ({ ...prev, quantity: undefined }));
                    }
                  }}
                />
                {errors.quantity && (
                  <div className="invalid-feedback">{errors.quantity}</div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="d-flex justify-content-end gap-2 mt-2">
        <button
          type="button"
          className="btn btn-outline-secondary"
          onClick={handleCancel}
        >
          İptal
        </button>
        <button
          type="button"
          className="btn btn-success"
          onClick={handleConfirm}
          disabled={showStockWarning || submitting}
        >
          {submitting ? 'Kaydediliyor...' : 'Onayla'}
        </button>
      </div>
    </Modal>
  );
}

export default TaskDoneModal;
