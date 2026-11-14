"use client"

import { jsonFetcher } from "@/lib/fetcher";
import { useState } from "react"
import useSWR from "swr"
import toast from "react-hot-toast"
import { Check, Edit, Eye, ListTodo, Loader2, MoreHorizontal, Plus, RotateCcw, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import TaskForm from "@/components/tasks/task-form"
import TaskDetail from "@/components/tasks/task-detail"
import { Assignees, DueDate, PriorityBadge } from "@/components/tasks/task-chrome"
import { usePermissions } from "@/hooks/use-permissions"
import { TASK_STATUS_LABELS, type Task, type TaskLink } from "@/types/task"

// Throws on non-2xx, so a failed load is an error state, not an empty list.
const fetcher = (url: string) => jsonFetcher(url);

/**
 * The task list for one record — drop it on a post, project or client page and it shows
 * that record's tasks, pre-linking anything created from it.
 *
 *   <TaskPanel link={{ postId: post.id }} />
 *
 * `canManage` resolves itself from the caller's permissions, so a client page can drop
 * the panel in without plumbing permissions through. Pass it explicitly from a server
 * component to skip the extra request.
 */
export default function TaskPanel({
  link,
  canManage,
  title = "Tasks",
}: {
  link: TaskLink
  canManage?: boolean
  title?: string
}) {
  const { has } = usePermissions()
  const manage = canManage ?? has("Manage-tasks")
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Task | null>(null)
  const [viewing, setViewing] = useState<Task | null>(null)
  const [deleting, setDeleting] = useState<Task | null>(null)
  const [toggling, setToggling] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const query = new URLSearchParams({ limit: "100" })
  for (const [key, value] of Object.entries(link)) if (value) query.set(key, value)

  const { data, error, isLoading, mutate } = useSWR<{ tasks: Task[]; error?: string }>(
    `/api/tasks?${query}`,
    fetcher,
  )
  const tasks = data?.tasks ?? []
  const open = tasks.filter((task) => task.status !== "DONE" && task.status !== "CANCELLED")

  /** One tap to finish or reopen. Anyone assigned may do this without Manage-tasks. */
  const toggleDone = async (task: Task) => {
    setToggling(task.id)
    try {
      const response = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: task.status === "DONE" ? "TODO" : "DONE" }),
      })
      const body = await response.json()
      if (!response.ok) {
        toast.error(body.error ?? "Could not update the task")
        return
      }
      mutate()
    } catch {
      toast.error("Network error — please try again")
    } finally {
      setToggling(null)
    }
  }

  const handleDelete = async () => {
    if (!deleting) return
    setBusy(true)
    try {
      const response = await fetch(`/api/tasks/${deleting.id}`, { method: "DELETE" })
      const body = await response.json()
      if (!response.ok) {
        toast.error(body.error ?? "Could not delete the task")
        return
      }
      toast.success(`“${deleting.title}” deleted`)
      setDeleting(null)
      setViewing(null)
      mutate()
    } catch {
      toast.error("Network error — please try again")
    } finally {
      setBusy(false)
    }
  }

  const openEdit = (task: Task) => {
    setViewing(null)
    setEditing(task)
    setFormOpen(true)
  }

  /** Same three actions the board offers, so the panel is not a lesser surface. */
  const TaskActions = ({ task }: { task: Task }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          aria-label={`Actions for ${task.title}`}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => setViewing(task)}>
          <Eye className="mr-2 h-4 w-4" />
          View details
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => openEdit(task)}>
          <Edit className="mr-2 h-4 w-4" />
          Edit
        </DropdownMenuItem>
        {manage && (
          <DropdownMenuItem
            onSelect={() => setDeleting(task)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4 pb-3">
        <CardTitle className="text-base">
          {title}
          {open.length > 0 && (
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {open.length} open
            </span>
          )}
        </CardTitle>
        {manage && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setEditing(null)
              setFormOpen(true)
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add task
          </Button>
        )}
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : error || data?.error ? (
          <div className="py-6 text-center">
            <p className="text-sm text-destructive">{data?.error ?? "Could not load tasks."}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => mutate()}>
              Try again
            </Button>
          </div>
        ) : tasks.length === 0 ? (
          <div className="py-8 text-center">
            <ListTodo className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <p className="mt-3 text-sm text-muted-foreground">
              No tasks yet.
              {manage && " Add one to track the work that is not a post of its own."}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {tasks.map((task) => {
              const done = task.status === "DONE"
              return (
                <li key={task.id} className="flex items-start gap-3 py-2.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    aria-label={done ? `Reopen ${task.title}` : `Mark ${task.title} done`}
                    disabled={toggling === task.id}
                    onClick={() => toggleDone(task)}
                  >
                    {done ? (
                      <RotateCcw className="h-3.5 w-3.5" />
                    ) : (
                      <span className="flex h-4 w-4 items-center justify-center rounded border border-muted-foreground/40">
                        <Check className="h-3 w-3 opacity-0 transition-opacity hover:opacity-40" />
                      </span>
                    )}
                  </Button>

                  <button
                    type="button"
                    onClick={() => setViewing(task)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span
                      className={`block text-sm ${done ? "text-muted-foreground line-through" : ""}`}
                    >
                      {task.title}
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-1.5">
                      {!done && <PriorityBadge priority={task.priority} />}
                      {task.status !== "TODO" && !done && (
                        <span className="text-xs text-muted-foreground">
                          {TASK_STATUS_LABELS[task.status]}
                        </span>
                      )}
                      {task.dueDate && <DueDate task={task} />}
                      <Assignees task={task} />
                    </span>
                  </button>

                  <TaskActions task={task} />
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>

      <TaskDetail
        task={viewing}
        open={!!viewing}
        onOpenChange={(open) => !open && setViewing(null)}
        onEdit={openEdit}
        onDelete={setDeleting}
        canManage={manage}
      />

      <TaskForm
        open={formOpen}
        onOpenChange={setFormOpen}
        task={editing}
        link={link}
        onSaved={() => mutate()}
        canManage={manage}
      />

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{deleting?.title}”?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault()
                handleDelete()
              }}
              disabled={busy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
