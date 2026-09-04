// Mirrors backend/internal/models/models.go's JSON shape exactly.

export type Role =
  | 'System_Admin'
  | 'Department_Head'
  | 'Project_Manager'
  | 'Worker'
  | 'External_User';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  unitId?: string | null;
  projectId?: string | null;
  avatarColor: string;
  createdAt: string;
}

export interface Unit {
  id: string;
  name: string;
  unitCode: string;
  departmentHeadId?: string | null;
  createdAt: string;
}

export interface Project {
  id: string;
  key: string;
  name: string;
  description: string;
  unitId: string;
  managerId: string;
  hasInventory: boolean;
  createdAt: string;
}

export type SprintStatus = 'Planned' | 'Active' | 'Completed';

export interface Sprint {
  id: string;
  projectId: string;
  name: string;
  month: number;
  year: number;
  startDate: string;
  endDate: string;
  status: SprintStatus;
}

export type IssueType = 'Task' | 'Bug' | 'Story' | 'Epic' | 'Request';
export type Priority = 'Highest' | 'High' | 'Medium' | 'Low' | 'Lowest';
export type Status = 'To Do' | 'In Progress' | 'In Review' | 'Done' | 'Geri Çevrildi';

export interface Issue {
  id: string;
  number: number;
  projectId: string;
  projectKey: string;
  key: string;
  sprintId?: string | null;
  title: string;
  description: string;
  type: IssueType;
  priority: Priority;
  status: Status;
  assigneeId?: string | null;
  reporterId: string;
  isRequest: boolean;
  visibleTo: string[];
  timeSpent: number;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string | null;
}

export interface Comment {
  id: string;
  issueId: string;
  authorId: string;
  text: string;
  createdAt: string;
}

export interface Activity {
  id: string;
  issueId: string;
  userId: string;
  type: 'created' | 'status_change' | 'assignment' | 'comment' | 'field_update';
  description: string;
  createdAt: string;
}

export interface InventoryItem {
  id: string;
  projectId: string;
  name: string;
  quantity: number;
  unit: string;
}
