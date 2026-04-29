// Action Types
export const ACTIONS = {
  // Auth
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',

  // Unit
  ADD_UNIT: 'ADD_UNIT',
  UPDATE_UNIT: 'UPDATE_UNIT',

  // Visible To
  ADD_VISIBLE_USER: 'ADD_VISIBLE_USER',

  // Project
  ADD_PROJECT: 'ADD_PROJECT',

  // Issue
  ADD_ISSUE: 'ADD_ISSUE',
  UPDATE_ISSUE: 'UPDATE_ISSUE',
  DELETE_ISSUE: 'DELETE_ISSUE',
  MOVE_ISSUE: 'MOVE_ISSUE',
  CLONE_REQUEST: 'CLONE_REQUEST',
  UPDATE_REQUEST_ASSIGNEE: 'UPDATE_REQUEST_ASSIGNEE',
  UPDATE_REQUEST_DATES: 'UPDATE_REQUEST_DATES',

  // Sprint
  ADD_SPRINT: 'ADD_SPRINT',
  START_SPRINT: 'START_SPRINT',
  COMPLETE_SPRINT: 'COMPLETE_SPRINT',
  ASSIGN_ISSUE_TO_SPRINT: 'ASSIGN_ISSUE_TO_SPRINT',

  // Comment
  ADD_COMMENT: 'ADD_COMMENT',
  DELETE_COMMENT: 'DELETE_COMMENT',

  // Activity
  ADD_ACTIVITY: 'ADD_ACTIVITY',
};

export const PRIORITIES = ['Highest', 'High', 'Medium', 'Low', 'Lowest'];

export const STATUSES = ['To Do', 'In Progress', 'In Review', 'Done'];

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
  Worker:          ['dashboard', 'projects'],
  External_User:   ['requests'],
};
