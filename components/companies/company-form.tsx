"use client"

import { useEffect, useState, useRef } from "react"
import toast from "react-hot-toast"
import { Loader2, Upload, X, Image as ImageIcon, FileImage, PenTool } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import type { Company } from "@/types/finance"

interface CompanyFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  company?: Company | null
  onSaved: () => void
}

type FormState = Record<string, string | boolean>

const EMPTY: FormState = {
  name: "",
  legalName: "",
  email: "",
  phone: "",
  website: "",
  logo: "",
  letterhead: "",
  signature: "",
  gstNumber: "",
  panNumber: "",
  hsnNumber: "",
  bankName: "",
  bankAccountName: "",
  bankAccountNumber: "",
  bankIfsc: "",
  bankBranch: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  postalCode: "",
  country: "India",
  currency: "INR",
  notes: "",
  isActive: true,
}

const SECTIONS: { title: string; hint?: string; fields: { key: string; label: string; placeholder?: string }[] }[] = [
  {
    title: "Identity",
    hint: "Shown on every quotation and invoice this company issues.",
    fields: [
      { key: "name", label: "Display name", placeholder: "itsmeDezino" },
      { key: "legalName", label: "Legal name", placeholder: "itsmeDezino Media Pvt Ltd" },
      { key: "email", label: "Email", placeholder: "accounts@example.com" },
      { key: "phone", label: "Phone", placeholder: "+91 98765 43210" },
      { key: "website", label: "Website", placeholder: "https://example.com" },
    ],
  },
  {
    title: "Statutory",
    hint: "Printed on tax documents. HSN/SAC describes the service being billed.",
    fields: [
      { key: "gstNumber", label: "GSTIN", placeholder: "27AAAAA0000A1Z5" },
      { key: "panNumber", label: "PAN", placeholder: "AAAAA0000A" },
      { key: "hsnNumber", label: "HSN / SAC", placeholder: "998314" },
    ],
  },
  {
    title: "Bank details",
    hint: "Payment instructions printed on invoices.",
    fields: [
      { key: "bankName", label: "Bank", placeholder: "HDFC Bank" },
      { key: "bankAccountName", label: "Account name" },
      { key: "bankAccountNumber", label: "Account number" },
      { key: "bankIfsc", label: "IFSC" },
      { key: "bankBranch", label: "Branch" },
    ],
  },
  {
    title: "Address",
    fields: [
      { key: "addressLine1", label: "Address line 1" },
      { key: "addressLine2", label: "Address line 2" },
      { key: "city", label: "City" },
      { key: "state", label: "State" },
      { key: "postalCode", label: "Postal code" },
      { key: "country", label: "Country" },
    ],
  },
  {
    title: "Defaults",
    fields: [{ key: "currency", label: "Currency code", placeholder: "INR" }],
  },
]

export default function CompanyForm({ open, onOpenChange, company, onSaved }: CompanyFormProps) {
  const [values, setValues] = useState<FormState>(EMPTY)
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [saving, setSaving] = useState(false)
  const [uploadingField, setUploadingField] = useState<string | null>(null)

  const letterheadInputRef = useRef<HTMLInputElement>(null)
  const signatureInputRef = useRef<HTMLInputElement>(null)
  const logoInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setErrors({})
    if (!company) {
      setValues(EMPTY)
      return
    }
    const next: FormState = { ...EMPTY }
    for (const key of Object.keys(EMPTY)) {
      const value = (company as unknown as Record<string, unknown>)[key]
      next[key] = typeof value === "boolean" ? value : ((value as string | null) ?? "")
    }
    setValues(next)
  }, [open, company])

  const set = (key: string, value: string | boolean) =>
    setValues((current) => ({ ...current, [key]: value }))

  const handleFileUpload = async (file: File, fieldKey: "letterhead" | "signature" | "logo") => {
    setUploadingField(fieldKey)
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("type", fieldKey)

      const response = await fetch("/api/companies/upload", {
        method: "POST",
        body: formData,
      })

      const data = await response.json()
      if (!response.ok) {
        toast.error(data.error || "Failed to upload image")
        return
      }

      set(fieldKey, data.url)
      toast.success(`${fieldKey.charAt(0).toUpperCase() + fieldKey.slice(1)} uploaded successfully!`)
    } catch {
      toast.error("Network error while uploading")
    } finally {
      setUploadingField(null)
    }
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setErrors({})
    try {
      const response = await fetch(company ? `/api/companies/${company.id}` : "/api/companies", {
        method: company ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      })
      const data = await response.json()

      if (!response.ok) {
        if (response.status === 422 && data.details) {
          setErrors(data.details)
          toast.error("Check the highlighted fields")
        } else {
          toast.error(data.error ?? "Could not save the company")
        }
        return
      }

      toast.success(company ? "Company updated" : "Company created")
      onSaved()
      onOpenChange(false)
    } catch {
      toast.error("Network error — please try again")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{company ? `Edit ${company.name}` : "New company"}</SheetTitle>
          <SheetDescription>
            A company is one of your own billing entities — the issuer on quotations and invoices.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-8 px-4 pb-8">
          {/* Template Letterhead & Signature Upload Zone */}
          <fieldset className="space-y-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
            <legend className="text-sm font-semibold text-primary flex items-center gap-2">
              <FileImage className="size-4" />
              Document Branding &amp; Template
            </legend>
            <p className="text-xs text-muted-foreground -mt-2">
              Upload your company letterhead banner and authorised signature to display automatically on all quotation and invoice documents.
            </p>

            {/* Letterhead Upload */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <FileImage className="size-3.5 text-primary" />
                  Letterhead Banner
                </Label>
                {values.letterhead && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() => set("letterhead", "")}
                    className="text-xs text-destructive hover:bg-destructive/10"
                  >
                    Remove
                  </Button>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Appears at the very top of quotations and invoices. Recommended: full width banner, PNG or JPG.
              </p>

              {values.letterhead ? (
                <div className="relative rounded-lg border border-border bg-card p-2 overflow-hidden group">
                  <img
                    src={String(values.letterhead)}
                    alt="Letterhead preview"
                    className="w-full h-24 object-contain rounded bg-white"
                  />
                  <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                    <span className="truncate max-w-[200px]">{String(values.letterhead)}</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="xs"
                      onClick={() => letterheadInputRef.current?.click()}
                      disabled={uploadingField === "letterhead"}
                    >
                      Replace
                    </Button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => letterheadInputRef.current?.click()}
                  className="flex flex-col items-center justify-center p-4 rounded-lg border border-dashed border-border bg-card/60 hover:bg-card cursor-pointer transition-colors"
                >
                  {uploadingField === "letterhead" ? (
                    <Loader2 className="size-5 animate-spin text-primary" />
                  ) : (
                    <>
                      <Upload className="size-5 text-muted-foreground mb-1" />
                      <p className="text-xs font-medium text-foreground">Click to upload Letterhead</p>
                      <p className="text-[10px] text-muted-foreground">PNG, JPG or WEBP up to 5MB</p>
                    </>
                  )}
                </div>
              )}
              <input
                ref={letterheadInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleFileUpload(file, "letterhead")
                }}
              />
            </div>

            {/* Authorised Signature Upload */}
            <div className="space-y-2 pt-2 border-t border-border/40">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <PenTool className="size-3.5 text-primary" />
                  Authorised Signature
                </Label>
                {values.signature && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() => set("signature", "")}
                    className="text-xs text-destructive hover:bg-destructive/10"
                  >
                    Remove
                  </Button>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Printed in the footer above &quot;Authorised Signatory&quot;. Transparent PNG recommended.
              </p>

              {values.signature ? (
                <div className="relative rounded-lg border border-border bg-card p-2 overflow-hidden">
                  <img
                    src={String(values.signature)}
                    alt="Signature preview"
                    className="h-16 w-auto object-contain mx-auto bg-white/50 rounded"
                  />
                  <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                    <span className="truncate max-w-[200px]">{String(values.signature)}</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="xs"
                      onClick={() => signatureInputRef.current?.click()}
                      disabled={uploadingField === "signature"}
                    >
                      Replace
                    </Button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => signatureInputRef.current?.click()}
                  className="flex flex-col items-center justify-center p-3 rounded-lg border border-dashed border-border bg-card/60 hover:bg-card cursor-pointer transition-colors"
                >
                  {uploadingField === "signature" ? (
                    <Loader2 className="size-5 animate-spin text-primary" />
                  ) : (
                    <>
                      <PenTool className="size-4 text-muted-foreground mb-1" />
                      <p className="text-xs font-medium text-foreground">Click to upload Signature</p>
                      <p className="text-[10px] text-muted-foreground">Transparent PNG or JPG</p>
                    </>
                  )}
                </div>
              )}
              <input
                ref={signatureInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleFileUpload(file, "signature")
                }}
              />
            </div>
          </fieldset>

          {SECTIONS.map((section) => (
            <fieldset key={section.title} className="space-y-4">
              <legend className="text-sm font-semibold text-foreground">{section.title}</legend>
              {section.hint && <p className="text-xs text-muted-foreground -mt-2">{section.hint}</p>}

              <div className="grid gap-4 sm:grid-cols-2">
                {section.fields.map((field) => (
                  <div key={field.key} className={field.key.startsWith("address") ? "sm:col-span-2" : ""}>
                    <Label htmlFor={field.key} className="text-xs">
                      {field.label}
                      {field.key === "name" && <span aria-hidden="true"> *</span>}
                    </Label>
                    <Input
                      id={field.key}
                      value={String(values[field.key] ?? "")}
                      onChange={(event) => set(field.key, event.target.value)}
                      placeholder={field.placeholder}
                      aria-invalid={!!errors[field.key]}
                      aria-describedby={errors[field.key] ? `${field.key}-error` : undefined}
                      className="mt-1"
                    />
                    {errors[field.key] && (
                      <p id={`${field.key}-error`} className="mt-1 text-xs text-destructive">
                        {errors[field.key][0]}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </fieldset>
          ))}

          <fieldset className="space-y-4">
            <legend className="text-sm font-semibold text-foreground">Notes</legend>
            <Textarea
              id="notes"
              aria-label="Internal notes"
              rows={3}
              value={String(values.notes ?? "")}
              onChange={(event) => set("notes", event.target.value)}
              placeholder="Internal only — never printed on documents."
            />
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <Label htmlFor="isActive" className="text-sm">
                  Active
                </Label>
                <p className="text-xs text-muted-foreground">
                  Inactive companies stay on past documents but cannot issue new ones.
                </p>
              </div>
              <Switch
                id="isActive"
                checked={Boolean(values.isActive)}
                onCheckedChange={(checked) => set("isActive", checked)}
              />
            </div>
          </fieldset>

          <SheetFooter className="px-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !!uploadingField}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {company ? "Save changes" : "Create company"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
