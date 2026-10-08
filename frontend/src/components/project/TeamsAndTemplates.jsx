import React, { useState, useEffect, useRef } from 'react';
import { TbPlus, TbUsers, TbTrash, TbTemplate, TbAlertCircle, TbX } from 'react-icons/tb';
import { useAppContext } from '../../context/AppContext';
import { usePermissions } from '../../hooks/usePermissions';
import { ROLES } from '../../constants';
import { teamsApi, templatesApi } from '../../api/resources';
import ConfirmDialog from '../common/ConfirmDialog';

const TEMPLATE_KINDS = {
  reply: {
    label: 'Cevap Şablonları',
    help: 'Yorum kutusuna eklenebilecek hazır yanıtlar.',
    empty: 'Henüz cevap şablonu eklenmedi.',
  },
  resolution: {
    label: 'Çözüm Şablonları',
    help: 'Bir talep tamamlanırken "Çözüm İçeriği" alanına eklenebilecek hazır çözüm metinleri.',
    empty: 'Henüz çözüm şablonu eklenmedi.',
  },
};

/** Inline "required" message under a field (Bootstrap invalid-feedback, with an icon). */
function FieldError({ children }) {
  if (!children) return null;
  return (
    <div className="invalid-feedback d-flex align-items-center gap-1">
      <TbAlertCircle size={14} className="flex-shrink-0" /> {children}
    </div>
  );
}

/**
 * A müdürlük's reply/resolution templates and teams (assign a request to a
 * group instead of one person). Shown on Yönetim → Ekipler ve Şablonlar.
 */
export default function TeamsAndTemplates({ projectId }) {
  const { state } = useAppContext();
  const { can } = usePermissions();
  const [teams, setTeams] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [kind, setKind] = useState('reply');
  const [newTeamName, setNewTeamName] = useState('');
  const [newMemberByTeam, setNewMemberByTeam] = useState({});
  const [tmplForm, setTmplForm] = useState({ title: '', body: '' });
  const [errors, setErrors] = useState({}); // title, body, teamName, member:<teamId>
  const [confirm, setConfirm] = useState(null); // { title, message, onConfirm }
  const titleRef = useRef(null);
  const bodyRef = useRef(null);
  const teamNameRef = useRef(null);

  const canManageTeams = can('team.manage');
  const canManageTemplates = can('template.manage');

  // Only this müdürlük's own staff (assigned to it, or its manager) can join
  // its teams — the backend enforces the same rule.
  const managerId = state.projects.find((p) => p.id === projectId)?.managerId;
  const projectUsers = state.users.filter(
    (u) => u.role !== ROLES.EXTERNAL_USER && (u.projectId === projectId || u.id === managerId)
  );

  const kindTemplates = templates.filter((t) => (t.kind || 'reply') === kind);
  const countOf = (k) => templates.filter((t) => (t.kind || 'reply') === k).length;
  const clearError = (key) => setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));

  function load() {
    setLoading(true);
    Promise.all([teamsApi.listByProject(projectId), templatesApi.listByProject(projectId, { all: true })])
      .then(([t, tmpl]) => { setTeams(t); setTemplates(tmpl); })
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Teams ─────────────────────────────────────────────────────────────
  async function createTeam(e) {
    e.preventDefault();
    if (!newTeamName.trim()) {
      setErrors((s) => ({ ...s, teamName: 'Ekip adı boş bırakılamaz.' }));
      teamNameRef.current?.focus();
      return;
    }
    try {
      await teamsApi.create(projectId, newTeamName.trim());
    } catch (err) {
      setErrors((s) => ({ ...s, teamName: err.message || 'Ekip oluşturulamadı.' }));
      return;
    }
    setNewTeamName('');
    load();
  }
  function deleteTeam(t) {
    setConfirm({
      title: 'Ekibi sil',
      message: `"${t.name}" ekibi silinecek. Bu ekibe atanmış talepler atanmamış duruma düşer.`,
      onConfirm: async () => { await teamsApi.delete(t.id); load(); },
    });
  }
  async function addMember(teamId) {
    const key = `member:${teamId}`;
    const userId = newMemberByTeam[teamId];
    if (!userId) {
      setErrors((s) => ({ ...s, [key]: 'Eklemek için bir personel seçin.' }));
      return;
    }
    try {
      await teamsApi.addMember(teamId, userId);
    } catch (err) {
      setErrors((s) => ({ ...s, [key]: err.message || 'Üye eklenemedi.' }));
      return;
    }
    setNewMemberByTeam((s) => ({ ...s, [teamId]: '' }));
    load();
  }
  async function removeMember(teamId, userId) {
    await teamsApi.removeMember(teamId, userId);
    load();
  }

  // ── Templates ─────────────────────────────────────────────────────────
  async function createTemplate(e) {
    e.preventDefault();
    const next = {
      title: tmplForm.title.trim() ? undefined : 'Şablon başlığı boş bırakılamaz.',
      body: tmplForm.body.trim() ? undefined : 'Şablon metni boş bırakılamaz.',
    };
    if (next.title || next.body) {
      setErrors((s) => ({ ...s, ...next }));
      (next.title ? titleRef : bodyRef).current?.focus();
      return;
    }
    try {
      await templatesApi.create(projectId, { kind, title: tmplForm.title.trim(), body: tmplForm.body.trim() });
    } catch (err) {
      setErrors((s) => ({ ...s, body: err.message || 'Şablon eklenemedi.' }));
      return;
    }
    setTmplForm({ title: '', body: '' });
    load();
  }
  async function toggleTemplateActive(t) {
    await templatesApi.update(t.id, { title: t.title, body: t.body, sortOrder: t.sortOrder, isActive: !t.isActive });
    load();
  }
  function deleteTemplate(t) {
    setConfirm({
      title: 'Şablonu sil',
      message: `"${t.title}" şablonu silinecek.`,
      onConfirm: async () => { await templatesApi.delete(t.id); load(); },
    });
  }
  function switchKind(k) {
    setKind(k);
    setErrors((s) => ({ ...s, title: undefined, body: undefined }));
  }

  if (loading) return <div className="text-center py-5"><span className="spinner-border text-primary" /></div>;

  return (
    <div className="row g-4">
      {/* Şablonlar (Cevap / Çözüm) */}
      <div className="col-lg-6">
        <div className="card border-0 shadow-sm">
          <div className="card-body">
            <h6 className="fw-semibold d-flex align-items-center gap-2 mb-3">
              <TbTemplate size={16} /> Şablonlar
            </h6>

            <ul className="nav nav-tabs mb-3" role="tablist">
              {Object.entries(TEMPLATE_KINDS).map(([k, meta]) => (
                <li className="nav-item" key={k} role="presentation">
                  <button type="button" role="tab" aria-selected={kind === k}
                    className={`nav-link py-1 px-3 small ${kind === k ? 'active fw-semibold' : 'text-muted'}`}
                    onClick={() => switchKind(k)}>
                    {meta.label} <span className="badge text-bg-light border ms-1">{countOf(k)}</span>
                  </button>
                </li>
              ))}
            </ul>

            <p className="text-muted small">
              {TEMPLATE_KINDS[kind].help} Yer tutucular: <code>{'{TalepNo}'}</code>, <code>{'{TalepEdenAdı}'}</code>,{' '}
              <code>{'{MüdürlükAdı}'}</code>, <code>{'{BenimAdım}'}</code>.
            </p>

            {canManageTemplates && (
              <form className="mb-3" onSubmit={createTemplate} noValidate>
                <div className="mb-2">
                  <label className="form-label fw-semibold small mb-1" htmlFor="tmpl-title">
                    Şablon başlığı <span className="text-danger">*</span>
                  </label>
                  <input
                    id="tmpl-title"
                    ref={titleRef}
                    className={`form-control form-control-sm ${errors.title ? 'is-invalid' : ''}`}
                    placeholder={kind === 'resolution' ? 'Örn. Yazıcı sürücüsü yeniden kuruldu' : 'Örn. Talebiniz alındı'}
                    value={tmplForm.title}
                    aria-invalid={!!errors.title}
                    onChange={(e) => { setTmplForm((s) => ({ ...s, title: e.target.value })); clearError('title'); }}
                  />
                  <FieldError>{errors.title}</FieldError>
                </div>
                <div className="mb-2">
                  <label className="form-label fw-semibold small mb-1" htmlFor="tmpl-body">
                    Şablon metni <span className="text-danger">*</span>
                  </label>
                  <textarea
                    id="tmpl-body"
                    ref={bodyRef}
                    className={`form-control form-control-sm ${errors.body ? 'is-invalid' : ''}`}
                    rows={3}
                    placeholder={kind === 'resolution'
                      ? 'Yapılan işlemi ve sonucu yazın…'
                      : 'Merhaba {TalepEdenAdı}, {TalepNo} numaralı talebiniz alınmıştır…'}
                    value={tmplForm.body}
                    aria-invalid={!!errors.body}
                    onChange={(e) => { setTmplForm((s) => ({ ...s, body: e.target.value })); clearError('body'); }}
                  />
                  <FieldError>{errors.body}</FieldError>
                </div>
                <button className="btn btn-primary btn-sm d-flex align-items-center gap-1" type="submit">
                  <TbPlus size={14} /> {kind === 'resolution' ? 'Çözüm Şablonu Ekle' : 'Cevap Şablonu Ekle'}
                </button>
              </form>
            )}

            {kindTemplates.length === 0 ? (
              <p className="text-muted small fst-italic">{TEMPLATE_KINDS[kind].empty}</p>
            ) : (
              kindTemplates.map((t) => (
                <div key={t.id} className="border rounded-3 p-2 mb-2" style={{ opacity: t.isActive ? 1 : 0.55 }}>
                  <div className="d-flex align-items-center justify-content-between">
                    <span className="fw-semibold small">{t.title}</span>
                    {canManageTemplates && (
                      <div className="d-flex gap-2">
                        <button className="btn btn-sm btn-link p-0" style={{ fontSize: 11 }} onClick={() => toggleTemplateActive(t)}>
                          {t.isActive ? 'Pasifleştir' : 'Aktifleştir'}
                        </button>
                        <button className="btn btn-sm btn-link text-danger p-0" onClick={() => deleteTemplate(t)} title="Şablonu sil">
                          <TbTrash size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                  <p className="text-muted mb-0" style={{ fontSize: 12, whiteSpace: 'pre-wrap' }}>{t.body}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Ekipler */}
      <div className="col-lg-6">
        <div className="card border-0 shadow-sm">
          <div className="card-body">
            <h6 className="fw-semibold d-flex align-items-center gap-2 mb-3">
              <TbUsers size={16} /> Ekipler
            </h6>
            <p className="text-muted small">
              Talepleri tek tek kişi yerine bir ekibe atayabilirsiniz. Ekiplere yalnızca bu müdürlüğün personeli eklenebilir.
            </p>

            {canManageTeams && (
              <form className="mb-3" onSubmit={createTeam} noValidate>
                <label className="form-label fw-semibold small mb-1" htmlFor="team-name">
                  Yeni ekip adı <span className="text-danger">*</span>
                </label>
                <div className="d-flex gap-2 align-items-start">
                  <div className="flex-grow-1">
                    <input
                      id="team-name"
                      ref={teamNameRef}
                      className={`form-control form-control-sm ${errors.teamName ? 'is-invalid' : ''}`}
                      placeholder="Örn. Ağ Ekibi"
                      value={newTeamName}
                      aria-invalid={!!errors.teamName}
                      onChange={(e) => { setNewTeamName(e.target.value); clearError('teamName'); }}
                    />
                    <FieldError>{errors.teamName}</FieldError>
                  </div>
                  <button className="btn btn-primary btn-sm d-flex align-items-center gap-1 flex-shrink-0" type="submit">
                    <TbPlus size={14} /> Ekle
                  </button>
                </div>
              </form>
            )}

            {teams.length === 0 ? (
              <p className="text-muted small fst-italic">Henüz ekip oluşturulmadı.</p>
            ) : (
              teams.map((t) => {
                const memberKey = `member:${t.id}`;
                const candidates = projectUsers.filter((u) => !t.memberIds.includes(u.id));
                return (
                  <div key={t.id} className="border rounded-3 p-2 mb-2">
                    <div className="d-flex align-items-center justify-content-between mb-2">
                      <span className="fw-semibold small">{t.name}</span>
                      {canManageTeams && (
                        <button className="btn btn-sm btn-link text-danger p-0" onClick={() => deleteTeam(t)} title="Ekibi sil">
                          <TbTrash size={14} />
                        </button>
                      )}
                    </div>
                    <div className="d-flex flex-wrap gap-1 mb-2">
                      {t.memberIds.length === 0 && <span className="text-muted" style={{ fontSize: 12 }}>Üye yok</span>}
                      {t.memberIds.map((uid) => {
                        const u = state.users.find((x) => x.id === uid);
                        return (
                          <span key={uid} className="badge text-bg-light border d-flex align-items-center gap-1" style={{ fontSize: 11 }}>
                            {u?.name || uid}
                            {canManageTeams && (
                              <button type="button" className="btn btn-link p-0 lh-1 text-muted" title="Ekipten çıkar"
                                aria-label={`${u?.name || 'Üye'} ekipten çıkar`} onClick={() => removeMember(t.id, uid)}>
                                <TbX size={11} />
                              </button>
                            )}
                          </span>
                        );
                      })}
                    </div>
                    {canManageTeams && (
                      candidates.length === 0 ? (
                        <div className="text-muted" style={{ fontSize: 12 }}>Müdürlüğün tüm personeli bu ekipte.</div>
                      ) : (
                        <>
                          <div className="d-flex gap-1">
                            <select
                              className={`form-select form-select-sm ${errors[memberKey] ? 'is-invalid' : ''}`}
                              value={newMemberByTeam[t.id] || ''}
                              aria-invalid={!!errors[memberKey]}
                              onChange={(e) => { setNewMemberByTeam((s) => ({ ...s, [t.id]: e.target.value })); clearError(memberKey); }}
                            >
                              <option value="">— Üye ekle —</option>
                              {candidates.map((u) => (
                                <option key={u.id} value={u.id}>{u.name}</option>
                              ))}
                            </select>
                            <button className="btn btn-sm btn-outline-secondary flex-shrink-0" onClick={() => addMember(t.id)}>Ekle</button>
                          </div>
                          {errors[memberKey] && (
                            <div className="invalid-feedback d-flex align-items-center gap-1">
                              <TbAlertCircle size={14} className="flex-shrink-0" /> {errors[memberKey]}
                            </div>
                          )}
                        </>
                      )
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={() => confirm?.onConfirm()}
        title={confirm?.title}
        message={confirm?.message}
        confirmText="Sil"
      />
    </div>
  );
}
