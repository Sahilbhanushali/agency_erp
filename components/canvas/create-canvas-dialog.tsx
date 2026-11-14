"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import useSWR from "swr"
import { LayoutTemplate, Loader2, Palette } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

const NO_PROJECT = "__none__"

const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) throw new Error("Could not load campaigns")
  return res.json() as Promise<{ projects: { id: string; name: string; client: string | null }[] }>
}

/**
 * New board, optionally tied to a campaign (project) and post. The client comes from
 * the campaign on the server, so the two cannot disagree.
 */
export function CreateCanvasDialog({
  open,
  onOpenChange,
  projectId,
  postId,
  defaultKind = "MOODBOARD",
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId?: string
  postId?: string
  defaultKind?: "CANVAS" | "MOODBOARD"
}) {
  const router = useRouter()
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [kind, setKind] = useState<"CANVAS" | "MOODBOARD">(defaultKind)
  const [project, setProject] = useState(projectId ?? NO_PROJECT)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<{ title?: string; form?: string }>({})
  const { data: projects, error: projectsError } = useSWR(open && !projectId ? "/api/projects?view=options" : null, fetcher)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      setErrors({ title: "Give the board a title." })
      return
    }
    setSaving(true)
    setErrors({})
    try {
      const res = await fetch("/api/canvases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          kind,
          projectId: project === NO_PROJECT ? null : project,
          postId: postId ?? null,
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error ?? "Could not create the board")
      onOpenChange(false)
      router.push(`/dashboard/canvas/${body.id}`)
    } catch (err) {
      setErrors({ form: err instanceof Error ? err.message : "Could not create the board" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-lg">
        <form onSubmit={submit} noValidate>
          <DialogHeader>
            <DialogTitle>New board</DialogTitle>
            <DialogDescription>Plan a campaign visually before the posts and creatives are made.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <fieldset className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <legend className="mb-2 text-sm font-medium">Start from</legend>
              {(
                [
                  { value: "MOODBOARD", label: "Mood board", hint: "Sections for theme, palette, typography, references…", icon: Palette },
                  { value: "CANVAS", label: "Blank canvas", hint: "An empty board to arrange freely.", icon: LayoutTemplate },
                ] as const
              ).map((option) => (
                <label
                  key={option.value}
                  className={`flex min-h-11 cursor-pointer gap-3 rounded-lg border p-3 text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring ${
                    kind === option.value ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                  }`}
                >
                  <input
                    type="radio"
                    name="canvas-kind"
                    value={option.value}
                    checked={kind === option.value}
                    onChange={() => setKind(option.value)}
                    className="sr-only"
                  />
                  <option.icon className="mt-0.5 size-4 flex-shrink-0 text-primary" aria-hidden="true" />
                  <span>
                    <span className="block font-medium">{option.label}</span>
                    <span className="block text-xs text-muted-foreground">{option.hint}</span>
                  </span>
                </label>
              ))}
            </fieldset>

            <div className="space-y-1.5">
              <Label htmlFor="canvas-title">Title</Label>
              <Input
                id="canvas-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={160}
                placeholder="e.g. Diwali 2026 campaign mood board"
                aria-invalid={!!errors.title}
                aria-describedby={errors.title ? "canvas-title-error" : undefined}
                autoFocus
              />
              {errors.title && <p id="canvas-title-error" className="text-xs text-destructive">{errors.title}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="canvas-description">Description <span className="font-normal text-muted-foreground">(optional)</span></Label>
              <Textarea
                id="canvas-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={2000}
                rows={2}
                placeholder="What is this board for?"
              />
            </div>

            {!projectId && (
              <div className="space-y-1.5">
                <Label htmlFor="canvas-project">Campaign <span className="font-normal text-muted-foreground">(optional)</span></Label>
                <Select value={project} onValueChange={setProject}>
                  <SelectTrigger id="canvas-project" className="min-h-11">
                    <SelectValue placeholder="Not linked to a campaign" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_PROJECT}>Not linked to a campaign</SelectItem>
                    {projects?.projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}{p.client ? ` · ${p.client}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {projectsError ? "Campaigns could not be loaded; you can link one later." : "The campaign's client is linked automatically."}
                </p>
              </div>
            )}

            {errors.form && <p role="alert" className="text-sm text-destructive">{errors.form}</p>}
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving} className="min-h-11">
              Cancel
            </Button>
            <Button type="submit" disabled={saving} className="min-h-11">
              {saving && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />}
              Create board
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
