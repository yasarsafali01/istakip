// Mirrors frontend/src/constants/index.js — kept in sync manually since the
// mobile and web apps are separate codebases sharing the same backend contract.

export const APP_NAME = 'Mersin Üniversitesi Talep Takip Sistemi';
export const BRAND = { navy: '#1F2855', orange: '#EE7203' };

// Pickers list them low → high, like the web.
export const PRIORITIES = ['Low', 'Medium', 'High'] as const;
export const STATUSES = ['To Do', 'In Progress', 'Onay Bekliyor', 'Done', 'Geri Çevrildi'] as const;
// "Onay Bekliyor" is only reached by completing work without issue.approve
// (and left by a manager's approve/reject) — never picked by hand.
export const MANUAL_STATUSES = STATUSES.filter((s) => s !== 'Onay Bekliyor');
export const ISSUE_TYPES = ['Task', 'Bug', 'Story', 'Epic', 'Request'] as const;

// Backend/DB values stay in English (the CHECK constraint and filter/sort
// logic key off these); only the on-screen text is Turkish.
export const PRIORITY_LABELS: Record<string, string> = {
  High: 'Yüksek',
  Medium: 'Orta',
  Low: 'Düşük',
};

export const STATUS_LABELS: Record<string, string> = {
  'To Do': 'Yapılacak',
  'In Progress': 'Devam Ediyor',
  'Onay Bekliyor': 'Onay Bekliyor',
  Done: 'Tamamlandı',
  'Geri Çevrildi': 'Geri Çevrildi',
  Yönlendirildi: 'Yönlendirildi',
  'İptal Edildi': 'İptal Edildi',
};

export const PRIORITY_COLORS: Record<string, string> = {
  High: '#E5493A',
  Medium: '#FFAA00',
  Low: '#2684FF',
};

export const STATUS_COLORS: Record<string, string> = {
  'To Do': '#DFE1E6',
  'In Progress': '#0052CC',
  'Onay Bekliyor': '#8B5CF6',
  Done: '#00875A',
  'Geri Çevrildi': '#DE350B',
  Yönlendirildi: '#6554C0',
  'İptal Edildi': '#6B778C',
};

export const ROLES = {
  SYSTEM_ADMIN: 'System_Admin',
  DEPARTMENT_HEAD: 'Department_Head',
  PROJECT_MANAGER: 'Project_Manager',
  WORKER: 'Worker',
  EXTERNAL_USER: 'External_User',
} as const;

export const MANAGER_ROLES: string[] = [ROLES.SYSTEM_ADMIN, ROLES.DEPARTMENT_HEAD, ROLES.PROJECT_MANAGER];

export const ROLE_DEFAULT_ROUTE: Record<string, string> = {
  System_Admin: '/(app)/dashboard',
  Department_Head: '/(app)/dashboard',
  Project_Manager: '/(app)/dashboard',
  Worker: '/(app)/dashboard',
  External_User: '/(app)/requests',
};

export const SCOPE_LABELS: Record<string, string> = {
  all: 'Tüm sistem',
  unit: 'Kendi daire başkanlığı',
  manager: 'Yönettiği müdürlükler',
  project: 'Atandığı müdürlük',
  own: 'Yalnızca kendi talepleri',
};
