"use client"

import { jsonFetcher } from "@/lib/fetcher";
import { useEffect, useMemo, useState } from "react"
import useSWR from "swr"
import toast from "react-hot-toast"
import { Check, Loader2, Search, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
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
import {
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  TASK_STATUS_ORDER,
  type Task,
  type TaskLink,
  type TaskPriority,
  type TaskStatus,
} from "@/types/task"

// Throws on non-2xx, so a failed load is an error state, not an empty list.
const fetcher = (url: string) => jsonFetcher(url);

interface TaskFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Present when editing, absent when creating. */
  task?: Task | null
  /** Pre-links a new task to the record the form was opened from. */
  link?: TaskLink
  onSaved: () => void
  /** False for an assignee who may only move status — the rest renders read-only. */
  canManage?: boolean
}

/** Radix Select cannot use "" as a value, so "not linked" needs a stand-in. */
const NO_PROJECT = "__none__"

const toDateInput = (value: string | null | undefined) =>
  value ? new Date(value).toISOString().slice(0, 10) : ""

export default function TaskForm({
  open,
  onOpenChange,
  task,
  link,
  onSaved,
  canManage = true,
}: TaskFormProps) {
  const isEdit = !!task
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [status, setStatus] = useState<TaskStatus>("TODO")
  const [priority, setPriority] = useState<TaskPriority>("MEDIUM")
  const [dueDate, setDueDate] = useState("")
  const [assigneeIds, setAssigneeIds] = useState<number[]>([])
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [assigneeQuery, setAssigneeQuery] = useState("")
  const [projectId, setProjectId] = useState("")

  /**
   * Whether the person chooses the project. Not when the form was opened from a project
   * or a post — that record decides it — and never for a task on a post, which belongs
   * to that post's project. Everywhere else (the Tasks page, an unlinked task) there was
   * no way to link a task to a project at all, so it never showed on the project page.
   */
  const pickProject = canManage && !link?.postId && !link?.projectId && !task?.postId
  const { data: projectData } = useSWR<{ projects?: { id: string; name: string; client: string | null }[] }>(
    open && pickProject ? "/api/projects?view=options" : null,
    fetcher,
  )
  const projectOptions = projectData?.projects ?? []

  // Only fetched while the sheet is open — the picker is not worth a request otherwise.
  const { data: users } = useSWR<{ id: string; name: string | null; email: string }[]>(
    open && canManage ? "/api/users" : null,
    fetcher,
  )
  // /api/users serialises id with .toString(), so it arrives as a string while the task's
  // assignee ids are numbers. Coerce once here rather than comparing across types.
  const userList = useMemo(
    () => (Array.isArray(users) ? users.map((user) => ({ ...user, id: Number(user.id) })) : []),
    [users],
  )

  useEffect(() => {
    if (!open) return
    setErrors({})
    setConfirmDelete(false)
    setTitle(task?.title ?? "")
    setDescription(task?.description ?? "")
    setStatus(task?.status ?? "TODO")
    setPriority(task?.priority ?? "MEDIUM")
    setDueDate(toDateInput(task?.dueDate))
    setAssigneeIds(task?.assignees.map((user) => user.id) ?? [])
    setAssigneeQuery("")
    setProjectId(task?.projectId ?? "")
  }, [open, task])

  // Search by name or email. Someone already picked stays visible even when they do
  // not match, so the list never hides a choice you have made.
  const visibleUsers = useMemo(() => {
    const needle = assigneeQuery.trim().toLowerCase()
    if (!needle) return userList
    return userList.filter(
      (user) =>
        assigneeIds.includes(user.id) ||
        (user.name ?? "").toLowerCase().includes(needle) ||
        user.email.toLowerCase().includes(needle),
    )
  }, [userList, assigneeQuery, assigneeIds])

  const toggleAssignee = (id: number) =>
    setAssigneeIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    )

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setErrors({})

    // An assignee without Manage-tasks may send status and nothing else — the API
    // refuses a mixed body rather than ignoring the extra fields.
    const payload = canManage
      ? {
          title,
          description: description || undefined,
          status,
          priority,
          dueDate: dueDate || null,
          assigneeIds,
          ...(isEdit ? {} : { ...link }),
          ...(pickProject ? { projectId: projectId || null } : {}),
        }
      : { status }

    try {
      const response = await fetch(isEdit ? `/api/tasks/${task!.id}` : "/api/tasks", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await response.json()

      if (!response.ok) {
        if (response.status === 422 && data.details) {
          setErrors(data.details)
          toast.error("Check the highlighted fields")
        } else {
          toast.error(data.error ?? "Could not save the task")
        }
        return
      }

      toast.success(isEdit ? "Task updated" : "Task created")
      onSaved()
      onOpenChange(false)
    } catch {
      toast.error("Network error — please try again")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!task) return
    setSaving(true)
    try {
      const response = await fetch(`/api/tasks/${task.id}`, { method: "DELETE" })
      const data = await response.json()
      if (!response.ok) {
        toast.error(data.error ?? "Could not delete the task")
        return
      }
      toast.success("Task deleted")
      setConfirmDelete(false)
      onSaved()
      onOpenChange(false)
    } catch {
      toast.error("Network error — please try again")
    } finally {
      setSaving(false)
    }
  }

  const linkedTo =
    task?.post?.title ??
    task?.project?.name ??
    task?.client?.company ??
    task?.client?.name ??
    null

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="flex w-full flex-col sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{isEdit ? "Edit task" : "New task"}</SheetTitle>
            <SheetDescription>
              {linkedTo
                ? `Linked to ${linkedTo}.`
                : link?.postId || link?.projectId || link?.clientId
                  ? "This task will be linked to the record you opened it from."
                  : "An internal task, not tied to a post or project."}
            </SheetDescription>
          </SheetHeader>

          <form onSubmit={handleSubmit} className="flex-1 space-y-5 overflow-y-auto px-4 pb-4">
            {!canManage && (
              <p className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                This task is assigned to you. You can move its status — editing the details
                needs the Manage-tasks permission.
              </p>
            )}

            <div>
              <Label htmlFor="task-title">
                Title{canManage && <span aria-hidden="true"> *</span>}
              </Label>
              <Input
                id="task-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="File September GST return"
                disabled={!canManage}
                aria-invalid={!!errors.title}
                aria-describedby={errors.title ? "task-title-error" : undefined}
                className="mt-1"
              />
              {errors.title && (
                <p id="task-title-error" className="mt-1 text-xs text-destructive">
                  {errors.title[0]}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="task-description">Description</Label>
              <Textarea
                id="task-description"
                rows={4}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="What exactly needs doing, and what counts as done."
                disabled={!canManage}
                className="mt-1"
              />
            </div>

            {pickProject && (
              <div>
                <Label htmlFor="task-project">Project</Label>
                <Select value={projectId || NO_PROJECT} onValueChange={(v) => setProjectId(v === NO_PROJECT ? "" : v)}>
                  <SelectTrigger id="task-project" className="mt-1" aria-describedby="task-project-hint">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_PROJECT}>No project — an internal task</SelectItem>
                    {projectOptions.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.client ? `${p.client} — ${p.name}` : p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p id="task-project-hint" className="mt-1 text-xs text-muted-foreground">
                  Linked tasks appear in that project&apos;s task list.
                </p>
                {errors.projectId && <p className="mt-1 text-xs text-destructive">{errors.projectId[0]}</p>}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="task-status">Status</Label>
                <Select value={status} onValueChange={(value) => setStatus(value as TaskStatus)}>
                  <SelectTrigger id="task-status" className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_STATUS_ORDER.map((value) => (
                      <SelectItem key={value} value={value}>
                        {TASK_STATUS_LABELS[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="task-priority">Priority</Label>
                <Select
                  value={priority}
                  onValueChange={(value) => setPriority(value as TaskPriority)}
                  disabled={!canManage}
                >
                  <SelectTrigger id="task-priority" className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(TASK_PRIORITY_LABELS) as TaskPriority[]).map((value) => (
                      <SelectItem key={value} value={value}>
                        {TASK_PRIORITY_LABELS[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="task-due">Due date</Label>
              <Input
                id="task-due"
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
                disabled={!canManage}
                className="mt-1"
              />
            </div>

            {canManage && (
              <fieldset>
                <legend className="text-sm font-medium">Assignees</legend>
                <p className="mt-1 mb-2 text-xs text-muted-foreground">
                  Everyone picked is notified. Leave empty to keep it in the backlog.
                </p>
                <div className="relative mb-2">
                  <Search
                    className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <Input
                    id="task-assignee-search"
                    aria-label="Search people to assign"
                    placeholder="Search by name or email"
                    value={assigneeQuery}
                    onChange={(event) => setAssigneeQuery(event.target.value)}
                    className="pl-9"
                  />
                </div>

                <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
                  {userList.length === 0 ? (
                    <p className="p-2 text-xs text-muted-foreground">Loading people…</p>
                  ) : visibleUsers.length === 0 ? (
                    <p className="p-2 text-xs text-muted-foreground">
                      Nobody matches “{assigneeQuery}”.
                    </p>
                  ) : (
                    visibleUsers.map((user) => {
                      const picked = assigneeIds.includes(user.id)
                      return (
                        <button
                          key={user.id}
                          type="button"
                          onClick={() => toggleAssignee(user.id)}
                          aria-pressed={picked}
                          className={`flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-muted ${
                            picked ? "bg-muted" : ""
                          }`}
                        >
                          <span className="min-w-0">
                            <span className="block truncate">{user.name ?? user.email}</span>
                            {user.name && (
                              <span className="block truncate text-xs text-muted-foreground">
                                {user.email}
                              </span>
                            )}
                          </span>
                          {picked && <Check className="ml-2 h-4 w-4 shrink-0" aria-hidden="true" />}
                        </button>
                      )
                    })
                  )}
                </div>
                {assigneeIds.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {assigneeIds.map((id) => {
                      const user = userList.find((candidate) => candidate.id === id)
                      return (
                        <Badge key={id} variant="secondary" className="gap-1">
                          {user?.name ?? user?.email ?? `#${id}`}
                          <button
                            type="button"
                            onClick={() => toggleAssignee(id)}
                            aria-label={`Remove ${user?.name ?? id}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      )
                    })}
                  </div>
                )}
              </fieldset>
            )}
          </form>

          <SheetFooter className="flex-row justify-between gap-2 border-t border-border px-4 py-3">
            {isEdit && canManage ? (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={() => setConfirmDelete(true)}
                disabled={saving}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEdit ? "Save" : "Create task"}
              </Button>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{task?.title}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault()
                handleDelete()
              }}
              disabled={saving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
