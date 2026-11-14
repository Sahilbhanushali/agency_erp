"use client"

import { ExternalLink, ImageOff, MessageSquare } from "lucide-react"
import { useState } from "react"
import { type CanvasElementData, contrastText, hostOf, imageSrc, num, str } from "./types"

/** What one element looks like on the board. Purely visual: interaction lives in the editor. */
export function CanvasElementView({ canvasId, element }: { canvasId: string; element: CanvasElementData }) {
  const d = element.data
  switch (element.type) {
    case "SECTION": {
      const color = str(d.color, "#e2e8f0")
      return (
        <div className="flex h-full w-full flex-col rounded-xl border-2" style={{ borderColor: color, backgroundColor: `${color}55` }}>
          <div className="rounded-t-lg px-3 py-2 text-sm font-semibold" style={{ backgroundColor: color, color: contrastText(color) }}>
            {str(d.title, "Section")}
          </div>
        </div>
      )
    }
    case "HEADING":
      return (
        <div
          className="h-full w-full overflow-hidden font-bold leading-tight"
          style={{ fontSize: num(d.fontSize, 32), color: str(d.color, "#0f172a") }}
        >
          {str(d.text) || <span className="opacity-40">Heading</span>}
        </div>
      )
    case "TEXT":
      return (
        <div
          className="h-full w-full overflow-hidden whitespace-pre-wrap break-words leading-snug"
          style={{
            fontSize: num(d.fontSize, 16),
            color: str(d.color, "#0f172a"),
            textAlign: (["left", "center", "right"].includes(str(d.align)) ? str(d.align) : "left") as "left",
            fontWeight: d.bold === true ? 700 : 400,
          }}
        >
          {str(d.text) || <span className="opacity-40">Double-click or use the panel to write…</span>}
        </div>
      )
    case "NOTE": {
      const color = str(d.color, "#fef08a")
      return (
        <div
          className="h-full w-full overflow-hidden whitespace-pre-wrap break-words rounded-md p-3 text-sm leading-snug shadow-md"
          style={{ backgroundColor: color, color: contrastText(color) }}
        >
          {str(d.text) || <span className="opacity-50">Empty note</span>}
        </div>
      )
    }
    case "COLOR": {
      const hex = str(d.hex, "#6366f1")
      return (
        <div className="flex h-full w-full flex-col overflow-hidden rounded-lg border border-black/10 bg-white shadow-sm">
          <div className="flex-1" style={{ backgroundColor: hex }} />
          <div className="px-2 py-1.5 text-xs text-slate-800">
            <p className="font-mono font-semibold uppercase">{hex}</p>
            {str(d.label) && <p className="line-clamp-1 text-slate-600">{str(d.label)}</p>}
          </div>
        </div>
      )
    }
    case "LINK": {
      const url = str(d.url)
      return (
        <div className="flex h-full w-full flex-col overflow-hidden rounded-lg border border-slate-200 bg-white p-3 text-slate-900 shadow-sm">
          <p className="flex items-center gap-1 text-xs text-slate-500">
            <ExternalLink className="size-3" aria-hidden="true" />
            {hostOf(url)}
          </p>
          <p className="mt-1 line-clamp-2 text-sm font-semibold">{str(d.title) || url}</p>
          {str(d.description) && <p className="mt-1 line-clamp-3 text-xs text-slate-600">{str(d.description)}</p>}
        </div>
      )
    }
    case "IMAGE":
      return <ImageElement canvasId={canvasId} data={d} />
  }
}

function ImageElement({ canvasId, data }: { canvasId: string; data: Record<string, unknown> }) {
  const [failed, setFailed] = useState(false)
  const src = imageSrc(canvasId, data)
  const caption = str(data.caption)
  return (
    <figure className="flex h-full w-full flex-col overflow-hidden rounded-lg bg-white shadow-sm">
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element -- private, permission-checked image or a user-supplied link
        <img
          src={src}
          alt={str(data.alt)}
          draggable={false}
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="min-h-0 w-full flex-1 object-cover"
        />
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-1 bg-slate-100 text-xs text-slate-500">
          <ImageOff className="size-5" aria-hidden="true" />
          Image unavailable
        </div>
      )}
      {caption && <figcaption className="line-clamp-2 px-2 py-1 text-xs text-slate-700">{caption}</figcaption>}
    </figure>
  )
}

export function CommentCountBadge({ count }: { count: number }) {
  if (!count) return null
  return (
    <span
      className="absolute -right-2 -top-2 z-10 flex items-center gap-0.5 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground shadow"
      aria-label={`${count} comment${count === 1 ? "" : "s"}`}
    >
      <MessageSquare className="size-2.5" aria-hidden="true" />
      {count}
    </span>
  )
}
