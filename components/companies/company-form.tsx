"use client"

import { useEffect, useState } from "react"
import toast from "react-hot-toast"
import { Loader2 } from "lucide-react"
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
  /** Present when editing; absent when creating. */
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
    hint: "Shown at the top of every quotation and invoice this company issues.",
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
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {company ? "Save changes" : "Create company"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
