export type TaskStatus = "TODO" | "IN_PROGRESS" | "BLOCKED" | "DONE" | "CANCELLED"
export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT"

export interface TaskAssignee {
  id: number
  name: string | null
  email: string
  avatar: string | null
}

export interface Task {
  id: string
  title: string
  description: string | null
  status: TaskStatus
  priority: TaskPriority
  dueDate: string | null
  completedAt: string | null
  position: number
  createdAt: string
  updatedAt: string
  postId: string | null
  projectId: string | null
  clientId: string | null
  createdBy: { id: number; name: string | null } | null
  assignees: TaskAssignee[]
  post: { id: string; title: string } | null
  project: { id: string; name: string } | null
  client: { id: string; name: string; company: string | null } | null
}

/** Which record a task hangs off. All absent = a standalone internal task. */
export interface TaskLink {
  postId?: string
  projectId?: string
  clientId?: string
}

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: "To do",
  IN_PROGRESS: "In progress",
  BLOCKED: "Blocked",
  DONE: "Done",
  CANCELLED: "Cancelled",
}

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
}

/** Colour carries meaning, so every label repeats it in text. */
export const TASK_PRIORITY_STYLES: Record<TaskPriority, string> = {
  LOW: "bg-muted text-muted-foreground",
  MEDIUM: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
  HIGH: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  URGENT: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
}

export const TASK_STATUS_ORDER: TaskStatus[] = [
  "TODO",
  "IN_PROGRESS",
  "BLOCKED",
  "DONE",
  "CANCELLED",
]
