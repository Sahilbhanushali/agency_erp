"use client"

import { useState } from "react"
import toast from "react-hot-toast"
import {
  AlertTriangle,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  Flag,
  HelpCircle,
  Link2,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  User,
  XCircle,
} from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
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
import BlockerDialog, { type BlockerData } from "@/components/todos/blocker-dialog"
import {
  type BlockerCategory,
  type BlockerStatus,
  type TaskPriority,
  type TodoStatus,
} from "@/lib/validation/todo"

export interface TodoDetailItem {
  id: string
  userId: number
  date: string | Date
  title: string
  notes?: string | null
  status: TodoStatus
  priority: TaskPriority
  progress: number
  blocker?: string | null
  taskId?: string | null
  completedAt?: string | null
  createdAt: string | Date
  updatedAt: string | Date
  user: { id: number; name: string | null; email: string; avatar?: string | null }
  task?: {
    id: string
    title: string
    status: string
    priority: string
    dueDate?: string | null
    project?: { id: string; name: string } | null
    post?: { id: string; title: string } | null
  } | null
  blockers?: BlockerData[]
}

interface TodoDetailSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  todo: TodoDetailItem | null
  canEdit?: boolean
  canDelete?: boolean
  onMutate: () => void
  onOpenEditForm?: (todo: TodoDetailItem) => void
}

const PRIORITY_STYLE: Record<TaskPriority, { label: string; class: string }> = {
  LOW: { label: "Low", class: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  MEDIUM: { label: "Medium", class: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300" },
  HIGH: { label: "High", class: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" },
  URGENT: { label: "Urgent", class: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300" },
}

const STATUS_STYLE: Record<TodoStatus, { label: string; class: string }> = {
  PENDING: { label: "Not Started", class: "bg-muted text-muted-foreground" },
  IN_PROGRESS: { label: "In Progress", class: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300" },
  BLOCKED: { label: "Blocked", class: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300" },
  DONE: { label: "Completed", class: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" },
  CARRIED_OVER: { label: "Carried Over", class: "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300" },
}

const BLOCKER_STATUS_BADGES: Record<BlockerStatus, { label: string; class: string }> = {
  OPEN: { label: "Open", class: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300" },
  IN_PROGRESS: { label: "In Progress", class: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" },
  RESOLVED: { label: "Resolved", class: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" },
}

const CATEGORY_NAMES: Record<BlockerCategory, string> = {
  TECHNICAL_ISSUE: "Technical Issue",
  DEPENDENCY: "Dependency",
  APPROVAL_PENDING: "Approval Pending",
  MISSING_INFORMATION: "Missing Info",
  RESOURCE_ISSUE: "Resource Missing",
  OTHER: "Other",
}

export default function TodoDetailSheet({
  open,
  onOpenChange,
  todo,
  canEdit = true,
  canDelete = true,
  onMutate,
  onOpenEditForm,
}: TodoDetailSheetProps) {
  const [busy, setBusy] = useState(false)
  const [blockerModalOpen, setBlockerModalOpen] = useState(false)
  const [editingBlocker, setEditingBlocker] = useState<BlockerData | null>(null)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [deletingBlockerId, setDeletingBlockerId] = useState<string | null>(null)

  if (!todo) return null

  const done = todo.status === "DONE"
  const blockers = todo.blockers || []
  const activeBlockers = blockers.filter((b) => b.status === "OPEN" || b.status === "IN_PROGRESS")
  const resolvedBlockers = blockers.filter((b) => b.status === "RESOLVED")

  const patchTodo = async (body: Record<string, unknown>) => {
    setBusy(true)
    try {
      const res = await fetch(`/api/todos/${todo.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? "Failed to update todo")
        return
      }
      toast.success("Todo updated")
      onMutate()
    } catch {
      toast.error("Network error — please try again")
    } finally {
      setBusy(false)
    }
  }

  const handleDeleteTodo = async () => {
    setBusy(true)
    try {
      const res = await fetch(`/api/todos/${todo.id}`, { method: "DELETE" })
      if (!res.ok) {
        const j = await res.json()
        toast.error(j.error ?? "Could not delete todo")
        return
      }
      toast.success("Todo deleted")
      setConfirmDeleteOpen(false)
      onOpenChange(false)
      onMutate()
    } catch {
      toast.error("Network error — please try again")
    } finally {
      setBusy(false)
    }
  }

  const handleResolveBlocker = async (b: BlockerData) => {
    setBusy(true)
    try {
      const res = await fetch(`/api/todos/${todo.id}/blockers/${b.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "RESOLVED" }),
      })
      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error ?? "Could not resolve blocker")
        return
      }
      toast.success("Blocker marked as resolved")
      onMutate()
    } catch {
      toast.error("Network error — please try again")
    } finally {
      setBusy(false)
    }
  }

  const handleReopenBlocker = async (b: BlockerData) => {
    setBusy(true)
    try {
      const res = await fetch(`/api/todos/${todo.id}/blockers/${b.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "OPEN" }),
      })
      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error ?? "Could not reopen blocker")
        return
      }
      toast.success("Blocker reopened")
      onMutate()
    } catch {
      toast.error("Network error — please try again")
    } finally {
      setBusy(false)
    }
  }

  const handleDeleteBlocker = async (blockerId: string) => {
    setBusy(true)
    try {
      const res = await fetch(`/api/todos/${todo.id}/blockers/${blockerId}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error ?? "Could not delete blocker")
        return
      }
      toast.success("Blocker removed")
      setDeletingBlockerId(null)
      onMutate()
    } catch {
      toast.error("Network error — please try again")
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="sm:max-w-lg overflow-y-auto flex flex-col justify-between p-6">
          <div className="space-y-6">
            <SheetHeader className="text-left space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className={`border-transparent font-medium text-xs ${STATUS_STYLE[todo.status]?.class || ""}`}
                >
                  {STATUS_STYLE[todo.status]?.label || todo.status}
                </Badge>
                <Badge
                  variant="outline"
                  className={`border-transparent font-medium text-xs ${PRIORITY_STYLE[todo.priority]?.class || ""}`}
                >
                  <Flag className="mr-1 h-3 w-3" />
                  {PRIORITY_STYLE[todo.priority]?.label || todo.priority}
                </Badge>
                {activeBlockers.length > 0 && (
                  <Badge variant="destructive" className="text-xs flex items-center gap-1 font-medium">
                    <AlertTriangle className="h-3 w-3" />
                    {activeBlockers.length} Active Blocker{activeBlockers.length === 1 ? "" : "s"}
                  </Badge>
                )}
              </div>

              <SheetTitle className="text-xl font-semibold leading-snug">
                {todo.title}
              </SheetTitle>

              <SheetDescription className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  <User className="h-3.5 w-3.5" />
                  {todo.user.name || todo.user.email}
                </span>
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" />
                  {new Date(todo.date).toLocaleDateString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </SheetDescription>
            </SheetHeader>

            {/* Progress & Quick Complete Button */}
            <div className="space-y-2 rounded-lg border border-border p-3.5 bg-muted/20">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-muted-foreground">Progress</span>
                <span className="font-semibold tabular-nums">{done ? 100 : todo.progress}%</span>
              </div>
              <Progress value={done ? 100 : todo.progress} className="h-2" />
              {canEdit && (
                <div className="flex items-center justify-between pt-1">
                  <Button
                    variant={done ? "outline" : "default"}
                    size="sm"
                    className="h-8 text-xs gap-1.5"
                    disabled={busy}
                    onClick={() => patchTodo({ status: done ? "IN_PROGRESS" : "DONE" })}
                  >
                    <Check className="h-3.5 w-3.5" />
                    {done ? "Reopen Todo" : "Mark as Completed"}
                  </Button>

                  {!done && (
                    <div className="flex items-center gap-1">
                      {[25, 50, 75, 100].map((p) => (
                        <Button
                          key={p}
                          variant={todo.progress === p ? "secondary" : "ghost"}
                          size="sm"
                          className="h-7 px-2 text-xs"
                          disabled={busy}
                          onClick={() => patchTodo({ progress: p, ...(p === 100 ? { status: "DONE" } : {}) })}
                        >
                          {p}%
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Notes / Description */}
            <div className="space-y-1.5">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Description / Notes
              </h4>
              {todo.notes ? (
                <p className="text-sm whitespace-pre-wrap rounded-md bg-muted/40 p-3 text-foreground leading-relaxed">
                  {todo.notes}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground italic">No description provided.</p>
              )}
            </div>

            {/* Linked Task Context */}
            {todo.task && (
              <div className="space-y-1.5 rounded-lg border border-border p-3 text-xs bg-card">
                <div className="flex items-center justify-between">
                  <span className="font-semibold flex items-center gap-1.5 text-foreground">
                    <Link2 className="h-3.5 w-3.5 text-primary" />
                    Linked Kanban Task
                  </span>
                  <Badge variant="outline" className="text-[10px]">
                    {todo.task.status}
                  </Badge>
                </div>
                <p className="font-medium text-foreground">{todo.task.title}</p>
                {todo.task.project && (
                  <p className="text-muted-foreground">Project: {todo.task.project.name}</p>
                )}
              </div>
            )}

            <Separator />

            {/* Dedicated Blocker Management Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold flex items-center gap-1.5 text-foreground">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                    Blockers ({blockers.length})
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Issues stopping or impacting completion of this todo.
                  </p>
                </div>
                {canEdit && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1 text-xs border-destructive/30 hover:bg-destructive/10 text-destructive"
                    onClick={() => {
                      setEditingBlocker(null)
                      setBlockerModalOpen(true)
                    }}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Blocker
                  </Button>
                )}
              </div>

              {blockers.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground space-y-2">
                  <CheckCircle2 className="mx-auto h-7 w-7 text-emerald-500 opacity-80" />
                  <p className="font-medium text-foreground">No Blockers Recorded</p>
                  <p>Work is progressing smoothly without documented impediments.</p>
                  {canEdit && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2 text-xs"
                      onClick={() => {
                        setEditingBlocker(null)
                        setBlockerModalOpen(true)
                      }}
                    >
                      Report a Blocker
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {blockers.map((b) => {
                    const isResolved = b.status === "RESOLVED"
                    return (
                      <div
                        key={b.id}
                        className={`rounded-lg border p-3.5 text-xs transition-all space-y-2 ${
                          isResolved
                            ? "border-emerald-500/20 bg-emerald-500/5 opacity-85"
                            : "border-destructive/30 bg-destructive/5 shadow-sm"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <Badge
                                variant="outline"
                                className={`text-[10px] border-transparent font-medium ${BLOCKER_STATUS_BADGES[b.status]?.class}`}
                              >
                                {BLOCKER_STATUS_BADGES[b.status]?.label}
                              </Badge>
                              <Badge variant="secondary" className="text-[10px]">
                                {CATEGORY_NAMES[b.category]}
                              </Badge>
                              {b.createdAt && (
                                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {new Date(b.createdAt).toLocaleDateString(undefined, {
                                    month: "short",
                                    day: "numeric",
                                  })}
                                </span>
                              )}
                            </div>
                            <h5 className={`font-semibold text-sm ${isResolved ? "line-through text-muted-foreground" : "text-foreground"}`}>
                              {b.title}
                            </h5>
                          </div>

                          {canEdit && (
                            <div className="flex items-center gap-1 shrink-0">
                              {isResolved ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs text-muted-foreground hover:text-foreground"
                                  title="Reopen blocker"
                                  disabled={busy}
                                  onClick={() => handleReopenBlocker(b)}
                                >
                                  <RefreshCw className="h-3.5 w-3.5 mr-1" />
                                  Reopen
                                </Button>
                              ) : (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs border-emerald-600/30 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300"
                                  disabled={busy}
                                  onClick={() => handleResolveBlocker(b)}
                                >
                                  <Check className="h-3.5 w-3.5 mr-1" />
                                  Resolve
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs"
                                onClick={() => {
                                  setEditingBlocker(b)
                                  setBlockerModalOpen(true)
                                }}
                              >
                                Edit
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:bg-destructive/10"
                                onClick={() => setDeletingBlockerId(b.id!)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          )}
                        </div>

                        {b.description && (
                          <p className="text-muted-foreground leading-relaxed">{b.description}</p>
                        )}

                        {(b.impact || b.assistanceRequired || b.responsibleParty) && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-border/50 text-[11px]">
                            {b.impact && (
                              <div>
                                <span className="text-muted-foreground font-medium">Impact: </span>
                                <span>{b.impact}</span>
                              </div>
                            )}
                            {b.assistanceRequired && (
                              <div>
                                <span className="text-muted-foreground font-medium">Help Needed: </span>
                                <span>{b.assistanceRequired}</span>
                              </div>
                            )}
                            {b.responsibleParty && (
                              <div>
                                <span className="text-muted-foreground font-medium">Responsible: </span>
                                <span>{b.responsibleParty}</span>
                              </div>
                            )}
                            {b.expectedResolution && (
                              <div>
                                <span className="text-muted-foreground font-medium">Target ETA: </span>
                                <span>{new Date(b.expectedResolution).toLocaleDateString()}</span>
                              </div>
                            )}
                          </div>
                        )}

                        {isResolved && b.resolutionNotes && (
                          <div className="rounded bg-emerald-500/10 p-2 text-[11px] text-emerald-800 dark:text-emerald-300 border border-emerald-500/20">
                            <strong>Resolution: </strong> {b.resolutionNotes}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          <SheetFooter className="mt-8 flex-col sm:flex-row gap-2 border-t pt-4">
            {canDelete && (
              <Button
                variant="destructive"
                size="sm"
                className="w-full sm:w-auto mr-auto gap-1.5"
                disabled={busy}
                onClick={() => setConfirmDeleteOpen(true)}
              >
                <Trash2 className="h-4 w-4" />
                Delete Todo
              </Button>
            )}

            {canEdit && onOpenEditForm && (
              <Button
                variant="outline"
                size="sm"
                className="w-full sm:w-auto"
                onClick={() => onOpenEditForm(todo)}
              >
                Edit Todo Details
              </Button>
            )}
            <Button
              variant="default"
              size="sm"
              className="w-full sm:w-auto"
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Blocker Modal */}
      <BlockerDialog
        open={blockerModalOpen}
        onOpenChange={setBlockerModalOpen}
        todoId={todo.id}
        todoTitle={todo.title}
        blocker={editingBlocker}
        onSuccess={() => {
          onMutate()
        }}
      />

      {/* Confirm Todo Deletion */}
      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this todo item?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove &ldquo;{todo.title}&rdquo;? Any associated blocker records will also be removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={busy}
              onClick={(e) => {
                e.preventDefault()
                handleDeleteTodo()
              }}
            >
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete Todo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm Blocker Deletion */}
      <AlertDialog open={Boolean(deletingBlockerId)} onOpenChange={(open) => !open && setDeletingBlockerId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this blocker?</AlertDialogTitle>
            <AlertDialogDescription>
              Removing this blocker will adjust the todo&rsquo;s blocked state automatically.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={busy}
              onClick={(e) => {
                e.preventDefault()
                if (deletingBlockerId) handleDeleteBlocker(deletingBlockerId)
              }}
            >
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete Blocker
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
