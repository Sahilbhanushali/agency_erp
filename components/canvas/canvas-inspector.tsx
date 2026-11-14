"use client"

import { ArrowDownToLine, ArrowUpToLine, Copy, ExternalLink, MessageSquare, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { type CanvasElementData, TYPE_LABEL, num, str } from "./types"

const SWATCHES = ["#fef08a", "#fecaca", "#bbf7d0", "#bfdbfe", "#e9d5ff", "#fed7aa", "#ffffff", "#0f172a"]

function ColorField({ id, label, value, onChange, disabled }: { id: string; label: string; value: string; onChange: (hex: string) => void; disabled: boolean }) {
  const valid = /^#[0-9a-fA-F]{6}$/.test(value)
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label} picker`}
          value={valid ? value : "#000000"}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="h-11 w-12 cursor-pointer rounded-md border border-border bg-transparent p-1 disabled:cursor-not-allowed"
        />
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value.trim())}
          maxLength={7}
          disabled={disabled}
          className="min-h-11 font-mono uppercase"
          aria-invalid={!valid}
        />
      </div>
      {!valid && <p className="text-xs text-destructive">Use a hex colour like #1A2B3C.</p>}
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={`${label} presets`}>
        {SWATCHES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onChange(s)}
            disabled={disabled}
            className="size-7 rounded-full border border-black/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            style={{ backgroundColor: s }}
            aria-label={`Use ${s}`}
          />
        ))}
      </div>
    </div>
  )
}

/**
 * Edits the selected element. Changes apply immediately on the board and are saved in
 * the background by the editor (debounced), so there is no Save button to forget.
 */
export function CanvasInspector({
  element,
  canEdit,
  onChange,
  onFront,
  onBack,
  onDuplicate,
  onDelete,
  onComment,
}: {
  element: CanvasElementData
  canEdit: boolean
  onChange: (patch: Record<string, unknown>) => void
  onFront: () => void
  onBack: () => void
  onDuplicate: () => void
  onDelete: () => void
  onComment: () => void
}) {
  const d = element.data
  const id = (field: string) => `inspector-${element.id}-${field}`
  const disabled = !canEdit

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{TYPE_LABEL[element.type]}</h3>
        {element.createdBy && <p className="text-xs text-muted-foreground">Added by {element.createdBy.name}</p>}
      </div>

      {(element.type === "TEXT" || element.type === "NOTE" || element.type === "HEADING") && (
        <div className="space-y-1.5">
          <Label htmlFor={id("text")}>Text</Label>
          {element.type === "HEADING" ? (
            <Input id={id("text")} value={str(d.text)} onChange={(e) => onChange({ text: e.target.value })} maxLength={300} disabled={disabled} className="min-h-11" />
          ) : (
            <Textarea id={id("text")} value={str(d.text)} onChange={(e) => onChange({ text: e.target.value })} maxLength={element.type === "NOTE" ? 2000 : 5000} rows={5} disabled={disabled} />
          )}
        </div>
      )}

      {(element.type === "TEXT" || element.type === "HEADING") && (
        <>
          <div className="space-y-1.5">
            <Label htmlFor={id("size")}>Font size</Label>
            <Input
              id={id("size")}
              type="number"
              min={element.type === "HEADING" ? 16 : 10}
              max={element.type === "HEADING" ? 120 : 72}
              value={num(d.fontSize, element.type === "HEADING" ? 32 : 16)}
              onChange={(e) => {
                const n = Number(e.target.value)
                const [min, max] = element.type === "HEADING" ? [16, 120] : [10, 72]
                if (Number.isFinite(n)) onChange({ fontSize: Math.min(max, Math.max(min, Math.round(n))) })
              }}
              disabled={disabled}
              className="min-h-11"
            />
          </div>
          <ColorField id={id("color")} label="Text colour" value={str(d.color, "#0f172a")} onChange={(color) => onChange({ color })} disabled={disabled} />
        </>
      )}

      {element.type === "TEXT" && (
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch id={id("bold")} checked={d.bold === true} onCheckedChange={(bold) => onChange({ bold })} disabled={disabled} />
            <Label htmlFor={id("bold")}>Bold</Label>
          </div>
          <div className="flex gap-1" role="group" aria-label="Alignment">
            {(["left", "center", "right"] as const).map((align) => (
              <Button
                key={align}
                type="button"
                size="sm"
                variant={str(d.align, "left") === align ? "default" : "outline"}
                onClick={() => onChange({ align })}
                disabled={disabled}
                aria-pressed={str(d.align, "left") === align}
                className="min-h-9 capitalize"
              >
                {align}
              </Button>
            ))}
          </div>
        </div>
      )}

      {element.type === "NOTE" && (
        <ColorField id={id("color")} label="Note colour" value={str(d.color, "#fef08a")} onChange={(color) => onChange({ color })} disabled={disabled} />
      )}

      {element.type === "SECTION" && (
        <>
          <div className="space-y-1.5">
            <Label htmlFor={id("title")}>Section title</Label>
            <Input id={id("title")} value={str(d.title)} onChange={(e) => onChange({ title: e.target.value })} maxLength={120} disabled={disabled} className="min-h-11" />
          </div>
          <ColorField id={id("color")} label="Section colour" value={str(d.color, "#e2e8f0")} onChange={(color) => onChange({ color })} disabled={disabled} />
          <p className="text-xs text-muted-foreground">Moving a section moves everything inside it.</p>
        </>
      )}

      {element.type === "COLOR" && (
        <>
          <ColorField id={id("hex")} label="Colour" value={str(d.hex, "#6366f1")} onChange={(hex) => onChange({ hex })} disabled={disabled} />
          <div className="space-y-1.5">
            <Label htmlFor={id("label")}>Name</Label>
            <Input id={id("label")} value={str(d.label)} onChange={(e) => onChange({ label: e.target.value })} maxLength={80} placeholder="e.g. Primary orange" disabled={disabled} className="min-h-11" />
          </div>
        </>
      )}

      {element.type === "LINK" && (
        <>
          <div className="space-y-1.5">
            <Label htmlFor={id("url")}>Link</Label>
            <Input id={id("url")} type="url" value={str(d.url)} onChange={(e) => onChange({ url: e.target.value })} maxLength={2000} disabled={disabled} className="min-h-11" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={id("title")}>Title</Label>
            <Input id={id("title")} value={str(d.title)} onChange={(e) => onChange({ title: e.target.value })} maxLength={200} disabled={disabled} className="min-h-11" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={id("description")}>Why it is here</Label>
            <Textarea id={id("description")} value={str(d.description)} onChange={(e) => onChange({ description: e.target.value })} maxLength={500} rows={3} disabled={disabled} />
          </div>
          {/^https?:\/\//i.test(str(d.url)) && (
            <a
              href={str(d.url)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-9 items-center gap-1.5 text-sm text-primary underline-offset-2 hover:underline"
            >
              <ExternalLink className="size-3.5" aria-hidden="true" />
              Open link
            </a>
          )}
        </>
      )}

      {element.type === "IMAGE" && (
        <>
          <div className="space-y-1.5">
            <Label htmlFor={id("alt")}>Description (for screen readers)</Label>
            <Input id={id("alt")} value={str(d.alt)} onChange={(e) => onChange({ alt: e.target.value })} maxLength={300} disabled={disabled} className="min-h-11" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={id("caption")}>Caption</Label>
            <Input id={id("caption")} value={str(d.caption)} onChange={(e) => onChange({ caption: e.target.value })} maxLength={300} disabled={disabled} className="min-h-11" />
          </div>
        </>
      )}

      <div className="flex flex-wrap gap-2 border-t border-border pt-3">
        <Button type="button" size="sm" variant="outline" onClick={onComment} className="min-h-9 gap-1.5">
          <MessageSquare className="size-3.5" aria-hidden="true" />
          Comment
        </Button>
        {canEdit && (
          <>
            <Button type="button" size="sm" variant="outline" onClick={onFront} className="min-h-9 gap-1.5">
              <ArrowUpToLine className="size-3.5" aria-hidden="true" />
              To front
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={onBack} className="min-h-9 gap-1.5">
              <ArrowDownToLine className="size-3.5" aria-hidden="true" />
              To back
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={onDuplicate} className="min-h-9 gap-1.5">
              <Copy className="size-3.5" aria-hidden="true" />
              Duplicate
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={onDelete} className="min-h-9 gap-1.5 text-destructive hover:text-destructive">
              <Trash2 className="size-3.5" aria-hidden="true" />
              Delete
            </Button>
          </>
        )}
      </div>
      {canEdit && (
        <p className="text-xs text-muted-foreground">
          Tip: with an item focused, arrow keys move it (Shift for 10px) and Delete removes it.
        </p>
      )}
    </div>
  )
}
