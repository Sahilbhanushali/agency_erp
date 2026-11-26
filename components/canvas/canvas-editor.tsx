"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import useSWR from "swr"
import toast from "react-hot-toast"
import {
  AlertCircle, ArrowLeft, Check, CloudOff, Copy, Expand, Heading1, Image as ImageIcon, Link2, Loader2, Maximize,
  Minus, Palette, PanelRightClose, PanelRightOpen, Plus, Shrink, SquareDashed, StickyNote, Trash2, Type,
} from "lucide-react"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { useLiveRefresh } from "@/hooks/use-live-refresh"
import { useBreadcrumbTitle } from "@/lib/route-labels"
import { CanvasElementView, CommentCountBadge } from "./canvas-element-view"
import { CanvasInspector } from "./canvas-inspector"
import { CanvasActivity, CanvasComments, CanvasSharing } from "./canvas-panels"
import { type CanvasAccessInfo, type CanvasDetail, type CanvasElementData, type ElementType, describeElement } from "./types"

const MIN_SCALE = 0.2
const MAX_SCALE = 3
const DATA_SAVE_DELAY = 600
const NO_PROJECT = "__none__"

const fetcher = async <T,>(url: string): Promise<T> => {
  const res = await fetch(url)
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw Object.assign(new Error(body.error ?? "Could not load the board"), { status: res.status })
  return body as T
}

async function request<T = unknown>(url: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const result = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(result.error ?? "The change could not be saved")
  return result as T
}

type View = { x: number; y: number; scale: number }
type Gesture =
  | { kind: "pan"; startX: number; startY: number; viewX: number; viewY: number }
  | { kind: "move"; startX: number; startY: number; origin: Map<string, { x: number; y: number }>; moved: boolean }
  | { kind: "resize"; id: string; startX: number; startY: number; width: number; height: number; moved: boolean }

const STARTERS: Record<Exclude<ElementType, "IMAGE" | "LINK">, Record<string, unknown>> = {
  HEADING: { text: "Heading" },
  TEXT: { text: "" },
  NOTE: { text: "", color: "#fef08a" },
  COLOR: { hex: "#6366f1", label: "" },
  SECTION: { title: "New section", color: "#e2e8f0" },
}

/** Elements fully inside a section move with it. */
function insideSection(section: CanvasElementData, el: CanvasElementData) {
  return (
    el.id !== section.id &&
    el.x >= section.x && el.y >= section.y &&
    el.x + el.width <= section.x + section.width &&
    el.y + el.height <= section.y + section.height
  )
}

export function CanvasEditor({ canvasId }: { canvasId: string }) {
  const router = useRouter()
  const { data: session } = useSession()
  const currentUserId = Number(session?.user?.id ?? 0)
  const url = `/api/canvases/${canvasId}`
  const { data, error, isLoading, mutate } = useSWR<{ canvas: CanvasDetail; access: CanvasAccessInfo }>(url, fetcher, {
    revalidateOnFocus: false,
  })
  useBreadcrumbTitle(canvasId, data?.canvas.title)

  const [elements, setElements] = useState<Record<string, CanvasElementData>>({})
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [view, setView] = useState<View>({ x: 40, y: 40, scale: 1 })
  const [tab, setTab] = useState("item")
  const [commentElementId, setCommentElementId] = useState<string | null>(null)
  const [pending, setPending] = useState(0)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [adding, setAdding] = useState<"IMAGE" | "LINK" | null>(null)
  const [confirm, setConfirm] = useState<{ kind: "element"; element: CanvasElementData } | { kind: "board" } | null>(null)
  const [title, setTitle] = useState("")
  const [isPanelOpen, setIsPanelOpen] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const viewportRef = useRef<HTMLDivElement>(null)
  const gesture = useRef<Gesture | null>(null)
  const dirty = useRef(new Set<string>())
  const dataTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const pendingData = useRef(new Map<string, Record<string, unknown>>())
  const keyMoveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fitted = useRef(false)
  // Latest committed elements, for saving from event handlers and timers without
  // putting side effects inside state updaters (which React may run twice).
  const elementsRef = useRef(elements)
  elementsRef.current = elements

  const access = data?.access
  const canEdit = !!access?.canEdit
  const list = useMemo(() => Object.values(elements).sort((a, b) => a.z - b.z), [elements])
  const selected = selectedId ? elements[selectedId] ?? null : null

  // Server → local, keeping anything this tab is still changing.
  useEffect(() => {
    if (!data) return
    setTitle((t) => (document.activeElement?.id === "canvas-title" ? t : data.canvas.title))
    setElements((prev) => {
      const next: Record<string, CanvasElementData> = {}
      for (const el of data.canvas.elements) {
        next[el.id] = dirty.current.has(el.id) && prev[el.id] ? prev[el.id] : el
      }
      return next
    })
  }, [data])

  useLiveRefresh(() => {
    if (!gesture.current) void mutate()
  }, ["CanvasElement", "Canvas", "CanvasMember"])

  // Saves are tracked so the header can say "Saving…", "Saved" or what went wrong.
  const track = useCallback(async <T,>(work: Promise<T>): Promise<T | undefined> => {
    setPending((n) => n + 1)
    try {
      const result = await work
      setSaveError(null)
      return result
    } catch (err) {
      const message = err instanceof Error ? err.message : "The change could not be saved"
      setSaveError(message)
      toast.error(message)
      void mutate() // show what the server actually has
      return undefined
    } finally {
      setPending((n) => n - 1)
    }
  }, [mutate])

  const saveGeometry = useCallback(
    (ids: string[], snapshot: Record<string, CanvasElementData>) => {
      const payload = ids.map((id) => {
        const el = snapshot[id]
        return { id, x: Math.round(el.x), y: Math.round(el.y), width: Math.round(el.width), height: Math.round(el.height), z: el.z }
      })
      ids.forEach((id) => dirty.current.add(id))
      void track(request(`${url}/elements`, "PATCH", { elements: payload })).finally(() => {
        ids.forEach((id) => {
          if (!dataTimers.current.has(id)) dirty.current.delete(id)
        })
      })
    },
    [track, url],
  )

  const updateData = useCallback(
    (id: string, patch: Record<string, unknown>) => {
      setElements((prev) => (prev[id] ? { ...prev, [id]: { ...prev[id], data: { ...prev[id].data, ...patch } } } : prev))
      dirty.current.add(id)
      pendingData.current.set(id, { ...(pendingData.current.get(id) ?? {}), ...patch })
      const existing = dataTimers.current.get(id)
      if (existing) clearTimeout(existing)
      dataTimers.current.set(
        id,
        setTimeout(() => {
          dataTimers.current.delete(id)
          const body = pendingData.current.get(id)
          pendingData.current.delete(id)
          if (!body) return
          void track(request(`${url}/elements/${id}`, "PATCH", { data: body })).finally(() => {
            if (!dataTimers.current.has(id)) dirty.current.delete(id)
          })
        }, DATA_SAVE_DELAY),
      )
    },
    [track, url],
  )

  // Flush unsaved text when leaving the page.
  useEffect(() => {
    const timers = dataTimers.current
    const queued = pendingData.current
    return () => {
      for (const [id, timer] of timers) {
        clearTimeout(timer)
        const body = queued.get(id)
        if (body) void fetch(`${url}/elements/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data: body }), keepalive: true })
      }
    }
  }, [url])

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (pendingData.current.size > 0 || pending > 0) e.preventDefault()
    }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [pending])

  // ---- view -------------------------------------------------------------------------

  /**
   * "all" fits the whole board on screen (the Fit button). "width" fits only its width and
   * starts at the top: fitting a tall board's height too (a mood board is 3 rows of
   * sections) opened it at ~30% where nothing was readable. The rest is a pan away.
   */
  const fitToContent = useCallback((mode: "all" | "width" = "all") => {
    const el = viewportRef.current
    const items = Object.values(elements)
    if (!el) return
    if (items.length === 0) {
      setView({ x: 40, y: 40, scale: 1 })
      return
    }
    const minX = Math.min(...items.map((i) => i.x))
    const minY = Math.min(...items.map((i) => i.y))
    const maxX = Math.max(...items.map((i) => i.x + i.width))
    const maxY = Math.max(...items.map((i) => i.y + i.height))
    const pad = 40
    const fitWidth = (el.clientWidth - pad * 2) / (maxX - minX || 1)
    const fitHeight = (el.clientHeight - pad * 2) / (maxY - minY || 1)
    const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.min(mode === "all" ? Math.min(fitWidth, fitHeight) : fitWidth, 1)))
    setView({ scale, x: pad - minX * scale + (el.clientWidth - pad * 2 - (maxX - minX) * scale) / 2, y: pad - minY * scale })
  }, [elements])

  useEffect(() => {
    if (!fitted.current && data && Object.keys(elements).length === data.canvas.elements.length) {
      fitted.current = true
      fitToContent("width")
    }
  }, [data, elements, fitToContent])

  // Full screen: Esc leaves it (unless a field or dialog has focus), and the page behind
  // must not scroll under the overlay.
  useEffect(() => {
    if (!isFullscreen) return
    const onKey = (e: KeyboardEvent) => {
      const active = document.activeElement
      if (e.key === "Escape" && (!active || active === document.body || active === viewportRef.current)) setIsFullscreen(false)
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    window.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener("keydown", onKey)
    }
  }, [isFullscreen])

  const zoomAt = useCallback((factor: number, clientX?: number, clientY?: number) => {
    const el = viewportRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const cx = (clientX ?? rect.left + rect.width / 2) - rect.left
    const cy = (clientY ?? rect.top + rect.height / 2) - rect.top
    setView((v) => {
      const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, v.scale * factor))
      const k = scale / v.scale
      return { scale, x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k }
    })
  }, [])

  // Wheel: ctrl/⌘ (and trackpad pinch) zooms, plain wheel pans. Non-passive to stop page scroll.
  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      if (e.ctrlKey || e.metaKey) zoomAt(Math.exp(-e.deltaY * 0.01), e.clientX, e.clientY)
      else setView((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }))
    }
    el.addEventListener("wheel", onWheel, { passive: false })
    return () => el.removeEventListener("wheel", onWheel)
  }, [zoomAt, data])

  // ---- pointer gestures ---------------------------------------------------------------

  const capture = (e: React.PointerEvent) => viewportRef.current?.setPointerCapture(e.pointerId)

  const onViewportPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    capture(e)
    gesture.current = { kind: "pan", startX: e.clientX, startY: e.clientY, viewX: view.x, viewY: view.y }
    setSelectedId(null)
  }

  const onElementPointerDown = (e: React.PointerEvent, el: CanvasElementData) => {
    if (e.button !== 0) return
    e.stopPropagation()
    setSelectedId(el.id)
    if (!canEdit) return
    capture(e)
    const moving = el.type === "SECTION" ? [el, ...Object.values(elements).filter((o) => insideSection(el, o))] : [el]
    gesture.current = {
      kind: "move",
      startX: e.clientX,
      startY: e.clientY,
      origin: new Map(moving.map((m) => [m.id, { x: m.x, y: m.y }])),
      moved: false,
    }
  }

  const onResizePointerDown = (e: React.PointerEvent, el: CanvasElementData) => {
    if (e.button !== 0) return
    e.stopPropagation()
    capture(e)
    setSelectedId(el.id)
    gesture.current = { kind: "resize", id: el.id, startX: e.clientX, startY: e.clientY, width: el.width, height: el.height, moved: false }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const g = gesture.current
    if (!g) return
    if (g.kind === "pan") {
      setView((v) => ({ ...v, x: g.viewX + e.clientX - g.startX, y: g.viewY + e.clientY - g.startY }))
      return
    }
    const dx = (e.clientX - g.startX) / view.scale
    const dy = (e.clientY - g.startY) / view.scale
    if (Math.abs(dx) + Math.abs(dy) > 1) g.moved = true
    if (g.kind === "move") {
      setElements((prev) => {
        const next = { ...prev }
        for (const [id, o] of g.origin) if (next[id]) next[id] = { ...next[id], x: o.x + dx, y: o.y + dy }
        return next
      })
    } else {
      setElements((prev) =>
        prev[g.id]
          ? { ...prev, [g.id]: { ...prev[g.id], width: Math.min(4000, Math.max(24, g.width + dx)), height: Math.min(4000, Math.max(24, g.height + dy)) } }
          : prev,
      )
    }
  }

  const onPointerUp = () => {
    const g = gesture.current
    gesture.current = null
    if (!g || g.kind === "pan" || !g.moved) return
    const ids = g.kind === "move" ? [...g.origin.keys()] : [g.id]
    saveGeometry(ids, elementsRef.current)
  }

  // ---- keyboard ---------------------------------------------------------------------

  const onElementKeyDown = (e: React.KeyboardEvent, el: CanvasElementData) => {
    if (e.key === "Escape") {
      setSelectedId(null)
      ;(e.currentTarget as HTMLElement).blur()
      return
    }
    if (!canEdit) return
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault()
      setConfirm({ kind: "element", element: el })
      return
    }
    const step = e.shiftKey ? 10 : 1
    const delta = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key]
    if (!delta) return
    e.preventDefault()
    setElements((prev) => ({ ...prev, [el.id]: { ...prev[el.id], x: prev[el.id].x + delta[0], y: prev[el.id].y + delta[1] } }))
    dirty.current.add(el.id)
    if (keyMoveTimer.current) clearTimeout(keyMoveTimer.current)
    keyMoveTimer.current = setTimeout(() => saveGeometry([el.id], elementsRef.current), 400)
  }

  // ---- element actions ----------------------------------------------------------------

  const centre = (w: number, h: number) => {
    const el = viewportRef.current
    const vw = el?.clientWidth ?? 800
    const vh = el?.clientHeight ?? 600
    const jitter = (Object.keys(elements).length % 6) * 16
    return { x: Math.round((vw / 2 - view.x) / view.scale - w / 2 + jitter), y: Math.round((vh / 2 - view.y) / view.scale - h / 2 + jitter) }
  }

  const addElement = async (type: ElementType, elementData: Record<string, unknown>, size?: { width: number; height: number }) => {
    const dims = size ?? { width: type === "SECTION" ? 700 : type === "HEADING" ? 420 : 260, height: type === "SECTION" ? 460 : type === "HEADING" ? 70 : 180 }
    const created = await track(
      request<CanvasElementData>(`${url}/elements`, "POST", { type, data: elementData, ...dims, ...centre(dims.width, dims.height) }),
    )
    if (!created) return
    setElements((prev) => ({ ...prev, [created.id]: created }))
    setSelectedId(created.id)
    setTab("item")
    void mutate()
  }

  const restack = (el: CanvasElementData, toFront: boolean) => {
    const zs = Object.values(elements).map((e) => e.z)
    const z = toFront ? Math.max(...zs) + 1 : Math.min(...zs) - 1
    const next = { ...elements, [el.id]: { ...el, z } }
    setElements(next)
    saveGeometry([el.id], next)
  }

  const duplicateElement = (el: CanvasElementData) => {
    if (el.type === "IMAGE" && typeof el.data.storageKey === "string") {
      toast("Uploaded images can't be copied on the same board — upload it again or duplicate the board.")
      return
    }
    void addElement(el.type, el.data, { width: el.width, height: el.height })
  }

  const deleteElement = async (el: CanvasElementData) => {
    const ok = await track(request(`${url}/elements/${el.id}`, "DELETE"))
    if (ok === undefined) return
    setElements((prev) => {
      const next = { ...prev }
      delete next[el.id]
      return next
    })
    if (selectedId === el.id) setSelectedId(null)
    void mutate()
  }

  // ---- board actions ------------------------------------------------------------------

  const patchBoard = async (patch: Record<string, unknown>) => {
    const ok = await track(request(url, "PATCH", patch))
    if (ok !== undefined) void mutate()
  }

  const duplicateBoard = async () => {
    const copy = await track(request<{ id: string }>(`${url}/duplicate`, "POST"))
    if (copy) {
      toast.success("Board duplicated")
      router.push(`/dashboard/canvas/${copy.id}`)
    }
  }

  const deleteBoard = async () => {
    const ok = await track(request(url, "DELETE"))
    if (ok !== undefined) {
      toast.success("Board deleted")
      router.push("/dashboard/canvas")
    }
  }

  // ---- render -----------------------------------------------------------------------

  if (isLoading) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Loading board">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-[60vh] w-full rounded-xl" />
      </div>
    )
  }

  if (error || !data) {
    const status = (error as { status?: number } | undefined)?.status
    return (
      <div role="alert" className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-10 text-center">
        <AlertCircle className="size-8 text-destructive" aria-hidden="true" />
        <p className="font-medium">{status === 404 ? "This board doesn't exist or isn't shared with you." : (error?.message ?? "Could not load the board")}</p>
        <div className="flex gap-2">
          <Button variant="outline" asChild><Link href="/dashboard/canvas">All boards</Link></Button>
          {status !== 404 && status !== 403 && <Button onClick={() => mutate()}>Try again</Button>}
        </div>
      </div>
    )
  }

  const { canvas } = data
  const accessInfo = data.access
  const saving = pending > 0 || pendingData.current.size > 0

  return (
    <div
      className={
        isFullscreen
          ? "fixed inset-0 z-50 flex flex-col gap-3 overflow-y-auto bg-background p-3 sm:p-4"
          : "flex min-h-[calc(100dvh-8rem)] flex-col gap-3"
      }
    >
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <Button variant="ghost" size="icon" asChild className="size-11 flex-shrink-0">
            <Link href="/dashboard/canvas" aria-label="Back to all boards"><ArrowLeft className="size-4" aria-hidden="true" /></Link>
          </Button>
          <div className="min-w-0">
            {canEdit ? (
              <>
                <label htmlFor="canvas-title" className="sr-only">Board title</label>
                <Input
                  id="canvas-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={() => title.trim() && title.trim() !== canvas.title && void patchBoard({ title: title.trim() })}
                  onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                  maxLength={160}
                  className="h-10 border-transparent px-2 text-lg font-bold shadow-none hover:border-border focus-visible:border-border sm:text-xl"
                />
              </>
            ) : (
              <h1 className="truncate px-2 text-lg font-bold sm:text-xl">{canvas.title}</h1>
            )}
            <p className="flex flex-wrap items-center gap-x-2 px-2 text-xs text-muted-foreground">
              <Badge variant="outline" className="text-[11px]">{canvas.kind === "MOODBOARD" ? "Mood board" : "Canvas"}</Badge>
              {canvas.client && <span>{canvas.client.name}</span>}
              {canvas.project && <Link href={`/dashboard/projects/${canvas.project.id}`} className="underline-offset-2 hover:underline">{canvas.project.name}</Link>}
              {canvas.post && <Link href={`/dashboard/projects/posts/${canvas.post.id}`} className="underline-offset-2 hover:underline">Post: {canvas.post.title}</Link>}
              <span>· Created by {canvas.createdBy?.name ?? "someone"}{canvas.updatedBy ? `, last edited by ${canvas.updatedBy.name}` : ""}</span>
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1 text-xs text-muted-foreground" role="status" aria-live="polite">
            {saveError ? (
              <><CloudOff className="size-3.5 text-destructive" aria-hidden="true" /> Not saved</>
            ) : saving ? (
              <><Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> Saving…</>
            ) : canEdit ? (
              <><Check className="size-3.5" aria-hidden="true" /> Saved</>
            ) : (
              "View only"
            )}
          </span>
          <Button variant="outline" size="sm" onClick={duplicateBoard} className="min-h-9 gap-1.5">
            <Copy className="size-3.5" aria-hidden="true" /> Duplicate
          </Button>
          {accessInfo.canDelete && (
            <Button variant="outline" size="sm" onClick={() => setConfirm({ kind: "board" })} className="min-h-9 gap-1.5 text-destructive hover:text-destructive">
              <Trash2 className="size-3.5" aria-hidden="true" /> Delete
            </Button>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border bg-card p-1.5" role="toolbar" aria-label="Board tools">
        {canEdit && (
          <>
            {(
              [
                { type: "HEADING", label: "Heading", icon: Heading1 },
                { type: "TEXT", label: "Text", icon: Type },
                { type: "NOTE", label: "Note", icon: StickyNote },
                { type: "COLOR", label: "Colour", icon: Palette },
                { type: "SECTION", label: "Section", icon: SquareDashed },
              ] as const
            ).map((tool) => (
              <Button key={tool.type} type="button" variant="ghost" size="sm" onClick={() => addElement(tool.type, STARTERS[tool.type])} className="min-h-10 gap-1.5">
                <tool.icon className="size-4" aria-hidden="true" />
                <span className="hidden sm:inline">{tool.label}</span>
                <span className="sr-only sm:hidden">Add {tool.label.toLowerCase()}</span>
              </Button>
            ))}
            <Button type="button" variant="ghost" size="sm" onClick={() => setAdding("IMAGE")} className="min-h-10 gap-1.5">
              <ImageIcon className="size-4" aria-hidden="true" />
              <span className="hidden sm:inline">Image</span>
              <span className="sr-only sm:hidden">Add image</span>
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setAdding("LINK")} className="min-h-10 gap-1.5">
              <Link2 className="size-4" aria-hidden="true" />
              <span className="hidden sm:inline">Link</span>
              <span className="sr-only sm:hidden">Add link</span>
            </Button>
            <span className="mx-1 hidden h-6 w-px bg-border sm:block" aria-hidden="true" />
          </>
        )}
        <div className="ml-auto flex items-center gap-1">
          <Button type="button" variant="ghost" size="icon" onClick={() => zoomAt(1 / 1.2)} className="size-10" aria-label="Zoom out"><Minus className="size-4" aria-hidden="true" /></Button>
          <span className="w-12 text-center text-xs tabular-nums" aria-live="polite">{Math.round(view.scale * 100)}%</span>
          <Button type="button" variant="ghost" size="icon" onClick={() => zoomAt(1.2)} className="size-10" aria-label="Zoom in"><Plus className="size-4" aria-hidden="true" /></Button>
          <Button type="button" variant="ghost" size="icon" onClick={() => fitToContent("all")} className="size-10" aria-label="Fit board to screen" title="Fit board to screen"><Maximize className="size-4" aria-hidden="true" /></Button>
          <span className="mx-1 h-6 w-px bg-border" aria-hidden="true" />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setIsPanelOpen((open) => !open)}
            className="size-10"
            aria-label={isPanelOpen ? "Hide side panel" : "Show side panel"}
            aria-pressed={!isPanelOpen}
            title={isPanelOpen ? "Hide side panel" : "Show side panel"}
          >
            {isPanelOpen ? <PanelRightClose className="size-4" aria-hidden="true" /> : <PanelRightOpen className="size-4" aria-hidden="true" />}
          </Button>
          <Button
            type="button"
            variant={isFullscreen ? "secondary" : "ghost"}
            size="icon"
            onClick={() => setIsFullscreen((on) => !on)}
            className="size-10"
            aria-label={isFullscreen ? "Exit full screen" : "Full screen board"}
            aria-pressed={isFullscreen}
            title={isFullscreen ? "Exit full screen (Esc)" : "Full screen board"}
          >
            {isFullscreen ? <Shrink className="size-4" aria-hidden="true" /> : <Expand className="size-4" aria-hidden="true" />}
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
        {/* Board */}
        <div
          ref={viewportRef}
          className={`relative flex-1 cursor-grab touch-none select-none overflow-hidden rounded-xl border border-border active:cursor-grabbing ${
            isFullscreen ? "min-h-[60dvh] lg:min-h-0" : "h-[75dvh] min-h-[420px] lg:h-auto lg:min-h-[calc(100dvh-14rem)]"
          }`}
          style={{
            backgroundColor: canvas.background,
            backgroundImage: "radial-gradient(circle, rgba(100,116,139,0.25) 1px, transparent 1px)",
            backgroundSize: `${24 * view.scale}px ${24 * view.scale}px`,
            backgroundPosition: `${view.x}px ${view.y}px`,
          }}
          onPointerDown={onViewportPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          role="application"
          aria-roledescription="board"
          aria-label={`${canvas.title}. Drag empty space to pan; use the zoom buttons or Ctrl and scroll to zoom. Tab to reach items.`}
        >
          <div className="absolute left-0 top-0 origin-top-left" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}>
            {list.map((el) => {
              const isSelected = el.id === selectedId
              return (
                <div
                  key={el.id}
                  tabIndex={0}
                  role="button"
                  aria-pressed={isSelected}
                  aria-label={describeElement(el)}
                  onPointerDown={(e) => onElementPointerDown(e, el)}
                  onFocus={() => setSelectedId(el.id)}
                  onKeyDown={(e) => onElementKeyDown(e, el)}
                  onDoubleClick={() => {
                    setIsPanelOpen(true)
                    setTab("item")
                    setTimeout(() => document.getElementById(`inspector-${el.id}-text`)?.focus() ?? document.getElementById(`inspector-${el.id}-title`)?.focus(), 0)
                  }}
                  className={`absolute rounded-lg outline-none ${canEdit ? "cursor-move" : "cursor-pointer"} ${
                    isSelected ? "ring-2 ring-primary ring-offset-2 ring-offset-transparent" : "focus-visible:ring-2 focus-visible:ring-primary"
                  }`}
                  style={{ left: el.x, top: el.y, width: el.width, height: el.height, zIndex: el.z + 100_001 }}
                >
                  <CanvasElementView canvasId={canvasId} element={el} />
                  <CommentCountBadge count={el._count?.comments ?? 0} />
                  {isSelected && canEdit && (
                    <span
                      onPointerDown={(e) => onResizePointerDown(e, el)}
                      className="absolute -bottom-2 -right-2 size-5 cursor-nwse-resize rounded-full border-2 border-white bg-primary shadow"
                      aria-hidden="true"
                    />
                  )}
                </div>
              )
            })}
          </div>

          {list.length === 0 && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
              <div className="max-w-sm rounded-xl bg-background/90 p-5 text-center shadow-sm">
                <p className="font-medium">This board is empty</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {canEdit ? "Add a heading, notes, colours, images or links from the toolbar, then drag them into place." : "Nothing has been added yet."}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Side panel */}
        <aside
          className={`${isPanelOpen ? "flex" : "hidden"} max-h-[80vh] flex-col rounded-xl border border-border bg-card lg:max-h-none lg:w-80 lg:flex-shrink-0`}
          aria-label="Board details"
        >
          <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
            <TabsList className="m-2 grid grid-cols-5">
              <TabsTrigger value="item" className="text-xs">Item</TabsTrigger>
              <TabsTrigger value="comments" className="text-xs">Notes</TabsTrigger>
              <TabsTrigger value="activity" className="text-xs">Activity</TabsTrigger>
              <TabsTrigger value="share" className="text-xs">Share</TabsTrigger>
              <TabsTrigger value="board" className="text-xs">Board</TabsTrigger>
            </TabsList>
            <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
              <TabsContent value="item" className="mt-0">
                {selected ? (
                  <CanvasInspector
                    element={selected}
                    canEdit={canEdit}
                    onChange={(patch) => updateData(selected.id, patch)}
                    onFront={() => restack(selected, true)}
                    onBack={() => restack(selected, false)}
                    onDuplicate={() => duplicateElement(selected)}
                    onDelete={() => setConfirm({ kind: "element", element: selected })}
                    onComment={() => {
                      setCommentElementId(selected.id)
                      setTab("comments")
                    }}
                  />
                ) : (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    Select an item on the board to {canEdit ? "edit it" : "see its details"}.
                  </p>
                )}
              </TabsContent>
              <TabsContent value="comments" className="mt-0">
                <CanvasComments
                  canvasId={canvasId}
                  elementId={commentElementId && elements[commentElementId] ? commentElementId : null}
                  elementLabel={commentElementId && elements[commentElementId] ? describeElement(elements[commentElementId]) : null}
                  access={accessInfo}
                  currentUserId={currentUserId}
                  onClearElement={() => setCommentElementId(null)}
                  onChanged={() => void mutate()}
                />
              </TabsContent>
              <TabsContent value="activity" className="mt-0">
                <CanvasActivity canvasId={canvasId} />
              </TabsContent>
              <TabsContent value="share" className="mt-0">
                <CanvasSharing canvasId={canvasId} members={canvas.members} owner={canvas.createdBy} access={accessInfo} onChanged={() => void mutate()} />
              </TabsContent>
              <TabsContent value="board" className="mt-0">
                <BoardSettings canvas={canvas} canEdit={canEdit} onSave={patchBoard} />
              </TabsContent>
            </div>
          </Tabs>
        </aside>
      </div>

      <AddMediaDialog
        kind={adding}
        canvasId={canvasId}
        onClose={() => setAdding(null)}
        onAdd={async (type, elementData) => {
          await addElement(type, elementData)
          setAdding(null)
        }}
      />

      <AlertDialog open={!!confirm} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.kind === "board" ? `Delete “${canvas.title}”?` : `Delete ${confirm?.kind === "element" ? describeElement(confirm.element) : "item"}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.kind === "board"
                ? `This permanently deletes the board, its ${list.length} item${list.length === 1 ? "" : "s"}, uploaded images, comments and activity. People it was shared with lose it too.`
                : "The item, its uploaded image (if any) and the comments on it are removed from the board."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                const target = confirm
                setConfirm(null)
                if (target?.kind === "board") void deleteBoard()
                else if (target?.kind === "element") void deleteElement(target.element)
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function BoardSettings({ canvas, canEdit, onSave }: { canvas: CanvasDetail; canEdit: boolean; onSave: (patch: Record<string, unknown>) => Promise<void> }) {
  const [description, setDescription] = useState(canvas.description ?? "")
  const [background, setBackground] = useState(canvas.background)
  const { data: projects } = useSWR<{ projects: { id: string; name: string; client: string | null }[] }>(
    canEdit ? "/api/projects?view=options" : null,
    fetcher,
  )
  const validBg = /^#[0-9a-fA-F]{6}$/.test(background)

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="board-description">Description</Label>
        <Textarea
          id="board-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={() => description !== (canvas.description ?? "") && void onSave({ description: description.trim() || null })}
          maxLength={2000}
          rows={3}
          disabled={!canEdit}
          placeholder="What this board is for"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="board-campaign">Campaign</Label>
        <Select
          value={canvas.project?.id ?? NO_PROJECT}
          onValueChange={(v) => void onSave({ projectId: v === NO_PROJECT ? null : v, ...(v === NO_PROJECT ? { clientId: null } : {}) })}
          disabled={!canEdit}
        >
          <SelectTrigger id="board-campaign" className="min-h-11">
            <SelectValue placeholder="Not linked" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_PROJECT}>Not linked</SelectItem>
            {canvas.project && !projects?.projects.some((p) => p.id === canvas.project?.id) && (
              <SelectItem value={canvas.project.id}>{canvas.project.name}</SelectItem>
            )}
            {projects?.projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}{p.client ? ` · ${p.client}` : ""}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          {canvas.client ? `Client: ${canvas.client.name}. ` : ""}Linking a campaign links its client too.
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="board-background">Background</Label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            aria-label="Background colour picker"
            value={validBg ? background : "#f8fafc"}
            onChange={(e) => setBackground(e.target.value)}
            onBlur={() => validBg && background !== canvas.background && void onSave({ background })}
            disabled={!canEdit}
            className="h-11 w-12 cursor-pointer rounded-md border border-border bg-transparent p-1"
          />
          <Input
            id="board-background"
            value={background}
            onChange={(e) => setBackground(e.target.value.trim())}
            onBlur={() => validBg && background !== canvas.background && void onSave({ background })}
            maxLength={7}
            disabled={!canEdit}
            className="min-h-11 font-mono uppercase"
            aria-invalid={!validBg}
          />
        </div>
      </div>
    </div>
  )
}

function AddMediaDialog({
  kind,
  canvasId,
  onClose,
  onAdd,
}: {
  kind: "IMAGE" | "LINK" | null
  canvasId: string
  onClose: () => void
  onAdd: (type: ElementType, data: Record<string, unknown>) => Promise<void>
}) {
  const [file, setFile] = useState<File | null>(null)
  const [link, setLink] = useState("")
  const [linkTitle, setLinkTitle] = useState("")
  const [caption, setCaption] = useState("")
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (!kind) {
      setFile(null)
      setLink("")
      setLinkTitle("")
      setCaption("")
      setFormError(null)
    }
  }, [kind])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    const isWeb = /^https?:\/\/\S+$/i.test(link.trim())
    if (kind === "LINK" && !isWeb) return setFormError("Enter a full link starting with https://")
    if (kind === "IMAGE" && !file && !isWeb) return setFormError("Choose an image file or paste an image link.")
    setBusy(true)
    try {
      if (kind === "LINK") {
        await onAdd("LINK", { url: link.trim(), title: linkTitle.trim(), description: "" })
      } else if (file) {
        const form = new FormData()
        form.append("file", file)
        const res = await fetch(`/api/canvases/${canvasId}/images`, { method: "POST", body: form })
        const body = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(body.error ?? "Could not upload the image")
        await onAdd("IMAGE", { storageKey: body.storageKey, alt: caption.trim() || file.name.replace(/\.[^.]+$/, ""), caption: caption.trim() })
      } else {
        await onAdd("IMAGE", { url: link.trim(), alt: caption.trim(), caption: caption.trim() })
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not add it")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={!!kind} onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md">
        <form onSubmit={submit} noValidate>
          <DialogHeader>
            <DialogTitle>{kind === "LINK" ? "Add a reference link" : "Add an image"}</DialogTitle>
            <DialogDescription>
              {kind === "LINK" ? "Link to inspiration, a brand guideline or a competitor post." : "Upload a reference (JPG, PNG, GIF or WebP, up to 15 MB) or paste a link to one."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {kind === "IMAGE" && (
              <div className="space-y-1.5">
                <Label htmlFor="canvas-image-file">Image file</Label>
                <Input
                  id="canvas-image-file"
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="min-h-11"
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="canvas-media-link">{kind === "LINK" ? "Link" : "…or image link"}</Label>
              <Input
                id="canvas-media-link"
                type="url"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="https://"
                disabled={kind === "IMAGE" && !!file}
                className="min-h-11"
              />
            </div>
            {kind === "LINK" ? (
              <div className="space-y-1.5">
                <Label htmlFor="canvas-link-title">Title <span className="font-normal text-muted-foreground">(optional)</span></Label>
                <Input id="canvas-link-title" value={linkTitle} onChange={(e) => setLinkTitle(e.target.value)} maxLength={200} className="min-h-11" />
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="canvas-image-caption">Caption <span className="font-normal text-muted-foreground">(optional)</span></Label>
                <Input id="canvas-image-caption" value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={300} className="min-h-11" />
              </div>
            )}
            {formError && <p role="alert" className="text-sm text-destructive">{formError}</p>}
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={busy} className="min-h-11">Cancel</Button>
            <Button type="submit" disabled={busy} className="min-h-11">
              {busy && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />}
              Add to board
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
