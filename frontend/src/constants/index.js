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
  'In Progress': '#0052CC',
  'In Review': '#FF991F',
  Done: '#00875A',
  'Geri Çevrildi': '#DE350B',
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
