import React, { useMemo, useState } from 'react';
import { TbX, TbPlus } from 'react-icons/tb';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../hooks/useAuth';
import { rolesApi } from '../api/resources';
import Avatar from '../components/common/Avatar';

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
 */
export default function UsersPage() {
  const { state, hydrateAll } = useAppContext();
  const { currentUser } = useAuth();
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

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
        return !!user.projectId && managedProjectIds.has(user.projectId);
      default:
        return false;
    }
  }

  const subordinates = useMemo(() => {
    const q = query.trim().toLowerCase();
    return state.users
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

  return (
    <div>
      <h4 className="fw-bold mb-1">Kullanıcılar</h4>
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
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
