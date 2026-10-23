"use client"

import { useEffect, useState } from "react"
import useSWR from "swr"
import toast from "react-hot-toast"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { format, isPast } from "date-fns"
import { AlertCircle, CalendarClock, Loader2, Lock, Pencil, Plus, Search, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import DeleteConfirmationDialog from "@/components/dialogs/DeleteConfirmationDialog"

/**
 * Personal todos — visible to their owner and nobody else.
 *
 * Kept apart from the day plan above it on purpose: that plan is shared with managers
 * and summarised in the 7pm report, and these are not. The API scopes every read and
 * write to the signed-in person, so this component never sends a user id at all.
 */

type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT"

interface PersonalTodo {
  id: string
  title: string
  notes: string | null
  priority: Priority
  dueAt: string | null
  completedAt: string | null
  createdAt: string
}

interface ListResponse {
  items: PersonalTodo[]
  overdueCount: number
  openCount: number
}

const PRIORITIES: Priority[] = ["URGENT", "HIGH", "MEDIUM", "LOW"]

const PRIORITY_STYLE: Record<Priority, string> = {
  URGENT: "bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-950 dark:text-rose-200 dark:border-rose-800",
  HIGH: "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800",
  MEDIUM: "bg-sky-100 text-sky-900 border-sky-300 dark:bg-sky-950 dark:text-sky-200 dark:border-sky-800",
  LOW: "bg-muted text-muted-foreground border-border",
}

const label = (p: Priority) => p.charAt(0) + p.slice(1).toLowerCase()

const fetcher = async (url: string) => {
  const res = await fetch(url, { cache: "no-store" })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error ?? "Could not load your todos")
  return body
}

/** The form works in strings; the API turns them into dates and validates again. */
const formSchema = z.object({
  title: z.string().trim().min(1, "Give it a title").max(255, "Keep it under 255 characters"),
  notes: z.string().max(5000, "Keep notes under 5,000 characters").optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
  dueAt: z.string().optional(),
})
type FormValues = z.infer<typeof formSchema>

/** A `datetime-local` value in the viewer's own time zone. */
function toLocalInput(iso: string | null): string {
  if (!iso) return ""
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function PersonalTodos() {
  const [status, setStatus] = useState<"open" | "done" | "all">("open")
  const [priority, setPriority] = useState<"all" | Priority>("all")
  const [due, setDue] = useState<"all" | "overdue" | "today" | "upcoming" | "none">("all")
  const [search, setSearch] = useState("")
  const [query, setQuery] = useState("")

  const [editing, setEditing] = useState<PersonalTodo | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [deleting, setDeleting] = useState<PersonalTodo | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [deletingBusy, setDeletingBusy] = useState(false)

  // A request per keystroke would be wasteful; wait for a pause.
  useEffect(() => {
    const t = setTimeout(() => setQuery(search.trim()), 250)
    return () => clearTimeout(t)
  }, [search])

  const params = new URLSearchParams({ status })
  if (priority !== "all") params.set("priority", priority)
  if (due !== "all") params.set("due", due)
  if (query) params.set("q", query)

  const { data, error, isLoading, mutate } = useSWR<ListResponse>(
    `/api/personal-todos?${params.toString()}`,
    fetcher,
    { keepPreviousData: true },
  )

  const filtersActive = priority !== "all" || due !== "all" || query !== "" || status !== "open"

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }

  const toggleDone = async (todo: PersonalTodo) => {
    setBusyId(todo.id)
    try {
      const res = await fetch(`/api/personal-todos/${todo.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: !todo.completedAt }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error ?? "Could not update")
      await mutate()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusyId(null)
    }
  }

  const confirmDelete = async () => {
    if (!deleting) return
    setDeletingBusy(true)
    try {
      const res = await fetch(`/api/personal-todos/${deleting.id}`, { method: "DELETE" })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error ?? "Could not delete")
      toast.success("Deleted")
      setDeleting(null)
      await mutate()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setDeletingBusy(false)
    }
  }

  const items = data?.items ?? []

  return (
    <Card className="shadow-sm border-border">
      <CardHeader className="pb-3 border-b border-border/60">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Lock className="h-4 w-4 text-muted-foreground" aria-hidden />
              Personal Todos
            </CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Only you can see these. They are not part of your day plan or the evening report.
            </p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            {data && data.overdueCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  setStatus("open")
                  setDue("overdue")
                }}
                className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Badge variant="outline" className="gap-1 border-destructive/40 bg-destructive/5 text-destructive">
                  <AlertCircle className="h-3 w-3" aria-hidden />
                  {data.overdueCount} overdue
                </Badge>
              </button>
            )}
            <Button size="sm" onClick={openCreate} className="gap-1.5">
              <Plus className="h-4 w-4" aria-hidden />
              Add todo
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_auto_auto_auto]">
          <div className="relative">
            <Label htmlFor="pt-search" className="sr-only">Search personal todos</Label>
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              id="pt-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title or notes..."
              className="h-9 pl-8"
            />
          </div>
          <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
            <SelectTrigger className="h-9 lg:w-[130px]" aria-label="Filter by completion">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="done">Completed</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
          <Select value={priority} onValueChange={(v) => setPriority(v as typeof priority)}>
            <SelectTrigger className="h-9 lg:w-[140px]" aria-label="Filter by priority">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any priority</SelectItem>
              {PRIORITIES.map((p) => (
                <SelectItem key={p} value={p}>{label(p)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={due} onValueChange={(v) => setDue(v as typeof due)}>
            <SelectTrigger className="h-9 lg:w-[140px]" aria-label="Filter by due date">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any date</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
              <SelectItem value="today">Due today</SelectItem>
              <SelectItem value="upcoming">Upcoming</SelectItem>
              <SelectItem value="none">No due date</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {isLoading && !data ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
            <AlertCircle className="h-6 w-6 text-destructive" aria-hidden />
            <p className="text-sm text-foreground">{String(error.message)}</p>
            <Button size="sm" variant="outline" onClick={() => mutate()}>Try again</Button>
          </div>
        ) : items.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <span className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-full bg-muted">
              <Lock className="h-5 w-5 text-muted-foreground" aria-hidden />
            </span>
            {filtersActive ? (
              <>
                <p className="text-sm font-medium text-foreground">Nothing matches these filters</p>
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => {
                    setStatus("open")
                    setPriority("all")
                    setDue("all")
                    setSearch("")
                  }}
                >
                  Clear filters
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-foreground">No personal todos yet</p>
                <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
                  Keep reminders, follow-ups and notes-to-self here. Nobody else will see them.
                </p>
                <Button size="sm" className="mt-4 gap-1.5" onClick={openCreate}>
                  <Plus className="h-4 w-4" aria-hidden />
                  Add your first todo
                </Button>
              </>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((todo) => {
              const done = !!todo.completedAt
              const overdue = !done && !!todo.dueAt && isPast(new Date(todo.dueAt))
              return (
                <li key={todo.id} className="flex items-start gap-3 px-4 py-3">
                  <div className="pt-0.5">
                    {busyId === todo.id ? (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden />
                    ) : (
                      <Checkbox
                        checked={done}
                        onCheckedChange={() => toggleDone(todo)}
                        aria-label={done ? `Mark "${todo.title}" as not done` : `Mark "${todo.title}" as done`}
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-medium ${done ? "text-muted-foreground line-through" : "text-foreground"}`}>
                      {todo.title}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                      <Badge variant="outline" className={`rounded px-1.5 py-px text-[10px] ${PRIORITY_STYLE[todo.priority]}`}>
                        {label(todo.priority)}
                      </Badge>
                      {todo.dueAt && (
                        <span className={`inline-flex items-center gap-1 ${overdue ? "font-medium text-destructive" : "text-muted-foreground"}`}>
                          <CalendarClock className="h-3 w-3" aria-hidden />
                          {overdue && "Overdue · "}
                          {format(new Date(todo.dueAt), "d MMM yyyy, HH:mm")}
                        </span>
                      )}
                    </div>
                    {todo.notes && (
                      <p className="mt-1 line-clamp-2 whitespace-pre-line text-xs text-muted-foreground" title={todo.notes}>
                        {todo.notes}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        setEditing(todo)
                        setFormOpen(true)
                      }}
                      aria-label={`Edit "${todo.title}"`}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => setDeleting(todo)}
                      aria-label={`Delete "${todo.title}"`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>

      <PersonalTodoDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        todo={editing}
        onSaved={() => mutate()}
      />

      <DeleteConfirmationDialog
        isOpen={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        itemName={deleting?.title ?? ""}
        entityType="personal todo"
        isLoading={deletingBusy}
      />
    </Card>
  )
}

function PersonalTodoDialog({
  open,
  onOpenChange,
  todo,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  todo: PersonalTodo | null
  onSaved: () => void
}) {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { title: "", notes: "", priority: "MEDIUM", dueAt: "" },
  })

  // Re-seed the form each time it opens, for a new todo or the one being edited.
  useEffect(() => {
    if (!open) return
    form.reset({
      title: todo?.title ?? "",
      notes: todo?.notes ?? "",
      priority: todo?.priority ?? "MEDIUM",
      dueAt: toLocalInput(todo?.dueAt ?? null),
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, todo])

  const onSubmit = async (values: FormValues) => {
    const payload = {
      title: values.title,
      notes: values.notes ?? "",
      priority: values.priority,
      // Sent as an absolute instant so the server stores what the person meant locally.
      dueAt: values.dueAt ? new Date(values.dueAt).toISOString() : null,
    }
    const res = await fetch(todo ? `/api/personal-todos/${todo.id}` : "/api/personal-todos", {
      method: todo ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) {
      // Field errors from the server land on the field, not only in a toast.
      const details = body.details as Record<string, string[]> | undefined
      if (details) {
        for (const [field, messages] of Object.entries(details)) {
          if (field in values) form.setError(field as keyof FormValues, { message: messages[0] })
        }
      }
      toast.error(body.error ?? "Could not save")
      return
    }
    toast.success(todo ? "Saved" : "Added")
    onOpenChange(false)
    onSaved()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{todo ? "Edit personal todo" : "New personal todo"}</DialogTitle>
          <DialogDescription>Only you will see this.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Follow up with the print vendor" autoFocus {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PRIORITIES.map((p) => (
                          <SelectItem key={p} value={p}>{label(p)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="dueAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Due (optional)</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (optional)</FormLabel>
                  <FormControl>
                    <Textarea rows={4} placeholder="Anything worth remembering" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
                {todo ? "Save" : "Add"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
