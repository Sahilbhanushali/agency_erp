"use client"

import { useState } from "react"
import useSWR from "swr"
import toast from "react-hot-toast"
import {
  AlertTriangle,
  Ban,
  CalendarClock,
  CalendarX,
  CheckCircle2,
  History,
  MessageSquareWarning,
  RotateCcw,
  Send,
  UserCheck,
  XCircle,
  type LucideIcon,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { statusLabel } from "@/lib/post-status"
import type { WorkflowAction, WorkflowStage } from "@/lib/posts/workflow-rules"

interface TimelineEntry {
  id: string
  action: string
  fromStatus: string
  toStatus: string
  version: number
  reason: string | null
  actorName: string | null
  actorType: "USER" | "CLIENT" | "SYSTEM"
  metadata: Record<string, unknown> | null
  createdAt: string
  actor: { id: number; name: string } | null
}

interface WorkflowState {
  status: string
  version: number
  requiresClientApproval: boolean
  scheduledAt: string | null
  stage: WorkflowStage
  stageLabel: string
  waitingOn: string | null
  actions: WorkflowAction[]
  canToggleClientApproval: boolean
  timeline: TimelineEntry[]
  error?: string
}

const fetcher = async (url: string) => {
  const res = await fetch(url)
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error ?? "Could not load the workflow")
  return body
}

const STAGE_VARIANT: Record<WorkflowStage, "neutral" | "info" | "warning" | "destructive" | "purple" | "success"> = {
  DRAFT: "neutral",
  PENDING_APPROVAL: "info",
  CHANGES_REQUESTED: "warning",
  REJECTED: "destructive",
  PENDING_CLIENT: "purple",
  READY_TO_SCHEDULE: "success",
  SCHEDULED: "info",
  PUBLISHED: "success",
  CANCELLED: "neutral",
}

/** Buttons, in the order a person scans them: the primary decision first. */
const ACTION_META: Partial<
  Record<
    WorkflowAction,
    {
      label: string
      icon: LucideIcon
      variant: "default" | "outline" | "destructive" | "secondary"
      /** Collected in a dialog before sending. */
      needs?: "reason" | "date" | "confirm"
      confirmTitle?: string
      confirmText?: string
    }
  >
> = {
  SUBMIT: { label: "Submit for approval", icon: Send, variant: "default" },
  APPROVE: {
    label: "Approve",
    icon: CheckCircle2,
    variant: "default",
    needs: "confirm",
    confirmTitle: "Approve this post?",
    confirmText: "Your approval is recorded against the current version of the post.",
  },
  REQUEST_CHANGES: { label: "Request changes", icon: MessageSquareWarning, variant: "outline", needs: "reason" },
  REJECT: { label: "Reject", icon: XCircle, variant: "destructive", needs: "reason" },
  CLIENT_APPROVE: { label: "Approve as client", icon: UserCheck, variant: "default", needs: "confirm", confirmTitle: "Approve this post?", confirmText: "This records your approval as the client." },
  CLIENT_REQUEST_CHANGES: { label: "Request changes", icon: MessageSquareWarning, variant: "outline", needs: "reason" },
  SCHEDULE: { label: "Schedule", icon: CalendarClock, variant: "default", needs: "date" },
  RESCHEDULE: { label: "Reschedule", icon: CalendarClock, variant: "outline", needs: "date" },
  UNSCHEDULE: {
    label: "Unschedule",
    icon: CalendarX,
    variant: "outline",
    needs: "confirm",
    confirmTitle: "Remove this post from the schedule?",
    confirmText: "It stays approved and can be scheduled again.",
  },
  PUBLISH: {
    label: "Mark as published",
    icon: CheckCircle2,
    variant: "secondary",
    needs: "confirm",
    confirmTitle: "Is this post live?",
    confirmText: "Only confirm once the post is actually published on the platform. This cannot be undone.",
  },
  CANCEL: { label: "Cancel post", icon: Ban, variant: "outline", needs: "reason" },
  REOPEN: { label: "Reopen as draft", icon: RotateCcw, variant: "outline" },
}

const ACTION_VERB: Record<string, string> = {
  SUBMIT: "Submitted for approval",
  APPROVE: "Approved",
  REJECT: "Rejected",
  REQUEST_CHANGES: "Requested changes",
  CLIENT_APPROVE: "Client approved",
  CLIENT_REQUEST_CHANGES: "Client requested changes",
  SCHEDULE: "Scheduled",
  RESCHEDULE: "Rescheduled",
  UNSCHEDULE: "Unscheduled",
  PUBLISH: "Published",
  CANCEL: "Cancelled",
  REOPEN: "Reopened",
  EDIT_INVALIDATE: "Edited",
  CLIENT_TOGGLE: "Changed client approval",
}

const toLocalInput = (iso: string | null) => {
  if (!iso) return ""
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const when = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(
    new Date(iso),
  )

/**
 * The post's workflow: where it is, who it is waiting on, what THIS person can do next,
 * and every step it has taken. Renders only the actions the server says are allowed;
 * the server re-checks each one, so this is never the security boundary.
 */
export function PostWorkflowPanel({ postId, onChanged }: { postId: string; onChanged?: () => void }) {
  const { data, error, isLoading, mutate } = useSWR<WorkflowState>(`/api/posts/${postId}/workflow`, fetcher)
  const [pending, setPending] = useState<WorkflowAction | null>(null)
  const [dialog, setDialog] = useState<WorkflowAction | null>(null)
  const [reason, setReason] = useState("")
  const [date, setDate] = useState("")
  const [fieldError, setFieldError] = useState<string | null>(null)

  const send = async (action: WorkflowAction, extra: Record<string, unknown> = {}) => {
    if (!data) return false
    setPending(action)
    try {
      const res = await fetch(`/api/posts/${postId}/workflow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, expectedVersion: data.version, ...extra }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(body.error ?? "Could not update the post")
        // A 409 means the post moved under us; show the real current state.
        if (res.status === 409) await mutate()
        return false
      }
      toast.success(`${ACTION_VERB[action] ?? "Updated"}`)
      await mutate()
      onChanged?.()
      return true
    } catch {
      toast.error("Network error — please try again")
      return false
    } finally {
      setPending(null)
    }
  }

  const open = (action: WorkflowAction) => {
    const meta = ACTION_META[action]
    setFieldError(null)
    setReason("")
    setDate(toLocalInput(data?.scheduledAt ?? null))
    if (!meta?.needs) void send(action)
    else setDialog(action)
  }

  const submitDialog = async () => {
    if (!dialog) return
    const meta = ACTION_META[dialog]
    if (meta?.needs === "reason" && !reason.trim()) {
      setFieldError("Explain what needs to change — the creator sees this.")
      return
    }
    if (meta?.needs === "date") {
      if (!date) return setFieldError("Choose a date and time.")
      if (new Date(date).getTime() < Date.now() - 60_000) return setFieldError("Choose a time in the future.")
    }
    const ok = await send(
      dialog,
      meta?.needs === "reason"
        ? { reason: reason.trim() }
        : meta?.needs === "date"
          ? { scheduledAt: new Date(date).toISOString() }
          : {},
    )
    if (ok) setDialog(null)
  }

  const toggleClient = async (next: boolean) => {
    await send("CLIENT_TOGGLE", { requiresClientApproval: next })
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="mt-2 h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    )
  }

  if (error || !data) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
          <AlertTriangle className="size-5 text-destructive" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">{error?.message ?? "Could not load the workflow."}</p>
          <Button size="sm" variant="outline" onClick={() => mutate()}>
            Try again
          </Button>
        </CardContent>
      </Card>
    )
  }

  const actions = data.actions.filter((a) => ACTION_META[a])
  const meta = dialog ? ACTION_META[dialog] : null

  return (
    <Card>
      <CardHeader className="space-y-3 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Approval workflow</CardTitle>
          <Badge variant={STAGE_VARIANT[data.stage]} size="lg">
            {data.stageLabel}
          </Badge>
        </div>
        <CardDescription className="text-xs">
          {data.waitingOn ? (
            <>
              Waiting on: <span className="font-medium text-foreground">{data.waitingOn}</span>
            </>
          ) : (
            "Nothing is waiting on anyone."
          )}
          <span className="ml-2 text-muted-foreground">· Version {data.version}</span>
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Client approval is its own stage, so it gets its own, clearly labelled switch. */}
        <div className="flex items-start justify-between gap-4 rounded-lg border border-border/70 p-3">
          <div className="space-y-0.5">
            <Label htmlFor={`client-approval-${postId}`} className="text-sm font-medium">
              Client approval required
            </Label>
            <p id={`client-approval-${postId}-hint`} className="text-xs text-muted-foreground">
              {data.requiresClientApproval
                ? "After internal approval the client must approve before this can be scheduled."
                : "Internal approval is enough to schedule this post."}
            </p>
          </div>
          <Switch
            id={`client-approval-${postId}`}
            checked={data.requiresClientApproval}
            disabled={!data.canToggleClientApproval || pending !== null}
            onCheckedChange={toggleClient}
            aria-describedby={`client-approval-${postId}-hint`}
          />
        </div>

        {actions.length > 0 ? (
          <div className="flex flex-wrap gap-2" role="group" aria-label="Workflow actions">
            {actions.map((action) => {
              const m = ACTION_META[action]!
              const Icon = m.icon
              return (
                <Button
                  key={action}
                  variant={m.variant}
                  size="sm"
                  className="min-h-9"
                  loading={pending === action}
                  disabled={pending !== null}
                  onClick={() => open(action)}
                >
                  <Icon aria-hidden="true" />
                  {m.label}
                </Button>
              )
            })}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            You have no actions on this post at its current stage.
          </p>
        )}

        <section aria-labelledby={`timeline-${postId}`} className="space-y-2">
          <h3 id={`timeline-${postId}`} className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <History className="size-3.5" aria-hidden="true" /> Activity
          </h3>
          {data.timeline.length === 0 ? (
            <p className="text-xs text-muted-foreground">No workflow activity yet. Submitting the post starts its history.</p>
          ) : (
            <ol className="space-y-3 border-l border-border pl-4">
              {data.timeline.map((entry) => (
                <li key={entry.id} className="relative text-xs">
                  <span className="absolute -left-[21px] top-1 size-2.5 rounded-full border-2 border-background bg-primary" aria-hidden="true" />
                  <p className="font-medium text-foreground">
                    {ACTION_VERB[entry.action] ?? entry.action}
                    {entry.fromStatus !== entry.toStatus && (
                      <span className="font-normal text-muted-foreground">
                        {" "}
                        · {statusLabel(entry.fromStatus)} → {statusLabel(entry.toStatus)}
                      </span>
                    )}
                  </p>
                  <p className="text-muted-foreground">
                    {entry.actor?.name ?? entry.actorName ?? (entry.actorType === "SYSTEM" ? "System" : "Unknown")}
                    {entry.actorType === "CLIENT" && " (client)"} · {when(entry.createdAt)} · v{entry.version}
                  </p>
                  {entry.reason && <p className="mt-1 rounded-md bg-muted/60 px-2 py-1 text-foreground">{entry.reason}</p>}
                </li>
              ))}
            </ol>
          )}
        </section>
      </CardContent>

      <Dialog open={!!dialog} onOpenChange={(next) => !next && pending === null && setDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{meta?.confirmTitle ?? meta?.label}</DialogTitle>
            {meta?.confirmText && <DialogDescription>{meta.confirmText}</DialogDescription>}
          </DialogHeader>

          {meta?.needs === "reason" && (
            <div className="space-y-1.5">
              <Label htmlFor="workflow-reason">Reason</Label>
              <Textarea
                id="workflow-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={4}
                aria-invalid={!!fieldError}
                aria-describedby={fieldError ? "workflow-error" : undefined}
                placeholder="What needs to change, and why"
              />
            </div>
          )}
          {meta?.needs === "date" && (
            <div className="space-y-1.5">
              <Label htmlFor="workflow-date">Publish at</Label>
              <Input
                id="workflow-date"
                type="datetime-local"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                aria-invalid={!!fieldError}
                aria-describedby={fieldError ? "workflow-error" : undefined}
              />
            </div>
          )}
          {fieldError && (
            <p id="workflow-error" role="alert" className="text-xs text-destructive">
              {fieldError}
            </p>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)} disabled={pending !== null}>
              Back
            </Button>
            <Button
              variant={meta?.variant === "destructive" ? "destructive" : "default"}
              onClick={submitDialog}
              loading={pending !== null}
            >
              {meta?.label}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
