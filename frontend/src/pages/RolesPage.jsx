import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { TbPlus, TbLock, TbUsers, TbShieldCheck, TbTrash } from 'react-icons/tb';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../hooks/useAuth';
import { rolesApi } from '../api/resources';
import { SCOPE_LABELS } from '../constants';
import Modal from '../components/common/Modal';
import Avatar from '../components/common/Avatar';
import ConfirmDialog from '../components/common/ConfirmDialog';

const EMPTY_FORM = { key: null, name: '', description: '', scope: 'project', permissions: [], isSystem: false };

/** Groups the flat permission catalog by its "group" field, keeping catalog order. */
function groupCatalog(catalog) {
  const groups = [];
  for (const p of catalog) {
    let g = groups.find((x) => x.name === p.group);
    if (!g) {
      g = { name: p.group, items: [] };
      groups.push(g);
    }
    g.items.push(p);
  }
  return groups;
}

function RoleEditor({ form, setForm, catalog, locked, onSave, onCancel, onDelete, saving, error, userCount }) {
  const groups = useMemo(() => groupCatalog(catalog), [catalog]);

  function toggle(key) {
    setForm((f) => ({
      ...f,
      permissions: f.permissions.includes(key) ? f.permissions.filter((p) => p !== key) : [...f.permissions, key],
    }));
  }

  return (
    <div>
      {locked && (
        <div className="alert alert-secondary d-flex align-items-center gap-2 py-2 small">
          <TbLock size={16} /> Sistem Yöneticisi rolü tüm izinlere sahiptir ve değiştirilemez.
        </div>
      )}
      {error && <div className="alert alert-danger py-2 small">{error}</div>}

      <div className="mb-3">
        <label className="form-label">Rol adı *</label>
        <input
          className="form-control"
          value={form.name}
          disabled={locked}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Örn. Birim Müdürü"
        />
      </div>
      <div className="mb-3">
        <label className="form-label">Açıklama</label>
        <input
          className="form-control"
          value={form.description}
          disabled={locked}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="Bu rol ne yapar?"
        />
      </div>
      <div className="mb-3">
        <label className="form-label">Veri kapsamı</label>
        <select
          className="form-select"
          value={form.scope}
          disabled={locked || form.isSystem}
          onChange={(e) => setForm({ ...form, scope: e.target.value })}
        >
          {Object.entries(SCOPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <div className="form-text">
          {form.isSystem
            ? 'Yerleşik rollerin veri kapsamı değiştirilemez.'
            : 'Rolün hangi iş ve talepleri görebileceğini belirler; yapabilecekleri aşağıdaki izinlerle seçilir.'}
        </div>
      </div>

      <div className="fw-semibold mb-2">İzinler</div>
      <div className="row g-3">
        {groups.map((g) => (
          <div className="col-md-6" key={g.name}>
            <div className="border rounded-3 p-3 h-100">
              <div className="text-uppercase text-muted mb-2" style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em' }}>
                {g.name}
              </div>
              {g.items.map((p) => (
                <div className="form-check mb-2" key={p.key}>
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id={`perm-${p.key}`}
                    checked={locked || form.permissions.includes(p.key)}
                    disabled={locked}
                    onChange={() => toggle(p.key)}
                  />
                  <label className="form-check-label" htmlFor={`perm-${p.key}`}>
                    <span className="fw-medium">{p.label}</span>
                    <span className="d-block text-muted" style={{ fontSize: 12 }}>{p.description}</span>
                  </label>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="d-flex justify-content-between align-items-center mt-4">
        <div>
          {form.key && !form.isSystem && (
            <button
              type="button"
              className="btn btn-outline-danger btn-sm d-flex align-items-center gap-1"
              onClick={onDelete}
              disabled={userCount > 0}
              title={userCount > 0 ? 'Bu role atanmış kullanıcılar var' : 'Rolü sil'}
            >
              <TbTrash size={15} /> Rolü sil
            </button>
          )}
        </div>
        <div className="d-flex gap-2">
          <button type="button" className="btn btn-outline-secondary" onClick={onCancel}>Kapat</button>
          {!locked && (
            <button type="button" className="btn btn-primary" onClick={onSave} disabled={saving}>
              {saving ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function RolesTab({ roles, catalog, reload }) {
  const [editing, setEditing] = useState(null); // form object or null
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  function openNew() {
    setError('');
    setEditing({ ...EMPTY_FORM });
  }
  function openEdit(role) {
    setError('');
    setEditing({
      key: role.key, name: role.name, description: role.description,
      scope: role.scope, permissions: role.permissions, isSystem: role.isSystem, userCount: role.userCount,
    });
  }

  async function save() {
    setSaving(true);
    setError('');
    try {
      const body = { name: editing.name, description: editing.description, scope: editing.scope, permissions: editing.permissions };
      if (editing.key) await rolesApi.update(editing.key, body);
      else await rolesApi.create(body);
      setEditing(null);
      await reload();
    } catch (err) {
      setError(err.message || 'Kaydedilemedi');
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    setConfirmDelete(false);
    try {
      await rolesApi.remove(editing.key);
      setEditing(null);
      await reload();
    } catch (err) {
      setError(err.message || 'Silinemedi');
    }
  }

  return (
    <>
      <div className="row g-3">
        {roles.map((r) => (
          <div className="col-md-6 col-xl-4" key={r.key}>
            <button
              type="button"
              className="card h-100 w-100 text-start p-0 border-0 project-card"
              onClick={() => openEdit(r)}
              style={{ cursor: 'pointer' }}
            >
              <div className="card-body">
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <div className="d-flex align-items-center gap-2 fw-semibold">
                    <TbShieldCheck size={18} color="#2563eb" /> {r.name}
                  </div>
                  {r.isSystem && <span className="badge text-bg-light border">Yerleşik</span>}
                </div>
                <p className="text-muted small mb-3" style={{ minHeight: 36 }}>{r.description || '—'}</p>
                <div className="d-flex flex-wrap gap-2 small">
                  <span className="badge text-bg-primary bg-opacity-10 text-primary">{r.permissions.length} izin</span>
                  <span className="badge text-bg-light border">{SCOPE_LABELS[r.scope] || r.scope}</span>
                  <span className="badge text-bg-light border d-flex align-items-center gap-1">
                    <TbUsers size={12} /> {r.userCount}
                  </span>
                </div>
              </div>
            </button>
          </div>
        ))}
        <div className="col-md-6 col-xl-4">
          <button
            type="button"
            className="card h-100 w-100 border-2 border-dashed d-flex align-items-center justify-content-center p-4 bg-transparent"
            style={{ borderStyle: 'dashed', cursor: 'pointer', minHeight: 150 }}
            onClick={openNew}
          >
            <span className="d-flex align-items-center gap-2 fw-semibold text-primary"><TbPlus size={18} /> Yeni Rol</span>
          </button>
        </div>
      </div>

      <Modal
        isOpen={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.key ? 'Rolü Düzenle' : 'Yeni Rol Oluştur'}
        size="lg"
      >
        {editing && (
          <RoleEditor
            form={editing}
            setForm={setEditing}
            catalog={catalog}
            locked={editing.key === 'System_Admin'}
            onSave={save}
            onCancel={() => setEditing(null)}
            onDelete={() => setConfirmDelete(true)}
            saving={saving}
            error={error}
            userCount={editing.userCount || 0}
          />
        )}
      </Modal>

      <ConfirmDialog
        isOpen={confirmDelete}
        title="Rolü sil"
        message="Bu rol kalıcı olarak silinecek. Emin misiniz?"
        confirmText="Sil"
        onConfirm={remove}
        onClose={() => setConfirmDelete(false)}
      />
    </>
  );
}

function UsersTab({ roles, reload }) {
  const { state } = useAppContext();
  const { currentUser } = useAuth();
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  const unitName = (id) => state.units.find((u) => u.id === id)?.name;
  const projectName = (id) => state.projects.find((p) => p.id === id)?.name;

  const users = state.users.filter((u) => {
    const q = query.trim().toLowerCase();
    return !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  async function changeRole(user, roleKey) {
    setBusyId(user.id);
    setError('');
    try {
      await rolesApi.assign(user.id, { role: roleKey });
      await reload();
    } catch (err) {
      setError(`${user.name}: ${err.message || 'Rol atanamadı'}`);
    } finally {
      setBusyId(null);
    }
  }

  return (
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
        <div className="table-responsive">
          <table className="table align-middle mb-0">
            <thead>
              <tr><th>Kullanıcı</th><th>Birim / Proje</th><th style={{ minWidth: 220 }}>Rol</th></tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div className="d-flex align-items-center gap-2">
                      <Avatar name={u.name} color={u.avatarColor} size={32} />
                      <div>
                        <div className="fw-medium">{u.name}</div>
                        <div className="text-muted small">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="small text-muted">
                    {[unitName(u.unitId), projectName(u.projectId)].filter(Boolean).join(' · ') || '—'}
                  </td>
                  <td>
                    <select
                      className="form-select form-select-sm"
                      value={u.roleKey || u.role}
                      disabled={busyId === u.id || u.id === currentUser?.id}
                      title={u.id === currentUser?.id ? 'Kendi rolünüzü değiştiremezsiniz' : undefined}
                      onChange={(e) => changeRole(u, e.target.value)}
                    >
                      {roles.map((r) => (
                        <option key={r.key} value={r.key}>{r.name}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function RolesPage() {
  const { hydrateAll } = useAppContext();
  const [tab, setTab] = useState('roles');
  const [roles, setRoles] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [r, c] = await Promise.all([rolesApi.list(), rolesApi.permissions()]);
      setRoles(r);
      setCatalog(c);
    } catch (err) {
      setError(err.message || 'Roller yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // After any change: refresh this page and the app-wide state (so the current
  // user's own permissions and everyone's role names stay up to date).
  const reload = useCallback(async () => {
    await load();
    await hydrateAll();
  }, [load, hydrateAll]);

  return (
    <div>
      <h4 className="fw-bold mb-1">Roller ve İzinler</h4>
      <p className="text-muted small mb-3">
        Bir rol, bir izin kümesi ve bir veri kapsamıdır. Kullanıcılara rol atayarak neleri görüp yapabileceklerini belirleyin.
      </p>

      <ul className="nav nav-tabs mb-3">
        <li className="nav-item">
          <button className={`nav-link ${tab === 'roles' ? 'active' : ''}`} onClick={() => setTab('roles')}>Roller</button>
        </li>
        <li className="nav-item">
          <button className={`nav-link ${tab === 'users' ? 'active' : ''}`} onClick={() => setTab('users')}>Kullanıcı Rolleri</button>
        </li>
      </ul>

      {error && <div className="alert alert-danger">{error}</div>}
      {loading ? (
        <div className="text-center py-5"><span className="spinner-border text-primary" /></div>
      ) : tab === 'roles' ? (
        <RolesTab roles={roles} catalog={catalog} reload={reload} />
      ) : (
        <UsersTab roles={roles} reload={reload} />
      )}
    </div>
  );
}
