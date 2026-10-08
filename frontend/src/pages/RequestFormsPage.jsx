import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import {
  TbGripVertical, TbCopy, TbTrash, TbChevronDown, TbChevronUp, TbPlus, TbX, TbEye,
  TbDeviceFloppy, TbArrowBackUp, TbGitBranch, TbListDetails, TbRefresh, TbArrowsMaximize, TbFileText,
} from 'react-icons/tb';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../hooks/useAuth';
import { requestFormsApi } from '../api/resources';
import { getVisibleProjects } from '../utils/permissionUtils';
import {
  QUESTION_TYPES, QUESTION_TYPE_BY_KEY, QUESTION_WIDTHS, isChoiceType, isConditionSource, hasPlaceholder,
  newQuestion, uuidv4, validateForm, FILE_CATEGORIES, MAX_UPLOAD_MB,
} from '../utils/requestForm';
import DynamicQuestions from '../components/request/DynamicQuestions';
import ConfirmDialog from '../components/common/ConfirmDialog';
import EmptyState from '../components/common/EmptyState';
import Modal from '../components/common/Modal';

// Builder field labels: bold and dark so they stand apart from the inputs.
const LABEL = 'form-label fw-semibold text-dark mb-1';
const LABEL_STYLE = { fontSize: '0.83rem' };

const toEditableQuestion = (q) => ({
  ...q, options: q.options || [], showIf: q.showIf || null, width: q.width || 12, settings: q.settings || {},
});
// The part of a form the builder edits; compared as JSON for the dirty check.
const toDraft = (f) => ({
  name: f.name,
  description: f.description || '',
  isActive: f.isActive,
  questions: (f.questions || []).map(toEditableQuestion),
});

/**
 * Talep Formları — a müdürlük can have several request forms ("talep
 * türleri", e.g. Arıza Bildirimi / Yazılım Talebi), each with its own
 * questions. A requester picks the müdürlük, then one of its active forms,
 * then answers that form's questions. The selected form is edited locally
 * and saved at once; question ids are generated here so a condition can
 * point at a question that hasn't been saved yet.
 */
export default function RequestFormsPage() {
  const { state } = useAppContext();
  const { currentUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const projects = useMemo(
    () => (currentUser ? getVisibleProjects(state.projects, currentUser) : []),
    [state.projects, currentUser]
  );
  const projectId = searchParams.get('project') || (projects.length === 1 ? projects[0].id : '');
  const project = projects.find((p) => p.id === projectId);

  const [forms, setForms] = useState([]);          // server copies
  const [selectedId, setSelectedId] = useState(null);
  const [draft, setDraft] = useState(null);         // edits to the selected form
  const [expanded, setExpanded] = useState(() => new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showErrors, setShowErrors] = useState(false);
  const [previewAnswers, setPreviewAnswers] = useState({});
  const [pendingNav, setPendingNav] = useState(null); // { project } | { form } awaiting "discard changes?"
  const [pendingDelete, setPendingDelete] = useState(null);
  const [confirmDeleteForm, setConfirmDeleteForm] = useState(false);
  const [fullPreview, setFullPreview] = useState(false);
  const [newForm, setNewForm] = useState(null);     // { name, description } while the create dialog is open

  const selected = forms.find((f) => f.id === selectedId) || null;
  const savedDraft = useMemo(() => (selected ? toDraft(selected) : null), [selected]);
  const dirty = !!draft && JSON.stringify(draft) !== JSON.stringify(savedDraft);
  const questions = useMemo(() => draft?.questions || [], [draft]);
  const formErrors = useMemo(() => validateForm(questions), [questions]);
  const errorCount = Object.keys(formErrors).length;

  function openForm(form) {
    setSelectedId(form?.id || null);
    setDraft(form ? toDraft(form) : null);
    setExpanded(new Set());
    setPreviewAnswers({});
    setShowErrors(false);
    setError('');
  }

  useEffect(() => {
    if (!projectId) return undefined;
    let cancelled = false;
    setLoading(true);
    setError('');
    setNotice('');
    requestFormsApi.listByProject(projectId, true)
      .then((list) => {
        if (cancelled) return;
        setForms(list);
        openForm(list[0] || null);
      })
      .catch((err) => !cancelled && setError(err.message || 'Formlar yüklenemedi'))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [projectId]);

  // Browser-level guard against losing unsaved work (tab close / reload).
  useEffect(() => {
    if (!dirty) return undefined;
    const handler = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  function selectProject(id) {
    if (dirty) { setPendingNav({ project: id }); return; }
    setSearchParams(id ? { project: id } : {});
  }

  function selectForm(form) {
    if (form.id === selectedId) return;
    if (dirty) { setPendingNav({ form }); return; }
    openForm(form);
  }

  function confirmNav() {
    if (pendingNav.project !== undefined) setSearchParams(pendingNav.project ? { project: pendingNav.project } : {});
    else openForm(pendingNav.form);
  }

  // ── form-level actions ────────────────────────────────────────────────
  const replaceForm = (form) => setForms((fs) => fs.map((f) => (f.id === form.id ? form : f)));

  async function createForm(e) {
    e.preventDefault();
    if (!newForm.name.trim()) return;
    try {
      const created = await requestFormsApi.create(projectId, {
        name: newForm.name.trim(), description: newForm.description.trim(),
      });
      setForms((fs) => [...fs, created]);
      openForm(created);
      setNewForm(null);
      setNotice('');
    } catch (err) {
      setError(err.message || 'Form oluşturulamadı');
      setNewForm(null);
    }
  }

  async function duplicateForm() {
    if (dirty) { setError('Çoğaltmadan önce değişiklikleri kaydedin veya geri alın.'); return; }
    try {
      const copy = await requestFormsApi.duplicate(selectedId);
      setForms((fs) => [...fs, copy]);
      openForm(copy);
      setNotice(`"${copy.name}" oluşturuldu.`);
    } catch (err) {
      setError(err.message || 'Form çoğaltılamadı');
    }
  }

  async function deleteForm() {
    try {
      await requestFormsApi.remove(selectedId);
      const rest = forms.filter((f) => f.id !== selectedId);
      setForms(rest);
      openForm(rest[0] || null);
      setNotice('Form silindi.');
    } catch (err) {
      setError(err.message || 'Form silinemedi');
    }
  }

  // ── question mutations (on the draft) ─────────────────────────────────
  const setQuestions = (fn) => setDraft((d) => ({ ...d, questions: fn(d.questions) }));
  const update = (id, patch) => setQuestions((qs) => qs.map((q) => (q.id === id ? { ...q, ...patch } : q)));

  function addQuestion(type) {
    const q = newQuestion(type);
    setQuestions((qs) => [...qs, q]);
    setExpanded((s) => new Set(s).add(q.id));
    setNotice('');
  }

  function duplicate(q) {
    const copy = { ...q, id: uuidv4(), label: q.label ? `${q.label} (kopya)` : '', options: [...q.options] };
    setQuestions((qs) => {
      const i = qs.findIndex((x) => x.id === q.id);
      return [...qs.slice(0, i + 1), copy, ...qs.slice(i + 1)];
    });
    setExpanded((s) => new Set(s).add(copy.id));
  }

  const dependentsOf = (id) => questions.filter((q) => q.showIf?.questionId === id);

  function removeQuestion(id) {
    // Questions that depended on this one become unconditional rather than orphaned.
    setQuestions((qs) => qs.filter((q) => q.id !== id)
      .map((q) => (q.showIf?.questionId === id ? { ...q, showIf: null } : q)));
  }

  function changeType(q, type) {
    const patch = { type };
    if (isChoiceType(type) && !isChoiceType(q.type)) patch.options = ['Seçenek 1', 'Seçenek 2'];
    if (!isChoiceType(type)) patch.options = [];
    if (!hasPlaceholder(type)) patch.placeholder = '';
    if (type !== q.type) patch.settings = type === 'file' ? { maxFiles: 1, accept: [] } : {};
    setQuestions((qs) => qs.map((x) => {
      if (x.id === q.id) return { ...x, ...patch };
      // Drop dependents' conditions when the answer kind changes: non-comparable
      // type, or switching between yes/no and option values (select ↔ radio keeps them).
      const kindChanged = !isConditionSource(type) || (type === 'boolean') !== (q.type === 'boolean');
      if (x.showIf?.questionId === q.id && kindChanged) return { ...x, showIf: null };
      return x;
    }));
  }

  function renameOption(q, index, next) {
    const prev = q.options[index];
    setQuestions((qs) => qs.map((x) => {
      if (x.id === q.id) return { ...x, options: q.options.map((o, i) => (i === index ? next : o)) };
      // Keep conditions pointing at this option in sync with the rename.
      if (x.showIf?.questionId === q.id && x.showIf.value === prev) return { ...x, showIf: { ...x.showIf, value: next } };
      return x;
    }));
  }

  function onDragEnd({ source, destination }) {
    if (!destination || destination.index === source.index) return;
    setQuestions((qs) => {
      const next = [...qs];
      const [moved] = next.splice(source.index, 1);
      next.splice(destination.index, 0, moved);
      return next;
    });
  }

  async function save() {
    setShowErrors(true);
    if (!draft.name.trim()) {
      setError('Talep türü adı boş olamaz.');
      return;
    }
    if (errorCount > 0) {
      setExpanded(new Set(Object.keys(formErrors)));
      setError(`${errorCount} soruda düzeltilmesi gereken alan var.`);
      return;
    }
    setSaving(true);
    setError('');
    try {
      let result = selected;
      const metaChanged = draft.name !== savedDraft.name || draft.description !== savedDraft.description
        || draft.isActive !== savedDraft.isActive;
      if (metaChanged) {
        result = await requestFormsApi.update(selectedId, {
          name: draft.name.trim(), description: draft.description.trim(), isActive: draft.isActive,
        });
      }
      if (JSON.stringify(draft.questions) !== JSON.stringify(savedDraft.questions)) {
        result = await requestFormsApi.saveQuestions(selectedId, draft.questions.map((q) => ({
          ...q,
          options: isChoiceType(q.type) ? q.options.map((o) => o.trim()).filter(Boolean) : [],
        })));
      }
      replaceForm(result);
      setDraft(toDraft(result));
      setShowErrors(false);
      setNotice(result.isActive
        ? 'Kaydedildi. Yeni talepler bu formu görecek.'
        : 'Kaydedildi. Form pasif olduğu için talep ekranında görünmüyor.');
    } catch (err) {
      setError(err.message || 'Form kaydedilemedi');
    } finally {
      setSaving(false);
    }
  }

  function discard() {
    setDraft(savedDraft);
    setShowErrors(false);
    setError('');
  }

  // ── render ────────────────────────────────────────────────────────────
  const unitsById = Object.fromEntries(state.units.map((u) => [u.id, u]));
  const projectsByUnit = projects.reduce((acc, p) => {
    (acc[p.unitId] = acc[p.unitId] || []).push(p);
    return acc;
  }, {});

  return (
    <div>
      <div className="d-flex flex-wrap align-items-start justify-content-between gap-3 mb-3">
        <div>
          <h4 className="fw-bold mb-1">Talep Formları</h4>
          <p className="text-muted small mb-0" style={{ maxWidth: 640 }}>
            Müdürlüğünüz için birden fazla talep türü (ör. Arıza Bildirimi, Yazılım Talebi) ve her birine özel sorular
            hazırlayın. Talep sahibi müdürlüğü, ardından talep türünü seçer ve o türün sorularını cevaplar.
          </p>
        </div>
        {projects.length > 1 && (
          <select
            className="form-select"
            style={{ maxWidth: 300 }}
            value={projectId}
            onChange={(e) => selectProject(e.target.value)}
            aria-label="Müdürlük seçin"
          >
            <option value="">— Müdürlük seçin —</option>
            {Object.entries(projectsByUnit).map(([unitId, list]) => (
              <optgroup key={unitId} label={unitsById[unitId]?.name || 'Daire Başkanlığı'}>
                {list.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </optgroup>
            ))}
          </select>
        )}
      </div>

      {error && <div className="alert alert-danger py-2 small">{error}</div>}
      {notice && !dirty && <div className="alert alert-success py-2 small">{notice}</div>}

      {!project ? (
        <EmptyState
          title={projects.length ? 'Bir müdürlük seçin' : 'Yönettiğiniz müdürlük yok'}
          description={projects.length
            ? 'Talep formlarını düzenlemek istediğiniz müdürlüğü sağ üstten seçin.'
            : 'Talep formu hazırlayabilmek için bir müdürlüğün yöneticisi olmalısınız.'}
        />
      ) : loading ? (
        <div className="text-muted small py-5 text-center">Formlar yükleniyor…</div>
      ) : (
        <div>
          {/* ── Talep türleri: sekmeler (tam genişlik içerik için üstte) ── */}
          <div className="card border-0 shadow-sm mb-3">
            <div className="card-body py-2 d-flex flex-wrap align-items-center gap-2" role="tablist" aria-label="Talep türleri">
              <span className="fw-semibold small text-muted me-1">Talep Türleri</span>
              {forms.map((f) => {
                const active = f.id === selectedId;
                const count = active && draft ? draft.questions.length : f.questions.length;
                return (
                  <button
                    key={f.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => selectForm(f)}
                    className={`btn btn-sm d-flex align-items-center gap-2 ${active ? 'btn-primary' : 'btn-light border'}`}
                    style={{ maxWidth: 280 }}
                  >
                    <TbFileText size={16} className="flex-shrink-0" />
                    <span className="fw-semibold text-truncate">
                      {active && draft ? (draft.name || 'Adsız form') : f.name}
                      {active && dirty && <span title="Kaydedilmemiş değişiklik"> •</span>}
                    </span>
                    <span className={`badge ${active ? 'bg-white text-primary' : 'text-bg-light border'}`} title="Soru sayısı">{count}</span>
                    {!f.isActive && <span className="badge text-bg-secondary">Pasif</span>}
                  </button>
                );
              })}
              <button type="button" className="btn btn-sm btn-outline-primary d-flex align-items-center gap-1"
                onClick={() => setNewForm({ name: '', description: '' })}>
                <TbPlus size={15} /> Yeni talep türü
              </button>
            </div>
          </div>

            {!selected || !draft ? (
              <div className="card border-0 shadow-sm">
                <div className="card-body">
                  <EmptyState
                    icon={<TbListDetails size={48} />}
                    title="Bu müdürlüğün henüz talep formu yok"
                    description="Form eklemezseniz talep sahipleri yalnızca başlık ve açıklama yazar. İlk talep türünüzü oluşturun."
                    action={(
                      <button className="btn btn-primary d-flex align-items-center gap-1"
                        onClick={() => setNewForm({ name: '', description: '' })}>
                        <TbPlus size={16} /> Talep türü oluştur
                      </button>
                    )}
                  />
                </div>
              </div>
            ) : (
              <>
                {/* Save bar — sticks to the top while scrolling a long form */}
                <div className="card mb-3 border-0 shadow-sm" style={{ position: 'sticky', top: 8, zIndex: 20 }}>
                  <div className="card-body py-2 d-flex flex-wrap align-items-center gap-2">
                    <span className="fw-semibold text-truncate" style={{ maxWidth: 260 }}>{draft.name || 'Adsız form'}</span>
                    <span className="text-muted small">· {questions.length} soru</span>
                    {dirty && <span className="badge text-bg-warning">Kaydedilmemiş değişiklik</span>}
                    <div className="ms-auto d-flex gap-2">
                      <button className="icon-btn" style={{ width: 32, height: 32 }} onClick={duplicateForm}
                        title="Talep türünü çoğalt" aria-label="Talep türünü çoğalt">
                        <TbCopy size={16} />
                      </button>
                      <button className="icon-btn icon-btn--danger" style={{ width: 32, height: 32 }}
                        onClick={() => setConfirmDeleteForm(true)} title="Talep türünü sil" aria-label="Talep türünü sil">
                        <TbTrash size={16} />
                      </button>
                      <button className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1"
                        onClick={discard} disabled={!dirty || saving}>
                        <TbArrowBackUp size={15} /> Geri al
                      </button>
                      <button className="btn btn-sm btn-primary d-flex align-items-center gap-1"
                        onClick={save} disabled={!dirty || saving}>
                        <TbDeviceFloppy size={15} /> {saving ? 'Kaydediliyor…' : 'Kaydet'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Form details */}
                <div className="card border-0 shadow-sm mb-3">
                  <div className="card-body">
                    <div className="row g-3">
                      <div className="col-12 col-md-5">
                        <label className={LABEL} style={LABEL_STYLE} htmlFor="form-name">Talep türü adı</label>
                        <input id="form-name" className={`form-control ${showErrors && !draft.name.trim() ? 'is-invalid' : ''}`}
                          value={draft.name} placeholder="Örn. Arıza Bildirimi"
                          onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
                      </div>
                      <div className="col-12 col-md-7">
                        <label className={LABEL} style={LABEL_STYLE} htmlFor="form-desc">
                          Kısa açıklama <span className="text-muted fw-normal">(isteğe bağlı)</span>
                        </label>
                        <input id="form-desc" className="form-control" value={draft.description}
                          placeholder="Talep sahibi türü seçerken bu açıklamayı görür"
                          onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
                      </div>
                    </div>
                    <div className="form-check form-switch mt-3 mb-0">
                      <input id="form-active" className="form-check-input" type="checkbox" role="switch"
                        checked={draft.isActive} onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })} />
                      <label htmlFor="form-active" className="form-check-label small fw-semibold">
                        {draft.isActive ? 'Aktif — talep ekranında seçilebilir' : 'Pasif — talep ekranında görünmez'}
                      </label>
                    </div>
                  </div>
                </div>

                <div className="row g-4">
                  {/* ── Question editor ── */}
                  <div className="col-12 col-xl-7">
                    {questions.length === 0 ? (
                      <div className="card border-0 shadow-sm mb-3">
                        <div className="card-body text-center py-4">
                          <TbListDetails size={32} className="text-muted mb-2" />
                          <div className="fw-semibold">Bu talep türünün henüz sorusu yok</div>
                          <div className="text-muted small">Aşağıdan bir soru tipi seçerek başlayın.</div>
                        </div>
                      </div>
                    ) : (
                      <DragDropContext onDragEnd={onDragEnd}>
                        <Droppable droppableId="questions">
                          {(dropProvided) => (
                            <div ref={dropProvided.innerRef} {...dropProvided.droppableProps}>
                              {questions.map((q, index) => (
                                <QuestionCard
                                  key={q.id}
                                  q={q}
                                  index={index}
                                  questions={questions}
                                  open={expanded.has(q.id)}
                                  errors={showErrors ? formErrors[q.id] : null}
                                  onToggle={() => setExpanded((s) => {
                                    const n = new Set(s);
                                    if (n.has(q.id)) n.delete(q.id); else n.add(q.id);
                                    return n;
                                  })}
                                  onUpdate={(patch) => update(q.id, patch)}
                                  onChangeType={(t) => changeType(q, t)}
                                  onRenameOption={(i, v) => renameOption(q, i, v)}
                                  onDuplicate={() => duplicate(q)}
                                  onDelete={() => (dependentsOf(q.id).length ? setPendingDelete(q) : removeQuestion(q.id))}
                                />
                              ))}
                              {dropProvided.placeholder}
                            </div>
                          )}
                        </Droppable>
                      </DragDropContext>
                    )}

                    {/* Add question palette */}
                    <div className="card border-0 shadow-sm">
                      <div className="card-body">
                        <div className="fw-semibold small mb-2 d-flex align-items-center gap-1">
                          <TbPlus size={15} /> Soru ekle
                        </div>
                        <div className="row g-2">
                          {QUESTION_TYPES.map(({ type, label, Icon, hint }) => (
                            <div className="col-6 col-md-3" key={type}>
                              <button
                                type="button"
                                className="btn btn-light border w-100 h-100 text-start p-2"
                                onClick={() => addQuestion(type)}
                                title={hint}
                              >
                                <Icon size={18} className="text-primary mb-1" />
                                <div className="small fw-medium">{label}</div>
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ── Live preview ── */}
                  <div className="col-12 col-xl-5">
                    <div className="card border-0 shadow-sm" style={{ position: 'sticky', top: 72 }}>
                      <div className="card-header bg-white d-flex align-items-center gap-2">
                        <TbEye size={16} className="text-primary" />
                        <span className="fw-semibold small">Canlı önizleme</span>
                        <button className="btn btn-sm btn-link ms-auto p-0 text-decoration-none d-flex align-items-center gap-1"
                          onClick={() => setFullPreview(true)} disabled={questions.length === 0}
                          title="Formu talep ekranındaki gerçek genişliğinde göster">
                          <TbArrowsMaximize size={14} /> Tam boy
                        </button>
                        <button className="btn btn-sm btn-link p-0 text-decoration-none d-flex align-items-center gap-1"
                          onClick={() => setPreviewAnswers({})} title="Önizlemedeki cevapları temizle">
                          <TbRefresh size={14} /> Sıfırla
                        </button>
                      </div>
                      <div className="card-body" style={{ maxHeight: 'calc(100vh - 160px)', overflowY: 'auto' }}>
                        <p className="text-muted small mb-3">
                          Talep sahibi <strong>{draft.name || 'bu türü'}</strong> seçtiğinde formu böyle görür. Koşullu
                          soruları denemek için cevap verebilirsiniz. Gerçek dizilim için <strong>Tam boy</strong>a tıklayın.
                        </p>
                        {questions.length === 0 ? (
                          <p className="text-muted small fst-italic mb-0">Soru ekledikçe burada görünecek.</p>
                        ) : (
                          <DynamicQuestions
                            questions={questions}
                            answers={previewAnswers}
                            onChange={setPreviewAnswers}
                            idPrefix="preview"
                            preview
                          />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
        </div>
      )}

      <Modal isOpen={fullPreview} onClose={() => setFullPreview(false)} size="lg"
        title={draft ? `${draft.name || 'Talep formu'} — önizleme` : 'Önizleme'}>
        <p className="text-muted small">Talep sahibinin "Yeni Talep Oluştur" penceresinde göreceği dizilim.</p>
        <DynamicQuestions questions={questions} answers={previewAnswers} onChange={setPreviewAnswers} idPrefix="full" preview />
      </Modal>

      <Modal isOpen={!!newForm} onClose={() => setNewForm(null)} title="Yeni talep türü">
        {newForm && (
          <form onSubmit={createForm}>
            <div className="mb-3">
              <label className={LABEL} style={LABEL_STYLE} htmlFor="new-form-name">Talep türü adı</label>
              <input id="new-form-name" className="form-control" autoFocus value={newForm.name}
                placeholder="Örn. Arıza Bildirimi"
                onChange={(e) => setNewForm({ ...newForm, name: e.target.value })} />
            </div>
            <div className="mb-4">
              <label className={LABEL} style={LABEL_STYLE} htmlFor="new-form-desc">
                Kısa açıklama <span className="text-muted fw-normal">(isteğe bağlı)</span>
              </label>
              <input id="new-form-desc" className="form-control" value={newForm.description}
                placeholder="Örn. Bilgisayar, yazıcı ve ağ arızaları için"
                onChange={(e) => setNewForm({ ...newForm, description: e.target.value })} />
            </div>
            <div className="d-flex justify-content-end gap-2">
              <button type="button" className="btn btn-outline-secondary" onClick={() => setNewForm(null)}>İptal</button>
              <button type="submit" className="btn btn-primary" disabled={!newForm.name.trim()}>Oluştur</button>
            </div>
          </form>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={!!pendingNav}
        onClose={() => setPendingNav(null)}
        onConfirm={confirmNav}
        title="Kaydedilmemiş değişiklikler"
        message="Bu formda kaydedilmemiş değişiklikler var. Devam ederseniz kaybolacak."
        confirmText="Değişiklikleri at"
        variant="warning"
      />
      <ConfirmDialog
        isOpen={confirmDeleteForm}
        onClose={() => setConfirmDeleteForm(false)}
        onConfirm={deleteForm}
        title="Talep türünü sil"
        message={`"${selected?.name || ''}" ve tüm soruları silinecek. Bu türle açılmış talepler cevaplarını korur.`}
        confirmText="Sil"
      />
      <ConfirmDialog
        isOpen={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => removeQuestion(pendingDelete.id)}
        title="Soruyu sil"
        message={pendingDelete
          ? `"${pendingDelete.label || 'Bu soru'}" sorusuna bağlı ${dependentsOf(pendingDelete.id).length} koşullu soru var. Silinirse bu sorular koşulsuz (her zaman görünür) hale gelir.`
          : ''}
        confirmText="Sil"
      />
    </div>
  );
}

function QuestionCard({
  q, index, questions, open, errors, onToggle, onUpdate, onChangeType, onRenameOption, onDuplicate, onDelete,
}) {
  const meta = QUESTION_TYPE_BY_KEY[q.type];
  const Icon = meta?.Icon;
  const parent = q.showIf && questions.find((x) => x.id === q.showIf.questionId);
  // A condition may only depend on an earlier single-answer question.
  const conditionSources = questions.slice(0, index).filter((x) => isConditionSource(x.type));

  return (
    <Draggable draggableId={q.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={`card mb-2 ${snapshot.isDragging ? 'shadow' : 'shadow-sm'} ${errors ? 'border-danger' : 'border-0'}`}
          style={{ ...provided.draggableProps.style, borderLeft: `3px solid ${errors ? '#dc3545' : '#2563eb'}` }}
        >
          {/* Header */}
          <div className="card-body py-2 d-flex align-items-center gap-2">
            <span {...provided.dragHandleProps} className="text-muted" style={{ cursor: 'grab' }}
              title="Sürükleyerek sırala" aria-label="Sürükleyerek sırala">
              <TbGripVertical size={18} />
            </span>
            <span className="text-muted small fw-semibold" style={{ width: 20 }}>{index + 1}.</span>
            {Icon && <Icon size={16} className="text-primary flex-shrink-0" title={meta.label} />}
            <button type="button" className="btn btn-link p-0 text-start text-decoration-none text-body flex-grow-1 text-truncate"
              onClick={onToggle} style={{ minWidth: 0 }}>
              {q.label || <span className="text-muted fst-italic">Yeni {meta?.label.toLowerCase()} sorusu</span>}
            </button>
            {q.width !== 12 && (
              <span className="badge text-bg-light border" title="Genişlik">
                {QUESTION_WIDTHS.find((w) => w.width === q.width)?.short}
              </span>
            )}
            {q.required && <span className="badge text-bg-light border">Zorunlu</span>}
            {parent && (
              <span className="badge text-bg-light border d-none d-md-inline-flex align-items-center gap-1"
                title={`"${parent.label}" = ${q.showIf.value === 'true' ? 'Evet' : q.showIf.value === 'false' ? 'Hayır' : q.showIf.value}`}>
                <TbGitBranch size={12} /> Koşullu
              </span>
            )}
            <button type="button" className="icon-btn" style={{ width: 30, height: 30 }} onClick={onDuplicate} title="Çoğalt">
              <TbCopy size={15} />
            </button>
            <button type="button" className="icon-btn icon-btn--danger" style={{ width: 30, height: 30 }} onClick={onDelete} title="Sil">
              <TbTrash size={15} />
            </button>
            <button type="button" className="icon-btn" style={{ width: 30, height: 30 }} onClick={onToggle}
              title={open ? 'Daralt' : 'Düzenle'} aria-expanded={open}>
              {open ? <TbChevronUp size={16} /> : <TbChevronDown size={16} />}
            </button>
          </div>

          {/* Body */}
          {open && (
            <div className="card-body border-top pt-3">
              {errors && (
                <div className="alert alert-danger py-1 px-2 small mb-3">
                  {errors.map((m) => <div key={m}>{m}</div>)}
                </div>
              )}
              <div className="row g-3 mb-3">
                <div className="col-12 col-md-8">
                  <label className={LABEL} style={LABEL_STYLE}>Soru metni</label>
                  <input className="form-control" value={q.label} autoFocus={!q.label}
                    placeholder="Örn. Sorun yaşadığınız cihazın seri numarası nedir?"
                    onChange={(e) => onUpdate({ label: e.target.value })} />
                </div>
                <div className="col-12 col-md-4">
                  <label className={LABEL} style={LABEL_STYLE}>Soru tipi</label>
                  <select className="form-select" value={q.type} onChange={(e) => onChangeType(e.target.value)}>
                    {QUESTION_TYPES.map((t) => <option key={t.type} value={t.type}>{t.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="row g-3 mb-3">
                <div className={hasPlaceholder(q.type) ? 'col-12 col-md-7' : 'col-12'}>
                  <label className={LABEL} style={LABEL_STYLE}>Yardım metni <span className="text-muted fw-normal">(isteğe bağlı)</span></label>
                  <input className="form-control form-control-sm" value={q.helpText}
                    placeholder="Sorunun altında küçük açıklama olarak görünür"
                    onChange={(e) => onUpdate({ helpText: e.target.value })} />
                </div>
                {hasPlaceholder(q.type) && (
                  <div className="col-12 col-md-5">
                    <label className={LABEL} style={LABEL_STYLE}>Örnek metin <span className="text-muted fw-normal">(placeholder)</span></label>
                    <input className="form-control form-control-sm" value={q.placeholder}
                      onChange={(e) => onUpdate({ placeholder: e.target.value })} />
                  </div>
                )}
              </div>

              <WidthPicker value={q.width} onChange={(width) => onUpdate({ width })} />

              {isChoiceType(q.type) && <OptionsEditor q={q} onUpdate={onUpdate} onRename={onRenameOption} />}
              {q.type === 'file' && <FileSettings q={q} onUpdate={onUpdate} />}

              <div className="d-flex flex-wrap align-items-center gap-4 mt-3 pt-2 border-top">
                <div className="form-check form-switch mb-0">
                  <input id={`req-${q.id}`} className="form-check-input" type="checkbox" role="switch"
                    checked={q.required} onChange={(e) => onUpdate({ required: e.target.checked })} />
                  <label htmlFor={`req-${q.id}`} className="form-check-label small">
                    {q.type === 'boolean' ? 'İşaretlenmesi zorunlu' : 'Zorunlu soru'}
                  </label>
                </div>
                <div className="form-check form-switch mb-0">
                  <input id={`cond-${q.id}`} className="form-check-input" type="checkbox" role="switch"
                    checked={!!q.showIf}
                    disabled={!q.showIf && conditionSources.length === 0}
                    onChange={(e) => {
                      if (!e.target.checked) return onUpdate({ showIf: null });
                      const src = conditionSources[conditionSources.length - 1];
                      return onUpdate({ showIf: { questionId: src.id, value: src.type === 'boolean' ? 'true' : (src.options[0] || '') } });
                    }} />
                  <label htmlFor={`cond-${q.id}`} className="form-check-label small"
                    title={conditionSources.length === 0 ? 'Önce bu sorudan önce gelen bir açılır liste, tek seçim veya onay kutusu sorusu ekleyin' : undefined}>
                    Yalnızca belirli bir cevapta göster
                  </label>
                </div>
              </div>

              {q.showIf && (
                <ConditionEditor q={q} sources={conditionSources} onUpdate={onUpdate} />
              )}
            </div>
          )}
        </div>
      )}
    </Draggable>
  );
}

/** Segmented control; each button draws its share of a row so the choice is visual. */
function WidthPicker({ value, onChange }) {
  return (
    <div className="mb-3">
      <label className={LABEL} style={LABEL_STYLE}>Genişlik <span className="text-muted fw-normal">(bir satırda en fazla 4 soru)</span></label>
      <div className="d-flex flex-wrap gap-2" role="radiogroup" aria-label="Soru genişliği">
        {QUESTION_WIDTHS.map((w) => {
          const active = value === w.width;
          return (
            <button
              key={w.width}
              type="button"
              role="radio"
              aria-checked={active}
              title={w.label}
              onClick={() => onChange(w.width)}
              className={`btn btn-sm d-flex flex-column align-items-center gap-1 px-2 py-1 ${active ? 'btn-primary' : 'btn-outline-secondary'}`}
              style={{ minWidth: 64 }}
            >
              <span className="d-flex gap-1" style={{ width: 44 }} aria-hidden="true">
                {Array.from({ length: w.parts }).map((_, i) => (
                  <span key={i} style={{ flex: 1, height: 8, borderRadius: 2, background: 'currentColor', opacity: i === 0 ? 1 : 0.35 }} />
                ))}
              </span>
              <span style={{ fontSize: '0.72rem' }}>{w.short}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** File question settings: how many files, and which categories are accepted. */
function FileSettings({ q, onUpdate }) {
  const settings = q.settings || {};
  const accept = settings.accept || [];
  const setSettings = (patch) => onUpdate({ settings: { maxFiles: 1, accept: [], ...settings, ...patch } });
  const toggle = (key) => setSettings({ accept: accept.includes(key) ? accept.filter((k) => k !== key) : [...accept, key] });

  return (
    <div className="row g-3 mb-1">
      <div className="col-12 col-md-4">
        <label className={LABEL} style={LABEL_STYLE} htmlFor={`max-${q.id}`}>En fazla dosya sayısı</label>
        <select id={`max-${q.id}`} className="form-select form-select-sm" value={settings.maxFiles || 1}
          onChange={(e) => setSettings({ maxFiles: Number(e.target.value) })}>
          {[1, 2, 3, 4, 5, 10].map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>
      <div className="col-12 col-md-8">
        <div className={LABEL} style={LABEL_STYLE}>
          İzin verilen türler <span className="text-muted fw-normal">(hiçbiri seçilmezse hepsi)</span>
        </div>
        <div className="d-flex flex-wrap gap-3">
          {FILE_CATEGORIES.map((c) => (
            <div className="form-check mb-0" key={c.key}>
              <input id={`acc-${q.id}-${c.key}`} type="checkbox" className="form-check-input"
                checked={accept.includes(c.key)} onChange={() => toggle(c.key)} />
              <label htmlFor={`acc-${q.id}-${c.key}`} className="form-check-label small" title={c.exts.join(' ')}>
                {c.label}
              </label>
            </div>
          ))}
        </div>
      </div>
      <div className="col-12 form-text mt-1">Dosya başına en fazla {MAX_UPLOAD_MB} MB.</div>
    </div>
  );
}

function OptionsEditor({ q, onUpdate, onRename }) {
  const [bulk, setBulk] = useState(null); // null = closed, string = textarea content

  function addOption(after = q.options.length - 1) {
    const next = [...q.options];
    next.splice(after + 1, 0, '');
    onUpdate({ options: next });
    // focus the new input after render
    setTimeout(() => document.getElementById(`opt-${q.id}-${after + 1}`)?.focus(), 0);
  }

  function applyBulk() {
    const lines = bulk.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length) onUpdate({ options: lines });
    setBulk(null);
  }

  return (
    <div className="mb-1">
      <div className="d-flex align-items-center mb-1">
        <label className={`${LABEL} mb-0`} style={LABEL_STYLE}>Seçenekler</label>
        <button type="button" className="btn btn-link btn-sm ms-auto p-0 text-decoration-none"
          onClick={() => setBulk(bulk === null ? q.options.join('\n') : null)}>
          {bulk === null ? 'Toplu düzenle' : 'Tek tek düzenle'}
        </button>
      </div>

      {bulk !== null ? (
        <div>
          <textarea className="form-control form-control-sm" rows={Math.max(4, q.options.length + 1)} value={bulk}
            placeholder={'Her satıra bir seçenek yazın'} onChange={(e) => setBulk(e.target.value)} autoFocus />
          <div className="d-flex justify-content-end gap-2 mt-2">
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setBulk(null)}>Vazgeç</button>
            <button type="button" className="btn btn-sm btn-primary" onClick={applyBulk}>Uygula</button>
          </div>
        </div>
      ) : (
        <>
          {q.options.map((o, i) => (
            <div className="input-group input-group-sm mb-2" key={i}>
              <span className="input-group-text text-muted" style={{ width: 34, justifyContent: 'center' }}>
                {q.type === 'checkbox' ? '☐' : q.type === 'radio' ? '○' : i + 1}
              </span>
              <input
                id={`opt-${q.id}-${i}`}
                className="form-control"
                value={o}
                placeholder={`Seçenek ${i + 1}`}
                onChange={(e) => onRename(i, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); addOption(i); }
                  if (e.key === 'Backspace' && o === '' && q.options.length > 1) {
                    e.preventDefault();
                    onUpdate({ options: q.options.filter((_, j) => j !== i) });
                    setTimeout(() => document.getElementById(`opt-${q.id}-${Math.max(0, i - 1)}`)?.focus(), 0);
                  }
                }}
              />
              <button type="button" className="btn btn-outline-secondary" title="Seçeneği kaldır"
                disabled={q.options.length <= 1}
                onClick={() => onUpdate({ options: q.options.filter((_, j) => j !== i) })}>
                <TbX size={14} />
              </button>
            </div>
          ))}
          <button type="button" className="btn btn-sm btn-link p-0 text-decoration-none d-flex align-items-center gap-1 mt-1"
            onClick={() => addOption()}>
            <TbPlus size={14} /> Seçenek ekle
          </button>
          <div className="form-text">İpucu: Enter ile yeni seçenek, boş satırda Backspace ile silme.</div>
        </>
      )}
    </div>
  );
}

function ConditionEditor({ q, sources, onUpdate }) {
  const parent = sources.find((s) => s.id === q.showIf.questionId);
  const values = parent?.type === 'boolean'
    ? [['true', 'Evet (işaretli)'], ['false', 'Hayır (işaretsiz)']]
    : (parent?.options || []).filter((o) => o.trim()).map((o) => [o, o]);

  return (
    <div className="d-flex flex-wrap align-items-center gap-2 mt-2 p-2 rounded small" style={{ background: '#F4F5F7' }}>
      <TbGitBranch size={15} className="text-primary" />
      <span>Bu soruyu yalnızca</span>
      <select className="form-select form-select-sm" style={{ width: 'auto', maxWidth: 240 }}
        value={parent ? parent.id : ''}
        onChange={(e) => {
          const src = sources.find((s) => s.id === e.target.value);
          onUpdate({ showIf: { questionId: src.id, value: src.type === 'boolean' ? 'true' : (src.options[0] || '') } });
        }}>
        {!parent && <option value="">— soru seçin —</option>}
        {sources.map((s) => <option key={s.id} value={s.id}>{s.label || '(adsız soru)'}</option>)}
      </select>
      <span>sorusunun cevabı</span>
      <select className="form-select form-select-sm" style={{ width: 'auto', maxWidth: 200 }}
        value={q.showIf.value}
        onChange={(e) => onUpdate({ showIf: { ...q.showIf, value: e.target.value } })}>
        {!values.some(([v]) => v === q.showIf.value) && <option value={q.showIf.value}>— seçin —</option>}
        {values.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
      </select>
      <span>olduğunda göster.</span>
    </div>
  );
}
