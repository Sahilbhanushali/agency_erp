"use client"

import { useState } from "react"
import useSWR from "swr"
import toast from "react-hot-toast"
import { format } from "date-fns"
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  ExternalLink,
  Instagram,
  Loader2,
  RotateCcw,
  Send,
  XCircle,
} from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useCan } from "@/hooks/use-can"

/**
 * Scheduling a post to Instagram, and what happened to it afterwards.
 *
 * Mounted by the dashboard post page rather than inside PostDetail, which is also
 * rendered for clients on the public share link — publishing controls must not appear
 * there at all, and the surest way to guarantee that is for the component never to be
 * part of that tree.
 *
 * Hiding the form is presentation only; /api/social/instagram/publish re-checks
 * posts:publish on every request.
 */

interface PublishJob {
  id: string
  status: "PENDING" | "CLAIMED" | "PROCESSING" | "PUBLISHED" | "FAILED" | "CANCELLED"
  scheduledFor: string
  mediaType: string
  attempts: number
  maxAttempts: number
  nextAttemptAt: string | null
  lastError: string | null
  permalink: string | null
  publishedAt: string | null
  socialAccount: { id: string; username: string; status: string } | null
}

interface Account {
  id: string
  username: string
  profilePictureUrl: string | null
  clientId: string | null
}

interface QueueResponse {
  job: PublishJob | null
  accounts: Account[]
  post: { type: string; hasCaption: boolean; assetCount: number; scheduledAt: string | null }
}

const fetcher = async (url: string) => {
  const res = await fetch(url, { cache: "no-store" })
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Request failed")
  return res.json()
}

/** Instagram's own vocabulary, in ours. */
const MEDIA_TYPE_LABEL: Record<string, string> = {
  IMAGE: "Single image",
  CAROUSEL: "Carousel",
  REELS: "Reel",
  STORIES: "Story",
}

const SUPPORTED_POST_TYPES = ["PHOTO", "CAROUSEL", "REEL", "STORY"]

/** A datetime-local value for the browser, from a date or now. */
function toLocalInput(value: string | null | undefined): string {
  const d = value ? new Date(value) : new Date()
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function InstagramPublishCard({ postId }: { postId: string }) {
  const { can, ready } = useCan()
  const canPublish = ready && can("posts", "publish")

  const { data, error, isLoading, mutate } = useSWR<QueueResponse>(
    `/api/social/instagram/publish?postId=${encodeURIComponent(postId)}`,
    fetcher,
    {
      // While the worker has it, the row changes without anything the browser did.
      refreshInterval: (latest) =>
        latest?.job && ["CLAIMED", "PROCESSING"].includes(latest.job.status) ? 10_000 : 0,
    },
  )

  const [accountId, setAccountId] = useState("")
  const [when, setWhen] = useState("")
  const [busy, setBusy] = useState(false)

  const job = data?.job ?? null
  const accounts = data?.accounts ?? []
  const post = data?.post

  // Initialise the form once the post's own schedule is known.
  const scheduleValue = when || toLocalInput(post?.scheduledAt)
  // On a re-queue, default to the account the job already used rather than whichever
  // one happens to sort first — the form is not on screen for the person to correct.
  const selectedAccount = accountId || job?.socialAccount?.id || accounts[0]?.id || ""

  const schedule = async () => {
    if (!selectedAccount) {
      toast.error("Choose an Instagram account first")
      return
    }
    setBusy(true)
    try {
      const res = await fetch("/api/social/instagram/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postId,
          socialAccountId: selectedAccount,
          scheduledFor: new Date(scheduleValue).toISOString(),
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        // The API's refusals are written for this reader — show them as-is.
        toast.error(body.error ?? "Could not schedule this post")
        return
      }
      toast.success("Queued for Instagram")
      mutate()
    } catch {
      toast.error("Could not reach the server")
    } finally {
      setBusy(false)
    }
  }

  const cancel = async () => {
    setBusy(true)
    try {
      const res = await fetch("/api/social/instagram/publish", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(body.error ?? "Could not cancel")
        return
      }
      toast.success("Removed from the queue")
      mutate()
    } catch {
      toast.error("Could not reach the server")
    } finally {
      setBusy(false)
    }
  }

  // Nothing to show someone who can neither publish nor see a queued post.
  if (ready && !canPublish && !job) return null

  return (
    <Card>
      <CardHeader className="border-b border-border py-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Instagram className="h-4 w-4 text-pink-600 dark:text-pink-400" aria-hidden />
          Instagram publishing
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        {isLoading || !ready ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-48" />
          </div>
        ) : error ? (
          <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">
                Could not load the publishing status
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">{String(error.message)}</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => mutate()}>
              Retry
            </Button>
          </div>
        ) : job ? (
          <JobState job={job} canPublish={canPublish} busy={busy} onCancel={cancel} onRetry={schedule} />
        ) : !post || !SUPPORTED_POST_TYPES.includes(post.type) ? (
          <Empty
            icon={AlertCircle}
            title="This post type cannot go to Instagram"
            body={`Instagram takes photos, carousels, reels and stories. This post is a ${post?.type?.toLowerCase() ?? "different type"}.`}
          />
        ) : accounts.length === 0 ? (
          <Empty
            icon={Instagram}
            title="No Instagram account connected"
            body="Connect the client's Instagram account before scheduling anything to it."
            action={
              <Button size="sm" variant="outline" asChild className="mt-3">
                <Link href="/dashboard/social/accounts">Connect an account</Link>
              </Button>
            }
          />
        ) : post.assetCount === 0 ? (
          <Empty
            icon={AlertCircle}
            title="No media to publish"
            body="Upload the creative to this post first — Instagram downloads the file from this server when it publishes."
          />
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="ig-account">Publish to</Label>
                <Select value={selectedAccount} onValueChange={setAccountId}>
                  <SelectTrigger id="ig-account">
                    <SelectValue placeholder="Choose an account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        @{a.username}
                        {a.clientId === null ? " (agency)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ig-when">Go live at</Label>
                <Input
                  id="ig-when"
                  type="datetime-local"
                  value={scheduleValue}
                  onChange={(e) => setWhen(e.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="secondary" className="rounded">
                {MEDIA_TYPE_LABEL[post.type === "PHOTO" ? "IMAGE" : post.type === "REEL" ? "REELS" : post.type === "STORY" ? "STORIES" : post.type] ?? post.type}
              </Badge>
              <span>
                {post.assetCount} {post.assetCount === 1 ? "asset" : "assets"}
              </span>
              {!post.hasCaption && post.type !== "STORY" && (
                <span className="text-amber-700 dark:text-amber-400">· no caption set</span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button onClick={schedule} disabled={busy || !canPublish} className="gap-2">
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Send className="h-4 w-4" aria-hidden />
                )}
                Schedule
              </Button>
              <p className="text-xs text-muted-foreground">
                Publishing runs on the server, so this happens whether or not this tab is open.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function Empty({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: typeof Instagram
  title: string
  body: string
  action?: React.ReactNode
}) {
  return (
    <div className="py-6 text-center">
      <span className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-full bg-muted">
        <Icon className="h-5 w-5 text-muted-foreground" aria-hidden />
      </span>
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">{body}</p>
      {action}
    </div>
  )
}

/** What the queue row currently says, in words rather than enum names. */
function JobState({
  job,
  canPublish,
  busy,
  onCancel,
  onRetry,
}: {
  job: PublishJob
  canPublish: boolean
  busy: boolean
  onCancel: () => void
  onRetry: () => void
}) {
  const account = job.socialAccount ? `@${job.socialAccount.username}` : "a removed account"

  if (job.status === "PUBLISHED") {
    return (
      <div className="flex items-start gap-3">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">Live on Instagram</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Published to {account}
            {job.publishedAt && ` on ${format(new Date(job.publishedAt), "d MMM yyyy 'at' HH:mm")}`}
          </p>
          {job.permalink && (
            <Button size="sm" variant="outline" asChild className="mt-3 gap-2">
              <a href={job.permalink} target="_blank" rel="noopener noreferrer">
                View on Instagram
                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              </a>
            </Button>
          )}
        </div>
      </div>
    )
  }

  if (job.status === "FAILED") {
    return (
      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">
              Publishing failed after {job.attempts} {job.attempts === 1 ? "attempt" : "attempts"}
            </p>
            <p className="mt-0.5 break-words text-xs text-muted-foreground">
              {job.lastError ?? "No reason was recorded."}
            </p>
          </div>
        </div>
        {canPublish && (
          <Button size="sm" variant="outline" onClick={onRetry} disabled={busy} className="gap-2">
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            Queue it again
          </Button>
        )}
      </div>
    )
  }

  if (job.status === "CANCELLED") {
    return (
      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
          <div>
            <p className="text-sm font-medium text-foreground">Removed from the queue</p>
            <p className="mt-0.5 text-xs text-muted-foreground">This post will not be published.</p>
          </div>
        </div>
        {canPublish && (
          <Button size="sm" variant="outline" onClick={onRetry} disabled={busy} className="gap-2">
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            Queue it again
          </Button>
        )}
      </div>
    )
  }

  const inFlight = job.status === "CLAIMED" || job.status === "PROCESSING"

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        {inFlight ? (
          <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-primary" aria-hidden />
        ) : (
          <Clock className="mt-0.5 h-5 w-5 shrink-0 text-violet-600 dark:text-violet-400" aria-hidden />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">
            {inFlight ? "Publishing now" : "Scheduled"}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {inFlight
              ? `Sending to ${account}. Instagram is processing the media.`
              : `Goes to ${account} on ${format(new Date(job.scheduledFor), "d MMM yyyy 'at' HH:mm")}.`}
          </p>
          {/* A retry in progress is worth saying out loud — it explains the delay. */}
          {job.attempts > 1 && (
            <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
              Attempt {job.attempts} of {job.maxAttempts}
              {job.lastError ? `: ${job.lastError}` : ""}
            </p>
          )}
        </div>
      </div>
      {canPublish && job.status === "PENDING" && (
        <Button size="sm" variant="outline" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
      )}
      {inFlight && (
        <p className="text-xs text-muted-foreground">
          This can no longer be cancelled — a container may already exist on Instagram.
        </p>
      )}
    </div>
  )
}
