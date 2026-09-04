import React, { useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { ACTIONS } from '../../constants';
import { sprintsApi } from '../../api/resources';
import { getMonthlySprintDates, getSprintName } from '../../utils/sprintUtils';
import { formatDate } from '../../utils/dateUtils';

const MONTH_NAMES = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

function SprintForm({ projectId, onSuccess, onCancel }) {
  const { state, dispatch } = useAppContext();

  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [errors, setErrors] = useState({});

  // Compute preview dates
  const { startDate, endDate } = getMonthlySprintDates(year, month);
  const sprintName = getSprintName(year, month);

  // Year options: current year ± 2
  const yearOptions = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 1 + i);

  function validate() {
    const errs = {};
    // Check for duplicate sprint (same project + same month + year)
    const duplicate = state.sprints.find(
      s => s.projectId === projectId && s.month === month && s.year === year
    );
    if (duplicate) {
      errs.month = `Bu ay için zaten bir sprint mevcut: "${duplicate.name}"`;
    }
    return errs;
  }

  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setSubmitting(true);
    try {
      const created = await sprintsApi.create(projectId, { month, year });
      dispatch({ type: ACTIONS.ADD_SPRINT, payload: created });
      onSuccess?.(created);
    } catch (err) {
      setErrors({ month: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="mb-3">
        <label className="form-label fw-semibold">Sprint Dönemi <span className="text-danger">*</span></label>
        <div className="row g-2">
          <div className="col-7">
            <select
              className={`form-select ${errors.month ? 'is-invalid' : ''}`}
              value={month}
              onChange={e => setMonth(Number(e.target.value))}
              aria-label="Ay seçin"
            >
              {MONTH_NAMES.map((name, idx) => (
                <option key={idx + 1} value={idx + 1}>{name}</option>
              ))}
            </select>
            {errors.month && <div className="invalid-feedback">{errors.month}</div>}
          </div>
          <div className="col-5">
            <select
              className="form-select"
              value={year}
              onChange={e => setYear(Number(e.target.value))}
              aria-label="Yıl seçin"
            >
              {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Preview */}
      <div className="mb-4 p-3 bg-light rounded">
        <p className="small fw-semibold mb-1">Sprint Önizleme</p>
        <p className="small mb-1"><strong>Ad:</strong> {sprintName}</p>
        <p className="small mb-1"><strong>Başlangıç:</strong> {formatDate(startDate.toISOString())}</p>
        <p className="small mb-0"><strong>Bitiş:</strong> {formatDate(endDate.toISOString())}</p>
      </div>

      <div className="d-flex justify-content-end gap-2">
        {onCancel && <button type="button" className="btn btn-secondary" onClick={onCancel}>İptal</button>}
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? 'Oluşturuluyor...' : 'Sprint Oluştur'}
        </button>
      </div>
    </form>
  );
}

export default SprintForm;
