"use client"

import { useState } from "react"
import useSWR from "swr"
import { formatDistanceToNow } from "date-fns"
import toast from "react-hot-toast"
import { AlertCircle, Check, Loader2, RotateCcw, Trash2, UserMinus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { useLiveRefresh } from "@/hooks/use-live-refresh"
import type { CanvasAccessInfo, CanvasMemberInfo } from "./types"

const fetcher = async <T,>(url: string): Promise<T> => {
  const res = await fetch(url)
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error ?? "Could not load")
  return body as T
}

async function send(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  const result = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(result.error ?? "Something went wrong")
  return result
}

function PanelError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-2 py-6 text-center text-sm">
      <AlertCircle className="size-5 text-destructive" aria-hidden="true" />
      <p>{message}</p>
      <Button size="sm" variant="outline" onClick={onRetry}>Try again</Button>
    </div>
  )
}

interface CommentRow {
  id: string
  body: string
  resolved: boolean
  elementId: string | null
  createdAt: string
  author: { id: number; name: string } | null
}

/** Feedback on the board, or on one selected item when `elementId` is set. */
export function CanvasComments({
  canvasId,
  elementId,
  elementLabel,
  access,
  currentUserId,
  onClearElement,
  onChanged,
}: {
  canvasId: string
  elementId: string | null
  elementLabel: string | null
  access: CanvasAccessInfo
  currentUserId: number
  onClearElement: () => void
  onChanged: () => void
}) {
  const url = `/api/canvases/${canvasId}/comments`
  const { data, error, isLoading, mutate } = useSWR<{ comments: CommentRow[] }>(url, fetcher)
  useLiveRefresh(() => mutate(), ["CanvasComment"])
  const [body, setBody] = useState("")
  const [posting, setPosting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [showResolved, setShowResolved] = useState(false)

  const all = data?.comments ?? []
  const scoped = elementId ? all.filter((c) => c.elementId === elementId) : all
  const shown = showResolved ? scoped : scoped.filter((c) => !c.resolved)
  const resolvedCount = scoped.length - scoped.filter((c) => !c.resolved).length

  const post = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!body.trim()) {
      setFormError("Write a comment first.")
      return
    }
    setPosting(true)
    setFormError(null)
    try {
      await send(url, "POST", { body: body.trim(), elementId })
      setBody("")
      await mutate()
      onChanged()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not post the comment")
    } finally {
      setPosting(false)
    }
  }

  const act = async (comment: CommentRow, action: "resolve" | "reopen" | "delete") => {
    try {
      if (action === "delete") await send(`${url}/${comment.id}`, "DELETE")
      else await send(`${url}/${comment.id}`, "PATCH", { resolved: action === "resolve" })
      await mutate()
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update the comment")
    }
  }

  const steward = access.role === "OWNER" || access.role === "PLANNER"

  return (
    <div className="space-y-3">
      {elementId ? (
        <div className="flex items-center justify-between gap-2 rounded-md bg-muted/60 px-2 py-1.5 text-xs">
          <span className="line-clamp-1">On <strong>{elementLabel}</strong></span>
          <button type="button" onClick={onClearElement} className="flex items-center gap-1 rounded p-1 hover:bg-muted" aria-label="Show comments for the whole board">
            <X className="size-3.5" aria-hidden="true" /> All
          </button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Comments on the whole board. Select an item to comment on it.</p>
      )}

      {isLoading && <div className="space-y-2" aria-busy="true"><Skeleton className="h-14" /><Skeleton className="h-14" /></div>}
      {error && <PanelError message={error.message} onRetry={() => mutate()} />}
      {data && shown.length === 0 && (
        <p className="py-4 text-center text-sm text-muted-foreground">
          {scoped.length === 0 ? "No comments yet. Start the feedback below." : "All comments here are resolved."}
        </p>
      )}

      <ul className="space-y-2">
        {shown.map((c) => (
          <li key={c.id} className={`rounded-lg border border-border p-2.5 text-sm ${c.resolved ? "opacity-60" : ""}`}>
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs">
                <span className="font-semibold">{c.author?.name ?? "Former member"}</span>
                <span className="text-muted-foreground"> · {formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}</span>
                {!elementId && c.elementId && <span className="text-muted-foreground"> · on an item</span>}
              </p>
              <div className="flex flex-shrink-0 gap-0.5">
                {(access.canEdit || c.author?.id === currentUserId) && (
                  <button
                    type="button"
                    onClick={() => act(c, c.resolved ? "reopen" : "resolve")}
                    className="rounded p-1.5 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={c.resolved ? "Reopen comment" : "Resolve comment"}
                  >
                    {c.resolved ? <RotateCcw className="size-3.5" aria-hidden="true" /> : <Check className="size-3.5" aria-hidden="true" />}
                  </button>
                )}
                {(steward || c.author?.id === currentUserId) && (
                  <button
                    type="button"
                    onClick={() => act(c, "delete")}
                    className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={`Delete comment by ${c.author?.name ?? "former member"}`}
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>
            <p className="mt-1 whitespace-pre-wrap break-words">{c.body}</p>
          </li>
        ))}
      </ul>

      {resolvedCount > 0 && (
        <Button type="button" variant="ghost" size="sm" onClick={() => setShowResolved((v) => !v)} className="text-xs">
          {showResolved ? "Hide resolved" : `Show ${resolvedCount} resolved`}
        </Button>
      )}

      {access.canComment && (
        <form onSubmit={post} className="space-y-2 border-t border-border pt-3">
          <Label htmlFor={`canvas-comment-${canvasId}`}>{elementId ? "Comment on this item" : "Comment on the board"}</Label>
          <Textarea
            id={`canvas-comment-${canvasId}`}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={2000}
            rows={3}
            placeholder="Feedback, a question, or a correction…"
            aria-invalid={!!formError}
          />
          {formError && <p className="text-xs text-destructive">{formError}</p>}
          <Button type="submit" size="sm" disabled={posting} className="min-h-9">
            {posting && <Loader2 className="mr-1.5 size-3.5 animate-spin" aria-hidden="true" />}
            Post comment
          </Button>
        </form>
      )}
    </div>
  )
}

interface ActivityRow {
  id: string
  action: string
  summary: string
  createdAt: string
  actor: { id: number; name: string } | null
}

export function CanvasActivity({ canvasId }: { canvasId: string }) {
  const { data, error, isLoading, mutate } = useSWR<{ activity: ActivityRow[] }>(`/api/canvases/${canvasId}/activity`, fetcher)
  useLiveRefresh(() => mutate(), ["CanvasActivity"])
  if (isLoading) return <div className="space-y-2" aria-busy="true"><Skeleton className="h-10" /><Skeleton className="h-10" /><Skeleton className="h-10" /></div>
  if (error) return <PanelError message={error.message} onRetry={() => mutate()} />
  if (!data?.activity.length) return <p className="py-4 text-center text-sm text-muted-foreground">No activity yet.</p>
  return (
    <ol className="space-y-3 border-l border-border pl-4">
      {data.activity.map((a) => (
        <li key={a.id} className="relative text-xs">
          <span className="absolute -left-[21px] top-1 size-2.5 rounded-full border-2 border-background bg-primary" aria-hidden="true" />
          <p className="text-foreground">{a.summary}</p>
          <p className="text-muted-foreground">
            {a.actor?.name ?? "Someone"} · {formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}
          </p>
        </li>
      ))}
    </ol>
  )
}

/** Who the board is shared with, and adding/removing people (stewards only). */
export function CanvasSharing({
  canvasId,
  members,
  owner,
  access,
  onChanged,
}: {
  canvasId: string
  members: CanvasMemberInfo[]
  owner: { id: number; name: string } | null
  access: CanvasAccessInfo
  onChanged: () => void
}) {
  const { data: users } = useSWR<{ id: string; name: string; role: string | null }[]>(access.canShare ? "/api/users" : null, fetcher)
  const [userId, setUserId] = useState("")
  const [role, setRole] = useState<"VIEWER" | "EDITOR">("VIEWER")
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const memberIds = new Set(members.map((m) => m.user.id))
  const candidates = (users ?? []).filter((u) => !memberIds.has(Number(u.id)) && Number(u.id) !== owner?.id)

  const share = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userId) {
      setFormError("Choose someone to share with.")
      return
    }
    setBusy(true)
    setFormError(null)
    try {
      await send(`/api/canvases/${canvasId}/members`, "POST", { userId: Number(userId), role })
      setUserId("")
      onChanged()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not share the board")
    } finally {
      setBusy(false)
    }
  }

  const changeRole = async (memberId: number, next: "VIEWER" | "EDITOR") => {
    try {
      await send(`/api/canvases/${canvasId}/members`, "POST", { userId: memberId, role: next })
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not change access")
    }
  }

  const remove = async (member: CanvasMemberInfo) => {
    try {
      await send(`/api/canvases/${canvasId}/members/${member.user.id}`, "DELETE")
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove access")
    }
  }

  return (
    <div className="space-y-4">
      <ul className="space-y-2">
        {owner && (
          <li className="flex items-center justify-between gap-2 text-sm">
            <span className="line-clamp-1">{owner.name}</span>
            <span className="text-xs text-muted-foreground">Owner</span>
          </li>
        )}
        {members.map((m) => (
          <li key={m.user.id} className="flex items-center justify-between gap-2 text-sm">
            <span className="min-w-0">
              <span className="line-clamp-1">{m.user.name}</span>
              {m.user.role?.name && <span className="block text-xs text-muted-foreground">{m.user.role.name}</span>}
            </span>
            {access.canShare ? (
              <span className="flex flex-shrink-0 items-center gap-1">
                <Select value={m.role} onValueChange={(v) => changeRole(m.user.id, v as "VIEWER" | "EDITOR")}>
                  <SelectTrigger className="h-9 w-28 text-xs" aria-label={`Access for ${m.user.name}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="VIEWER">Can view</SelectItem>
                    <SelectItem value="EDITOR">Can edit</SelectItem>
                  </SelectContent>
                </Select>
                <Button type="button" size="icon" variant="ghost" onClick={() => remove(m)} className="size-9" aria-label={`Stop sharing with ${m.user.name}`}>
                  <UserMinus className="size-4" aria-hidden="true" />
                </Button>
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">{m.role === "EDITOR" ? "Can edit" : "Can view"}</span>
            )}
          </li>
        ))}
        {members.length === 0 && <li className="text-sm text-muted-foreground">Not shared with anyone yet.</li>}
      </ul>

      {access.canShare ? (
        <form onSubmit={share} className="space-y-2 border-t border-border pt-3">
          <Label htmlFor={`canvas-share-${canvasId}`}>Share with</Label>
          <Select value={userId} onValueChange={setUserId}>
            <SelectTrigger id={`canvas-share-${canvasId}`} className="min-h-11">
              <SelectValue placeholder={users ? "Choose a team member" : "Loading people…"} />
            </SelectTrigger>
            <SelectContent>
              {candidates.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name}{u.role ? ` · ${u.role}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={role} onValueChange={(v) => setRole(v as "VIEWER" | "EDITOR")}>
            <SelectTrigger className="min-h-11" aria-label="Access level">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="VIEWER">Can view and comment</SelectItem>
              <SelectItem value="EDITOR">Can edit</SelectItem>
            </SelectContent>
          </Select>
          {formError && <p className="text-xs text-destructive">{formError}</p>}
          <Button type="submit" size="sm" disabled={busy} className="min-h-9">
            {busy && <Loader2 className="mr-1.5 size-3.5 animate-spin" aria-hidden="true" />}
            Share
          </Button>
          <p className="text-xs text-muted-foreground">People are notified. Only roles that can open boards can be added.</p>
        </form>
      ) : (
        <p className="text-xs text-muted-foreground">Only the owner or a planner can change who this board is shared with.</p>
      )}
    </div>
  )
}
