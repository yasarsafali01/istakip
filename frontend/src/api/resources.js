// Thin per-resource wrappers over the API client, grouped in one file since
// each is a handful of one-line calls mirroring the backend's REST routes.
import { api } from './client';

export const usersApi = {
  list: () => api.get('/users'),
  me: () => api.get('/users/me'),
  updateMe: (data) => api.patch('/users/me', data),
  changePassword: (currentPassword, newPassword) =>
    api.post('/users/me/change-password', { currentPassword, newPassword }),
};

export const unitsApi = {
  list: () => api.get('/units'),
  create: (data) => api.post('/units', data),
  update: (id, data) => api.patch(`/units/${id}`, data),
};

export const projectsApi = {
  list: () => api.get('/projects'),
  get: (id) => api.get(`/projects/${id}`),
  create: (data) => api.post('/projects', data),
  update: (id, data) => api.patch(`/projects/${id}`, data),
};

export const sprintsApi = {
  listByProject: (projectId) => api.get(`/projects/${projectId}/sprints`),
  create: (projectId, data) => api.post(`/projects/${projectId}/sprints`, data),
  start: (id) => api.post(`/sprints/${id}/start`),
  complete: (id) => api.post(`/sprints/${id}/complete`),
};

export const issuesApi = {
  list: (params = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
    ).toString();
    return api.get(`/issues${qs ? `?${qs}` : ''}`);
  },
  get: (id) => api.get(`/issues/${id}`),
  create: (data) => api.post('/issues', data),
  update: (id, data) => api.patch(`/issues/${id}`, data),
  delete: (id) => api.delete(`/issues/${id}`),
  updateStatus: (id, status) => api.patch(`/issues/${id}/status`, { status }),
  complete: (id, data) => api.post(`/issues/${id}/complete`, data),
  updateAssignee: (id, assigneeId) => api.patch(`/issues/${id}/assignee`, { assigneeId, assigneeTeamId: null }),
  assignTeam: (id, assigneeTeamId) => api.patch(`/issues/${id}/assignee`, { assigneeId: null, assigneeTeamId }),
  clone: (id) => api.post(`/issues/${id}/clone`),
  moveSprint: (id, sprintId) => api.post(`/issues/${id}/move-sprint`, { sprintId }),
  updateDates: (id, resolvedAt, timeSpent) => api.patch(`/issues/${id}/dates`, { resolvedAt, timeSpent }),
  addVisibleUser: (id, userId) => api.post(`/issues/${id}/visible-users`, { userId }),
  forward: (id, targetProjectId, note) => api.post(`/issues/${id}/forward`, { targetProjectId, note }),
  cancel: (id) => api.post(`/issues/${id}/cancel`, {}),
  rate: (id, rating, comment) => api.post(`/issues/${id}/rate`, { rating, comment }),
};

export const teamsApi = {
  listByProject: (projectId) => api.get(`/projects/${projectId}/teams`),
  create: (projectId, name) => api.post(`/projects/${projectId}/teams`, { name }),
  rename: (id, name) => api.patch(`/teams/${id}`, { name }),
  delete: (id) => api.delete(`/teams/${id}`),
  addMember: (id, userId) => api.post(`/teams/${id}/members`, { userId }),
  removeMember: (id, userId) => api.delete(`/teams/${id}/members/${userId}`),
};

export const templatesApi = {
  listByProject: (projectId, all = false) => api.get(`/projects/${projectId}/reply-templates${all ? '?all=1' : ''}`),
  create: (projectId, data) => api.post(`/projects/${projectId}/reply-templates`, data),
  update: (id, data) => api.patch(`/reply-templates/${id}`, data),
  delete: (id) => api.delete(`/reply-templates/${id}`),
};

export const notificationsApi = {
  list: () => api.get('/notifications'),
  unreadCount: () => api.get('/notifications/unread-count'),
  markRead: (id) => api.post(`/notifications/${id}/read`, {}),
  markAllRead: () => api.post('/notifications/read-all', {}),
};

export const commentsApi = {
  listByIssue: (issueId) => api.get(`/issues/${issueId}/comments`),
  create: (issueId, text) => api.post(`/issues/${issueId}/comments`, { text }),
  delete: (id) => api.delete(`/comments/${id}`),
};

export const activitiesApi = {
  listByIssue: (issueId) => api.get(`/issues/${issueId}/activities`),
};

export const inventoryApi = {
  listByProject: (projectId) => api.get(`/projects/${projectId}/inventory`),
  create: (projectId, data) => api.post(`/projects/${projectId}/inventory`, data),
  adjust: (id, quantityChange) => api.patch(`/inventory/${id}`, { quantityChange }),
};

export const rolesApi = {
  list: () => api.get('/roles'),
  permissions: () => api.get('/permissions'),
  create: (data) => api.post('/roles', data),
  update: (key, data) => api.patch(`/roles/${key}`, data),
  remove: (key) => api.delete(`/roles/${key}`),
  assign: (userId, data) => api.patch(`/users/${userId}/role`, data),
};
