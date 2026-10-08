import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';
import { useAuth } from '../../hooks/useAuth';
import { usePermissions } from '../../hooks/usePermissions';
import { ACTIONS, PRIORITIES, PRIORITY_LABELS } from '../../constants';
import { issuesApi, requestFormsApi } from '../../api/resources';
import { buildUnitCodeByProjectId, mapIssue } from '../../api/mappers';
import { validateAnswers, buildAnswersPayload } from '../../utils/requestForm';
import DynamicQuestions from './DynamicQuestions';

export default function RequestForm({ onClose, defaultUnitId = '' }) {
  const { state, dispatch } = useAppContext();
  const { currentUser } = useAuth();
  const { can } = usePermissions();

  const [unitId, setUnitId] = useState(defaultUnitId || currentUser?.unitId || '');
  const [projectId, setProjectId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('Medium');
  const [onBehalf, setOnBehalf] = useState(false);
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  // The selected müdürlük's request forms ("talep türleri", designed on the
  // Talep Formları page); the requester picks one, then answers its questions.
  const [forms, setForms] = useState([]);
  const [formId, setFormId] = useState('');
  const [answers, setAnswers] = useState({});
  const [answerErrors, setAnswerErrors] = useState({});
  const [formsState, setFormsState] = useState('idle'); // idle | loading | error
  const [uploadingIds, setUploadingIds] = useState([]); // file questions with uploads in flight
  const uploading = uploadingIds.length > 0;

  const selectedForm = forms.find((f) => f.id === formId);
  const questions = selectedForm?.questions || [];

  useEffect(() => {
    setForms([]);
    setFormId('');
    setAnswers({});
    setAnswerErrors({});
    if (!projectId) { setFormsState('idle'); return undefined; }
    let cancelled = false;
    setFormsState('loading');
    requestFormsApi.listByProject(projectId)
      .then((list) => {
        if (cancelled) return;
        setForms(list);
        if (list.length === 1) setFormId(list[0].id);
        setFormsState('idle');
      })
      .catch(() => { if (!cancelled) setFormsState('error'); });
    return () => { cancelled = true; };
  }, [projectId]);

  function pickForm(id) {
    setFormId(id);
    setAnswers({});
    setAnswerErrors({});
    setErrors((e) => ({ ...e, formId: undefined }));
  }

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
    if (!unitId) errs.unitId = 'Lütfen bir daire başkanlığı seçin.';
    if (!projectId) errs.projectId = 'Lütfen bir müdürlük seçin.';
    if (projectId && forms.length > 0 && !formId) errs.formId = 'Lütfen talep türünü seçin.';
    return errs;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    const aErrs = validateAnswers(questions, answers);
    setAnswerErrors(aErrs);
    if (Object.keys(errs).length > 0 || Object.keys(aErrs).length > 0) { setErrors(errs); return; }
    if (formsState === 'error') { setErrors({ form: 'Müdürlüğün talep türleri yüklenemedi, lütfen tekrar deneyin.' }); return; }
    if (!currentUser) return;

    setSubmitting(true);
    try {
      const created = await issuesApi.create({
        projectId,
        title: title.trim(),
        description: description.trim(),
        priority,
        isRequest: true,
        ...(formId ? { requestFormId: formId, answers: buildAnswersPayload(questions, answers) } : {}),
        ...(onBehalf && can('helpdesk.create')
          ? { contactName: contactName.trim(), contactPhone: contactPhone.trim() }
          : {}),
      });
      const unitCodeByProjectId = buildUnitCodeByProjectId(state.projects, state.units);
      dispatch({ type: ACTIONS.ADD_ISSUE, payload: mapIssue(created, unitCodeByProjectId) });
      onClose();
    } catch (err) {
      setErrors({ form: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {/* Yardım masası: telefonla arayan/yüz yüze gelen biri adına talep açma */}
      {can('helpdesk.create') && (
        <div className="mb-3 p-2 rounded" style={{ backgroundColor: '#F4F5F7' }}>
          <div className="form-check">
            <input
              id="req-on-behalf"
              type="checkbox"
              className="form-check-input"
              checked={onBehalf}
              onChange={(e) => setOnBehalf(e.target.checked)}
            />
            <label htmlFor="req-on-behalf" className="form-check-label small fw-medium">
              Bir kişi adına açıyorum (telefon / yüz yüze)
            </label>
          </div>
          {onBehalf && (
            <div className="row g-2 mt-1">
              <div className="col-6">
                <input
                  className="form-control form-control-sm"
                  placeholder="Ad Soyad"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                />
              </div>
              <div className="col-6">
                <input
                  className="form-control form-control-sm"
                  placeholder="Telefon"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Birim */}
      <div className="mb-3">
        <label htmlFor="req-unit" className="form-label fw-medium">
          Daire Başkanlığı <span className="text-danger">*</span>
        </label>
        <select
          id="req-unit"
          className={`form-select ${errors.unitId ? 'is-invalid' : ''}`}
          value={unitId}
          onChange={handleUnitChange}
        >
          <option value="">— Daire başkanlığı seçin —</option>
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
            Müdürlük <span className="text-danger">*</span>
          </label>
          {unitProjects.length === 0 ? (
            <div className="alert alert-warning py-2 small mb-0">
              Bu daire başkanlığına ait müdürlük bulunamadı.
            </div>
          ) : (
            <select
              id="req-project"
              className={`form-select ${errors.projectId ? 'is-invalid' : ''}`}
              value={projectId}
              onChange={e => setProjectId(e.target.value)}
            >
              <option value="">— Müdürlük seçin —</option>
              {unitProjects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}
          {errors.projectId && <div className="invalid-feedback">{errors.projectId}</div>}
        </div>
      )}

      {/* Talep türü — müdürlüğün formları */}
      {projectId && formsState === 'loading' && (
        <div className="text-muted small mb-3">Talep türleri yükleniyor…</div>
      )}
      {projectId && formsState === 'error' && (
        <div className="alert alert-warning py-2 small mb-3">Müdürlüğün talep türleri yüklenemedi.</div>
      )}
      {forms.length > 0 && (
        <div className="mb-3">
          <div className="form-label fw-semibold">
            Talep Türü <span className="text-danger">*</span>
          </div>
          <div className="row g-2" role="radiogroup" aria-label="Talep türü">
            {forms.map((f) => {
              const active = f.id === formId;
              return (
                <div className="col-12 col-sm-6 col-lg-4" key={f.id}>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => pickForm(f.id)}
                    className={`btn w-100 h-100 text-start p-2 border ${active ? 'border-primary border-2 bg-primary bg-opacity-10' : 'btn-light'}`}
                  >
                    <div className="fw-semibold small">{f.name}</div>
                    {f.description && <div className="text-muted" style={{ fontSize: '0.75rem' }}>{f.description}</div>}
                  </button>
                </div>
              );
            })}
          </div>
          {errors.formId && <div className="invalid-feedback d-block">{errors.formId}</div>}
        </div>
      )}

      {/* Seçilen talep türünün soruları */}
      {questions.length > 0 && (
        <fieldset className="mb-3 p-3 rounded border" style={{ background: '#F8FAFC' }}>
          <legend className="float-none w-auto px-2 mb-0 small fw-semibold text-primary" style={{ fontSize: '0.8rem' }}>
            {selectedForm.name} — Talep Bilgileri
          </legend>
          <DynamicQuestions
            questions={questions}
            answers={answers}
            onChange={(next) => { setAnswers(next); setAnswerErrors({}); }}
            errors={answerErrors}
            onBusy={(qid, busy) => setUploadingIds((ids) => (busy ? [...ids, qid] : ids.filter((x) => x !== qid)))}
          />
        </fieldset>
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
          {PRIORITIES.map(p => (
            <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
          ))}
        </select>
      </div>

      {errors.form && <div className="alert alert-danger py-2 small">{errors.form}</div>}

      <div className="d-flex gap-2 justify-content-end">
        <button type="button" className="btn btn-outline-secondary" onClick={onClose}>İptal</button>
        <button type="submit" className="btn btn-primary" disabled={submitting || uploading}>
          {uploading ? 'Dosyalar yükleniyor...' : submitting ? 'Gönderiliyor...' : 'Talep Oluştur'}
        </button>
      </div>
    </form>
  );
}
