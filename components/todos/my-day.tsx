"use client"

import { jsonFetcher } from "@/lib/fetcher";
import { useState } from "react"
import useSWR from "swr"
import toast from "react-hot-toast"
import {
  AlertTriangle,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Flag,
  Link2,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  SlidersHorizontal,
  Table as TableIcon,
  Trash2,
  User,
  Users,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import TodoDetailSheet, { type TodoDetailItem } from "@/components/todos/todo-detail-sheet"
import TodoFormDialog from "@/components/todos/todo-form-dialog"
import BlockerDialog from "@/components/todos/blocker-dialog"
import TeamTodosTable from "@/components/todos/team-todos-table"
import {
  TODO_PRIORITIES,
  type TaskPriority,
  type TodoStatus,
} from "@/lib/validation/todo"

// Throws on non-2xx, so a failed load is an error state, not an empty list.
const fetcher = (url: string) => jsonFetcher(url);

const STATUS_CONFIG: Record<TodoStatus, { label: string; class: string }> = {
  PENDING: { label: "Not Started", class: "bg-muted text-muted-foreground border-transparent" },
  IN_PROGRESS: { label: "In Progress", class: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 border-transparent" },
  BLOCKED: { label: "Blocked", class: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 border-transparent" },
  DONE: { label: "Done", class: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-transparent" },
  CARRIED_OVER: { label: "Carried Over", class: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300 border-transparent" },
}

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; class: string }> = {
  LOW: { label: "Low", class: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-transparent" },
  MEDIUM: { label: "Medium", class: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border-transparent" },
  HIGH: { label: "High", class: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-transparent" },
  URGENT: { label: "Urgent", class: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 border-transparent" },
}

interface Summary {
  total: number
  done: number
  inProgress: number
  blocked: number
  carried: number
  completion: number
}

function SummaryBar({ s }: { s: Summary }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <span>
        <strong className="text-foreground">{s.done}</strong> of {s.total} done
      </span>
      {s.inProgress > 0 && <span>{s.inProgress} in progress</span>}
      {s.carried > 0 && <span>{s.carried} carried over</span>}
      {s.blocked > 0 && (
        <span className="font-semibold text-destructive flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          {s.blocked} blocked
        </span>
      )}
      <span className="ml-auto tabular-nums font-medium">{s.completion}% completed</span>
    </div>
  )
}

interface PersonalTodoRowProps {
  todo: TodoDetailItem
  busy: boolean
  onToggleDone: (todo: TodoDetailItem) => void
  onPatchProgress: (id: string, progress: number) => void
  onOpenDetails: (todo: TodoDetailItem) => void
  onAddBlocker: (todo: TodoDetailItem) => void
  onRemove: (id: string) => void
}

function PersonalTodoRow({
  todo,
  busy,
  onToggleDone,
  onPatchProgress,
  onOpenDetails,
  onAddBlocker,
  onRemove,
}: PersonalTodoRowProps) {
  const done = todo.status === "DONE"
  const activeBlockers = (todo.blockers || []).filter(
    (b) => b.status === "OPEN" || b.status === "IN_PROGRESS",
  )
  const isBlocked = todo.status === "BLOCKED" || activeBlockers.length > 0 || Boolean(todo.blocker)

  return (
    <li className="group py-3 space-y-2 hover:bg-muted/20 px-2 rounded-lg transition-colors">
      <div className="flex items-start gap-3">
        {/* Checkbox toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 mt-0.5"
          aria-label={done ? `Reopen ${todo.title}` : `Mark ${todo.title} done`}
          disabled={busy}
          onClick={() => onToggleDone(todo)}
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <span
              className={`flex h-4 w-4 items-center justify-center rounded border transition-colors ${
                done
                  ? "border-emerald-600 bg-emerald-600 text-white"
                  : "border-muted-foreground/40 hover:border-foreground"
              }`}
            >
              {done && <Check className="h-3 w-3 stroke-[3]" />}
            </span>
          )}
        </Button>

        {/* Title, tags, blocker alert */}
        <div className="min-w-0 flex-1 cursor-pointer" onClick={() => onOpenDetails(todo)}>
          <p
            className={`text-sm font-medium leading-snug transition-colors ${
              done ? "text-muted-foreground line-through" : "text-foreground hover:text-primary"
            }`}
          >
            {todo.title}
          </p>

          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {/* Status */}
            <Badge
              variant="outline"
              className={`text-xs py-0 px-1.5 font-medium ${STATUS_CONFIG[todo.status]?.class}`}
            >
              {STATUS_CONFIG[todo.status]?.label}
            </Badge>

            {/* Priority */}
            <Badge
              variant="outline"
              className={`text-xs py-0 px-1.5 font-medium ${PRIORITY_CONFIG[todo.priority]?.class}`}
            >
              <Flag className="mr-1 h-2.5 w-2.5" />
              {PRIORITY_CONFIG[todo.priority]?.label}
            </Badge>

            {/* Task Link */}
            {todo.task && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Link2 className="h-3 w-3" aria-hidden="true" />
                {todo.task.project?.name ?? "Task"}
              </span>
            )}

            {/* Active Blocker Indicator Button */}
            {isBlocked && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onOpenDetails(todo)
                }}
                className="inline-flex items-center gap-1 text-xs font-semibold text-destructive bg-destructive/10 px-2 py-0.5 rounded hover:bg-destructive/20 transition-colors"
              >
                <AlertTriangle className="h-3 w-3" />
                {activeBlockers.length > 0
                  ? activeBlockers[0].title
                  : todo.blocker || "Blocked"}
              </button>
            )}
          </div>
        </div>

        {/* Right actions */}
        <div className="flex shrink-0 items-center gap-1.5">
          {/* Progress selector */}
          <Select
            value={String(todo.progress)}
            onValueChange={(v) => onPatchProgress(todo.id, Number(v))}
            disabled={done || busy}
          >
            <SelectTrigger
              className="h-7 w-[80px] text-xs font-medium"
              aria-label={`Progress on ${todo.title}`}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[0, 10, 25, 50, 75, 90, 100].map((p) => (
                <SelectItem key={p} value={String(p)}>
                  {p}%
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Add Blocker quick action */}
          {!done && (
            <Button aria-label="Add Blocker"
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              title="Add Blocker"
              onClick={() => onAddBlocker(todo)}
            >
              <AlertTriangle className="h-3.5 w-3.5" />
            </Button>
          )}

          {/* More actions menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button aria-label="More actions for this to-do" variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground">
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40 text-xs">
              <DropdownMenuItem onClick={() => onOpenDetails(todo)}>
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAddBlocker(todo)}>
                <AlertTriangle className="mr-2 h-3.5 w-3.5 text-destructive" />
                Add Blocker
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onRemove(todo.id)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-3.5 w-3.5" />
                Remove
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Progress value={done ? 100 : todo.progress} className="h-1 bg-muted/50" />
    </li>
  )
}

export default function MyDay({ canSeeTeam = false }: { canSeeTeam: boolean }) {
  const [view, setView] = useState<"mine" | "team">("mine")
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10))

  // Quick add form state
  const [quickTitle, setQuickTitle] = useState("")
  const [quickPriority, setQuickPriority] = useState<TaskPriority>("MEDIUM")
  const [adding, setAdding] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  // Modals & Drawers state
  const [viewingTodo, setViewingTodo] = useState<TodoDetailItem | null>(null)
  const [editingTodo, setEditingTodo] = useState<TodoDetailItem | null>(null)
  const [formDialogOpen, setFormDialogOpen] = useState(false)
  const [blockerTodo, setBlockerTodo] = useState<TodoDetailItem | null>(null)
  const [blockerModalOpen, setBlockerModalOpen] = useState(false)

  // Fetch personal todos for selected date
  const { data, error, isLoading, mutate } = useSWR<{
    todos?: TodoDetailItem[]
    summary?: Summary
    sync?: { added: number; carried: number }
    canSeeTeam?: boolean
    canUpdate?: boolean
    canDelete?: boolean
    error?: string
  }>(`/api/todos?date=${selectedDate}`, fetcher)

  const todos = data?.todos || []
  const summary = data?.summary

  // Date navigation helpers
  const shiftDate = (days: number) => {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() + days)
    setSelectedDate(d.toISOString().slice(0, 10))
  }

  const isToday = selectedDate === new Date().toISOString().slice(0, 10)

  // Patch progress or status
  const patch = async (id: string, body: Record<string, unknown>) => {
    setBusyId(id)
    try {
      const res = await fetch(`/api/todos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? "Could not save")
        return
      }
      mutate()
    } catch {
      toast.error("Network error — please try again")
    } finally {
      setBusyId(null)
    }
  }

  // Quick Add submit
  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!quickTitle.trim()) return

    setAdding(true)
    try {
      const res = await fetch("/api/todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: quickTitle.trim(),
          priority: quickPriority,
          date: selectedDate,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? "Could not add todo")
        return
      }
      setQuickTitle("")
      setQuickPriority("MEDIUM")
      toast.success("Todo added to today's plan")
      mutate()
    } catch {
      toast.error("Network error — please try again")
    } finally {
      setAdding(false)
    }
  }

  // Remove todo
  const remove = async (id: string) => {
    setBusyId(id)
    try {
      const res = await fetch(`/api/todos/${id}`, { method: "DELETE" })
      if (!res.ok) {
        const j = await res.json()
        toast.error(j.error ?? "Could not remove todo")
        return
      }
      toast.success("Todo removed")
      mutate()
    } catch {
      toast.error("Network error — please try again")
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-5">
      {/* View Switcher for Administrators */}
      {canSeeTeam && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex rounded-lg border border-border bg-muted/40 p-1">
            <Button
              variant={view === "mine" ? "default" : "ghost"}
              size="sm"
              onClick={() => setView("mine")}
              className="h-8 text-xs font-medium gap-1.5"
            >
              <User className="h-3.5 w-3.5" />
              My Day (Personal)
            </Button>
            <Button
              variant={view === "team" ? "default" : "ghost"}
              size="sm"
              onClick={() => setView("team")}
              className="h-8 text-xs font-medium gap-1.5"
            >
              <Users className="h-3.5 w-3.5" />
              Team Management Table
            </Button>
          </div>

          {view === "mine" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEditingTodo(null)
                setFormDialogOpen(true)
              }}
              className="h-8 text-xs gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Todo with Details
            </Button>
          )}
        </div>
      )}

      {/* Admin Team Table View */}
      {view === "team" && canSeeTeam ? (
        <TeamTodosTable canUpdate={data?.canUpdate ?? true} canDelete={data?.canDelete ?? true} />
      ) : (
        /* Personal My Day View */
        <Card className="shadow-sm border-border">
          <CardHeader className="pb-3 border-b border-border/60">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base font-semibold">
                  {isToday ? "Today's Plan" : "Daily Plan"}
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Keep track of what you plan to accomplish and report any blockers immediately.
                </p>
              </div>

              {/* Date Navigation */}
              <div className="flex items-center gap-1.5 self-start sm:self-auto">
                <Button aria-label="Previous Day"
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => shiftDate(-1)}
                  title="Previous Day"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>

                {!isToday && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs font-medium"
                    onClick={() => setSelectedDate(new Date().toISOString().slice(0, 10))}
                  >
                    Today
                  </Button>
                )}

                <Input aria-label="Day to show"
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="h-7 w-[130px] text-xs font-medium"
                />

                <Button aria-label="Next Day"
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => shiftDate(1)}
                  title="Next Day"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Scorecard & Sync notifications */}
            {summary && (
              <div className="pt-2">
                <SummaryBar s={summary} />
              </div>
            )}

            {!!data?.sync?.added && (
              <p className="text-xs text-muted-foreground pt-1">
                {data.sync.added} task{data.sync.added === 1 ? "" : "s"} due today mirrored automatically.
              </p>
            )}
            {!!data?.sync?.carried && (
              <p className="text-xs text-muted-foreground pt-1">
                {data.sync.carried} unfinished item{data.sync.carried === 1 ? "" : "s"} carried over from yesterday.
              </p>
            )}
          </CardHeader>

          <CardContent className="pt-4 space-y-4">
            {/* Quick Add Form */}
            <form onSubmit={handleQuickAdd} className="flex flex-col sm:flex-row gap-2">
              <Label htmlFor="quick-todo-input" className="sr-only">
                Add a todo item
              </Label>
              <Input
                id="quick-todo-input"
                placeholder="What else are you working on today?"
                value={quickTitle}
                onChange={(e) => setQuickTitle(e.target.value)}
                className="h-9 text-sm flex-1"
              />

              <div className="flex items-center gap-2">
                <Select
                  value={quickPriority}
                  onValueChange={(val) => setQuickPriority(val as TaskPriority)}
                >
                  <SelectTrigger aria-label="Priority" className="h-9 w-[110px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TODO_PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p}>
                        {PRIORITY_CONFIG[p].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button
                  type="submit"
                  disabled={adding || !quickTitle.trim()}
                  className="h-9 gap-1.5 text-xs font-medium"
                >
                  {adding ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  Add
                </Button>

                <Button aria-label="Full details form"
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground"
                  title="Full details form"
                  onClick={() => {
                    setEditingTodo(null)
                    setFormDialogOpen(true)
                  }}
                >
                  <SlidersHorizontal className="h-4 w-4" />
                </Button>
              </div>
            </form>

            {/* Todo Items List */}
            {isLoading ? (
              <div className="space-y-3 py-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-lg" />
                ))}
              </div>
            ) : todos.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground space-y-2">
                <Calendar className="mx-auto h-8 w-8 text-muted-foreground/30" />
                <p className="text-sm font-medium text-foreground">Nothing planned for this day.</p>
                <p className="text-xs max-w-sm mx-auto">
                  Add what you plan to work on, or any assigned tasks due today will automatically show up.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-border/60">
                {todos.map((todo) => (
                  <PersonalTodoRow
                    key={todo.id}
                    todo={todo}
                    busy={busyId === todo.id}
                    onToggleDone={(t) =>
                      patch(t.id, {
                        status: t.status === "DONE" ? "IN_PROGRESS" : "DONE",
                      })
                    }
                    onPatchProgress={(id, progress) =>
                      patch(id, {
                        progress,
                        ...(progress === 100 ? { status: "DONE" } : {}),
                      })
                    }
                    onOpenDetails={(t) => setViewingTodo(t)}
                    onAddBlocker={(t) => {
                      setBlockerTodo(t)
                      setBlockerModalOpen(true)
                    }}
                    onRemove={remove}
                  />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {/* Todo Details Sheet */}
      <TodoDetailSheet
        open={Boolean(viewingTodo)}
        onOpenChange={(open) => !open && setViewingTodo(null)}
        todo={viewingTodo}
        canEdit={true}
        canDelete={true}
        onMutate={() => {
          mutate()
          if (viewingTodo) {
            fetch(`/api/todos?userId=${viewingTodo.userId}&date=${new Date(viewingTodo.date).toISOString()}`)
              .then((r) => r.json())
              .then((res) => {
                const refreshed = (res.todos || []).find((t: any) => t.id === viewingTodo.id)
                if (refreshed) setViewingTodo(refreshed)
              })
              .catch(() => {})
          }
        }}
        onOpenEditForm={(t) => {
          setViewingTodo(null)
          setEditingTodo(t)
          setFormDialogOpen(true)
        }}
      />

      {/* Create / Edit Todo Dialog */}
      <TodoFormDialog
        open={formDialogOpen}
        onOpenChange={setFormDialogOpen}
        todo={editingTodo}
        defaultDate={selectedDate}
        onSuccess={() => mutate()}
      />

      {/* Add Blocker Dialog */}
      {blockerTodo && (
        <BlockerDialog
          open={blockerModalOpen}
          onOpenChange={setBlockerModalOpen}
          todoId={blockerTodo.id}
          todoTitle={blockerTodo.title}
          onSuccess={() => {
            mutate()
            setBlockerTodo(null)
          }}
        />
      )}
    </div>
  )
}
