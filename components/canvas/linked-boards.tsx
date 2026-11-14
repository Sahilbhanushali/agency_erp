"use client"

import { useState } from "react"
import Link from "next/link"
import useSWR from "swr"
import { LayoutTemplate, Palette, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { usePermissions } from "@/hooks/use-permissions"
import { CreateCanvasDialog } from "./create-canvas-dialog"
import type { CanvasSummary } from "./canvas-list"

const fetcher = async (url: string) => {
  const res = await fetch(url)
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error ?? "Could not load boards")
  return body as { items: CanvasSummary[] }
}

/**
 * Mood boards for a campaign (and, on a post, the boards for that post's campaign), so
 * the creative direction sits next to the work it guides. Hidden for roles without
 * canvas access.
 */
export function LinkedBoards({ projectId, postId }: { projectId: string; postId?: string }) {
  const { can, isLoading: permissionsLoading } = usePermissions()
  const [creating, setCreating] = useState(false)
  const allowed = can("canvas", "read")
  const { data, error, isLoading } = useSWR(allowed ? `/api/canvases?projectId=${encodeURIComponent(projectId)}` : null, fetcher)

  if (permissionsLoading || !allowed) return null
  const boards = data?.items ?? []
  // A post shows its own boards first, then the rest of the campaign's.
  const ordered = postId ? [...boards.filter((b) => b.post?.id === postId), ...boards.filter((b) => b.post?.id !== postId)] : boards

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 border-b border-border bg-muted/30 px-4 py-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Palette className="size-4 text-primary" aria-hidden="true" />
            Mood boards
          </CardTitle>
          <CardDescription className="text-xs">Creative direction for this campaign.</CardDescription>
        </div>
        {can("canvas", "create") && (
          <Button size="sm" variant="outline" onClick={() => setCreating(true)} className="min-h-9 gap-1.5">
            <Plus className="size-3.5" aria-hidden="true" /> New
          </Button>
        )}
      </CardHeader>
      <CardContent className="p-3">
        {isLoading && <div className="space-y-2" aria-busy="true"><Skeleton className="h-11" /><Skeleton className="h-11" /></div>}
        {error && <p role="alert" className="text-sm text-destructive">{error.message}</p>}
        {data && ordered.length === 0 && (
          <p className="py-2 text-sm text-muted-foreground">
            No boards yet.{can("canvas", "create") ? " Start one to collect references, colours and type for the designers." : ""}
          </p>
        )}
        <ul className="space-y-1">
          {ordered.slice(0, 6).map((board) => (
            <li key={board.id}>
              <Link
                href={`/dashboard/canvas/${board.id}`}
                className="flex min-h-11 items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {board.kind === "MOODBOARD" ? (
                  <Palette className="size-4 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
                ) : (
                  <LayoutTemplate className="size-4 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
                )}
                <span className="min-w-0 flex-1 truncate">{board.title}</span>
                {postId && board.post?.id === postId && <span className="text-xs text-primary">This post</span>}
              </Link>
            </li>
          ))}
        </ul>
        {ordered.length > 6 && (
          <Link href="/dashboard/canvas" className="mt-2 inline-block text-xs text-primary underline-offset-2 hover:underline">
            See all {ordered.length} boards
          </Link>
        )}
      </CardContent>
      <CreateCanvasDialog open={creating} onOpenChange={setCreating} projectId={projectId} postId={postId} />
    </Card>
  )
}
