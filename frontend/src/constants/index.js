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

export const PRIORITIES = ['Highest', 'High', 'Medium', 'Low', 'Lowest'];

// Veritabanı ve API bu İngilizce değerleri kullanır (backend CHECK kısıtı,
// filtre/sıralama mantığı vb.); ekranda gösterilecek Türkçe karşılıkları.
export const PRIORITY_LABELS = {
  Highest: 'En Yüksek',
  High: 'Yüksek',
  Medium: 'Orta',
  Low: 'Düşük',
  Lowest: 'En Düşük',
};

export const STATUSES = ['To Do', 'In Progress', 'In Review', 'Done', 'Geri Çevrildi'];

export const ISSUE_TYPES = ['Task', 'Bug', 'Story', 'Epic', 'Request'];

export const SPRINT_STATUSES = ['Planned', 'Active', 'Completed'];

export const PRIORITY_COLORS = {
  Highest: '#FF0000',
  High: '#FF7700',
  Medium: '#FFAA00',
  Low: '#2684FF',
  Lowest: '#57D9A3',
};

export const STATUS_COLORS = {
  'To Do': '#DFE1E6',
  'In Progress': '#2563eb',
  'In Review': '#FF991F',
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
  'In Review': 'İncelemede',
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
  Department_Head: ['dashboard', 'units', 'projects', 'requests'],
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
  unit:    'Kendi birimi',
  manager: 'Yönettiği projeler',
  project: 'Atandığı proje',
  own:     'Yalnızca kendi talepleri',
};

// Mirrors the permissions seeded by backend migrations. Only used when the
// session has no permission list yet (e.g. unit tests).
const ALL_ISSUE_PERMS = [
  'issue.create', 'request.create', 'issue.edit', 'issue.delete', 'issue.status', 'issue.assign',
  'issue.clone', 'issue.sprint', 'issue.dates', 'issue.share', 'sprint.manage', 'inventory.manage', 'inventory.use',
];
export const DEFAULT_ROLE_PERMISSIONS = {
  System_Admin:    [...ALL_ISSUE_PERMS, 'project.create', 'project.edit', 'unit.manage', 'role.manage'],
  Department_Head: [...ALL_ISSUE_PERMS, 'project.create', 'project.edit'],
  Project_Manager: ALL_ISSUE_PERMS,
  Worker:          ['request.create', 'issue.status', 'issue.share', 'inventory.use'],
  External_User:   ['request.create', 'issue.edit', 'issue.delete', 'issue.clone'],
};
