// Thin per-resource wrappers over the API client, mirroring the backend's
// REST routes (same contract the web frontend's src/api/resources.js uses).
import { api } from './client';
import type {
  User, Unit, Project, Sprint, Issue, Comment, Activity, InventoryItem,
} from './types';

export const usersApi = {
  list: () => api.get<User[]>('/users'),
  me: () => api.get<User>('/users/me'),
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
  create: (data: Partial<Issue> & { projectId: string; title: string }) => api.post<Issue>('/issues', data),
  update: (id: string, data: Partial<Issue>) => api.patch<Issue>(`/issues/${id}`, data),
  delete: (id: string) => api.delete(`/issues/${id}`),
  updateStatus: (id: string, status: string) => api.patch<Issue>(`/issues/${id}/status`, { status }),
  complete: (id: string, data: { resolutionNote: string; usedEquipment?: boolean; equipmentId?: string; quantity?: number }) =>
    api.post<{ issue: Issue; stockWarning: boolean }>(`/issues/${id}/complete`, data),
  updateAssignee: (id: string, assigneeId: string | null) =>
    api.patch<Issue>(`/issues/${id}/assignee`, { assigneeId }),
  clone: (id: string) => api.post<Issue>(`/issues/${id}/clone`),
  moveSprint: (id: string, sprintId: string | null) => api.post<Issue>(`/issues/${id}/move-sprint`, { sprintId }),
  updateDates: (id: string, resolvedAt: string | null, timeSpent: number) =>
    api.patch<Issue>(`/issues/${id}/dates`, { resolvedAt, timeSpent }),
  addVisibleUser: (id: string, userId: string) => api.post<Issue>(`/issues/${id}/visible-users`, { userId }),
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
