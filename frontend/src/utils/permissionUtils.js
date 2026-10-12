import { ROLES, DEFAULT_ROLE_PERMISSIONS } from '../constants';

/**
 * Kullanıcı bu müdürlükte görevli mi? Bir personel daire başkanlığının birden
 * fazla müdürlüğünde görev alabilir (projectIds); projectId ana müdürlüktür.
 */
export function inProject(user, projectId) {
  if (!user || !projectId) return false;
  return (user.projectIds?.length ? user.projectIds : [user.projectId]).includes(projectId);
}

/**
 * Kullanıcının rolüne göre görebileceği projeleri filtreler.
 * - System_Admin: tüm projeler
 * - Department_Head: kendi biriminin projeleri
 * - Project_Manager: yalnızca kendi yönettiği proje
 * - Worker: yalnızca kendi atandığı proje (projectId alanı ile)
 * - External_User: hiçbir proje
 */
export function getVisibleProjects(projects, currentUser) {
  if (!currentUser) return [];
  switch (currentUser.role) {
    case ROLES.SYSTEM_ADMIN:
      return projects;
    case ROLES.DEPARTMENT_HEAD:
      return projects.filter(p => p.unitId === currentUser.unitId);
    case ROLES.PROJECT_MANAGER:
      return projects.filter(p => p.managerId === currentUser.id);
    case ROLES.WORKER:
      return projects.filter(p => inProject(currentUser, p.id));
    case ROLES.EXTERNAL_USER:
      return [];
    default:
      return [];
  }
}

/**
 * Kullanıcının rolüne göre görebileceği issue'ları filtreler.
 * External_User yalnızca kendi açtığı veya visibleTo listesinde olduğu issue'ları görür.
 * Worker yalnızca kendi projesindeki issue'ları görür.
 * Diğer roller proje erişimine göre filtrelenir.
 */
export function getVisibleIssues(issues, currentUser, visibleProjectIds) {
  return withTeamIssues(scopedIssues(issues, currentUser, visibleProjectIds), issues, currentUser);
}

/**
 * Kullanıcının üyesi olduğu ekiplere atanmış issue'ları rol kapsamının üzerine
 * ekler — ekip başka bir müdürlüğe ait olsa bile (backend ile aynı kural).
 */
function withTeamIssues(visible, all, currentUser) {
  const teamIds = new Set((currentUser?.teams || []).map(t => t.teamId));
  if (teamIds.size === 0) return visible;
  const seen = new Set(visible.map(i => i.id));
  return visible.concat(all.filter(i => !seen.has(i.id) && teamIds.has(i.assigneeTeamId)));
}

function scopedIssues(issues, currentUser, visibleProjectIds) {
  if (!currentUser) return [];
  if (currentUser.role === ROLES.EXTERNAL_USER) {
    return issues.filter(
      i =>
        i.reporterId === currentUser.id ||
        (Array.isArray(i.visibleTo) && i.visibleTo.includes(currentUser.id))
    );
  }
  if (currentUser.role === ROLES.SYSTEM_ADMIN) return issues;
  if (currentUser.role === ROLES.WORKER) {
    return issues.filter(i => inProject(currentUser, i.projectId));
  }
  return issues.filter(i => visibleProjectIds.includes(i.projectId));
}

/**
 * Kullanıcının görebileceği talepleri (isRequest: true) filtreler.
 *
 * Görünürlük kuralları:
 * - System_Admin          → tüm talepler
 * - Department_Head       → kendi birimine ait tüm talepler
 * - Project_Manager       → kendi projesine ait tüm talepler
 * - Worker                → kendi projesine ait tüm talepler
 * - External_User         → yalnızca kendi açtığı veya visibleTo listesinde olduğu talepler
 *
 * Dış kullanıcı talep açtığında ilgili birimin tüm üyeleri otomatik olarak
 * visibleTo listesine eklenir (bkz. RequestForm.jsx). Bu fonksiyon ise
 * iç kullanıcıların proje/birim bazlı erişimini garanti altına alır.
 *
 * @param {Array}  issues       - Tüm issue listesi
 * @param {Object} currentUser  - Oturum açmış kullanıcı
 * @param {Array}  [projects]   - Tüm projeler listesi (PM/Worker filtrelemesi için)
 */
export function getVisibleRequests(issues, currentUser, projects = []) {
  const requests = issues.filter(i => i.isRequest === true);
  return withTeamIssues(scopedRequests(requests, currentUser, projects), requests, currentUser);
}

function scopedRequests(requests, currentUser, projects) {
  if (!currentUser) return [];

  // System_Admin tüm talepleri görür
  if (currentUser.role === ROLES.SYSTEM_ADMIN) return requests;

  // Department_Head: kendi birimine ait tüm talepler
  if (currentUser.role === ROLES.DEPARTMENT_HEAD) {
    const unitProjects = projects.filter(p => p.unitId === currentUser.unitId);
    const unitProjectIds = unitProjects.map(p => p.id);
    return requests.filter(r => unitProjectIds.includes(r.projectId));
  }

  // Project_Manager: kendi projesine ait tüm talepler
  if (currentUser.role === ROLES.PROJECT_MANAGER) {
    const myProject = projects.find(p => p.managerId === currentUser.id);
    if (!myProject) return [];
    return requests.filter(r => r.projectId === myProject.id);
  }

  // Worker: kendi projesine ait tüm talepler
  if (currentUser.role === ROLES.WORKER) {
    return requests.filter(r => inProject(currentUser, r.projectId));
  }

  // External_User: yalnızca kendi açtığı veya visibleTo listesinde olduğu talepler
  return requests.filter(
    r =>
      r.reporterId === currentUser.id ||
      (Array.isArray(r.visibleTo) && r.visibleTo.includes(currentUser.id))
  );
}

/**
 * Kullanıcının belirli bir projeye erişimi olup olmadığını kontrol eder.
 */
export function canAccessProject(project, currentUser) {
  if (!currentUser || !project) return false;
  switch (currentUser.role) {
    case ROLES.SYSTEM_ADMIN:
      return true;
    case ROLES.DEPARTMENT_HEAD:
      return project.unitId === currentUser.unitId;
    case ROLES.PROJECT_MANAGER:
      return project.managerId === currentUser.id;
    case ROLES.WORKER:
      return inProject(currentUser, project.id);
    case ROLES.EXTERNAL_USER:
      return false;
    default:
      return false;
  }
}

/**
 * Kullanıcının birim yönetimi yapıp yapamayacağını kontrol eder.
 */
export function canManageUnits(currentUser) {
  return currentUser?.role === ROLES.SYSTEM_ADMIN;
}

/**
 * Kullanıcının proje oluşturup oluşturamayacağını kontrol eder.
 */
export function canCreateProject(currentUser) {
  return [ROLES.SYSTEM_ADMIN, ROLES.DEPARTMENT_HEAD].includes(currentUser?.role);
}

/**
 * Kullanıcının belirli bir issue için atanan kişiyi değiştirip değiştiremeyeceğini kontrol eder.
 * - System_Admin: tüm issue'lar için evet
 * - Department_Head: kendi birimine ait issue'lar için evet
 * - Project_Manager: kendi projesine ait issue'lar için evet
 * - External_User: hiçbir zaman hayır
 *
 * @param {Object} user     - currentUser ({ id, role, unitId })
 * @param {Object} issue    - Issue nesnesi ({ projectId, unitCode, ... })
 * @param {Array}  projects - Tüm projeler listesi
 * @returns {boolean}
 */
export function canChangeAssignee(user, issue, projects = []) {
  if (!user || !issue) return false;
  // Rolün atama izni yoksa hiçbir issue için yapamaz
  const permissions = user.scope ? user.permissions || [] : user.permissions || DEFAULT_ROLE_PERMISSIONS[user.role] || [];
  if (!permissions.includes('issue.assign')) return false;
  // Issue'yu açan kişi atama yapamaz
  if (issue.reporterId === user.id) return false;
  switch (user.role) {
    case ROLES.WORKER:
      return inProject(user, issue.projectId);
    case ROLES.SYSTEM_ADMIN:
      return true;
    case ROLES.DEPARTMENT_HEAD: {
      const project = projects.find(p => p.id === issue.projectId);
      return project?.unitId === user.unitId;
    }
    case ROLES.PROJECT_MANAGER: {
      const project = projects.find(p => p.id === issue.projectId);
      return project?.managerId === user.id;
    }
    case ROLES.EXTERNAL_USER:
      return false;
    default:
      return false;
  }
}

/**
 * Personel Profili: kim kimin profilini görebilir?
 * - Sistem Yöneticisi: herkes
 * - Daire Başkanı (daire başkanlığı kapsamı): kendi daire başkanlığının personeli
 * - Müdür: yönettiği müdürlüklerden birinde görevli personel
 * Herkes kendi profilini görebilir. Talep sahipleri (Üniversite Personeli / Öğrenci) hariç.
 */
export function canViewPersonnel(viewer, target, projects = []) {
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
