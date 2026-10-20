"use client"

import { useMemo, useState } from "react"
import useSWR from "swr"
import toast from "react-hot-toast"
import {
  AlertTriangle,
  Edit,
  Eye,
  Grid3X3,
  Kanban,
  ListTodo,
  Loader2,
  MoreHorizontal,
  Plus,
  Search,
  Table as TableIcon,
  Trash2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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
import { Assignees, DueDate, LinkedTo, PriorityBadge } from "@/components/tasks/task-chrome"
import {
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  TASK_STATUS_ORDER,
  type Task,
  type TaskPriority,
  type TaskStatus,
} from "@/types/task"

const fetcher = (url: string) => fetch(url).then((response) => response.json())

/** Whose tasks the board is showing. */
type TaskScope = "mine" | "assignedByMe" | "all"

type ViewMode = "kanban" | "cards" | "table"

const VIEWS: { key: ViewMode; label: string; icon: typeof Kanban }[] = [
  { key: "kanban", label: "Kanban", icon: Kanban },
  { key: "cards", label: "Cards", icon: Grid3X3 },
  { key: "table", label: "Table", icon: TableIcon },
]

/**
 * The standalone Task entity in three views, matching the post pipeline's switcher.
 *
 * Kanban drag-and-drop is the native HTML5 API — no library — and a drop sends the
 * whole destination column to /api/tasks/reorder so one request settles both the moved
 * card's status and its neighbours' positions. Cards and table have nothing to drag, so
 * they change status through a Select instead.
 *
 * Every view carries the same View / Edit / Delete menu, and all three share one detail
 * dialog, one edit sheet and one delete confirmation held here.
 */
export interface TaskPerms {
  create: boolean
  update: boolean
  delete: boolean
}

export default function TaskBoard({ perms }: { perms: TaskPerms }) {
  // Dragging a card changes its status, which is an update. Creating and deleting are
  // separate permissions, so a read+update role gets a working board with no New task
  // button and no delete action.
  const canManage = perms.update
  const [viewMode, setViewMode] = useState<ViewMode>("kanban")
  const [search, setSearch] = useState("")
  const [priority, setPriority] = useState<string>("ALL")
  /**
   * Whose tasks the board shows. Defaults to the viewer's own work — opening the board
   * on everyone's tasks buries what the person is actually responsible for.
   */
  const [scope, setScope] = useState<TaskScope>("mine")
  const [dragging, setDragging] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<TaskStatus | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Task | null>(null)
  const [viewing, setViewing] = useState<Task | null>(null)
  const [deleting, setDeleting] = useState<Task | null>(null)
  const [busy, setBusy] = useState(false)
  const [blockingTarget, setBlockingTarget] = useState<{
    task: Task
    type: "drop" | "select"
    destination?: string[]
  } | null>(null)
  const [blockerReason, setBlockerReason] = useState("")
  const [blockerCategory, setBlockerCategory] = useState("TECHNICAL_ISSUE")

  const query = new URLSearchParams({ limit: "200" })
  if (priority !== "ALL") query.set("priority", priority)
  if (scope === "mine") query.set("mine", "1")
  if (scope === "assignedByMe") query.set("createdByMe", "1")
  if (search.trim()) query.set("search", search.trim())

  const { data, error, isLoading, mutate } = useSWR<{ tasks: Task[]; total: number; error?: string }>(
    `/api/tasks?${query}`,
    fetcher,
    { keepPreviousData: true },
  )

  const tasks = data?.tasks ?? []
  const columns = useMemo(() => {
    const byStatus = new Map<TaskStatus, Task[]>(TASK_STATUS_ORDER.map((s) => [s, []]))
    for (const task of tasks) byStatus.get(task.status)?.push(task)
    return byStatus
  }, [tasks])

  const openEdit = (task: Task) => {
    setViewing(null)
    setEditing(task)
    setFormOpen(true)
  }

  const handleDrop = async (status: TaskStatus) => {
    const taskId = dragging
    setDragging(null)
    setDropTarget(null)
    if (!taskId) return

    const task = tasks.find((candidate) => candidate.id === taskId)
    if (!task || task.status === status) return

    // Dropped cards go to the top of the destination column.
    const destination = [taskId, ...(columns.get(status) ?? []).map((item) => item.id)]

    // Intercept BLOCKED status to prompt user for reason popup
    if (status === "BLOCKED") {
      setBlockingTarget({
        task,
        type: "drop",
        destination,
      })
      setBlockerReason("")
      setBlockerCategory("TECHNICAL_ISSUE")
      return
    }

    // Optimistic: move the card now so it does not visibly snap back.
    mutate(
      {
        ...(data ?? { tasks: [], total: 0 }),
        tasks: tasks.map((item) => (item.id === taskId ? { ...item, status } : item)),
      },
      false,
    )

    setBusy(true)
    try {
      const response = await fetch("/api/tasks/reorder", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, taskIds: destination }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        toast.error(body.error ?? "Could not move the task")
        return
      }
      // A silent drop leaves you unsure whether the move actually saved.
      toast.success(`Moved to ${TASK_STATUS_LABELS[status]}`)
    } catch {
      toast.error("Network error — please try again")
    } finally {
      setBusy(false)
      mutate()
    }
  }

  /** Status change outside the kanban, where there is nothing to drag. */
  const setStatus = async (task: Task, status: TaskStatus) => {
    if (task.status === status) return

    // Intercept BLOCKED status to prompt user for reason popup
    if (status === "BLOCKED") {
      setBlockingTarget({
        task,
        type: "select",
      })
      setBlockerReason("")
      setBlockerCategory("TECHNICAL_ISSUE")
      return
    }

    setBusy(true)
    mutate(
      {
        ...(data ?? { tasks: [], total: 0 }),
        tasks: tasks.map((item) => (item.id === task.id ? { ...item, status } : item)),
      },
      false,
    )
    try {
      const response = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      const body = await response.json()
      if (!response.ok) {
        toast.error(body.error ?? "Could not update the task")
        return
      }
      toast.success(`Moved to ${TASK_STATUS_LABELS[status]}`)
    } catch {
      toast.error("Network error — please try again")
    } finally {
      setBusy(false)
      mutate()
    }
  }

  const confirmBlock = async () => {
    if (!blockingTarget || !blockerReason.trim()) return
    const { task, destination, type } = blockingTarget
    const reason = blockerReason.trim()
    const category = blockerCategory
    setBlockingTarget(null)

    if (type === "drop" && destination) {
      mutate(
        {
          ...(data ?? { tasks: [], total: 0 }),
          tasks: tasks.map((item) => (item.id === task.id ? { ...item, status: "BLOCKED" as TaskStatus } : item)),
        },
        false,
      )
      setBusy(true)
      try {
        const response = await fetch("/api/tasks/reorder", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "BLOCKED",
            taskIds: destination,
            blockerReason: reason,
            blockerCategory: category,
          }),
        })
        if (!response.ok) {
          const body = await response.json().catch(() => ({}))
          toast.error(body.error ?? "Could not move the task")
          return
        }
        toast.success("Task marked as Blocked")
      } catch {
        toast.error("Network error — please try again")
      } finally {
        setBusy(false)
        mutate()
      }
    } else {
      setBusy(true)
      mutate(
        {
          ...(data ?? { tasks: [], total: 0 }),
          tasks: tasks.map((item) => (item.id === task.id ? { ...item, status: "BLOCKED" as TaskStatus } : item)),
        },
        false,
      )
      try {
        const response = await fetch(`/api/tasks/${task.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "BLOCKED",
            blockerReason: reason,
            blockerCategory: category,
          }),
        })
        const body = await response.json()
        if (!response.ok) {
          toast.error(body.error ?? "Could not update the task")
          return
        }
        toast.success("Task marked as Blocked")
      } catch {
        toast.error("Network error — please try again")
      } finally {
        setBusy(false)
        mutate()
      }
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

  /** The same actions on every view, so none of them is the odd one out. */
  const TaskActions = ({ task }: { task: Task }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={`Actions for ${task.title}`}>
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
        {perms.delete && (
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

  const StatusSelect = ({ task }: { task: Task }) => (
    <Select
      value={task.status}
      onValueChange={(value) => setStatus(task, value as TaskStatus)}
      disabled={busy}
    >
      <SelectTrigger className="h-8 text-xs" aria-label={`Status of ${task.title}`}>
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
  )

  if (isLoading && !data) {
    return (
      <div className="grid gap-4 lg:grid-cols-5">
        {TASK_STATUS_ORDER.map((status) => (
          <div key={status} className="space-y-3">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ))}
      </div>
    )
  }

  if (error || data?.error) {
    return (
      <Card>
        <CardContent className="p-10 text-center">
          <p className="text-sm text-destructive">{data?.error ?? "Could not load tasks."}</p>
          <Button variant="outline" className="mt-4" onClick={() => mutate()}>
            Try again
          </Button>
        </CardContent>
      </Card>
    )
  }

  const isFiltered = search.trim() !== "" || priority !== "ALL" || scope !== "mine"

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Search tasks"
            placeholder="Search tasks"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={scope} onValueChange={(value) => setScope(value as TaskScope)}>
          <SelectTrigger className="w-[170px]" aria-label="Whose tasks">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="mine">Assigned to me</SelectItem>
            <SelectItem value="assignedByMe">Assigned by me</SelectItem>
            <SelectItem value="all">Everyone</SelectItem>
          </SelectContent>
        </Select>

        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger className="w-[150px]" aria-label="Filter by priority">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Any priority</SelectItem>
            {(Object.keys(TASK_PRIORITY_LABELS) as TaskPriority[]).map((value) => (
              <SelectItem key={value} value={value}>
                {TASK_PRIORITY_LABELS[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {busy && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" />}

        <div
          role="group"
          aria-label="Task view"
          className="ml-auto flex rounded-lg border border-border bg-muted p-1"
        >
          {VIEWS.map((item) => {
            const Icon = item.icon
            const isActive = viewMode === item.key
            return (
              <Button
                key={item.key}
                variant={isActive ? "default" : "ghost"}
                size="sm"
                aria-pressed={isActive}
                onClick={() => setViewMode(item.key)}
              >
                <Icon className="mr-1.5 size-4" aria-hidden="true" />
                {item.label}
              </Button>
            )
          })}
        </div>

        {perms.create && (
          <Button
            onClick={() => {
              setEditing(null)
              setFormOpen(true)
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            New task
          </Button>
        )}
      </div>

      {tasks.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <ListTodo className="mx-auto h-10 w-10 text-muted-foreground/50" />
            {/*
              The board opens on "Assigned to me", so an empty result usually means
              "nothing is assigned to you" rather than "this agency has no tasks".
              Saying "No tasks yet" there, with a Create button, was simply wrong.
            */}
            <h2 className="mt-4 text-base font-medium">
              {search.trim() !== "" || priority !== "ALL"
                ? "No tasks match those filters"
                : scope === "mine"
                  ? "Nothing assigned to you"
                  : scope === "assignedByMe"
                    ? "You haven't assigned any tasks"
                    : "No tasks yet"}
            </h2>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
              {search.trim() !== "" || priority !== "ALL" ? (
                "Try a different priority or clear the search."
              ) : scope === "mine" ? (
                <>
                  Work assigned to you shows up here. Switch to{" "}
                  <strong className="font-medium">Everyone</strong> to see the whole board.
                </>
              ) : scope === "assignedByMe" ? (
                "Tasks you create for other people show up here."
              ) : (
                "Tasks can stand alone, or hang off a post, project or client."
              )}
            </p>
            {scope !== "all" && search.trim() === "" && priority === "ALL" && (
              <Button variant="outline" className="mt-5" onClick={() => setScope("all")}>
                Show everyone's tasks
              </Button>
            )}
            {scope === "all" && !isFiltered && perms.create && (
              <Button
                className="mt-5"
                onClick={() => {
                  setEditing(null)
                  setFormOpen(true)
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Create the first task
              </Button>
            )}
          </CardContent>
        </Card>
      ) : viewMode === "kanban" ? (
        <div className="grid gap-4 lg:grid-cols-5">
          {TASK_STATUS_ORDER.map((status) => {
            const items = columns.get(status) ?? []
            return (
              <section
                key={status}
                onDragOver={(event) => {
                  if (!canManage) return
                  event.preventDefault()
                  setDropTarget(status)
                }}
                onDragLeave={() => setDropTarget((current) => (current === status ? null : current))}
                onDrop={(event) => {
                  event.preventDefault()
                  if (canManage) handleDrop(status)
                }}
                className={`rounded-xl border border-dashed p-2 transition-colors ${
                  dropTarget === status ? "border-primary bg-primary/5" : "border-border"
                }`}
              >
                <h3 className="flex items-center justify-between px-1 py-2 text-sm font-medium">
                  {TASK_STATUS_LABELS[status]}
                  <span className="text-xs text-muted-foreground">{items.length}</span>
                </h3>

                <div className="space-y-2">
                  {items.map((task) => (
                    <article
                      key={task.id}
                      draggable={canManage}
                      onDragStart={() => setDragging(task.id)}
                      onDragEnd={() => {
                        setDragging(null)
                        setDropTarget(null)
                      }}
                      className={`rounded-lg border border-border bg-card p-3 text-left shadow-sm transition-opacity ${
                        dragging === task.id ? "opacity-40" : ""
                      } ${canManage ? "cursor-grab active:cursor-grabbing" : ""}`}
                    >
                      <div className="flex items-start justify-between gap-1">
                        {/* A button, not a click handler on the card, so the keyboard reaches it. */}
                        <button
                          type="button"
                          onClick={() => setViewing(task)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <span className="text-sm font-medium leading-snug">{task.title}</span>
                        </button>
                        <TaskActions task={task} />
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <PriorityBadge priority={task.priority} />
                        {task.dueDate && <DueDate task={task} />}
                      </div>

                      {(task.post || task.project || task.client) && (
                        <p className="mt-2 truncate">
                          <LinkedTo task={task} />
                        </p>
                      )}

                      {task.assignees.length > 0 && (
                        <div className="mt-2">
                          <Assignees task={task} compact />
                        </div>
                      )}
                    </article>
                  ))}

                  {items.length === 0 && (
                    <p className="px-1 py-6 text-center text-xs text-muted-foreground">
                      {canManage ? "Drop a task here" : "Nothing here"}
                    </p>
                  )}
                </div>
              </section>
            )
          })}
        </div>
      ) : viewMode === "cards" ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {tasks.map((task) => (
            <Card key={task.id} className={task.status === "DONE" ? "opacity-70" : ""}>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setViewing(task)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span
                      className={`block text-sm font-medium leading-snug ${
                        task.status === "DONE" ? "line-through" : ""
                      }`}
                    >
                      {task.title}
                    </span>
                  </button>
                  <PriorityBadge priority={task.priority} />
                  <TaskActions task={task} />
                </div>

                {task.description && (
                  <p className="line-clamp-3 text-xs text-muted-foreground">{task.description}</p>
                )}

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <DueDate task={task} />
                  <LinkedTo task={task} />
                </div>

                <Assignees task={task} />
                <StatusSelect task={task} />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Task</TableHead>
                    <TableHead className="hidden md:table-cell">Linked to</TableHead>
                    <TableHead className="hidden lg:table-cell">Assignees</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Due</TableHead>
                    <TableHead className="w-[160px]">Status</TableHead>
                    <TableHead className="w-[60px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tasks.map((task) => (
                    <TableRow key={task.id} className={task.status === "DONE" ? "opacity-70" : ""}>
                      <TableCell>
                        <button
                          type="button"
                          onClick={() => setViewing(task)}
                          className="text-left text-sm font-medium hover:underline"
                        >
                          <span className={task.status === "DONE" ? "line-through" : ""}>
                            {task.title}
                          </span>
                        </button>
                        <span className="mt-0.5 block md:hidden">
                          <LinkedTo task={task} />
                        </span>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <LinkedTo task={task} />
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <Assignees task={task} />
                      </TableCell>
                      <TableCell>
                        <PriorityBadge priority={task.priority} />
                      </TableCell>
                      <TableCell>
                        <DueDate task={task} />
                      </TableCell>
                      <TableCell>
                        <StatusSelect task={task} />
                      </TableCell>
                      <TableCell className="text-right">
                        <TaskActions task={task} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <TaskDetail
        task={viewing}
        open={!!viewing}
        onOpenChange={(open) => !open && setViewing(null)}
        onEdit={openEdit}
        onDelete={setDeleting}
        canManage={perms.update}
      />

      <TaskForm
        open={formOpen}
        onOpenChange={setFormOpen}
        task={editing}
        onSaved={() => mutate()}
        canManage={perms.update}
      />

      <AlertDialog open={Boolean(blockingTarget)} onOpenChange={(open) => !open && setBlockingTarget(null)}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Mark Task as Blocked
            </AlertDialogTitle>
            <AlertDialogDescription>
              Please specify why &ldquo;{blockingTarget?.task.title}&rdquo; is blocked and cannot proceed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">Blocker Category *</Label>
              <Select value={blockerCategory} onValueChange={setBlockerCategory}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TECHNICAL_ISSUE">Technical Issue</SelectItem>
                  <SelectItem value="DEPENDENCY">Dependency / Waiting on Others</SelectItem>
                  <SelectItem value="APPROVAL_PENDING">Approval Pending</SelectItem>
                  <SelectItem value="MISSING_INFORMATION">Missing Information / Brief</SelectItem>
                  <SelectItem value="RESOURCE_ISSUE">Resource / Asset Missing</SelectItem>
                  <SelectItem value="OTHER">Other Reason</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">Blocker Reason / Details *</Label>
              <Textarea
                placeholder="What is stopping this task? Mention who or what is needed to unblock it..."
                value={blockerReason}
                onChange={(e) => setBlockerReason(e.target.value)}
                rows={3}
                className="text-sm"
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy} onClick={() => setBlockingTarget(null)}>
              Cancel
            </AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={!blockerReason.trim() || busy}
              onClick={confirmBlock}
            >
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Confirm Blocker
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{deleting?.title}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone.
              {deleting?.assignees.length
                ? ` ${deleting.assignees.map((user) => user.name ?? user.email).join(", ")} will no longer see it.`
                : ""}
            </AlertDialogDescription>
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
    </div>
  )
}
