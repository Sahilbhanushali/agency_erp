export type ElementType = "IMAGE" | "TEXT" | "HEADING" | "NOTE" | "COLOR" | "LINK" | "SECTION"

export interface CanvasElementData {
  id: string
  type: ElementType
  x: number
  y: number
  width: number
  height: number
  z: number
  data: Record<string, unknown>
  createdBy: { id: number; name: string } | null
  _count: { comments: number }
}

export interface CanvasAccessInfo {
  role: "OWNER" | "EDITOR" | "VIEWER" | "PLANNER"
  canEdit: boolean
  canDelete: boolean
  canShare: boolean
  canComment: boolean
}

export interface CanvasMemberInfo {
  role: "VIEWER" | "EDITOR"
  user: { id: number; name: string; avatar: string | null; role: { name: string } | null }
}

export interface CanvasDetail {
  id: string
  title: string
  description: string | null
  kind: "CANVAS" | "MOODBOARD"
  background: string
  version: number
  updatedAt: string
  client: { id: string; name: string } | null
  project: { id: string; name: string } | null
  post: { id: string; title: string } | null
  createdBy: { id: number; name: string } | null
  updatedBy: { id: number; name: string } | null
  elements: CanvasElementData[]
  members: CanvasMemberInfo[]
}

export const str = (value: unknown, fallback = "") => (typeof value === "string" ? value : fallback)
export const num = (value: unknown, fallback: number) => (typeof value === "number" && Number.isFinite(value) ? value : fallback)

export const TYPE_LABEL: Record<ElementType, string> = {
  IMAGE: "Image",
  TEXT: "Text",
  HEADING: "Heading",
  NOTE: "Note",
  COLOR: "Colour",
  LINK: "Link",
  SECTION: "Section",
}

/** Accessible name for an element: its type and the first words of its content. */
export function describeElement(el: CanvasElementData): string {
  const d = el.data
  const content = str(d.title) || str(d.text) || str(d.label) || str(d.caption) || str(d.alt) || str(d.hex) || str(d.url)
  return `${TYPE_LABEL[el.type]}${content ? `: ${content.slice(0, 60)}` : ""}`
}

export function imageSrc(canvasId: string, data: Record<string, unknown>): string | null {
  const key = str(data.storageKey)
  if (key) return `/api/canvases/${canvasId}/images?key=${encodeURIComponent(key)}`
  const url = str(data.url)
  return /^https?:\/\//i.test(url) ? url : null
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}

/** Readable text colour (near-black or white) for a hex background. */
export function contrastText(hex: string): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex)
  if (!m) return "#0f172a"
  const n = parseInt(m[1], 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return luminance > 0.4 ? "#0f172a" : "#ffffff"
}
