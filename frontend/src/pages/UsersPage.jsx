import React, { useMemo, useState } from 'react';
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
      // Someone whose current role already matches or outranks me is out of reach,
      // even if they happen to be in my unit/project (mirrors the backend check).
      .filter((u) => (roleByKey[u.roleKey || u.role]?.level ?? 0) < myLevel)
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

  async function changeRole(user, roleKey) {
    setBusyId(user.id);
    setError('');
    try {
      await rolesApi.assign(user.id, { role: roleKey });
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
        Yönetim alanınızdaki kullanıcılara rol atayın. Yalnızca kendi rol seviyenizin (Seviye {myLevel}) altındaki roller
        ve kendi biriminiz/projeniz içindeki kullanıcılar listelenir.
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
                  <tr><th>Kullanıcı</th><th>Birim / Proje</th><th style={{ minWidth: 220 }}>Rol</th></tr>
                </thead>
                <tbody>
                  {subordinates.map((u) => (
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
                          disabled={busyId === u.id}
                          onChange={(e) => changeRole(u, e.target.value)}
                        >
                          {/* Kullanıcının mevcut rolü, listede olmasa bile (örn. benimle aynı
                              seviyede biri artık göremiyor) seçili kalabilsin diye eklenir. */}
                          {!assignableRoles.some((r) => r.key === (u.roleKey || u.role)) && (
                            <option value={u.roleKey || u.role}>
                              {roleByKey[u.roleKey || u.role]?.name || u.role}
                            </option>
                          )}
                          {assignableRoles.map((r) => (
                            <option key={r.key} value={r.key}>{r.name}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
