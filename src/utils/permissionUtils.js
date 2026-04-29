import { ROLES } from '../constants';

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
      return projects.filter(p => p.id === currentUser.projectId);
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
    return issues.filter(i => i.projectId === currentUser.projectId);
  }
  return issues.filter(i => visibleProjectIds.includes(i.projectId));
}

/**
 * Kullanıcının görebileceği talepleri (isRequest: true) filtreler.
 * External_User yalnızca kendi taleplerini veya visibleTo'da olduklarını görür.
 * İç kullanıcılar tüm talepleri görür.
 */
export function getVisibleRequests(issues, currentUser) {
  if (!currentUser) return [];
  const requests = issues.filter(i => i.isRequest === true);
  if (currentUser.role === ROLES.EXTERNAL_USER) {
    return requests.filter(
      r =>
        r.reporterId === currentUser.id ||
        (Array.isArray(r.visibleTo) && r.visibleTo.includes(currentUser.id))
    );
  }
  return requests;
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
      return project.id === currentUser.projectId;
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
 * Kullanıcının belirli bir talep için atanan kişiyi değiştirip değiştiremeyeceğini kontrol eder.
 * - System_Admin: tüm talepler için evet
 * - Department_Head: kendi birimine ait talepler için evet
 * - Project_Manager: kendi projesine ait talepler için evet
 * - External_User: hiçbir zaman hayır
 *
 * @param {Object} user     - currentUser ({ id, role, unitId })
 * @param {Object} issue    - Talep nesnesi ({ projectId, unitCode, ... })
 * @param {Array}  projects - Tüm projeler listesi
 * @returns {boolean}
 */
export function canChangeAssignee(user, issue, projects = []) {
  if (!user || !issue) return false;
  switch (user.role) {
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
