"use client"

import Link from "next/link"
import { Edit, ExternalLink, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Assignees, DueDate, PriorityBadge, StatusBadge } from "@/components/tasks/task-chrome"
import type { Task } from "@/types/task"

/**
 * Read-only detail view. Everything a task holds, including the fields the board's
 * compact layouts drop: full description, who created it, and the timestamps.
 * Edit and Delete hand back to the parent so one dialog and one confirm serve all views.
 */
export default function TaskDetail({
  task,
  open,
  onOpenChange,
  onEdit,
  onDelete,
  canManage,
}: {
  task: Task | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onEdit: (task: Task) => void
  onDelete: (task: Task) => void
  canManage: boolean
}) {
  if (!task) return null

  const stamp = (value: string | null) =>
    value
      ? new Date(value).toLocaleString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })
      : "—"

  /** The linked record, with a link when that record has a page of its own. */
  const linked = task.post
    ? { label: task.post.title, href: `/dashboard/projects/posts/${task.post.id}`, kind: "Post" }
    : task.project
      ? { label: task.project.name, href: `/dashboard/projects/${task.project.id}`, kind: "Project" }
      : task.client
        ? { label: task.client.company ?? task.client.name, href: null, kind: "Client" }
        : null

  const rows: { label: string; value: React.ReactNode }[] = [
    { label: "Status", value: <StatusBadge status={task.status} /> },
    { label: "Priority", value: <PriorityBadge priority={task.priority} /> },
    { label: "Due", value: <DueDate task={task} short={false} /> },
    { label: "Assignees", value: <Assignees task={task} /> },
    {
      label: linked ? linked.kind : "Scope",
      value: linked ? (
        linked.href ? (
          <Link
            href={linked.href}
            className="inline-flex items-center gap-1 text-xs hover:underline"
          >
            {linked.label}
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
          </Link>
        ) : (
          <span className="text-xs">{linked.label}</span>
        )
      ) : (
        <span className="text-xs text-muted-foreground">Standalone — not linked to a record</span>
      ),
    },
    { label: "Created by", value: <span className="text-xs">{task.createdBy?.name ?? "—"}</span> },
    { label: "Created", value: <span className="text-xs">{stamp(task.createdAt)}</span> },
    { label: "Last updated", value: <span className="text-xs">{stamp(task.updatedAt)}</span> },
    ...(task.completedAt
      ? [{ label: "Completed", value: <span className="text-xs">{stamp(task.completedAt)}</span> }]
      : []),
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="pr-6 leading-snug">{task.title}</DialogTitle>
          <DialogDescription>Task details</DialogDescription>
        </DialogHeader>

        {task.description && (
          <>
            <p className="whitespace-pre-line text-sm text-muted-foreground">{task.description}</p>
            <Separator />
          </>
        )}

        <dl className="space-y-3">
          {rows.map((row) => (
            <div key={row.label} className="grid grid-cols-[7.5rem_1fr] items-center gap-3">
              <dt className="text-xs font-medium text-muted-foreground">{row.label}</dt>
              <dd className="min-w-0">{row.value}</dd>
            </div>
          ))}
        </dl>

        <DialogFooter className="gap-2 sm:justify-between">
          {canManage ? (
            <Button
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => onDelete(task)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button onClick={() => onEdit(task)}>
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
