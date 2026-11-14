"use client"

import { useState } from "react"
import useSWR from "swr"
import toast from "react-hot-toast"
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Eye,
  Check,
  FileText,
  ImageIcon,
  Loader2,
  Plus,
  Save,
  Star,
  Trash2,
  Upload,
  X,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { resizeImageFile } from "@/lib/resize-image"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface PayslipTemplate {
  id: string
  name: string
  description: string | null
  companyName: string
  companyAddress: string | null
  logoUrl: string | null
  signatoryText: string
  footerNote: string | null
  showBankDetails: boolean
  showPan: boolean
  showLeaveSummary: boolean
  showEmployerCost: boolean
  showAmountInWords: boolean
  sections: { key: string; visible: boolean }[] | null
  accentColor: string
  paperSize: string
  isDefault: boolean
  isActive: boolean
}

/** The payslip body, in the order it prints. Keys match the PDF generator's sections. */
const SECTION_LABELS: Record<string, string> = {
  employee: "Employee & bank information",
  attendance: "Attendance and days",
  earnings: "Earnings & deductions",
  netpay: "Net pay card",
  employerCost: "Employer cost (CTC)",
  footer: "Signature & footer",
}
const DEFAULT_SECTIONS = ["employee", "attendance", "earnings", "netpay", "employerCost", "footer"]

const BLANK = {
  name: "",
  description: "",
  companyName: "",
  companyAddress: "",
  signatoryText: "Authorized Signatory",
  footerNote: "",
  showBankDetails: true,
  showPan: true,
  showLeaveSummary: true,
  showEmployerCost: false,
  showAmountInWords: true,
  accentColor: "#0F172A",
  paperSize: "A4",
}

const TOGGLES: { key: keyof typeof BLANK; label: string; hint: string }[] = [
  { key: "showBankDetails", label: "Bank details", hint: "Bank name, masked account number, IFSC" },
  { key: "showPan", label: "PAN and UAN", hint: "Masked PAN and provident fund number" },
  { key: "showLeaveSummary", label: "Leave summary", hint: "Payable, LOP and paid-leave days" },
  { key: "showEmployerCost", label: "Employer cost", hint: "Employer PF/ESI share and total CTC" },
  { key: "showAmountInWords", label: "Amount in words", hint: "Net pay spelled out under the figure" },
]

const fetcher = async (url: string) => {
  const res = await fetch(url)
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`)
  return body
}

/**
 * Payslip templates: the branding and layout a payslip PDF is rendered with.
 *
 * Every one of these values used to be hardcoded in the PDF generator — including a
 * placeholder company address that printed on payslips sent to employees.
 */
export default function PayslipTemplatesTab({ canManage = false }: { canManage?: boolean }) {
  const { data, error, isLoading, mutate } = useSWR<{ templates: PayslipTemplate[] }>(
    "/api/payroll/payslip-templates",
    fetcher,
  )

  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<typeof BLANK>({ ...BLANK })
  /** Section order and visibility, edited separately from the plain fields. */
  const [sections, setSections] = useState<{ key: string; visible: boolean }[]>(
    DEFAULT_SECTIONS.map((key) => ({ key, visible: key !== "employerCost" })),
  )
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [toDelete, setToDelete] = useState<PayslipTemplate | null>(null)
  const [uploadingFor, setUploadingFor] = useState<string | null>(null)

  const templates = data?.templates ?? []

  /**
   * Preview renders a genuine payslip with the chosen template, which is the only
   * honest way to show a layout — a mock would not prove the real data fits.
   */
  const { data: sample } = useSWR<any>("/api/payroll/payslips?limit=1", fetcher)
  const previewPayslipId: string | null = (() => {
    const list = Array.isArray(sample) ? sample : (sample?.payslips ?? sample?.data ?? [])
    return list?.[0]?.id ?? null
  })()

  const openNew = () => {
    setForm({ ...BLANK })
    setSections(DEFAULT_SECTIONS.map((key) => ({ key, visible: key !== "employerCost" })))
    setEditingId("new")
    setFormError(null)
  }

  /** Move a section one place up or down. Buttons, not drag: keyboard-reachable. */
  const moveSection = (index: number, delta: number) => {
    setSections((prev) => {
      const next = [...prev]
      const target = index + delta
      if (target < 0 || target >= next.length) return prev
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  const openEdit = (t: PayslipTemplate) => {
    setForm({
      name: t.name,
      description: t.description ?? "",
      companyName: t.companyName,
      companyAddress: t.companyAddress ?? "",
      signatoryText: t.signatoryText,
      footerNote: t.footerNote ?? "",
      showBankDetails: t.showBankDetails,
      showPan: t.showPan,
      showLeaveSummary: t.showLeaveSummary,
      showEmployerCost: t.showEmployerCost,
      showAmountInWords: t.showAmountInWords,
      accentColor: t.accentColor || "#0F172A",
      paperSize: t.paperSize || "A4",
    })
    // Append anything the saved template predates, so no section is silently lost.
    const saved = t.sections ?? DEFAULT_SECTIONS.map((key) => ({ key, visible: true }))
    setSections([
      ...saved,
      ...DEFAULT_SECTIONS.filter((k) => !saved.some((x) => x.key === k)).map((key) => ({
        key,
        visible: true,
      })),
    ])
    setEditingId(t.id)
    setFormError(null)
  }

  const save = async () => {
    setFormError(null)
    setBusy(true)
    try {
      const creating = editingId === "new"
      const res = await fetch(
        creating
          ? "/api/payroll/payslip-templates"
          : `/api/payroll/payslip-templates/${editingId}`,
        {
          method: creating ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...form,
            sections,
            description: form.description.trim() || null,
            companyAddress: form.companyAddress.trim() || null,
            footerNote: form.footerNote.trim() || null,
          }),
        },
      )
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error ?? "Could not save the template")
      toast.success(creating ? `"${form.name}" created` : `"${form.name}" updated`)
      setEditingId(null)
      await mutate()
    } catch (e) {
      setFormError((e as Error).message)
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const makeDefault = async (t: PayslipTemplate) => {
    try {
      const res = await fetch(`/api/payroll/payslip-templates/${t.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDefault: true }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error ?? "Could not set the default")
      toast.success(`"${t.name}" is now used for every payslip`)
      await mutate()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const remove = async () => {
    if (!toDelete) return
    setBusy(true)
    try {
      const res = await fetch(`/api/payroll/payslip-templates/${toDelete.id}`, {
        method: "DELETE",
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error ?? "Could not delete the template")
      toast.success(`"${toDelete.name}" deleted`)
      if (editingId === toDelete.id) setEditingId(null)
      setToDelete(null)
      await mutate()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const uploadLogo = async (t: PayslipTemplate, picked: File) => {
    setUploadingFor(t.id)
    try {
      /**
       * Shrink before sending. The payslip draws the logo at 14mm, so 512px is already
       * generous, and it keeps the embedded PDF image small enough to email. Without
       * this the server rejects a full-resolution brand asset and leaves the person to
       * resize it themselves.
       */
      const { file, resized, from } = await resizeImageFile(picked, 512)
      if (resized && from) {
        toast.success(`Resized from ${from.width}x${from.height} to fit the payslip`)
      }

      const body = new FormData()
      body.append("logo", file)
      const res = await fetch(`/api/payroll/payslip-templates/${t.id}/logo`, {
        method: "POST",
        body,
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? "Could not upload the logo")
      toast.success("Logo updated")
      await mutate()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setUploadingFor(null)
    }
  }

  const removeLogo = async (t: PayslipTemplate) => {
    try {
      const res = await fetch(`/api/payroll/payslip-templates/${t.id}/logo`, { method: "DELETE" })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Failed")
      toast.success("Logo removed")
      await mutate()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="space-y-4 p-10 text-center">
          <p className="text-sm text-destructive">{(error as Error).message}</p>
          <Button variant="outline" onClick={() => mutate()}>
            Try again
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-0.5">
          <h2 className="text-sm font-semibold">Payslip templates</h2>
          <p className="text-xs text-muted-foreground">
            Branding and layout for the payslip PDF. The default template is used whenever a
            payslip is downloaded or emailed.
          </p>
        </div>
        {canManage && (
          <Button size="sm" onClick={openNew} className="gap-1.5">
            <Plus className="size-3.5" aria-hidden="true" />
            New template
          </Button>
        )}
      </div>

      {templates.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center">
            <FileText className="mx-auto size-9 text-muted-foreground/50" aria-hidden="true" />
            <p className="mt-3 text-sm font-medium">No payslip template yet</p>
            <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
              Payslips currently render with your payroll company name and no address. Create a
              template to set the company details, logo and which blocks appear.
            </p>
            {canManage && (
              <Button size="sm" className="mt-5 gap-1.5" onClick={openNew}>
                <Plus className="size-3.5" aria-hidden="true" />
                Create the first template
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-2">
          {templates.map((t) => (
            <li key={t.id}>
              <Card className={t.isDefault ? "border-primary/40" : ""}>
                <CardContent className="flex flex-wrap items-center gap-3 p-3">
                  <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border/60 bg-muted/40">
                    {t.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={t.logoUrl} alt="" className="size-full object-contain" />
                    ) : (
                      <ImageIcon className="size-4 text-muted-foreground/60" aria-hidden="true" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                      {t.name}
                      {t.isDefault && (
                        <Badge variant="default" className="gap-1 text-xs">
                          <Star className="size-2.5" aria-hidden="true" />
                          Default
                        </Badge>
                      )}
                      {!t.isActive && (
                        <Badge variant="secondary" className="text-xs">
                          Inactive
                        </Badge>
                      )}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {t.companyName}
                      {t.companyAddress ? ` · ${t.companyAddress}` : " · no address set"}
                    </p>
                  </div>

                  {canManage && (
                    <div className="flex shrink-0 items-center gap-1">
                      {!t.isDefault && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 text-xs"
                          onClick={() => makeDefault(t)}
                        >
                          Make default
                        </Button>
                      )}
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          className="sr-only"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) uploadLogo(t, file)
                            e.target.value = ""
                          }}
                        />
                        <span
                          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-input px-2.5 text-xs hover:bg-muted"
                          role="button"
                        >
                          {uploadingFor === t.id ? (
                            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                          ) : (
                            <Upload className="size-3.5" aria-hidden="true" />
                          )}
                          Logo
                        </span>
                      </label>
                      {t.logoUrl && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8"
                          onClick={() => removeLogo(t)}
                          aria-label={`Remove the logo from ${t.name}`}
                        >
                          <X className="size-3.5" aria-hidden="true" />
                        </Button>
                      )}
                      {previewPayslipId && (
                        <a
                          href={`/api/payroll/payslips/${previewPayslipId}/pdf?templateId=${t.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-input px-2.5 text-xs hover:bg-muted"
                        >
                          <Eye className="size-3.5" aria-hidden="true" />
                          Preview
                        </a>
                      )}
                      <Button
                        size="sm"
                        variant={editingId === t.id ? "secondary" : "outline"}
                        className="h-8 text-xs"
                        onClick={() => (editingId === t.id ? setEditingId(null) : openEdit(t))}
                      >
                        {editingId === t.id ? "Close" : "Edit"}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-8 text-destructive hover:text-destructive"
                        onClick={() => setToDelete(t)}
                        aria-label={`Delete ${t.name}`}
                      >
                        <Trash2 className="size-3.5" aria-hidden="true" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {/* Editor */}
      {canManage && editingId && (
        <Card className="border-primary/30">
          <CardContent className="space-y-4 p-4 sm:p-6">
            <h3 className="text-sm font-semibold">
              {editingId === "new" ? "New payslip template" : `Editing: ${form.name || "template"}`}
            </h3>

            {formError && (
              <p className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-2.5 text-xs text-destructive" role="alert">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                {formError}
              </p>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="tpl-name" className="text-xs font-medium">
                  Template name *
                </Label>
                <Input
                  id="tpl-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Standard Payslip"
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tpl-company" className="text-xs font-medium">
                  Company name *
                </Label>
                <Input
                  id="tpl-company"
                  value={form.companyName}
                  onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                  placeholder="e.g. itsmeDezino"
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tpl-address" className="text-xs font-medium">
                Company address
              </Label>
              <Textarea
                id="tpl-address"
                value={form.companyAddress}
                onChange={(e) => setForm({ ...form, companyAddress: e.target.value })}
                rows={2}
                placeholder="Printed under the company name on the payslip"
                className="text-xs"
              />
              <p className="text-xs text-muted-foreground">
                Left blank, no address is printed — nothing is invented.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="tpl-signatory" className="text-xs font-medium">
                  Signatory text
                </Label>
                <Input
                  id="tpl-signatory"
                  value={form.signatoryText}
                  onChange={(e) => setForm({ ...form, signatoryText: e.target.value })}
                  placeholder="Authorized Signatory"
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tpl-footer" className="text-xs font-medium">
                  Footer note
                </Label>
                <Input
                  id="tpl-footer"
                  value={form.footerNote}
                  onChange={(e) => setForm({ ...form, footerNote: e.target.value })}
                  placeholder="Confidential — query within 7 days"
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <fieldset className="space-y-2 rounded-lg border border-border/60 bg-muted/20 p-3">
              <legend className="px-1 text-xs font-medium">Show on the payslip</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {TOGGLES.map((toggle) => (
                  <label
                    key={toggle.key}
                    className="flex cursor-pointer items-start gap-2 rounded-md p-1.5 hover:bg-background"
                  >
                    <Checkbox
                      checked={Boolean(form[toggle.key])}
                      onCheckedChange={(v) => setForm({ ...form, [toggle.key]: Boolean(v) })}
                      aria-label={toggle.label}
                      className="mt-0.5"
                    />
                    <span className="min-w-0">
                      <span className="block text-xs font-medium">{toggle.label}</span>
                      <span className="block text-xs text-muted-foreground">{toggle.hint}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="space-y-2 rounded-lg border border-border/60 bg-muted/20 p-3">
              <legend className="px-1 text-xs font-medium">Layout — section order</legend>
              <p className="text-xs text-muted-foreground">
                The payslip prints these top to bottom. Untick to leave a section out; use
                the arrows to reorder. The letterhead always stays at the top.
              </p>
              <ol className="space-y-1">
                {sections.map((section, index) => (
                  <li
                    key={section.key}
                    className="flex items-center gap-2 rounded-md border border-border/60 bg-background p-1.5"
                  >
                    <span className="w-5 text-center text-xs text-muted-foreground">
                      {index + 1}
                    </span>
                    <Checkbox
                      checked={section.visible}
                      onCheckedChange={(v) =>
                        setSections((prev) =>
                          prev.map((x, i) => (i === index ? { ...x, visible: Boolean(v) } : x)),
                        )
                      }
                      aria-label={`Show ${SECTION_LABELS[section.key] ?? section.key}`}
                    />
                    <span
                      className={`min-w-0 flex-1 truncate text-xs ${section.visible ? "" : "text-muted-foreground line-through"}`}
                    >
                      {SECTION_LABELS[section.key] ?? section.key}
                    </span>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="size-7"
                      disabled={index === 0}
                      onClick={() => moveSection(index, -1)}
                      aria-label={`Move ${SECTION_LABELS[section.key] ?? section.key} up`}
                    >
                      <ArrowUp className="size-3.5" aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="size-7"
                      disabled={index === sections.length - 1}
                      onClick={() => moveSection(index, 1)}
                      aria-label={`Move ${SECTION_LABELS[section.key] ?? section.key} down`}
                    >
                      <ArrowDown className="size-3.5" aria-hidden="true" />
                    </Button>
                  </li>
                ))}
              </ol>

              <div className="grid gap-3 pt-1 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="tpl-accent" className="text-xs font-medium">
                    Accent colour
                  </Label>
                  <div className="flex items-center gap-2">
                    <input
                      id="tpl-accent"
                      type="color"
                      value={form.accentColor}
                      onChange={(e) => setForm({ ...form, accentColor: e.target.value })}
                      className="h-9 w-12 cursor-pointer rounded-md border border-input bg-background p-1"
                      aria-label="Accent colour"
                    />
                    <Input aria-label="#0F172A"
                      value={form.accentColor}
                      onChange={(e) => setForm({ ...form, accentColor: e.target.value })}
                      className="h-9 font-mono text-xs"
                      placeholder="#0F172A"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Header bar, net-pay card and section rules.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="tpl-paper" className="text-xs font-medium">
                    Paper size
                  </Label>
                  <select
                    id="tpl-paper"
                    value={form.paperSize}
                    onChange={(e) => setForm({ ...form, paperSize: e.target.value })}
                    className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs"
                  >
                    <option value="A4">A4</option>
                    <option value="LETTER">US Letter</option>
                  </select>
                </div>
              </div>
            </fieldset>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditingId(null)} disabled={busy}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={save}
                disabled={busy || !form.name.trim() || !form.companyName.trim()}
                className="gap-1.5"
              >
                {busy ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : editingId === "new" ? (
                  <Check className="size-4" aria-hidden="true" />
                ) : (
                  <Save className="size-4" aria-hidden="true" />
                )}
                {editingId === "new" ? "Create template" : "Save changes"}
              </Button>
            </div>

            {editingId !== "new" && (
              <p className="text-xs text-muted-foreground">
                Upload a logo with the <strong>Logo</strong> button on the template above.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <AlertDialog open={!!toDelete} onOpenChange={(open) => !open && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete the &quot;{toDelete?.name}&quot; template?</AlertDialogTitle>
            <AlertDialogDescription>
              Payslips already issued are unaffected — this only removes the branding used to
              render new ones. It cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                e.preventDefault()
                remove()
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {busy && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />}
              Delete template
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
