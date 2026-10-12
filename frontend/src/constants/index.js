// Action Types
export const ACTIONS = {
  // Auth
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',

  // Data loading (from the backend API)
  HYDRATE: 'HYDRATE',
  SET_LOADING: 'SET_LOADING',
  SET_COMMENTS_FOR_ISSUE: 'SET_COMMENTS_FOR_ISSUE',
  SET_ACTIVITIES_FOR_ISSUE: 'SET_ACTIVITIES_FOR_ISSUE',
  SET_INVENTORY_FOR_PROJECT: 'SET_INVENTORY_FOR_PROJECT',

  // Unit
  ADD_UNIT: 'ADD_UNIT',
  UPDATE_UNIT: 'UPDATE_UNIT',

  // Project
  ADD_PROJECT: 'ADD_PROJECT',
  UPDATE_PROJECT: 'UPDATE_PROJECT',

  // Issue
  ADD_ISSUE: 'ADD_ISSUE',
  UPDATE_ISSUE: 'UPDATE_ISSUE',
  DELETE_ISSUE: 'DELETE_ISSUE',

  // Sprint
  ADD_SPRINT: 'ADD_SPRINT',
  START_SPRINT: 'START_SPRINT',
  COMPLETE_SPRINT: 'COMPLETE_SPRINT',
};

// Pickers list them low → high.
export const PRIORITIES = ['Low', 'Medium', 'High'];

// Veritabanı ve API bu İngilizce değerleri kullanır (backend CHECK kısıtı,
// filtre/sıralama mantığı vb.); ekranda gösterilecek Türkçe karşılıkları.
export const PRIORITY_LABELS = {
  High: 'Yüksek',
  Medium: 'Orta',
  Low: 'Düşük',
};

export const STATUSES = ['To Do', 'In Progress', 'Onay Bekliyor', 'Done', 'Geri Çevrildi'];

// "Onay Bekliyor" is only reached by completing work without issue.approve
// (and left by a manager's approve/reject) — never picked by hand.
export const MANUAL_STATUSES = STATUSES.filter((s) => s !== 'Onay Bekliyor');

export const ISSUE_TYPES = ['Task', 'Bug', 'Story', 'Epic', 'Request'];

export const SPRINT_STATUSES = ['Planned', 'Active', 'Completed'];

export const PRIORITY_COLORS = {
  High: '#E5493A',
  Medium: '#FFAA00',
  Low: '#2684FF',
};

export const STATUS_COLORS = {
  'To Do': '#DFE1E6',
  'In Progress': '#2563eb',
  'Onay Bekliyor': '#8B5CF6',
  Done: '#00875A',
  'Geri Çevrildi': '#DE350B',
  // Reached only through the dedicated forward/cancel actions (never a plain
  // status-change dropdown) — kept out of STATUSES so board columns and the
  // manual transition pickers don't offer them directly.
  Yönlendirildi: '#6554C0',
  'İptal Edildi': '#6B778C',
};

export const STATUS_LABELS = {
  'To Do': 'Yapılacak',
  'In Progress': 'Devam Ediyor',
  'Onay Bekliyor': 'Onay Bekliyor',
  Done: 'Tamamlandı',
  'Geri Çevrildi': 'Geri Çevrildi',
  Yönlendirildi: 'Yönlendirildi',
  'İptal Edildi': 'İptal Edildi',
};

export const ISSUE_TYPE_COLORS = {
  Task: '#4BADE8',
  Bug: '#E5493A',
  Story: '#65BA43',
  Epic: '#904EE2',
  Request: '#FF8B00',
};

export const ACTIVITY_TYPES = {
  STATUS_CHANGE: 'status_change',
  ASSIGNMENT: 'assignment',
  COMMENT: 'comment',
  FIELD_UPDATE: 'field_update',
  CREATED: 'created',
};

export const ROLES = {
  SYSTEM_ADMIN:    'System_Admin',
  DEPARTMENT_HEAD: 'Department_Head',
  PROJECT_MANAGER: 'Project_Manager',
  WORKER:          'Worker',
  EXTERNAL_USER:   'External_User',
};

export const ROLE_DEFAULT_ROUTES = {
  System_Admin:    '/dashboard',
  Department_Head: '/dashboard',
  Project_Manager: '/dashboard',
  Worker:          '/dashboard',
  External_User:   '/requests',
};

export const ROLE_NAV_ITEMS = {
  System_Admin:    ['dashboard', 'units', 'projects', 'requests'],
  Department_Head: ['dashboard', 'projects', 'requests'],
  Project_Manager: ['dashboard', 'projects', 'requests'],
  Worker:          ['dashboard', 'projects', 'requests'],
  External_User:   ['requests'],
};

// Data scope → the built-in role whose UI a custom role borrows. The UI's
// dashboards, lists and dropdowns are organised around the five built-in
// roles; a custom role behaves like the built-in role that has the same scope,
// while individual actions are gated by its permissions.
export const SCOPE_TO_BASE_ROLE = {
  all:     'System_Admin',
  unit:    'Department_Head',
  manager: 'Project_Manager',
  project: 'Worker',
  own:     'External_User',
};

export const SCOPE_LABELS = {
  all:     'Tüm sistem',
  unit:    'Kendi daire başkanlığı',
  manager: 'Yönettiği müdürlükler',
  project: 'Atandığı müdürlük',
  own:     'Yalnızca kendi talepleri',
};

// Mirrors the permissions seeded by backend migrations. Only used when the
// session has no permission list yet (e.g. unit tests).
const ALL_ISSUE_PERMS = [
  'issue.create', 'request.create', 'issue.edit', 'issue.delete', 'issue.status', 'issue.assign',
  'issue.clone', 'issue.sprint', 'issue.dates', 'issue.share', 'sprint.manage', 'inventory.manage', 'inventory.use',
];
export const DEFAULT_ROLE_PERMISSIONS = {
  System_Admin:    [...ALL_ISSUE_PERMS, 'project.create', 'project.edit', 'unit.manage', 'role.manage', 'request_form.manage', 'issue.approve'],
  Department_Head: [...ALL_ISSUE_PERMS, 'project.create', 'project.edit', 'request_form.manage', 'issue.approve'],
  Project_Manager: [...ALL_ISSUE_PERMS, 'request_form.manage', 'issue.approve'],
  Worker:          ['request.create', 'issue.status', 'issue.share', 'inventory.use'],
  External_User:   ['request.create', 'issue.edit', 'issue.delete', 'issue.clone'],
};
