export type TaskStatus =
  | "TODO"
  | "IN_PROGRESS"
  | "IN_REVIEW"
  | "NEEDS_REVISION"
  | "ADMIN_APPROVED"
  | "CLIENT_PENDING"
  | "DONE"
  | "CANCELLED";

export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export interface TaskUser {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  avatarUrl?: string | null;
}

export interface SubTask {
  id: string;
  title: string;
  status: TaskStatus;
  dueDate: string | null;
  assignee: TaskUser | null;
}

export interface TaskComment {
  id: string;
  content: string;
  createdAt: string;
  user: TaskUser;
}

export interface Task {
  id: string;
  companyId: string;
  projectId: string;
  workspaceId: string | null;
  parentTaskId: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  position: number;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  assignee: TaskUser | null;
  createdBy: Pick<TaskUser, "id" | "firstName" | "lastName">;
  project: { id: string; title: string };
  workspace: { id: string; name: string; colorHex: string | null } | null;
  subTasks: SubTask[];
  /** Only returned by GET /tasks/:id. */
  comments?: TaskComment[];
  _count: { comments: number };
}

export interface CreateTaskPayload {
  projectId: string;
  workspaceId?: string | null;
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string | null;
  assigneeId?: string | null;
}

export type UpdateTaskPayload = Partial<Omit<CreateTaskPayload, "projectId">>;

export interface CreateSubTaskPayload {
  title: string;
  assigneeId?: string | null;
  dueDate?: string | null;
}
