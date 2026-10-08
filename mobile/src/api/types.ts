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
  /** Additional roles on top of `role`; effective access is the union. */
  extraRoles?: string[];
  unitId?: string | null;
  projectId?: string | null;
  avatarColor: string;
  createdAt: string;
  /** Real role key (a custom role's key); `role` holds the built-in role with the same scope. */
  roleKey?: string;
  scope?: string;
  level?: number;
  permissions?: string[];
  building?: string | null;
  floor?: string | null;
  room?: string | null;
  notifyEmail?: boolean;
  notifySms?: boolean;
  notifyPush?: boolean;
}

export interface RoleDef {
  key: string;
  name: string;
  description: string;
  scope: 'all' | 'unit' | 'manager' | 'project' | 'own';
  level: number;
  isSystem: boolean;
  permissions: string[];
  userCount: number;
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
export type Priority = 'High' | 'Medium' | 'Low';
export type Status =
  | 'To Do' | 'In Progress' | 'Onay Bekliyor' | 'Done' | 'Geri Çevrildi' | 'Yönlendirildi' | 'İptal Edildi';

export interface FileRef {
  id: string;
  name: string;
  size: number;
}

export interface RequestAnswer {
  questionId: string;
  label: string;
  type: QuestionType;
  /** string, string[] (checkbox), boolean (boolean) or FileRef[] (file) */
  value: any;
}

export interface PendingCompletion {
  resolutionNote: string;
  equipmentId?: string | null;
  quantity?: number;
  submittedBy: string;
  submittedAt: string;
}

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
  assigneeTeamId?: string | null;
  reporterId: string;
  isRequest: boolean;
  visibleTo: string[];
  timeSpent: number;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string | null;
  startedAt?: string | null;
  rating?: number | null;
  ratingComment?: string | null;
  ratedAt?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  forwardedFromProjectId?: string | null;
  requestFormId?: string | null;
  requestFormName?: string | null;
  requestAnswers: RequestAnswer[];
  pendingCompletion?: PendingCompletion | null;
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

export interface Team {
  id: string;
  projectId: string;
  name: string;
  createdAt: string;
  memberIds: string[];
}

export type TemplateKind = 'reply' | 'resolution';

export interface ReplyTemplate {
  id: string;
  projectId: string;
  kind: TemplateKind;
  title: string;
  body: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
}

export interface AppNotification {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  issueId?: string | null;
  createdAt: string;
  readAt?: string | null;
}

export type QuestionType =
  | 'text' | 'textarea' | 'number' | 'date' | 'select' | 'radio' | 'checkbox' | 'boolean' | 'file';

export interface RequestQuestion {
  id: string;
  formId?: string;
  label: string;
  helpText: string;
  placeholder: string;
  type: QuestionType;
  options: string[];
  required: boolean;
  sortOrder?: number;
  showIf: { questionId: string; value: string } | null;
  width: number;
  settings: { maxFiles?: number; accept?: string[] };
}

export interface RequestForm {
  id: string;
  projectId: string;
  name: string;
  description: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  questions: RequestQuestion[];
}
