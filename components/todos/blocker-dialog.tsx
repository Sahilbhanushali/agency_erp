"use client"

import { useState, useEffect } from "react"
import toast from "react-hot-toast"
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { BLOCKER_CATEGORIES, BLOCKER_STATUSES, type BlockerCategory, type BlockerStatus } from "@/lib/validation/todo"

export interface BlockerData {
  id?: string
  todoId: string
  title: string
  description?: string | null
  category: BlockerCategory
  impact?: string | null
  assistanceRequired?: string | null
  responsibleParty?: string | null
  expectedResolution?: string | null
  status: BlockerStatus
  resolutionNotes?: string | null
  resolvedAt?: string | null
  createdAt?: string
}

interface BlockerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  todoId: string
  todoTitle?: string
  blocker?: BlockerData | null
  onSuccess: () => void
}

const CATEGORY_LABELS: Record<BlockerCategory, string> = {
  TECHNICAL_ISSUE: "Technical Issue",
  DEPENDENCY: "Dependency / Waiting on Others",
  APPROVAL_PENDING: "Approval Pending",
  MISSING_INFORMATION: "Missing Information / Brief",
  RESOURCE_ISSUE: "Resource / Asset Missing",
  OTHER: "Other Issue",
}

export default function BlockerDialog({
  open,
  onOpenChange,
  todoId,
  todoTitle,
  blocker,
  onSuccess,
}: BlockerDialogProps) {
  const isEditing = Boolean(blocker?.id)
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState<BlockerCategory>("TECHNICAL_ISSUE")
  const [impact, setImpact] = useState("")
  const [assistanceRequired, setAssistanceRequired] = useState("")
  const [responsibleParty, setResponsibleParty] = useState("")
  const [expectedResolution, setExpectedResolution] = useState("")
  const [status, setStatus] = useState<BlockerStatus>("OPEN")
  const [resolutionNotes, setResolutionNotes] = useState("")

  useEffect(() => {
    if (open) {
      if (blocker) {
        setTitle(blocker.title || "")
        setDescription(blocker.description || "")
        setCategory(blocker.category || "TECHNICAL_ISSUE")
        setImpact(blocker.impact || "")
        setAssistanceRequired(blocker.assistanceRequired || "")
        setResponsibleParty(blocker.responsibleParty || "")
        setExpectedResolution(
          blocker.expectedResolution ? new Date(blocker.expectedResolution).toISOString().slice(0, 10) : "",
        )
        setStatus(blocker.status || "OPEN")
        setResolutionNotes(blocker.resolutionNotes || "")
      } else {
        setTitle("")
        setDescription("")
        setCategory("TECHNICAL_ISSUE")
        setImpact("")
        setAssistanceRequired("")
        setResponsibleParty("")
        setExpectedResolution("")
        setStatus("OPEN")
        setResolutionNotes("")
      }
      setErrors({})
    }
  }, [open, blocker])

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!title.trim()) {
      errs.title = "Blocker title is required"
    }
    if (status === "RESOLVED" && !resolutionNotes.trim() && isEditing) {
      errs.resolutionNotes = "Please add resolution notes when marking as resolved"
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setBusy(true)
    try {
      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        category,
        impact: impact.trim() || null,
        assistanceRequired: assistanceRequired.trim() || null,
        responsibleParty: responsibleParty.trim() || null,
        expectedResolution: expectedResolution ? new Date(expectedResolution).toISOString() : null,
        status,
        resolutionNotes: resolutionNotes.trim() || null,
      }

      const url = isEditing
        ? `/api/todos/${todoId}/blockers/${blocker!.id}`
        : `/api/todos/${todoId}/blockers`
      const method = isEditing ? "PATCH" : "POST"

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? "Failed to save blocker")
        return
      }

      toast.success(isEditing ? "Blocker updated" : "Blocker added to todo")
      onOpenChange(false)
      onSuccess()
    } catch {
      toast.error("Network error — please try again")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              {isEditing ? "Edit Blocker" : "Add Blocker to Todo"}
            </DialogTitle>
            <DialogDescription>
              {todoTitle ? (
                <>For: <span className="font-medium text-foreground">{todoTitle}</span></>
              ) : (
                "Document what is preventing progress on this todo item."
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto px-1">
            {/* Blocker Title */}
            <div className="space-y-1.5">
              <Label htmlFor="blocker-title" className={errors.title ? "text-destructive font-medium" : ""}>
                Blocker Title / Summary *
              </Label>
              <Input
                id="blocker-title"
                placeholder="e.g., Waiting on client approval for creative copy"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value)
                  if (errors.title) setErrors((prev) => ({ ...prev, title: "" }))
                }}
                className={errors.title ? "border-destructive focus-visible:ring-destructive" : ""}
              />
              {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
            </div>

            {/* Category & Status */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="blocker-category">Category *</Label>
                <Select value={category} onValueChange={(v) => setCategory(v as BlockerCategory)}>
                  <SelectTrigger id="blocker-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BLOCKER_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {CATEGORY_LABELS[cat]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="blocker-status">Blocker Status *</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as BlockerStatus)}>
                  <SelectTrigger id="blocker-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OPEN">Open (Active)</SelectItem>
                    <SelectItem value="IN_PROGRESS">In Progress (Addressing)</SelectItem>
                    <SelectItem value="RESOLVED">Resolved (Fixed)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="blocker-desc">Problem Description</Label>
              <Textarea
                id="blocker-desc"
                placeholder="Explain the issue in detail, why it occurred, and current roadblocks..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>

            {/* Impact & Assistance Required */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="blocker-impact">Impact</Label>
                <Input
                  id="blocker-impact"
                  placeholder="e.g., Delivery delayed by 1 day"
                  value={impact}
                  onChange={(e) => setImpact(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="blocker-help">Assistance Required</Label>
                <Input
                  id="blocker-help"
                  placeholder="e.g., Manager escalation needed"
                  value={assistanceRequired}
                  onChange={(e) => setAssistanceRequired(e.target.value)}
                />
              </div>
            </div>

            {/* Responsible Person / Team & Expected Resolution Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="blocker-person">Responsible Person or Team</Label>
                <Input
                  id="blocker-person"
                  placeholder="e.g., Design Team / John Doe"
                  value={responsibleParty}
                  onChange={(e) => setResponsibleParty(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="blocker-eta">Expected Resolution Date</Label>
                <Input
                  id="blocker-eta"
                  type="date"
                  value={expectedResolution}
                  onChange={(e) => setExpectedResolution(e.target.value)}
                />
              </div>
            </div>

            {/* Resolution Notes (displayed or required if resolved) */}
            {status === "RESOLVED" && (
              <div className="space-y-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
                <Label htmlFor="blocker-notes" className="text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4" />
                  Resolution Notes {isEditing && "*"}
                </Label>
                <Textarea
                  id="blocker-notes"
                  placeholder="How was this blocker solved? Mention who fixed it and what actions were taken..."
                  value={resolutionNotes}
                  onChange={(e) => {
                    setResolutionNotes(e.target.value)
                    if (errors.resolutionNotes) setErrors((prev) => ({ ...prev, resolutionNotes: "" }))
                  }}
                  rows={2}
                  className={errors.resolutionNotes ? "border-destructive focus-visible:ring-destructive" : ""}
                />
                {errors.resolutionNotes && (
                  <p className="text-xs text-destructive">{errors.resolutionNotes}</p>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !title.trim()}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Update Blocker" : "Save Blocker"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
