"use client"

import { useState, useEffect } from "react"
import toast from "react-hot-toast"
import { Calendar, Flag, Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  TODO_PRIORITIES,
  TODO_STATUSES,
  type TaskPriority,
  type TodoStatus,
} from "@/lib/validation/todo"

export interface TodoData {
  id?: string
  title: string
  notes?: string | null
  date?: string | Date
  priority?: TaskPriority
  status?: TodoStatus
  progress?: number
  userId?: number
}

interface UserOption {
  id: number
  name: string | null
  email: string
}

interface TodoFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  todo?: TodoData | null
  defaultDate?: string
  canAssignUser?: boolean
  teamMembers?: UserOption[]
  onSuccess: () => void
}

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  LOW: "Low Priority",
  MEDIUM: "Medium Priority",
  HIGH: "High Priority",
  URGENT: "Urgent Priority",
}

const STATUS_LABELS: Record<TodoStatus, string> = {
  PENDING: "Pending / To Do",
  IN_PROGRESS: "In Progress",
  BLOCKED: "Blocked",
  DONE: "Completed",
  CARRIED_OVER: "Carried Over",
}

export default function TodoFormDialog({
  open,
  onOpenChange,
  todo,
  defaultDate,
  canAssignUser = false,
  teamMembers = [],
  onSuccess,
}: TodoFormDialogProps) {
  const isEditing = Boolean(todo?.id)
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [title, setTitle] = useState("")
  const [notes, setNotes] = useState("")
  const [date, setDate] = useState("")
  const [priority, setPriority] = useState<TaskPriority>("MEDIUM")
  const [status, setStatus] = useState<TodoStatus>("PENDING")
  const [progress, setProgress] = useState(0)
  const [userId, setUserId] = useState<string>("")

  useEffect(() => {
    if (open) {
      if (todo) {
        setTitle(todo.title || "")
        setNotes(todo.notes || "")
        setDate(
          todo.date
            ? new Date(todo.date).toISOString().slice(0, 10)
            : defaultDate || new Date().toISOString().slice(0, 10),
        )
        setPriority(todo.priority || "MEDIUM")
        setStatus(todo.status || "PENDING")
        setProgress(todo.progress || 0)
        setUserId(todo.userId ? String(todo.userId) : "")
      } else {
        setTitle("")
        setNotes("")
        setDate(defaultDate || new Date().toISOString().slice(0, 10))
        setPriority("MEDIUM")
        setStatus("PENDING")
        setProgress(0)
        setUserId("")
      }
      setErrors({})
    }
  }, [open, todo, defaultDate])

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!title.trim()) {
      errs.title = "Todo title is required"
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setBusy(true)
    try {
      const payload: Record<string, unknown> = {
        title: title.trim(),
        notes: notes.trim() || null,
        date: date || undefined,
        priority,
        status,
      }

      if (isEditing) {
        payload.progress = status === "DONE" ? 100 : progress
      }

      if (userId && canAssignUser) {
        payload.userId = Number(userId)
      }

      const url = isEditing ? `/api/todos/${todo!.id}` : "/api/todos"
      const method = isEditing ? "PATCH" : "POST"

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? "Failed to save todo")
        return
      }

      toast.success(isEditing ? "Todo updated" : "Todo planned successfully")
      onOpenChange(false)
      onSuccess()
    } catch {
      toast.error("Network error — please try again")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEditing ? "Edit Todo Item" : "Add New Todo"}</DialogTitle>
            <DialogDescription>
              {isEditing
                ? "Update task details, priority, and completion status."
                : "Plan work for today with clear priorities and notes."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Title */}
            <div className="space-y-1.5">
              <Label htmlFor="todo-title" className={errors.title ? "text-destructive font-medium" : ""}>
                Todo Title *
              </Label>
              <Input
                id="todo-title"
                placeholder="What needs to get done?"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value)
                  if (errors.title) setErrors((prev) => ({ ...prev, title: "" }))
                }}
                className={errors.title ? "border-destructive focus-visible:ring-destructive" : ""}
                autoFocus
              />
              {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
            </div>

            {/* Description / Notes */}
            <div className="space-y-1.5">
              <Label htmlFor="todo-notes">Description / Notes (Optional)</Label>
              <Textarea
                id="todo-notes"
                placeholder="Key details, deliverables, links, or context..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>

            {/* Date & Priority */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="todo-date" className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  Target Date
                </Label>
                <Input
                  id="todo-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="todo-priority" className="flex items-center gap-1.5">
                  <Flag className="h-3.5 w-3.5 text-muted-foreground" />
                  Priority
                </Label>
                <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                  <SelectTrigger id="todo-priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TODO_PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p}>
                        {PRIORITY_LABELS[p]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Status (and progress if editing) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="todo-status">Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as TodoStatus)}>
                  <SelectTrigger id="todo-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TODO_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {STATUS_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {isEditing ? (
                <div className="space-y-1.5">
                  <Label htmlFor="todo-progress">Progress ({progress}%)</Label>
                  <Select
                    value={String(progress)}
                    onValueChange={(v) => setProgress(Number(v))}
                    disabled={status === "DONE"}
                  >
                    <SelectTrigger id="todo-progress">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[0, 10, 25, 50, 75, 90, 100].map((p) => (
                        <SelectItem key={p} value={String(p)}>
                          {p}% Completed
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
            </div>

            {/* Optional Team Member Assignment (for administrators/managers) */}
            {canAssignUser && teamMembers.length > 0 && (
              <div className="space-y-1.5">
                <Label htmlFor="todo-user">Plan for Team Member</Label>
                <Select value={userId} onValueChange={setUserId}>
                  <SelectTrigger id="todo-user">
                    <SelectValue placeholder="Myself (Default)" />
                  </SelectTrigger>
                  <SelectContent>
                    {teamMembers.map((m) => (
                      <SelectItem key={m.id} value={String(m.id)}>
                        {m.name || m.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !title.trim()}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Save Changes" : "Create Todo"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
