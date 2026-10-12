// Mirrors frontend/src/utils/permissionUtils.js (inProject, canViewPersonnel).
import type { User, Project } from '../api/types';
import { ROLES } from './constants';

/** Whether the user serves in the müdürlük (a person may serve in several). */
export function inProject(user: Pick<User, 'projectId' | 'projectIds'> | null | undefined, projectId?: string | null) {
  if (!user || !projectId) return false;
  const ids = user.projectIds?.length ? user.projectIds : [user.projectId];
  return ids.includes(projectId);
}

export function projectIdsOf(user: Pick<User, 'projectId' | 'projectIds'>) {
  return (user.projectIds?.length ? user.projectIds : [user.projectId]).filter(Boolean) as string[];
}

/**
 * Personel Profili: a Daire Başkanı sees their unit's staff, a Müdür the staff of
 * the müdürlükler they manage, a Sistem Yöneticisi everyone. Requesters have none.
 */
export function canViewPersonnel(viewer: User | null, target: User | undefined, projects: Project[] = []) {
  if (!viewer || !target) return false;
  if (target.role === ROLES.EXTERNAL_USER) return false;
  if (viewer.id === target.id) return true;
  switch (viewer.scope) {
    case 'all':
      return true;
    case 'unit':
      return !!viewer.unitId && target.unitId === viewer.unitId;
    case 'manager':
      return projects.some((p) => p.managerId === viewer.id && inProject(target, p.id));
    default:
      return false;
  }
}

/** "3 saat önce" style relative time, like the web's timeAgo. */
export function timeAgo(date?: string | null) {
  if (!date) return '';
  const diff = Date.now() - new Date(date).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'az önce';
  if (min < 60) return `${min} dk önce`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} saat önce`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} gün önce`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo} ay önce`;
  return `${Math.floor(mo / 12)} yıl önce`;
}

export function formatDate(date?: string | null) {
  return date ? new Date(date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';
}
