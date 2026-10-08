import React from 'react';
import { visibleQuestions } from '../../utils/requestForm';
import FileQuestion from './FileQuestion';

/**
 * Renders a project's request-form questions as inputs. Controlled: `answers`
 * maps questionId → value (string, string[] for checkbox, bool for boolean).
 * Used both on the real request form and as the builder's live preview.
 */
// `preview` (form builder) keeps file questions from really uploading;
// `onBusy(questionId, bool)` reports uploads in flight so the parent can hold submit.
export default function DynamicQuestions({ questions, answers, onChange, errors = {}, idPrefix = 'rq', preview = false, onBusy }) {
  const shown = visibleQuestions(questions, answers);
  if (shown.length === 0) return null;

  // Functional update: file uploads finish asynchronously, so merge into the
  // latest answers rather than the ones captured when the upload started.
  const set = (id, value) => onChange((prev) => ({ ...prev, [id]: value }));

  return (
    <div className="rq-grid">
      <div className="rq-row">
      {shown.map((q) => {
        const id = `${idPrefix}-${q.id}`;
        const err = errors[q.id];
        const value = answers[q.id];
        const label = q.label || <span className="text-muted fst-italic">Soru metni girilmedi</span>;
        const help = q.helpText && <div className="form-text mt-1">{q.helpText}</div>;
        const feedback = err && <div className="invalid-feedback d-block">{err}</div>;
        const cell = `rq-cell rq-w-${q.width || 12}`;

        if (q.type === 'boolean') {
          return (
            <div key={q.id} className={cell}>
              <div className="form-check">
                <input
                  id={id}
                  type="checkbox"
                  className={`form-check-input ${err ? 'is-invalid' : ''}`}
                  checked={value === true}
                  onChange={(e) => set(q.id, e.target.checked)}
                />
                <label htmlFor={id} className="form-check-label fw-semibold">
                  {label} {q.required && <span className="text-danger">*</span>}
                </label>
              </div>
              {help}
              {feedback}
            </div>
          );
        }

        return (
          <div key={q.id} className={cell}>
            <label htmlFor={id} className="form-label fw-semibold mb-1">
              {label} {q.required && <span className="text-danger">*</span>}
            </label>
            {q.type === 'file'
              ? <FileQuestion q={q} id={id} value={value} invalid={!!err} preview={preview}
                  onChange={(v) => set(q.id, v)} onBusy={(b) => onBusy?.(q.id, b)} />
              : renderInput(q, id, value, err, set)}
            {help}
            {feedback}
          </div>
        );
      })}
      </div>
    </div>
  );
}

function renderInput(q, id, value, err, set) {
  const invalid = err ? 'is-invalid' : '';
  const options = q.options.filter((o) => o.trim());

  switch (q.type) {
    case 'textarea':
      return (
        <textarea id={id} className={`form-control ${invalid}`} rows={3} placeholder={q.placeholder}
          value={value || ''} onChange={(e) => set(q.id, e.target.value)} />
      );
    case 'number':
      return (
        <input id={id} type="number" inputMode="decimal" className={`form-control ${invalid}`} placeholder={q.placeholder}
          value={value || ''} onChange={(e) => set(q.id, e.target.value)} />
      );
    case 'date':
      return (
        <input id={id} type="date" className={`form-control ${invalid}`}          value={value || ''} onChange={(e) => set(q.id, e.target.value)} />
      );
    case 'select':
      return (
        <select id={id} className={`form-select ${invalid}`} value={value || ''} onChange={(e) => set(q.id, e.target.value)}>
          <option value="">— Seçin —</option>
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    case 'radio':
      return (
        <div id={id} role="radiogroup">
          {options.map((o, i) => (
            <div className="form-check" key={o}>
              <input id={`${id}-${i}`} type="radio" name={id} className={`form-check-input ${invalid}`}
                checked={value === o} onChange={() => set(q.id, o)} />
              <label htmlFor={`${id}-${i}`} className="form-check-label">{o}</label>
            </div>
          ))}
        </div>
      );
    case 'checkbox': {
      const picked = Array.isArray(value) ? value : [];
      const toggle = (o) => set(q.id, picked.includes(o) ? picked.filter((p) => p !== o) : [...picked, o]);
      return (
        <div id={id}>
          {options.map((o, i) => (
            <div className="form-check" key={o}>
              <input id={`${id}-${i}`} type="checkbox" className={`form-check-input ${invalid}`}
                checked={picked.includes(o)} onChange={() => toggle(o)} />
              <label htmlFor={`${id}-${i}`} className="form-check-label">{o}</label>
            </div>
          ))}
        </div>
      );
    }
    default:
      return (
        <input id={id} type="text" className={`form-control ${invalid}`} placeholder={q.placeholder}
          value={value || ''} onChange={(e) => set(q.id, e.target.value)} />
      );
  }
}
