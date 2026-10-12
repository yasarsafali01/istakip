import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { TbX, TbPlus, TbEdit, TbTrash, TbUserPlus } from 'react-icons/tb';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../hooks/useAuth';
import { rolesApi, usersApi, teamsApi } from '../api/resources';
import { ROLES } from '../constants';
import { inProject } from '../utils/permissionUtils';
import Avatar from '../components/common/Avatar';
import Modal from '../components/common/Modal';
import ConfirmDialog from '../components/common/ConfirmDialog';

/**
 * Delegated, hierarchical role assignment. Unlike "Roller ve İzinler" (which
 * defines what a role can DO and is System_Admin-only), this page lets any
 * manager hand out roles to their own subordinates — scoped to who they
 * manage and capped at roles strictly below their own rank. The backend
 * (services.CanManageUser / CanAssignRoleLevel) enforces the same rule
 * server-side; the filtering here is just so nobody sees an option they
 * can't actually use.
 *
 * A user has one primary role plus any number of extra roles (e.g. Çalışan +
 * Envanter Sorumlusu); their access is the union of all of them.
 *
 * A Daire Başkanı can also add, edit and delete (deactivate) the personnel of
 * their daire başkanlığı and put each person on any number of its teams.
 */
export default function UsersPage() {
  const { state, hydrateAll } = useAppContext();
  const { currentUser } = useAuth();
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(null); // null | 'new' | user
  const [deleting, setDeleting] = useState(null);
  const [unitTeams, setUnitTeams] = useState([]);

  // Only the Daire Başkanı manages personnel here; others assign roles only.
  const isUnitAdmin = currentUser?.role === ROLES.DEPARTMENT_HEAD;
  const unitProjects = useMemo(
    () => state.projects.filter((p) => p.unitId === currentUser?.unitId),
    [state.projects, currentUser?.unitId]
  );

  function loadTeams() {
    Promise.all(unitProjects.map((p) => teamsApi.listByProject(p.id).catch(() => [])))
      .then((lists) => setUnitTeams(lists.flat()));
  }
  useEffect(() => {
    if (isUnitAdmin) loadTeams();
  }, [isUnitAdmin, unitProjects]); // eslint-disable-line react-hooks/exhaustive-deps

  const roleByKey = useMemo(
    () => Object.fromEntries(state.roles.map((r) => [r.key, r])),
    [state.roles]
  );
  const myLevel = currentUser?.level ?? 0;

  // Projects this user manages (only relevant when scope === 'manager').
  const managedProjectIds = useMemo(
    () => new Set(state.projects.filter((p) => p.managerId === currentUser?.id).map((p) => p.id)),
    [state.projects, currentUser?.id]
  );

  const primaryKey = (u) => u.roleKey || u.role;
  const extrasOf = (u) => u.extraRoles || [];
  // Highest level across all of a user's roles — what the hierarchy check compares.
  const userLevel = (u) => Math.max(...[primaryKey(u), ...extrasOf(u)].map((k) => roleByKey[k]?.level ?? 0));

  function inManagementScope(user) {
    switch (currentUser?.scope) {
      case 'all':
        return true;
      case 'unit':
        return !!user.unitId && user.unitId === currentUser.unitId;
      case 'manager':
        return [...managedProjectIds].some((id) => inProject(user, id));
      default:
        return false;
    }
  }

  const subordinates = useMemo(() => {
    const q = query.trim().toLowerCase();
    return state.users
      .filter((u) => u.isActive !== false)
      .filter((u) => u.id !== currentUser?.id)
      .filter(inManagementScope)
      // Someone whose roles already match or outrank me is out of reach,
      // even if they happen to be in my unit/project (mirrors the backend check).
      .filter((u) => userLevel(u) < myLevel)
      .filter((u) => !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.users, query, myLevel, roleByKey, currentUser]);

  // Roles I'm allowed to hand out: strictly below my own rank.
  const assignableRoles = useMemo(
    () => state.roles.filter((r) => r.level < myLevel).sort((a, b) => b.level - a.level),
    [state.roles, myLevel]
  );

  const unitName = (id) => state.units.find((u) => u.id === id)?.name;
  const projectName = (id) => state.projects.find((p) => p.id === id)?.name;
  const teamsOf = (u) => unitTeams.filter((t) => t.memberIds.includes(u.id));
  const projectIdsOf = (u) => (u.projectIds?.length ? u.projectIds : [u.projectId]).filter(Boolean);

  // Inline müdürlük / team changes from the table (Daire Başkanı only).
  async function saveMembership(user, { projectIds = projectIdsOf(user), teamIds = teamsOf(user).map((t) => t.id) }) {
    setBusyId(user.id);
    setError('');
    try {
      await usersApi.update(user.id, { name: user.name, email: user.email, projectIds, teamIds });
      await hydrateAll();
      loadTeams();
    } catch (err) {
      setError(`${user.name}: ${err.message || 'Kaydedilemedi'}`);
    } finally {
      setBusyId(null);
    }
  }

  async function saveRoles(user, primary, extras) {
    setBusyId(user.id);
    setError('');
    try {
      await rolesApi.assign(user.id, { role: primary, extraRoles: extras.filter((k) => k !== primary) });
      await hydrateAll();
    } catch (err) {
      setError(`${user.name}: ${err.message || 'Rol atanamadı'}`);
    } finally {
      setBusyId(null);
    }
  }

  async function deleteUser(user) {
    setError('');
    try {
      await usersApi.remove(user.id);
      await hydrateAll();
      loadTeams();
    } catch (err) {
      setError(`${user.name}: ${err.message || 'Kullanıcı silinemedi'}`);
    }
  }

  return (
    <div>
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-1">
        <h4 className="fw-bold mb-0">Kullanıcılar</h4>
        {isUnitAdmin && (
          <button className="btn btn-primary btn-sm d-flex align-items-center gap-1" onClick={() => setEditing('new')}>
            <TbUserPlus size={16} /> Yeni Kullanıcı
          </button>
        )}
      </div>
      <p className="text-muted small mb-3">
        Yönetim alanınızdaki kullanıcılara rol atayın. Bir kullanıcının bir <strong>ana rolü</strong> ve istediği kadar
        <strong> ek rolü</strong> olabilir (ör. Çalışan + Envanter Sorumlusu); kullanıcı tüm rollerinin yetkilerini
        birlikte kullanır. Yalnızca kendi rol seviyenizin (Seviye {myLevel}) altındaki roller ve kendi daire
        başkanlığınız/müdürlüğünüz içindeki kullanıcılar listelenir.
      </p>

      <div className="card">
        <div className="card-body">
          {error && <div className="alert alert-danger py-2 small">{error}</div>}
          <input
            className="form-control mb-3"
            style={{ maxWidth: 320 }}
            placeholder="Kullanıcı ara…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {subordinates.length === 0 ? (
            <p className="text-muted small fst-italic mb-0">
              Yönetim alanınızda, rol atayabileceğiniz bir kullanıcı bulunamadı.
            </p>
          ) : (
            <div className="table-responsive">
              <table className="table align-middle mb-0">
                <thead>
                  <tr>
                    <th>Kullanıcı</th>
                    <th>Daire Başkanlığı / Müdürlük</th>
                    <th style={{ minWidth: 200 }}>Ana Rol</th>
                    <th style={{ minWidth: 260 }}>Ek Roller</th>
                    {isUnitAdmin && <th style={{ minWidth: 180 }}>Ekipler</th>}
                    {isUnitAdmin && <th className="text-end">İşlemler</th>}
                  </tr>
                </thead>
                <tbody>
                  {subordinates.map((u) => {
                    const primary = primaryKey(u);
                    const extras = extrasOf(u);
                    const busy = busyId === u.id;
                    const addable = assignableRoles.filter((r) => r.key !== primary && !extras.includes(r.key));
                    return (
                      <tr key={u.id}>
                        <td>
                          <div className="d-flex align-items-center gap-2">
                            <Avatar name={u.name} color={u.avatarColor} size={32} />
                            <div>
                              <Link to={`/personnel/${u.id}`} className="fw-medium text-decoration-none" title="Personel profilini aç">
                                {u.name}
                              </Link>
                              <div className="text-muted small">{u.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="small text-muted">
                          <div className="mb-1">{unitName(u.unitId) || '—'}</div>
                          <div className="d-flex flex-wrap align-items-center gap-1">
                            {projectIdsOf(u).map((id) => (
                              <span key={id} className="badge rounded-pill bg-primary bg-opacity-10 text-primary border border-primary-subtle d-inline-flex align-items-center gap-1 fw-medium">
                                {projectName(id)}
                                {isUnitAdmin && projectIdsOf(u).length > 1 && (
                                  <button
                                    type="button"
                                    className="btn btn-link p-0 lh-1 text-primary"
                                    disabled={busy}
                                    title="Müdürlükten çıkar"
                                    aria-label={`${projectName(id)} müdürlüğünden çıkar`}
                                    onClick={() => saveMembership(u, { projectIds: projectIdsOf(u).filter((x) => x !== id) })}
                                  >
                                    <TbX size={12} />
                                  </button>
                                )}
                              </span>
                            ))}
                            {isUnitAdmin && unitProjects.some((p) => !projectIdsOf(u).includes(p.id)) && (
                              <div className="position-relative d-inline-flex align-items-center">
                                <TbPlus size={12} className="position-absolute text-muted" style={{ left: 8, pointerEvents: 'none' }} />
                                <select
                                  className="form-select form-select-sm"
                                  style={{ width: 'auto', paddingLeft: 22, fontSize: '0.78rem' }}
                                  value=""
                                  disabled={busy}
                                  aria-label="Müdürlük ekle"
                                  onChange={(e) => e.target.value && saveMembership(u, { projectIds: [...projectIdsOf(u), e.target.value] })}
                                >
                                  <option value="">Müdürlük ekle</option>
                                  {unitProjects.filter((p) => !projectIdsOf(u).includes(p.id)).map((p) => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                  ))}
                                </select>
                              </div>
                            )}
                          </div>
                        </td>
                        <td>
                          <select
                            className="form-select form-select-sm"
                            value={primary}
                            disabled={busy}
                            onChange={(e) => saveRoles(u, e.target.value, extras)}
                          >
                            {/* Kullanıcının mevcut rolü, listede olmasa bile (örn. benimle aynı
                                seviyede biri artık göremiyor) seçili kalabilsin diye eklenir. */}
                            {!assignableRoles.some((r) => r.key === primary) && (
                              <option value={primary}>{roleByKey[primary]?.name || u.role}</option>
                            )}
                            {assignableRoles.map((r) => (
                              <option key={r.key} value={r.key}>{r.name}</option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <div className="d-flex flex-wrap align-items-center gap-1">
                            {extras.map((k) => (
                              <span key={k} className="badge rounded-pill bg-primary bg-opacity-10 text-primary border border-primary-subtle d-inline-flex align-items-center gap-1 fw-medium">
                                {roleByKey[k]?.name || k}
                                <button
                                  type="button"
                                  className="btn btn-link p-0 lh-1 text-primary"
                                  disabled={busy}
                                  title="Ek rolü kaldır"
                                  aria-label={`${roleByKey[k]?.name || k} rolünü kaldır`}
                                  onClick={() => saveRoles(u, primary, extras.filter((x) => x !== k))}
                                >
                                  <TbX size={12} />
                                </button>
                              </span>
                            ))}
                            {addable.length > 0 && (
                              <div className="position-relative d-inline-flex align-items-center">
                                <TbPlus size={12} className="position-absolute text-muted" style={{ left: 8, pointerEvents: 'none' }} />
                                <select
                                  className="form-select form-select-sm"
                                  style={{ width: 'auto', paddingLeft: 22, fontSize: '0.78rem' }}
                                  value=""
                                  disabled={busy}
                                  aria-label="Ek rol ekle"
                                  onChange={(e) => e.target.value && saveRoles(u, primary, [...extras, e.target.value])}
                                >
                                  <option value="">Rol ekle</option>
                                  {addable.map((r) => <option key={r.key} value={r.key}>{r.name}</option>)}
                                </select>
                              </div>
                            )}
                            {extras.length === 0 && addable.length === 0 && <span className="text-muted small">—</span>}
                          </div>
                        </td>
                        {isUnitAdmin && (
                          <td>
                            <div className="d-flex flex-wrap align-items-center gap-1">
                              {teamsOf(u).map((t) => (
                                <span key={t.id} title={projectName(t.projectId)}
                                  className="badge rounded-pill bg-primary bg-opacity-10 text-primary border border-primary-subtle d-inline-flex align-items-center gap-1 fw-medium">
                                  {t.name}
                                  <button
                                    type="button"
                                    className="btn btn-link p-0 lh-1 text-primary"
                                    disabled={busy}
                                    title="Ekipten çıkar"
                                    aria-label={`${t.name} ekibinden çıkar`}
                                    onClick={() => saveMembership(u, { teamIds: teamsOf(u).filter((x) => x.id !== t.id).map((x) => x.id) })}
                                  >
                                    <TbX size={12} />
                                  </button>
                                </span>
                              ))}
                              {unitTeams.some((t) => !t.memberIds.includes(u.id)) ? (
                                <div className="position-relative d-inline-flex align-items-center">
                                  <TbPlus size={12} className="position-absolute text-muted" style={{ left: 8, pointerEvents: 'none' }} />
                                  <select
                                    className="form-select form-select-sm"
                                    style={{ width: 'auto', paddingLeft: 22, fontSize: '0.78rem' }}
                                    value=""
                                    disabled={busy}
                                    aria-label="Ekip ekle"
                                    onChange={(e) => e.target.value && saveMembership(u, { teamIds: [...teamsOf(u).map((x) => x.id), e.target.value] })}
                                  >
                                    <option value="">Ekip ekle</option>
                                    {unitProjects.map((p) => {
                                      const options = unitTeams.filter((t) => t.projectId === p.id && !t.memberIds.includes(u.id));
                                      return options.length > 0 && (
                                        <optgroup key={p.id} label={p.name}>
                                          {options.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                                        </optgroup>
                                      );
                                    })}
                                  </select>
                                </div>
                              ) : teamsOf(u).length === 0 && (
                                <span className="text-muted small" title="Ekipler ve Şablonlar sayfasından ekip oluşturun">Ekip yok</span>
                              )}
                            </div>
                          </td>
                        )}
                        {isUnitAdmin && (
                          <td className="text-end text-nowrap">
                            <button className="icon-btn" style={{ width: 30, height: 30 }} title="Düzenle"
                              aria-label={`${u.name} düzenle`} onClick={() => setEditing(u)}>
                              <TbEdit size={15} />
                            </button>
                            <button className="icon-btn icon-btn--danger ms-1" style={{ width: 30, height: 30 }} title="Sil"
                              aria-label={`${u.name} sil`} onClick={() => setDeleting(u)}>
                              <TbTrash size={15} />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {isUnitAdmin && (
        <Modal
          isOpen={!!editing}
          onClose={() => setEditing(null)}
          size="lg"
          title={editing === 'new' ? 'Yeni Kullanıcı' : `Kullanıcıyı Düzenle — ${editing?.name || ''}`}
        >
          {editing && (
            <UserForm
              user={editing === 'new' ? null : editing}
              projects={unitProjects}
              teams={unitTeams}
              roles={assignableRoles}
              memberTeamIds={editing === 'new' ? [] : teamsOf(editing).map((t) => t.id)}
              onCancel={() => setEditing(null)}
              onSaved={async () => {
                setEditing(null);
                await hydrateAll();
                loadTeams();
              }}
            />
          )}
        </Modal>
      )}

      <ConfirmDialog
        isOpen={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleteUser(deleting)}
        title="Kullanıcıyı sil"
        message={deleting
          ? `"${deleting.name}" silinecek: artık giriş yapamaz ve tüm ekiplerden çıkarılır. Geçmiş talep ve yorumlarında adı görünmeye devam eder.`
          : ''}
        confirmText="Sil"
      />
    </div>
  );
}

/** Add / edit a person of the daire başkanlığı, including their teams. */
function UserForm({ user, projects, teams, roles, memberTeamIds, onCancel, onSaved }) {
  const isNew = !user;
  const [form, setForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    password: '',
    projectIds: user ? (user.projectIds?.length ? user.projectIds : [user.projectId].filter(Boolean)) : [],
    role: roles.find((r) => r.key === ROLES.WORKER)?.key || roles[roles.length - 1]?.key || '',
    teamIds: memberTeamIds,
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const toggleTeam = (id) => set({
    teamIds: form.teamIds.includes(id) ? form.teamIds.filter((x) => x !== id) : [...form.teamIds, id],
  });
  const toggleProject = (id) => set({
    projectIds: form.projectIds.includes(id) ? form.projectIds.filter((x) => x !== id) : [...form.projectIds, id],
  });

  async function submit(e) {
    e.preventDefault();
    let problem = '';
    if (!form.name.trim()) problem = 'Ad soyad zorunludur.';
    else if (!form.email.includes('@')) problem = 'Geçerli bir e-posta girin.';
    else if (isNew && form.password.length < 6) problem = 'Şifre en az 6 karakter olmalı.';
    else if (!isNew && form.password && form.password.length < 6) problem = 'Yeni şifre en az 6 karakter olmalı.';
    else if (form.projectIds.length === 0) problem = 'En az bir müdürlük seçin.';
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        projectIds: form.projectIds,
        teamIds: form.teamIds,
        ...(form.password ? { password: form.password } : {}),
      };
      if (isNew) await usersApi.create({ ...payload, role: form.role });
      else await usersApi.update(user.id, payload);
      await onSaved();
    } catch (err) {
      setError(err.message || 'Kaydedilemedi.');
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      {error && <div className="alert alert-danger py-2 small">{error}</div>}
      <div className="row g-3">
        <div className="col-md-6">
          <label className="form-label small fw-semibold" htmlFor="uf-name">Ad Soyad</label>
          <input id="uf-name" className="form-control" value={form.name} autoFocus
            onChange={(e) => set({ name: e.target.value })} />
        </div>
        <div className="col-md-6">
          <label className="form-label small fw-semibold" htmlFor="uf-email">E-posta</label>
          <input id="uf-email" type="email" className="form-control" value={form.email}
            onChange={(e) => set({ email: e.target.value })} />
        </div>
        <div className="col-md-6">
          <label className="form-label small fw-semibold" htmlFor="uf-password">
            {isNew ? 'Şifre' : 'Yeni şifre'}
            {!isNew && <span className="text-muted fw-normal"> (değişmeyecekse boş bırakın)</span>}
          </label>
          <input id="uf-password" type="password" className="form-control" value={form.password}
            autoComplete="new-password" onChange={(e) => set({ password: e.target.value })} />
        </div>
        <div className="col-12">
          <div className="form-label small fw-semibold mb-1">
            Müdürlükler <span className="text-muted fw-normal">(birden fazla seçilebilir; ilk seçilen ana müdürlük olur)</span>
          </div>
          <div className="d-flex flex-wrap gap-2">
            {projects.map((p) => {
              const checked = form.projectIds.includes(p.id);
              return (
                <label key={p.id} htmlFor={`uf-project-${p.id}`}
                  className={`btn btn-sm d-flex align-items-center gap-2 ${checked ? 'btn-primary' : 'btn-outline-secondary'}`}>
                  <input id={`uf-project-${p.id}`} type="checkbox" className="form-check-input m-0"
                    checked={checked} onChange={() => toggleProject(p.id)} />
                  {p.name}
                  {checked && form.projectIds[0] === p.id && form.projectIds.length > 1 && (
                    <span className="badge bg-white text-primary">Ana</span>
                  )}
                </label>
              );
            })}
          </div>
        </div>
        {isNew && (
          <div className="col-md-6">
            <label className="form-label small fw-semibold" htmlFor="uf-role">Rol</label>
            <select id="uf-role" className="form-select" value={form.role} onChange={(e) => set({ role: e.target.value })}>
              {roles.map((r) => <option key={r.key} value={r.key}>{r.name}</option>)}
            </select>
          </div>
        )}
        <div className="col-12">
          <div className="form-label small fw-semibold mb-1">
            Ekipler <span className="text-muted fw-normal">(birden fazla seçilebilir)</span>
          </div>
          {teams.length === 0 ? (
            <p className="text-muted small fst-italic mb-0">Daire başkanlığınızda henüz ekip yok.</p>
          ) : (
            <div className="row g-2">
              {projects.map((p) => {
                const projectTeams = teams.filter((t) => t.projectId === p.id);
                if (projectTeams.length === 0) return null;
                return (
                  <div key={p.id} className="col-md-6">
                    <div className="border rounded-3 p-2 h-100">
                      <div className="small fw-semibold text-muted mb-1">{p.name}</div>
                      {projectTeams.map((t) => (
                        <div key={t.id} className="form-check mb-0">
                          <input id={`uf-team-${t.id}`} type="checkbox" className="form-check-input"
                            checked={form.teamIds.includes(t.id)} onChange={() => toggleTeam(t.id)} />
                          <label htmlFor={`uf-team-${t.id}`} className="form-check-label small">{t.name}</label>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      <div className="d-flex justify-content-end gap-2 mt-4">
        <button type="button" className="btn btn-outline-secondary" onClick={onCancel}>İptal</button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Kaydediliyor…' : isNew ? 'Kullanıcıyı Ekle' : 'Kaydet'}
        </button>
      </div>
    </form>
  );
}
