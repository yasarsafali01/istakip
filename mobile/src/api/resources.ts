// Thin per-resource wrappers over the API client, mirroring the backend's
// REST routes (same contract the web frontend's src/api/resources.js uses).
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { api, BASE_URL, getAccessToken } from './client';
import type {
  User, Unit, Project, Sprint, Issue, Comment, Activity, InventoryItem, RoleDef, Team, ReplyTemplate,
  AppNotification, RequestForm, RequestQuestion, TemplateKind, FileRef, AssigneeOptions,
} from './types';
import { withBaseRole } from './roles';

export const usersApi = {
  // Users are mapped to their scope's built-in role so role-based dropdowns keep working with custom roles.
  list: async () => {
    const [users, roles] = await Promise.all([api.get<User[]>('/users'), api.get<RoleDef[]>('/roles')]);
    const scopeByKey = Object.fromEntries(roles.map((r) => [r.key, r.scope]));
    return users.map((u) => withBaseRole(u, scopeByKey));
  },
  me: async () => withBaseRole(await api.get<User>('/users/me')),
  updateMe: (data: Partial<User>) => api.patch<User>('/users/me', data),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post('/users/me/change-password', { currentPassword, newPassword }),
  // Daire Başkanı: manage the personnel of their own daire başkanlığı.
  create: (data: { name: string; email: string; password: string; role: string; projectIds: string[]; teamIds: string[] }) =>
    api.post<User>('/users', data),
  update: (id: string, data: { name: string; email: string; projectIds: string[]; teamIds?: string[]; password?: string }) =>
    api.patch<User>(`/users/${id}`, data),
  remove: (id: string) => api.delete(`/users/${id}`),
};

export interface PermissionInfo { key: string; label: string; group: string; description: string }
export interface RoleBody { name: string; description: string; scope: string; level: number; permissions: string[] }

export const rolesApi = {
  list: () => api.get<RoleDef[]>('/roles'),
  permissions: () => api.get<PermissionInfo[]>('/permissions'),
  create: (data: RoleBody) => api.post<RoleDef>('/roles', data),
  update: (key: string, data: RoleBody) => api.patch<RoleDef>(`/roles/${key}`, data),
  remove: (key: string) => api.delete(`/roles/${key}`),
  /** extraRoles omitted keeps the user's current extra roles. */
  assign: (userId: string, role: string, extraRoles?: string[]) =>
    api.patch<User>(`/users/${userId}/role`, extraRoles ? { role, extraRoles } : { role }),
};

export const unitsApi = {
  list: () => api.get<Unit[]>('/units'),
  create: (data: Partial<Unit>) => api.post<Unit>('/units', data),
  update: (id: string, data: Partial<Unit>) => api.patch<Unit>(`/units/${id}`, data),
};

export const projectsApi = {
  list: () => api.get<Project[]>('/projects'),
  get: (id: string) => api.get<Project>(`/projects/${id}`),
  create: (data: Partial<Project>) => api.post<Project>('/projects', data),
  update: (id: string, data: Partial<Project>) => api.patch<Project>(`/projects/${id}`, data),
  /** Makes exactly these people the müdürlük's personnel. */
  setMembers: (id: string, userIds: string[]) => api.put(`/projects/${id}/members`, { userIds }),
};

export const sprintsApi = {
  listByProject: (projectId: string) => api.get<Sprint[]>(`/projects/${projectId}/sprints`),
  create: (projectId: string, data: { month: number; year: number }) =>
    api.post<Sprint>(`/projects/${projectId}/sprints`, data),
  start: (id: string) => api.post<Sprint>(`/sprints/${id}/start`),
  complete: (id: string) => api.post<Sprint>(`/sprints/${id}/complete`),
};

export interface IssueListParams {
  projectId?: string;
  sprintId?: string;
  backlog?: boolean;
  isRequest?: boolean;
  assigneeId?: string;
  priority?: string;
}

export interface CompletePayload {
  resolutionNote: string;
  usedEquipment?: boolean;
  equipmentId?: string;
  quantity?: number;
}

export const issuesApi = {
  list: (params: IssueListParams = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => [k, String(v)])
    ).toString();
    return api.get<Issue[]>(`/issues${qs ? `?${qs}` : ''}`);
  },
  get: (id: string) => api.get<Issue>(`/issues/${id}`),
  create: (data: Record<string, any> & { projectId: string; title: string }) => api.post<Issue>('/issues', data),
  update: (id: string, data: Partial<Issue>) => api.patch<Issue>(`/issues/${id}`, data),
  delete: (id: string) => api.delete(`/issues/${id}`),
  updateStatus: (id: string, status: string) => api.patch<Issue>(`/issues/${id}/status`, { status }),
  complete: (id: string, data: CompletePayload) =>
    api.post<{ issue: Issue; stockWarning?: boolean; pendingApproval?: boolean }>(`/issues/${id}/complete`, data),
  approveCompletion: (id: string) => api.post<{ issue: Issue; stockWarning: boolean }>(`/issues/${id}/approve-completion`, {}),
  rejectCompletion: (id: string, reason: string) => api.post<Issue>(`/issues/${id}/reject-completion`, { reason }),
  updateAssignee: (id: string, assigneeId: string | null) =>
    api.patch<Issue>(`/issues/${id}/assignee`, { assigneeId, assigneeTeamId: null }),
  assignTeam: (id: string, assigneeTeamId: string) =>
    api.patch<Issue>(`/issues/${id}/assignee`, { assigneeId: null, assigneeTeamId }),
  assignees: (id: string, projectId?: string) =>
    api.get<AssigneeOptions>(`/issues/${id}/assignees${projectId ? `?projectId=${projectId}` : ''}`),
  clone: (id: string) => api.post<Issue>(`/issues/${id}/clone`),
  moveSprint: (id: string, sprintId: string | null) => api.post<Issue>(`/issues/${id}/move-sprint`, { sprintId }),
  updateDates: (id: string, resolvedAt: string | null, timeSpent: number) =>
    api.patch<Issue>(`/issues/${id}/dates`, { resolvedAt, timeSpent }),
  addVisibleUser: (id: string, userId: string) => api.post<Issue>(`/issues/${id}/visible-users`, { userId }),
  forward: (id: string, targetProjectId: string, note: string) =>
    api.post<Issue>(`/issues/${id}/forward`, { targetProjectId, note }),
  cancel: (id: string) => api.post<Issue>(`/issues/${id}/cancel`, {}),
  rate: (id: string, rating: number, comment: string) => api.post<Issue>(`/issues/${id}/rate`, { rating, comment }),
};

export const commentsApi = {
  listByIssue: (issueId: string) => api.get<Comment[]>(`/issues/${issueId}/comments`),
  create: (issueId: string, text: string) => api.post<Comment>(`/issues/${issueId}/comments`, { text }),
  delete: (id: string) => api.delete(`/comments/${id}`),
};

export const activitiesApi = {
  listByIssue: (issueId: string) => api.get<Activity[]>(`/issues/${issueId}/activities`),
};

export const inventoryApi = {
  listByProject: (projectId: string) => api.get<InventoryItem[]>(`/projects/${projectId}/inventory`),
  create: (projectId: string, data: { name: string; quantity: number; unit: string }) =>
    api.post<InventoryItem>(`/projects/${projectId}/inventory`, data),
  adjust: (id: string, quantityChange: number) => api.patch<InventoryItem>(`/inventory/${id}`, { quantityChange }),
};

export const teamsApi = {
  listByProject: (projectId: string) => api.get<Team[]>(`/projects/${projectId}/teams`),
  create: (projectId: string, name: string) => api.post<Team>(`/projects/${projectId}/teams`, { name }),
  delete: (id: string) => api.delete(`/teams/${id}`),
  addMember: (id: string, userId: string) => api.post<Team>(`/teams/${id}/members`, { userId }),
  removeMember: (id: string, userId: string) => api.delete(`/teams/${id}/members/${userId}`),
};

export const templatesApi = {
  // kind: 'reply' (comment answers) | 'resolution' (completion notes) | omitted = both; all: also inactive
  listByProject: (projectId: string, { all = false, kind }: { all?: boolean; kind?: TemplateKind } = {}) => {
    const qs = new URLSearchParams({ ...(all ? { all: '1' } : {}), ...(kind ? { kind } : {}) }).toString();
    return api.get<ReplyTemplate[]>(`/projects/${projectId}/reply-templates${qs ? `?${qs}` : ''}`);
  },
  create: (projectId: string, data: { kind: TemplateKind; title: string; body: string }) =>
    api.post<ReplyTemplate>(`/projects/${projectId}/reply-templates`, data),
  update: (id: string, data: { title: string; body: string; sortOrder: number; isActive: boolean }) =>
    api.patch<ReplyTemplate>(`/reply-templates/${id}`, data),
  delete: (id: string) => api.delete(`/reply-templates/${id}`),
};

export const notificationsApi = {
  list: () => api.get<AppNotification[]>('/notifications'),
  unreadCount: () => api.get<{ count: number }>('/notifications/unread-count'),
  markRead: (id: string) => api.post(`/notifications/${id}/read`, {}),
  markAllRead: () => api.post('/notifications/read-all', {}),
};

export const requestFormsApi = {
  listByProject: (projectId: string, all = false) =>
    api.get<RequestForm[]>(`/projects/${projectId}/request-forms${all ? '?all=1' : ''}`),
  create: (projectId: string, data: { name: string; description: string }) =>
    api.post<RequestForm>(`/projects/${projectId}/request-forms`, data),
  update: (id: string, data: { name: string; description: string; isActive: boolean }) =>
    api.patch<RequestForm>(`/request-forms/${id}`, data),
  remove: (id: string) => api.delete(`/request-forms/${id}`),
  saveQuestions: (id: string, questions: RequestQuestion[]) =>
    api.put<RequestForm>(`/request-forms/${id}/questions`, { questions }),
  duplicate: (id: string) => api.post<RequestForm>(`/request-forms/${id}/duplicate`, {}),
};

export const filesApi = {
  /** Uploads a picked file (DocumentPicker asset) for a file question. */
  upload: async (asset: { uri: string; name: string; mimeType?: string | null }) => {
    const form = new FormData();
    // React Native's FormData takes { uri, name, type } for files.
    form.append('file', { uri: asset.uri, name: asset.name, type: asset.mimeType || 'application/octet-stream' } as any);
    const saved = await api.upload<{ id: string; name: string; size: number }>('/uploads', form);
    return { id: saved.id, name: saved.name, size: saved.size } as FileRef;
  },
  /** Downloads with the bearer token into the cache, then opens the share/open sheet. */
  open: async (file: FileRef) => {
    const token = getAccessToken();
    const dest = new File(Paths.cache, file.name);
    const downloaded = await File.downloadFileAsync(`${BASE_URL}/files/${file.id}`, dest, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      idempotent: true,
    });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(downloaded.uri, { dialogTitle: file.name });
    }
  },
};
