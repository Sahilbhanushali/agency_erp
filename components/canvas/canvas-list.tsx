"use client"

import { useState } from "react"
import Link from "next/link"
import useSWRInfinite from "swr/infinite"
import { formatDistanceToNow } from "date-fns"
import { AlertCircle, LayoutTemplate, Loader2, MessageSquare, Palette, Plus, Search, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { Input } from "@/components/ui/input"
import { PageHeader } from "@/components/ui/page-header"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { usePermissions } from "@/hooks/use-permissions"
import { useLiveRefresh } from "@/hooks/use-live-refresh"
import { CreateCanvasDialog } from "./create-canvas-dialog"

export interface CanvasSummary {
  id: string
  title: string
  description: string | null
  kind: "CANVAS" | "MOODBOARD"
  background: string
  updatedAt: string
  client: { id: string; name: string } | null
  project: { id: string; name: string } | null
  post: { id: string; title: string } | null
  createdBy: { id: number; name: string } | null
  updatedBy: { id: number; name: string } | null
  _count: { elements: number; comments: number; members: number }
}

type Page = { items: CanvasSummary[]; nextCursor: string | null }

const fetcher = async (url: string): Promise<Page> => {
  const res = await fetch(url)
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error ?? "Could not load boards")
  return body as Page
}

export function CanvasCard({ canvas }: { canvas: CanvasSummary }) {
  const Icon = canvas.kind === "MOODBOARD" ? Palette : LayoutTemplate
  return (
    <Link
      href={`/dashboard/canvas/${canvas.id}`}
      className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Card className="h-full overflow-hidden transition-shadow group-hover:shadow-md">
        <div className="flex h-24 items-center justify-center border-b border-border" style={{ backgroundColor: canvas.background }}>
          <Icon className="size-8 text-slate-500" aria-hidden="true" />
        </div>
        <CardContent className="space-y-2 p-4">
          <div className="flex items-start justify-between gap-2">
            <h3 className="line-clamp-1 font-semibold text-foreground">{canvas.title}</h3>
            <Badge variant="outline" className="flex-shrink-0 text-[11px]">
              {canvas.kind === "MOODBOARD" ? "Mood board" : "Canvas"}
            </Badge>
          </div>
          {canvas.description && <p className="line-clamp-2 text-xs text-muted-foreground">{canvas.description}</p>}
          {(canvas.client || canvas.project) && (
            <p className="line-clamp-1 text-xs text-foreground/80">
              {[canvas.client?.name, canvas.project?.name].filter(Boolean).join(" · ")}
            </p>
          )}
          <div className="flex items-center justify-between gap-2 pt-1 text-xs text-muted-foreground">
            <span className="line-clamp-1">
              {canvas.updatedBy?.name ?? canvas.createdBy?.name ?? "Someone"} · {formatDistanceToNow(new Date(canvas.updatedAt), { addSuffix: true })}
            </span>
            <span className="flex flex-shrink-0 items-center gap-2">
              <span className="flex items-center gap-0.5" aria-label={`${canvas._count.comments} comments`}>
                <MessageSquare className="size-3" aria-hidden="true" />
                {canvas._count.comments}
              </span>
              <span className="flex items-center gap-0.5" aria-label={`Shared with ${canvas._count.members}`}>
                <Users className="size-3" aria-hidden="true" />
                {canvas._count.members}
              </span>
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

export function CanvasList() {
  const { can, isLoading: permissionsLoading } = usePermissions()
  const [q, setQ] = useState("")
  const [kind, setKind] = useState<"ALL" | "CANVAS" | "MOODBOARD">("ALL")
  const [creating, setCreating] = useState(false)

  const params = new URLSearchParams()
  if (q.trim()) params.set("q", q.trim())
  if (kind !== "ALL") params.set("kind", kind)

  const { data, error, isLoading, size, setSize, mutate } = useSWRInfinite(
    (index, previous: Page | null) => {
      if (!can("canvas", "read")) return null
      if (previous && !previous.nextCursor) return null
      const p = new URLSearchParams(params)
      if (previous?.nextCursor) p.set("cursor", previous.nextCursor)
      return `/api/canvases?${p.toString()}`
    },
    fetcher,
  )
  useLiveRefresh(() => mutate(), ["Canvas"])

  const items = data?.flatMap((p) => p.items) ?? []
  const hasMore = !!data?.[data.length - 1]?.nextCursor
  const loadingMore = size > 0 && data && typeof data[size - 1] === "undefined"
  const filtered = q.trim() !== "" || kind !== "ALL"

  if (!permissionsLoading && !can("canvas", "read")) {
    return (
      <EmptyState
        icon={AlertCircle}
        title="Boards are not available to your role"
        description="Ask an administrator to grant Canvas & Mood Boards → Open boards."
      />
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Canvas & Mood Boards" description="Plan campaigns visually: references, palettes, typography and notes in one place.">
        {can("canvas", "create") && (
          <Button onClick={() => setCreating(true)} className="min-h-11 gap-2">
            <Plus className="size-4" aria-hidden="true" />
            New board
          </Button>
        )}
      </PageHeader>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <label htmlFor="canvas-search" className="sr-only">Search boards</label>
          <Input
            id="canvas-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search boards"
            className="min-h-11 pl-9"
          />
        </div>
        <Select value={kind} onValueChange={(v) => setKind(v as typeof kind)}>
          <SelectTrigger className="min-h-11 sm:w-48" aria-label="Board type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All boards</SelectItem>
            <SelectItem value="MOODBOARD">Mood boards</SelectItem>
            <SelectItem value="CANVAS">Canvases</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {(isLoading || permissionsLoading) && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" aria-busy="true">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-52 rounded-xl" />
          ))}
        </div>
      )}

      {error && (
        <EmptyState icon={AlertCircle} title="Boards could not be loaded" description={error.message} actionLabel="Try again" onAction={() => mutate()} />
      )}

      {!isLoading && !error && items.length === 0 && (
        <EmptyState
          icon={Palette}
          title={filtered ? "No boards match" : "No boards yet"}
          description={
            filtered
              ? "Try another search or board type."
              : "Start a mood board for a campaign: collect references, colours and type before the creatives are made."
          }
          {...(!filtered && can("canvas", "create") ? { actionLabel: "New board", onAction: () => setCreating(true) } : {})}
        />
      )}

      {items.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((canvas) => (
            <CanvasCard key={canvas.id} canvas={canvas} />
          ))}
        </div>
      )}

      {hasMore && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => setSize(size + 1)} disabled={!!loadingMore} className="min-h-11">
            {loadingMore && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />}
            Load more
          </Button>
        </div>
      )}

      <CreateCanvasDialog open={creating} onOpenChange={setCreating} />
    </div>
  )
}
