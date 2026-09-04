// Mirrors frontend/src/constants/index.js — kept in sync manually since the
// mobile and web apps are separate codebases sharing the same backend contract.

export const PRIORITIES = ['Highest', 'High', 'Medium', 'Low', 'Lowest'] as const;
export const STATUSES = ['To Do', 'In Progress', 'In Review', 'Done', 'Geri Çevrildi'] as const;
export const ISSUE_TYPES = ['Task', 'Bug', 'Story', 'Epic', 'Request'] as const;

export const PRIORITY_COLORS: Record<string, string> = {
  Highest: '#FF0000',
  High: '#FF7700',
  Medium: '#FFAA00',
  Low: '#2684FF',
  Lowest: '#57D9A3',
};

export const STATUS_COLORS: Record<string, string> = {
  'To Do': '#DFE1E6',
  'In Progress': '#0052CC',
  'In Review': '#FF991F',
  Done: '#00875A',
  'Geri Çevrildi': '#DE350B',
};

export const ROLES = {
  SYSTEM_ADMIN: 'System_Admin',
  DEPARTMENT_HEAD: 'Department_Head',
  PROJECT_MANAGER: 'Project_Manager',
  WORKER: 'Worker',
  EXTERNAL_USER: 'External_User',
} as const;

export const ROLE_DEFAULT_ROUTE: Record<string, string> = {
  System_Admin: '/(app)/dashboard',
  Department_Head: '/(app)/dashboard',
  Project_Manager: '/(app)/dashboard',
  Worker: '/(app)/dashboard',
  External_User: '/(app)/requests',
};
