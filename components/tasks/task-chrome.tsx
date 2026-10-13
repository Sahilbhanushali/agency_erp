"use client"

import { CalendarClock, User as UserIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  TASK_PRIORITY_LABELS,
  TASK_PRIORITY_STYLES,
  TASK_STATUS_LABELS,
  type Task,
  type TaskPriority,
  type TaskStatus,
} from "@/types/task"

/**
 * How a task reads, defined once. The board's three views, the detail dialog and the
 * embeddable panel all import from here, so overdue styling, the "Standalone" fallback
 * and the assignee initials cannot drift apart between them.
 */

/** Past due and not finished. A done or cancelled task is never overdue. */
export const isOverdue = (task: Task) =>
  !!task.dueDate &&
  new Date(task.dueDate) < new Date(new Date().toDateString()) &&
  task.status !== "DONE" &&
  task.status !== "CANCELLED"

export const formatDue = (value: string) =>
  new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })

export const formatDueShort = (value: string) =>
  new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short" })

export const initials = (name: string | null, email: string) =>
  (name ?? email)
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")

const STATUS_STYLES: Record<TaskStatus, string> = {
  TODO: "bg-muted text-muted-foreground",
  IN_PROGRESS: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
  BLOCKED: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
  DONE: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  CANCELLED: "bg-muted text-muted-foreground line-through",
}

export function StatusBadge({ status }: { status: TaskStatus }) {
  return (
    <Badge variant="outline" className={`border-transparent ${STATUS_STYLES[status]}`}>
      {TASK_STATUS_LABELS[status]}
    </Badge>
  )
}

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  return (
    <Badge
      variant="outline"
      className={`border-transparent text-[11px] ${TASK_PRIORITY_STYLES[priority]}`}
    >
      {TASK_PRIORITY_LABELS[priority]}
    </Badge>
  )
}

export function DueDate({ task, short = true }: { task: Task; short?: boolean }) {
  if (!task.dueDate) return <span className="text-muted-foreground">—</span>
  const late = isOverdue(task)
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap text-[11px] ${
        late ? "font-medium text-destructive" : "text-muted-foreground"
      }`}
    >
      <CalendarClock className="h-3 w-3" aria-hidden="true" />
      {short ? formatDueShort(task.dueDate) : formatDue(task.dueDate)}
      {late && <span className="sr-only">(overdue)</span>}
    </span>
  )
}

/** Which record the task hangs off, or "Standalone" when it hangs off nothing. */
export function LinkedTo({ task }: { task: Task }) {
  const label =
    task.post?.title ?? task.project?.name ?? task.client?.company ?? task.client?.name
  if (!label) return <span className="text-xs text-muted-foreground">Standalone</span>
  return <span className="text-xs text-muted-foreground">{label}</span>
}

/** `compact` renders initial chips for dense layouts; otherwise a readable name list. */
export function Assignees({ task, compact = false }: { task: Task; compact?: boolean }) {
  if (task.assignees.length === 0) {
    return <span className="text-xs text-muted-foreground">Unassigned</span>
  }
  if (compact) {
    return (
      <ul className="flex flex-wrap gap-1">
        {task.assignees.map((user) => (
          <li
            key={user.id}
            title={user.name ?? user.email}
            className="flex h-6 items-center gap-1 rounded-full bg-muted px-2 text-[10px] font-medium"
          >
            <UserIcon className="h-2.5 w-2.5" aria-hidden="true" />
            {initials(user.name, user.email)}
          </li>
        ))}
      </ul>
    )
  }
  return (
    <span className="text-xs">
      {task.assignees.map((user) => user.name ?? user.email).join(", ")}
    </span>
  )
}
