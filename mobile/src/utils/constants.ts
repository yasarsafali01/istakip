// Mirrors frontend/src/constants/index.js — kept in sync manually since the
// mobile and web apps are separate codebases sharing the same backend contract.

export const PRIORITIES = ['Highest', 'High', 'Medium', 'Low', 'Lowest'] as const;
export const STATUSES = ['To Do', 'In Progress', 'In Review', 'Done', 'Geri Çevrildi'] as const;
export const ISSUE_TYPES = ['Task', 'Bug', 'Story', 'Epic', 'Request'] as const;

// Backend/DB values stay in English (matches frontend/src/constants — the
// CHECK constraint and filter/sort logic key off these); only the on-screen
// text is Turkish. Mirrors frontend/src/constants's PRIORITY_LABELS/STATUS_LABELS.
export const PRIORITY_LABELS: Record<string, string> = {
  Highest: 'En Yüksek',
  High: 'Yüksek',
  Medium: 'Orta',
  Low: 'Düşük',
  Lowest: 'En Düşük',
};

export const STATUS_LABELS: Record<string, string> = {
  'To Do': 'Yapılacak',
  'In Progress': 'Devam Ediyor',
  'In Review': 'İncelemede',
  Done: 'Tamamlandı',
  'Geri Çevrildi': 'Geri Çevrildi',
  Yönlendirildi: 'Yönlendirildi',
  'İptal Edildi': 'İptal Edildi',
};

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
