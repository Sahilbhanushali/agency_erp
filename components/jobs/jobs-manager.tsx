"use client"

import { useState } from "react"
import useSWR from "swr"
import toast from "react-hot-toast"
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  Mail,
  Play,
  Plus,
  Save,
  X,
  XCircle,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { SearchableSelect } from "@/components/ui/searchable-select"

/** Times an agency actually picks, so nobody has to know cron syntax to change one. */
const PRESETS: { label: string; expression: string }[] = [
  { label: "Every weekday at 09:30", expression: "30 9 * * 1-5" },
  { label: "Every weekday at 19:00", expression: "0 19 * * 1-5" },
  { label: "Every day at 09:00", expression: "0 9 * * *" },
  { label: "Every day at 14:00", expression: "0 14 * * *" },
  { label: "Every day at 21:00", expression: "0 21 * * *" },
  { label: "Every Monday at 09:00", expression: "0 9 * * 1" },
]

const TIMEZONES = ["Asia/Kolkata", "Asia/Dubai", "Europe/London", "America/New_York", "UTC"]

const MODE_LABEL: Record<string, string> = {
  AUTO: "Automatic",
  EXPLICIT: "Only the people I choose",
  BOTH: "Automatic, plus the people I choose",
}

interface Job {
  key: string
  label: string
  description: string
  cronExpression: string
  cronLabel: string
  timezone: string
  isEnabled: boolean
  supportsRecipients: boolean
  autoRecipients: string
  recipientMode: "AUTO" | "EXPLICIT" | "BOTH"
  recipients: { id: number; name: string | null; email: string }[]
  recipientEmails: string[]
  runRequestedAt: string | null
  lastRunAt: string | null
  lastStatus: string | null
  lastMessage: string | null
  updatedBy: { id: number; name: string | null } | null
  updatedAt: string
  runs: { id: string; startedAt: string; ok: boolean; message: string | null; trigger: string }[]
}

const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `HTTP ${res.status}`)
  return res.json()
}

const when = (value: string | null) =>
  value ? new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : null

export default function JobsManager({ editable }: { editable: boolean }) {
  const { data, error, isLoading, mutate } = useSWR<{
    jobs: Job[]
    schedulerSeenAt: string | null
  }>("/api/jobs", fetcher, { refreshInterval: 30_000 })

  const [openKey, setOpenKey] = useState<string | null>(null)

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28 w-full rounded-xl" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="space-y-4 p-10 text-center">
          <p className="text-sm text-destructive">{(error as Error).message}</p>
          <Button variant="outline" onClick={() => mutate()}>
            Try again
          </Button>
        </CardContent>
      </Card>
    )
  }

  const jobs = data?.jobs ?? []
  const enabled = jobs.filter((j) => j.isEnabled).length

  return (
    <div className="space-y-4">
      {/* The scheduler is a separate process; if it is not running, nothing here fires. */}
      {!data?.schedulerSeenAt ? (
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden="true" />
          <div className="space-y-0.5 text-xs">
            <p className="font-medium text-amber-700 dark:text-amber-400">
              The scheduler has not checked in
            </p>
            <p className="text-muted-foreground">
              Schedules save, but nothing will run until the scheduler process is started
              (<code className="rounded bg-muted px-1 py-0.5">pm2 start ecosystem.config.js</code>).
              It asks this page for its schedule once a minute.
            </p>
          </div>
        </div>
      ) : (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <CheckCircle2 className="size-3.5 text-emerald-600" aria-hidden="true" />
          Scheduler online — last checked in {when(data.schedulerSeenAt)}. {enabled} of{" "}
          {jobs.length} jobs enabled.
        </p>
      )}

      {jobs.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center">
            <p className="text-sm text-muted-foreground">
              No schedulable jobs are registered in this build.
            </p>
          </CardContent>
        </Card>
      ) : (
        jobs.map((job) => (
          <JobCard
            key={job.key}
            job={job}
            editable={editable}
            open={openKey === job.key}
            onOpenChange={(open) => setOpenKey(open ? job.key : null)}
            onSaved={() => mutate()}
          />
        ))
      )}
    </div>
  )
}

function JobCard({
  job,
  editable,
  open,
  onOpenChange,
  onSaved,
}: {
  job: Job
  editable: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const [expression, setExpression] = useState(job.cronExpression)
  const [timezone, setTimezone] = useState(job.timezone)
  const [mode, setMode] = useState(job.recipientMode)
  const [userIds, setUserIds] = useState<number[]>(job.recipients.map((r) => r.id))
  const [emails, setEmails] = useState<string[]>(job.recipientEmails)
  const [newEmail, setNewEmail] = useState("")
  const [saving, setSaving] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [running, setRunning] = useState(false)
  const [fieldError, setFieldError] = useState<string | null>(null)

  const { data: directory } = useSWR<{ id: number; name: string | null; email: string }[]>(
    open && job.supportsRecipients ? "/api/users" : null,
    fetcher,
  )

  const patch = async (body: Record<string, unknown>) => {
    const res = await fetch(`/api/jobs/${job.key}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    const payload = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(payload.error ?? "Could not save")
    return payload
  }

  const save = async () => {
    setFieldError(null)
    setSaving(true)
    try {
      await patch({
        cronExpression: expression.trim(),
        timezone,
        ...(job.supportsRecipients
          ? { recipientMode: mode, recipientUserIds: userIds, recipientEmails: emails }
          : {}),
      })
      toast.success(`${job.label} updated`)
      onOpenChange(false)
      onSaved()
    } catch (e) {
      setFieldError((e as Error).message)
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const toggle = async (next: boolean) => {
    setToggling(true)
    try {
      await patch({ isEnabled: next })
      toast.success(next ? `${job.label} enabled` : `${job.label} paused`)
      onSaved()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setToggling(false)
    }
  }

  const runNow = async () => {
    setRunning(true)
    try {
      const res = await fetch(`/api/jobs/${job.key}/run`, { method: "POST" })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload.error ?? "Could not queue the run")
      toast.success(payload.message ?? "Queued")
      onSaved()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setRunning(false)
    }
  }

  const addEmail = () => {
    const value = newEmail.trim().toLowerCase()
    if (!value) return
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setFieldError(`"${value}" is not an email address`)
      return
    }
    if (emails.includes(value)) {
      setNewEmail("")
      return
    }
    setEmails([...emails, value])
    setNewEmail("")
    setFieldError(null)
  }

  const lastRun = when(job.lastRunAt)

  return (
    <Card className="shadow-2xs border-border/70">
      <CardHeader className="gap-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <CardTitle className="flex flex-wrap items-center gap-2 text-base font-semibold">
              {job.label}
              {job.isEnabled ? (
                <Badge variant="outline" className="text-[10px]">
                  <Clock className="mr-1 size-3" aria-hidden="true" />
                  {job.cronLabel} · {job.timezone}
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-[10px]">
                  Paused
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="text-xs">{job.description}</CardDescription>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {editable && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 min-h-11 gap-1.5 sm:min-h-9"
                  disabled={running || !job.isEnabled}
                  onClick={runNow}
                >
                  {running ? (
                    <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <Play className="size-3.5" aria-hidden="true" />
                  )}
                  Run now
                </Button>
                <Switch
                  checked={job.isEnabled}
                  disabled={toggling}
                  onCheckedChange={toggle}
                  aria-label={`${job.isEnabled ? "Pause" : "Enable"} ${job.label}`}
                />
              </>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Mail className="size-3.5" aria-hidden="true" />
            {job.supportsRecipients
              ? job.recipientMode === "AUTO"
                ? `Goes to ${job.autoRecipients}`
                : `${MODE_LABEL[job.recipientMode]} — ${
                    job.recipients.length + job.recipientEmails.length
                  } recipient(s)`
              : `Always goes to ${job.autoRecipients}`}
          </span>

          {job.runRequestedAt && (
            <span className="flex items-center gap-1.5 text-amber-600">
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              Queued to run
            </span>
          )}

          {lastRun ? (
            <span className="flex items-center gap-1.5">
              {job.lastStatus === "ok" ? (
                <CheckCircle2 className="size-3.5 text-emerald-600" aria-hidden="true" />
              ) : (
                <XCircle className="size-3.5 text-destructive" aria-hidden="true" />
              )}
              Last run {lastRun}
              {job.lastStatus !== "ok" && job.lastMessage ? ` — ${job.lastMessage}` : ""}
            </span>
          ) : (
            <span>Has not run yet</span>
          )}
        </div>
      </CardHeader>

      {editable && (
        <CardContent className="space-y-4 border-t border-border/70 pt-4">
          {!open ? (
            <Button variant="outline" size="sm" className="min-h-11 sm:min-h-9" onClick={() => onOpenChange(true)}>
              Change schedule and recipients
            </Button>
          ) : (
            <div className="space-y-5">
              {fieldError && (
                <p className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-2.5 text-xs text-destructive">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                  {fieldError}
                </p>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor={`${job.key}-preset`} className="text-xs font-medium">
                    When should it run?
                  </Label>
                  <Select
                    value={PRESETS.some((p) => p.expression === expression) ? expression : "custom"}
                    onValueChange={(v) => v !== "custom" && setExpression(v)}
                  >
                    <SelectTrigger id={`${job.key}-preset`} className="h-9 bg-card text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRESETS.map((p) => (
                        <SelectItem key={p.expression} value={p.expression} className="text-xs">
                          {p.label}
                        </SelectItem>
                      ))}
                      <SelectItem value="custom" className="text-xs">
                        Custom (cron expression)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor={`${job.key}-tz`} className="text-xs font-medium">
                    Timezone
                  </Label>
                  <Select value={timezone} onValueChange={setTimezone}>
                    <SelectTrigger id={`${job.key}-tz`} className="h-9 bg-card text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIMEZONES.map((tz) => (
                        <SelectItem key={tz} value={tz} className="text-xs">
                          {tz}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor={`${job.key}-cron`} className="text-xs font-medium">
                  Cron expression
                </Label>
                <Input
                  id={`${job.key}-cron`}
                  value={expression}
                  onChange={(e) => setExpression(e.target.value)}
                  className="h-9 font-mono text-xs"
                  placeholder="0 19 * * 1-5"
                  aria-describedby={`${job.key}-cron-help`}
                />
                <p id={`${job.key}-cron-help`} className="text-[11px] text-muted-foreground">
                  Five fields: minute, hour, day of month, month, day of week.
                  <code className="mx-1 rounded bg-muted px-1">0 19 * * 1-5</code>
                  means 19:00 Monday to Friday.
                </p>
              </div>

              {job.supportsRecipients ? (
                <div className="space-y-3 rounded-lg border border-border/70 bg-muted/20 p-3">
                  <div className="space-y-1.5">
                    <Label htmlFor={`${job.key}-mode`} className="text-xs font-medium">
                      Who receives it?
                    </Label>
                    <Select value={mode} onValueChange={(v) => setMode(v as Job["recipientMode"])}>
                      <SelectTrigger id={`${job.key}-mode`} className="h-9 bg-card text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(["AUTO", "EXPLICIT", "BOTH"] as const).map((m) => (
                          <SelectItem key={m} value={m} className="text-xs">
                            {MODE_LABEL[m]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-[11px] text-muted-foreground">
                      Automatic means {job.autoRecipients}.
                    </p>
                  </div>

                  {mode !== "AUTO" && (
                    <>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">People</Label>
                        <SearchableSelect
                          options={(directory ?? [])
                            .filter((u) => !userIds.includes(u.id))
                            .map((u) => ({
                              id: String(u.id),
                              label: u.name ?? u.email,
                              subLabel: u.email,
                            }))}
                          value=""
                          onValueChange={(v: string) =>
                            v && setUserIds([...userIds, Number(v)])
                          }
                          placeholder={directory ? "Search people..." : "Loading people..."}
                        />
                        {userIds.length > 0 && (
                          <ul className="flex flex-wrap gap-1.5 pt-1">
                            {userIds.map((id) => {
                              const user =
                                job.recipients.find((r) => r.id === id) ??
                                directory?.find((u) => u.id === id)
                              return (
                                <li key={id}>
                                  <Badge variant="outline" className="gap-1 text-[10px]">
                                    {user?.name ?? user?.email ?? `User ${id}`}
                                    <button
                                      type="button"
                                      onClick={() => setUserIds(userIds.filter((x) => x !== id))}
                                      aria-label={`Remove ${user?.name ?? user?.email ?? id}`}
                                      className="hover:text-destructive"
                                    >
                                      <X className="size-3" aria-hidden="true" />
                                    </button>
                                  </Badge>
                                </li>
                              )
                            })}
                          </ul>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor={`${job.key}-email`} className="text-xs font-medium">
                          Other addresses
                        </Label>
                        <div className="flex gap-2">
                          <Input
                            id={`${job.key}-email`}
                            type="email"
                            value={newEmail}
                            onChange={(e) => setNewEmail(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault()
                                addEmail()
                              }
                            }}
                            placeholder="reports@itsmedigital.in"
                            className="h-9 text-xs"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-9 min-h-11 shrink-0 sm:min-h-9"
                            onClick={addEmail}
                            disabled={!newEmail.trim()}
                          >
                            <Plus className="size-3.5" aria-hidden="true" />
                            <span className="sr-only sm:not-sr-only sm:ml-1">Add</span>
                          </Button>
                        </div>
                        {emails.length > 0 && (
                          <ul className="flex flex-wrap gap-1.5 pt-1">
                            {emails.map((email) => (
                              <li key={email}>
                                <Badge variant="outline" className="gap-1 text-[10px]">
                                  {email}
                                  <button
                                    type="button"
                                    onClick={() => setEmails(emails.filter((e) => e !== email))}
                                    aria-label={`Remove ${email}`}
                                    className="hover:text-destructive"
                                  >
                                    <X className="size-3" aria-hidden="true" />
                                  </button>
                                </Badge>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <p className="rounded-lg border border-border/70 bg-muted/20 p-3 text-xs text-muted-foreground">
                  This job always writes to {job.autoRecipients}, so there is nothing to
                  choose — sending it elsewhere would mean mailing people the task has
                  nothing to do with.
                </p>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] text-muted-foreground">
                  {job.updatedBy
                    ? `Last changed by ${job.updatedBy.name ?? "a user"} on ${when(job.updatedAt)}`
                    : "Never changed"}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="min-h-11 sm:min-h-9"
                    disabled={saving}
                    onClick={() => {
                      setExpression(job.cronExpression)
                      setTimezone(job.timezone)
                      setMode(job.recipientMode)
                      setUserIds(job.recipients.map((r) => r.id))
                      setEmails(job.recipientEmails)
                      setFieldError(null)
                      onOpenChange(false)
                    }}
                  >
                    Cancel
                  </Button>
                  <Button size="sm" className="min-h-11 sm:min-h-9" disabled={saving} onClick={save}>
                    {saving ? (
                      <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Save className="mr-2 size-4" aria-hidden="true" />
                    )}
                    Save
                  </Button>
                </div>
              </div>

              {job.runs.length > 0 && (
                <div className="space-y-1.5 border-t border-border/70 pt-3">
                  <h3 className="text-xs font-medium">Recent runs</h3>
                  <ul className="space-y-1">
                    {job.runs.map((run) => (
                      <li key={run.id} className="flex items-start gap-2 text-[11px]">
                        {run.ok ? (
                          <CheckCircle2
                            className="mt-0.5 size-3 shrink-0 text-emerald-600"
                            aria-hidden="true"
                          />
                        ) : (
                          <XCircle className="mt-0.5 size-3 shrink-0 text-destructive" aria-hidden="true" />
                        )}
                        <span className="text-muted-foreground">
                          {when(run.startedAt)}
                          {run.trigger === "manual" ? " (manual)" : ""}
                          {run.message ? ` — ${run.message}` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}
