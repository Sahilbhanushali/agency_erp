"use client"

import { useState } from "react"
import useSWR from "swr"
import Link from "next/link"
import toast from "react-hot-toast"
import { formatDistanceToNow } from "date-fns"
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Eye,
  ExternalLink,
  Heart,
  Instagram,
  Loader2,
  Minus,
  RefreshCw,
  Users,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useCan } from "@/hooks/use-can"
import { InsightsChart, type TrendPoint } from "@/components/social/insights-chart"

/**
 * Instagram performance, read from our own tables.
 *
 * Every number here was captured by the sync job rather than fetched now, which is
 * why the page says when it last ran: Meta revises recent figures for up to 48 hours,
 * and story insights disappear from its API after 24, so "live" would be both slower
 * and less complete than this.
 */

interface Totals {
  reach: number
  views: number
  interactions: number
  accountsEngaged: number
  likes: number
  comments: number
  shares: number
  saves: number
}

interface MediaRow {
  id: string
  mediaId: string
  postId: string | null
  mediaType: string | null
  permalink: string | null
  caption: string | null
  thumbnailUrl: string | null
  publishedAt: string | null
  reach: number | null
  views: number | null
  likes: number | null
  comments: number | null
  totalInteractions: number | null
}

interface InsightsResponse {
  accounts: { id: string; username: string; status: string; client: string | null }[]
  account: {
    id: string
    username: string
    profilePictureUrl: string | null
    status: string
    lastSyncedAt: string | null
    client: string | null
  } | null
  days: number
  series: { date: string; reach: number | null; views: number | null; interactions: number | null }[]
  totals: {
    current: Totals
    previous: Totals
    followers: number | null
    followersChange: number | null
    daysWithData: number
  } | null
  topMedia: MediaRow[]
}

const fetcher = async (url: string) => {
  const res = await fetch(url, { cache: "no-store" })
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Request failed")
  return res.json()
}

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 })
const full = new Intl.NumberFormat("en")

type Metric = "reach" | "views" | "interactions"
const METRIC_LABEL: Record<Metric, string> = {
  reach: "Reach",
  views: "Views",
  interactions: "Interactions",
}

export default function InstagramInsightsPage() {
  const { can, ready } = useCan()
  const [accountId, setAccountId] = useState("")
  const [days, setDays] = useState("30")
  const [metric, setMetric] = useState<Metric>("reach")
  const [syncing, setSyncing] = useState(false)

  const { data, error, isLoading, mutate } = useSWR<InsightsResponse>(
    `/api/social/insights?days=${days}${accountId ? `&accountId=${encodeURIComponent(accountId)}` : ""}`,
    fetcher,
  )

  const syncNow = async () => {
    setSyncing(true)
    try {
      const res = await fetch("/api/social/instagram/sync-insights", { method: "POST" })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(body.error ?? "Could not sync")
        return
      }
      toast.success(body.message ?? "Synced")
      mutate()
    } catch {
      toast.error("Could not reach the server")
    } finally {
      setSyncing(false)
    }
  }

  const totals = data?.totals
  const points: TrendPoint[] = (data?.series ?? []).map((s) => ({
    date: s.date,
    value: s[metric],
  }))

  const tiles = totals
    ? [
        { key: "reach", label: "Reach", value: totals.current.reach, previous: totals.previous.reach, Icon: Users, hint: "unique accounts" },
        { key: "views", label: "Views", value: totals.current.views, previous: totals.previous.views, Icon: Eye, hint: "times seen" },
        { key: "interactions", label: "Interactions", value: totals.current.interactions, previous: totals.previous.interactions, Icon: Heart, hint: "likes, comments, saves, shares" },
        { key: "followers", label: "Followers", value: totals.followers ?? 0, previous: totals.followers !== null && totals.followersChange !== null ? totals.followers - totals.followersChange : null, Icon: Instagram, hint: "at last sync" },
      ]
    : []

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">Instagram insights</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            How published content performed, pulled from Instagram on a schedule.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/social/accounts">Accounts</Link>
          </Button>
          {ready && can("social_accounts", "update") && (
            <Button size="sm" onClick={syncNow} disabled={syncing} className="gap-2">
              {syncing ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <RefreshCw className="h-4 w-4" aria-hidden />
              )}
              Sync now
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[98px] rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-[340px] rounded-xl" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center">
          <h2 className="text-base font-semibold text-foreground">Could not load insights</h2>
          <p className="mt-1 text-sm text-muted-foreground">{String(error.message)}</p>
          <Button size="sm" variant="outline" className="mt-4" onClick={() => mutate()}>
            Try again
          </Button>
        </div>
      ) : !data?.account ? (
        <EmptyPanel
          title="No Instagram account connected"
          body="Connect an account and the first sync will fill this page within six hours."
          action={
            <Button size="sm" asChild className="mt-4">
              <Link href="/dashboard/social/accounts">Connect an account</Link>
            </Button>
          }
        />
      ) : (
        <>
          {/* Filters in one row above the charts. */}
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 sm:flex-row sm:items-end">
            <div className="space-y-1.5">
              <Label htmlFor="insights-account">Account</Label>
              <Select value={data.account.id} onValueChange={setAccountId}>
                <SelectTrigger id="insights-account" className="w-full sm:w-[240px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {data.accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      @{a.username}
                      {a.client ? ` — ${a.client}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="insights-range">Period</Label>
              <Select value={days} onValueChange={setDays}>
                <SelectTrigger id="insights-range" className="w-full sm:w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Last 7 days</SelectItem>
                  <SelectItem value="30">Last 30 days</SelectItem>
                  <SelectItem value="90">Last 90 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground sm:ml-auto sm:pb-2">
              {data.account.lastSyncedAt
                ? `Last synced ${formatDistanceToNow(new Date(data.account.lastSyncedAt), { addSuffix: true })}`
                : "Not synced yet"}
            </p>
          </div>

          {totals && totals.daysWithData === 0 ? (
            <EmptyPanel
              title="No numbers for this period yet"
              body="The sync runs every six hours. Instagram also revises recent figures for up to 48 hours, so the newest days fill in gradually."
            />
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {tiles.map(({ key, label, value, previous, Icon, hint }) => (
                  <StatTile
                    key={key}
                    label={label}
                    value={value}
                    previous={previous}
                    Icon={Icon}
                    hint={hint}
                  />
                ))}
              </div>

              <div className="rounded-xl border border-border bg-card p-4 [--viz-series:#2a78d6] dark:[--viz-series:#3987e5]">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">
                      {METRIC_LABEL[metric]} per day
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      @{data.account.username} · last {data.days} days
                    </p>
                  </div>
                  {/* One measure at a time, never two y-scales in one frame. */}
                  <Tabs value={metric} onValueChange={(v) => setMetric(v as Metric)}>
                    <TabsList className="h-8">
                      {(Object.keys(METRIC_LABEL) as Metric[]).map((m) => (
                        <TabsTrigger key={m} value={m} className="h-6 px-3 text-xs">
                          {METRIC_LABEL[m]}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </Tabs>
                </div>
                <InsightsChart points={points} label={METRIC_LABEL[metric]} />
              </div>

              <div className="rounded-xl border border-border bg-card">
                <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                  <BarChart3 className="h-4 w-4 text-muted-foreground" aria-hidden />
                  <h2 className="text-sm font-semibold text-foreground">Top posts</h2>
                  <Badge variant="secondary" className="ml-auto rounded-full tabular-nums">
                    {data.topMedia.length}
                  </Badge>
                </div>
                {data.topMedia.length === 0 ? (
                  <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                    Nothing published in this period has insights yet.
                  </p>
                ) : (
                  <TopPosts rows={data.topMedia} />
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

function StatTile({
  label,
  value,
  previous,
  Icon,
  hint,
}: {
  label: string
  value: number
  previous: number | null
  Icon: typeof Users
  hint: string
}) {
  // No baseline means no comparison. Showing "+100%" against zero history would be
  // a made-up number, so the change simply does not appear.
  const delta =
    previous === null || previous === 0 ? null : Math.round(((value - previous) / previous) * 100)
  const Direction = delta === null ? Minus : delta > 0 ? ArrowUpRight : delta < 0 ? ArrowDownRight : Minus

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-muted">
          <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
        </span>
      </div>
      <p className="mt-3 text-2xl font-bold tabular-nums text-foreground" title={full.format(value)}>
        {compact.format(value)}
      </p>
      <div className="mt-1 flex items-center gap-1.5 text-xs">
        {delta !== null && (
          <span
            className={`inline-flex items-center gap-0.5 font-medium ${
              delta > 0
                ? "text-emerald-700 dark:text-emerald-400"
                : delta < 0
                  ? "text-rose-700 dark:text-rose-400"
                  : "text-muted-foreground"
            }`}
          >
            {/* An arrow as well as a colour — direction is never colour alone. */}
            <Direction className="h-3 w-3" aria-hidden />
            {Math.abs(delta)}%
          </span>
        )}
        <span className="text-muted-foreground">{delta !== null ? "vs previous period" : hint}</span>
      </div>
    </div>
  )
}

function TopPosts({ rows }: { rows: MediaRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-border text-xs text-muted-foreground">
            <th scope="col" className="px-4 py-2 text-left font-medium">Post</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">Reach</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">Views</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">Likes</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">Comments</th>
            <th scope="col" className="px-4 py-2 text-right font-medium">Link</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-border last:border-0">
              <th scope="row" className="px-4 py-2.5 text-left font-normal">
                <div className="flex items-center gap-3">
                  {row.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={row.thumbnailUrl}
                      alt=""
                      loading="lazy"
                      className="h-10 w-10 shrink-0 rounded-md border border-border/60 bg-muted object-cover"
                    />
                  ) : (
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-border/60 bg-muted">
                      <Instagram className="h-4 w-4 text-muted-foreground" aria-hidden />
                    </span>
                  )}
                  <span className="min-w-0">
                    <span className="block max-w-[260px] truncate text-foreground" title={row.caption ?? ""}>
                      {row.caption?.trim() || "No caption"}
                    </span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                      {row.mediaType && (
                        <Badge variant="outline" className="rounded px-1 py-px text-xs">
                          {row.mediaType}
                        </Badge>
                      )}
                      {row.postId && (
                        <Link
                          href={`/dashboard/projects/posts/${row.postId}`}
                          className="underline-offset-2 hover:text-foreground hover:underline"
                        >
                          Open post
                        </Link>
                      )}
                    </span>
                  </span>
                </div>
              </th>
              <td className="px-3 py-2.5 text-right tabular-nums text-foreground">
                {row.reach === null ? "—" : full.format(row.reach)}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                {row.views === null ? "—" : full.format(row.views)}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                {row.likes === null ? "—" : full.format(row.likes)}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                {row.comments === null ? "—" : full.format(row.comments)}
              </td>
              <td className="px-4 py-2.5 text-right">
                {row.permalink && (
                  <a
                    href={row.permalink}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Open this post on Instagram"
                    className="inline-grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <ExternalLink className="h-4 w-4" aria-hidden />
                  </a>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function EmptyPanel({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card px-6 py-14 text-center">
      <span className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-muted">
        <BarChart3 className="h-5 w-5 text-muted-foreground" aria-hidden />
      </span>
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{body}</p>
      {action}
    </div>
  )
}
