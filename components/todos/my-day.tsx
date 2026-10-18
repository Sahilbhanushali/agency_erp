"use client"

import { useState } from "react"
import useSWR from "swr"
import toast from "react-hot-toast"
import {
  AlertTriangle,
  Check,
  Link2,
  Loader2,
  Plus,
  Trash2,
  Users,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

type Status = "PENDING" | "IN_PROGRESS" | "BLOCKED" | "DONE" | "CARRIED_OVER"

const STATUS_LABEL: Record<Status, string> = {
  PENDING: "Not started",
  IN_PROGRESS: "In progress",
  BLOCKED: "Blocked",
  DONE: "Done",
  CARRIED_OVER: "Carried over",
}
const STATUS_STYLE: Record<Status, string> = {
  PENDING: "bg-muted text-muted-foreground",
  IN_PROGRESS: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
  BLOCKED: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
  DONE: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  CARRIED_OVER: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
}

interface Todo {
  id: string
  title: string
  notes: string | null
  status: Status
  progress: number
  blocker: string | null
  taskId: string | null
  user: { id: number; name: string | null; email: string }
  task: { id: string; title: string; project: { name: string } | null } | null
}
interface Summary {
  total: number
  done: number
  inProgress: number
  blocked: number
  carried: number
  completion: number
}

/**
 * The day's plan. Progress and blockers are saved as they change — a manager's 7pm
 * report is only as good as what is recorded during the day, so nothing waits behind a
 * save button.
 */
export default function MyDay({ canSeeTeam }: { canSeeTeam: boolean }) {
  const [view, setView] = useState<"mine" | "team">("mine")
  const [title, setTitle] = useState("")
  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [blockerDraft, setBlockerDraft] = useState<Record<string, string>>({})

  const key = view === "team" ? "/api/todos?team=1" : "/api/todos"
  const { data, error, isLoading, mutate } = useSWR<{
    todos?: Todo[]
    summary?: Summary
    sync?: { added: number; carried: number }
    team?: { user: Todo["user"]; todos: Todo[]; summary: Summary }[]
    error?: string
  }>(key, fetcher)

  const patch = async (id: string, body: Record<string, unknown>) => {
    setBusy(id)
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
      setBusy(null)
    }
  }

  const add = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!title.trim()) return
    setAdding(true)
    try {
      const res = await fetch("/api/todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? "Could not add")
        return
      }
      setTitle("")
      mutate()
    } catch {
      toast.error("Network error — please try again")
    } finally {
      setAdding(false)
    }
  }

  const remove = async (id: string) => {
    setBusy(id)
    try {
      const res = await fetch(`/api/todos/${id}`, { method: "DELETE" })
      if (!res.ok) {
        const j = await res.json()
        toast.error(j.error ?? "Could not remove")
        return
      }
      mutate()
    } finally {
      setBusy(null)
    }
  }

  const SummaryBar = ({ s }: { s: Summary }) => (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <span>
        <strong className="text-foreground">{s.done}</strong> of {s.total} done
      </span>
      {s.inProgress > 0 && <span>{s.inProgress} in progress</span>}
      {s.carried > 0 && <span>{s.carried} carried over</span>}
      {s.blocked > 0 && (
        <span className="font-medium text-destructive">{s.blocked} blocked</span>
      )}
      <span className="ml-auto tabular-nums">{s.completion}%</span>
    </div>
  )

  const TodoRow = ({ todo, editable }: { todo: Todo; editable: boolean }) => {
    const done = todo.status === "DONE"
    return (
      <li className="space-y-2 py-3">
        <div className="flex items-start gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            aria-label={done ? `Reopen ${todo.title}` : `Mark ${todo.title} done`}
            disabled={!editable || busy === todo.id}
            onClick={() => patch(todo.id, { status: done ? "IN_PROGRESS" : "DONE" })}
          >
            {busy === todo.id ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <span
                className={`flex h-4 w-4 items-center justify-center rounded border ${
                  done ? "border-emerald-600 bg-emerald-600 text-white" : "border-muted-foreground/40"
                }`}
              >
                {done && <Check className="h-3 w-3" />}
              </span>
            )}
          </Button>

          <div className="min-w-0 flex-1">
            <p className={`text-sm ${done ? "text-muted-foreground line-through" : ""}`}>
              {todo.title}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={`border-transparent text-[11px] ${STATUS_STYLE[todo.status]}`}>
                {STATUS_LABEL[todo.status]}
              </Badge>
              {todo.task && (
                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Link2 className="h-3 w-3" aria-hidden="true" />
                  {todo.task.project?.name ?? "Task"}
                </span>
              )}
              {todo.blocker && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-destructive">
                  <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                  {todo.blocker}
                </span>
              )}
            </div>
          </div>

          {editable && (
            <div className="flex shrink-0 items-center gap-2">
              <Select
                value={String(todo.progress)}
                onValueChange={(v) => patch(todo.id, { progress: Number(v) })}
                disabled={done || busy === todo.id}
              >
                <SelectTrigger className="h-7 w-[84px] text-xs" aria-label={`Progress on ${todo.title}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[0, 10, 25, 50, 75, 90, 100].map((p) => (
                    <SelectItem key={p} value={String(p)}>{p}%</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!todo.taskId && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  aria-label={`Remove ${todo.title}`}
                  disabled={busy === todo.id}
                  onClick={() => remove(todo.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          )}
        </div>

        <Progress value={done ? 100 : todo.progress} className="h-1" />

        {editable && !done && (
          <div className="flex items-center gap-2 pl-10">
            <Label htmlFor={`blocker-${todo.id}`} className="sr-only">
              What is blocking {todo.title}
            </Label>
            <Input
              id={`blocker-${todo.id}`}
              placeholder="Blocked by something? Say what, and it goes in tonight's report."
              defaultValue={todo.blocker ?? ""}
              onChange={(e) => setBlockerDraft((d) => ({ ...d, [todo.id]: e.target.value }))}
              onBlur={() => {
                const next = blockerDraft[todo.id]
                if (next !== undefined && next !== (todo.blocker ?? "")) {
                  patch(todo.id, { blocker: next })
                }
              }}
              className="h-7 text-xs"
            />
          </div>
        )}
      </li>
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
      </div>
    )
  }

  if (error || data?.error) {
    return (
      <Card>
        <CardContent className="p-10 text-center">
          <p className="text-sm text-destructive">{data?.error ?? "Could not load your day."}</p>
          <Button variant="outline" className="mt-4" onClick={() => mutate()}>Try again</Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {canSeeTeam && (
        <div className="inline-flex rounded-lg border border-border p-1">
          {(["mine", "team"] as const).map((v) => (
            <Button
              key={v}
              variant={view === v ? "default" : "ghost"}
              size="sm"
              onClick={() => setView(v)}
            >
              {v === "team" && <Users className="mr-2 h-4 w-4" aria-hidden="true" />}
              {v === "mine" ? "My day" : "The team"}
            </Button>
          ))}
        </div>
      )}

      {view === "mine" ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Today</CardTitle>
            {data?.summary && <SummaryBar s={data.summary} />}
            {!!data?.sync?.added && (
              <p className="text-xs text-muted-foreground">
                {data.sync.added} task{data.sync.added === 1 ? "" : "s"} due today added automatically.
              </p>
            )}
            {!!data?.sync?.carried && (
              <p className="text-xs text-muted-foreground">
                {data.sync.carried} unfinished item{data.sync.carried === 1 ? "" : "s"} carried over from yesterday.
              </p>
            )}
          </CardHeader>
          <CardContent>
            <form onSubmit={add} className="mb-3 flex gap-2">
              <Label htmlFor="new-todo" className="sr-only">Add to today</Label>
              <Input
                id="new-todo"
                placeholder="What else are you doing today?"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <Button type="submit" disabled={adding || !title.trim()}>
                {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                <span className="ml-2 hidden sm:inline">Add</span>
              </Button>
            </form>

            {(data?.todos ?? []).length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Nothing planned yet. Add what you are working on, and anything assigned to
                you and due today will appear here on its own.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {data!.todos!.map((t) => <TodoRow key={t.id} todo={t} editable />)}
              </ul>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {(data?.team ?? []).length === 0 ? (
            <Card>
              <CardContent className="p-10 text-center text-sm text-muted-foreground">
                Nobody has planned their day yet.
              </CardContent>
            </Card>
          ) : (
            data!.team!.map((block) => (
              <Card key={block.user.id}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{block.user.name ?? block.user.email}</CardTitle>
                  <SummaryBar s={block.summary} />
                </CardHeader>
                <CardContent>
                  <ul className="divide-y divide-border">
                    {block.todos.map((t) => <TodoRow key={t.id} todo={t} editable={false} />)}
                  </ul>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  )
}
