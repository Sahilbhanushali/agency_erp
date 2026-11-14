"use client"

import { jsonFetcher } from "@/lib/fetcher";
import { useMemo } from "react"
import { useRouter } from "next/navigation"
import useSWR from "swr"
import toast from "react-hot-toast"
import { useFieldArray, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { computeTotals, formatMoney, toNumber } from "@/lib/finance"
import { invoiceFormSchema, type InvoiceFormValues } from "@/lib/validation/invoice"
import type { Company, InvoiceDetail } from "@/types/finance"

// Throws on non-2xx, so a failed load is an error state, not an empty list.
const fetcher = (url: string) => jsonFetcher(url);

/** `/api/clients` already returns each client with its active projects — one request. */
interface ClientWithProjects {
  id: string
  name: string
  company: string | null
  companies?: { id: string; name: string }[]
  projects: { id: string; name: string; clientCompanyId?: string | null }[]
}

const BLANK_LINE = { description: "", quantity: 1, unit: "", unitPrice: 0 }

const toDateInput = (value: string | null | undefined) =>
  value ? new Date(value).toISOString().slice(0, 10) : ""

interface Prefill {
  companyId?: string
  clientId?: string
}

function defaults(
  invoice?: InvoiceDetail | null,
  prefill?: Prefill,
): InvoiceFormValues {
  if (!invoice) {
    return {
      companyId: prefill?.companyId ?? "",
      clientId: prefill?.clientId ?? "",
      clientCompanyId: "",
      projectId: "",
      title: "",
      currency: "INR",
      discountPercent: 0,
      taxType: "CGST_SGST",
      taxPercent: 18,
      issueDate: new Date().toISOString().slice(0, 10),
      dueDate: "",
      terms: "",
      notes: "",
      lineItems: [{ ...BLANK_LINE }],
    }
  }
  return {
    companyId: invoice.companyId,
    clientId: invoice.clientId,
    clientCompanyId: invoice.clientCompanyId ?? "",
    projectId: invoice.projectId ?? "",
    title: invoice.title,
    currency: invoice.currency,
    discountPercent: toNumber(invoice.discountPercent),
    taxType: invoice.taxType,
    taxPercent: toNumber(invoice.taxPercent),
    issueDate: toDateInput(invoice.issueDate) || new Date().toISOString().slice(0, 10),
    dueDate: toDateInput(invoice.dueDate),
    terms: invoice.terms ?? "",
    notes: invoice.notes ?? "",
    lineItems: invoice.lineItems.map((line) => ({
      description: line.description,
      quantity: toNumber(line.quantity),
      unit: line.unit ?? "",
      unitPrice: toNumber(line.unitPrice),
    })),
  }
}

export default function InvoiceEditor({
  invoice,
  prefill,
}: {
  invoice?: InvoiceDetail | null
  prefill?: Prefill
}) {
  const router = useRouter()
  const isEdit = !!invoice

  const { data: companyData } = useSWR<{ companies: Company[] }>("/api/companies", fetcher)
  const { data: clients } = useSWR<ClientWithProjects[]>("/api/clients", fetcher)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceFormSchema),
    defaultValues: defaults(invoice, prefill),
  })
  const { fields, append, remove } = useFieldArray({ control, name: "lineItems" })

  const values = watch()
  // An inactive company cannot issue new documents, but the one already on this
  // invoice stays selectable so an existing draft remains editable.
  const companies = (companyData?.companies ?? []).filter(
    (company) => company.isActive || company.id === invoice?.companyId,
  )
  const selectedClient = useMemo(
    () => (Array.isArray(clients) ? clients : []).find((c) => c.id === values.clientId),
    [clients, values.clientId],
  )
  const projects = selectedClient?.projects ?? []
  const clientCompanies = selectedClient?.companies ?? []

  const totals = computeTotals({
    lineItems: (values.lineItems ?? []).map((line) => ({
      quantity: Number(line?.quantity) || 0,
      unitPrice: Number(line?.unitPrice) || 0,
    })),
    discountPercent: Number(values.discountPercent) || 0,
    taxPercent: Number(values.taxPercent) || 0,
    taxType: values.taxType,
  })
  const money = (amount: number) => formatMoney(amount, values.currency || "INR")
  const halfRate = (Number(values.taxPercent) || 0) / 2

  const onSubmit = async (form: InvoiceFormValues) => {
    const payload = {
      ...form,
      projectId: form.projectId || undefined,
      clientCompanyId: form.clientCompanyId || null,
      issueDate: form.issueDate || null,
      dueDate: form.dueDate || null,
      terms: form.terms || undefined,
      notes: form.notes || undefined,
      lineItems: form.lineItems.map((line) => ({ ...line, unit: line.unit || undefined })),
    }

    try {
      const response = await fetch(isEdit ? `/api/invoices/${invoice!.id}` : "/api/invoices", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await response.json()

      if (!response.ok) {
        toast.error(data.error ?? "Could not save the invoice")
        return
      }

      toast.success(isEdit ? `${data.invoice.number} updated` : `${data.invoice.number} created`)
      router.push(`/dashboard/invoices/${data.invoice.id}`)
      router.refresh()
    } catch {
      toast.error("Network error — please try again")
    }
  }

  const fieldError = (message?: string) =>
    message ? <p className="mt-1 text-xs text-destructive">{message}</p> : null

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Who and what</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="companyId">Issued by *</Label>
            <Select
              value={values.companyId}
              onValueChange={(value) => setValue("companyId", value, { shouldValidate: true })}
              disabled={isEdit}
            >
              <SelectTrigger id="companyId" className="mt-1" aria-invalid={!!errors.companyId}>
                <SelectValue placeholder={companies.length ? "Choose a company" : "No companies yet"} />
              </SelectTrigger>
              <SelectContent>
                {companies.map((company) => (
                  <SelectItem key={company.id} value={company.id}>
                    {company.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldError(errors.companyId?.message)}
            <p className="mt-1 text-xs text-muted-foreground">
              {isEdit
                ? "The number is issued under this company, so it cannot be moved."
                : "Determines the number series, GSTIN and bank details on the document."}
            </p>
          </div>

          <div>
            <Label htmlFor="clientId">Billed to *</Label>
            <Select
              value={values.clientId}
              onValueChange={(value) => {
                setValue("clientId", value, { shouldValidate: true })
                setValue("projectId", "")
                // A client with one company has no choice to make.
                const companies = (Array.isArray(clients) ? clients : []).find((c) => c.id === value)?.companies ?? []
                setValue("clientCompanyId", companies.length === 1 ? companies[0].id : "")
              }}
            >
              <SelectTrigger id="clientId" className="mt-1" aria-invalid={!!errors.clientId}>
                <SelectValue placeholder="Choose a client" />
              </SelectTrigger>
              <SelectContent>
                {(Array.isArray(clients) ? clients : []).map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.company ? `${client.company} — ${client.name}` : client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldError(errors.clientId?.message)}
          </div>

          <div>
            <Label htmlFor="clientCompanyId">Client company</Label>
            <Select
              value={values.clientCompanyId || "none"}
              onValueChange={(value) => setValue("clientCompanyId", value === "none" ? "" : value)}
              disabled={!values.clientId || clientCompanies.length === 0}
            >
              <SelectTrigger id="clientCompanyId" className="mt-1">
                <SelectValue
                  placeholder={!values.clientId ? "Choose a client first" : "No companies on file"}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">The client by name</SelectItem>
                {clientCompanies.map((company) => (
                  <SelectItem key={company.id} value={company.id}>
                    {company.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-1 text-xs text-muted-foreground">
              {values.clientId && clientCompanies.length === 0
                ? "Add the client's companies on their client page to bill one."
                : "Its name, address and GSTIN go on the document."}
            </p>
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              {...register("title")}
              placeholder="Social media retainer — January 2026"
              aria-invalid={!!errors.title}
              className="mt-1"
            />
            {fieldError(errors.title?.message)}
          </div>

          <div>
            <Label htmlFor="projectId">Project</Label>
            <Select
              value={values.projectId}
              onValueChange={(value) => {
                setValue("projectId", value === "none" ? "" : value)
                // Bill the company the project is for, unless one is already chosen.
                const projectCompany = projects.find((project) => project.id === value)?.clientCompanyId
                if (projectCompany && !values.clientCompanyId) setValue("clientCompanyId", projectCompany)
              }}
              disabled={!values.clientId}
            >
              <SelectTrigger id="projectId" className="mt-1">
                <SelectValue
                  placeholder={
                    !values.clientId
                      ? "Choose a client first"
                      : projects.length
                        ? "Optional"
                        : "No active projects"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No project</SelectItem>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="issueDate">Issue date</Label>
            <Input id="issueDate" type="date" {...register("issueDate")} className="mt-1" />
          </div>

          <div>
            <Label htmlFor="dueDate">Payment due</Label>
            <Input
              id="dueDate"
              type="date"
              {...register("dueDate")}
              aria-invalid={!!errors.dueDate}
              className="mt-1"
            />
            {fieldError(errors.dueDate?.message)}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle className="text-base">Line items</CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={() => append({ ...BLANK_LINE })}>
            <Plus className="mr-2 h-4 w-4" />
            Add line
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {typeof errors.lineItems?.message === "string" && fieldError(errors.lineItems.message)}

          {/* Column headers on wide screens; each field keeps its own label on mobile. */}
          <div className="hidden gap-3 px-1 text-xs font-medium text-muted-foreground lg:grid lg:grid-cols-[1fr_5rem_5rem_8rem_7rem_2.5rem]">
            <span>Description</span>
            <span>Qty</span>
            <span>Unit</span>
            <span>Rate</span>
            <span className="text-right">Amount</span>
            <span className="sr-only">Remove</span>
          </div>

          {fields.map((field, index) => {
            const line = values.lineItems?.[index]
            const amount = (Number(line?.quantity) || 0) * (Number(line?.unitPrice) || 0)
            const lineErrors = errors.lineItems?.[index]

            return (
              <div
                key={field.id}
                className="grid gap-3 rounded-lg border border-border p-3 lg:grid-cols-[1fr_5rem_5rem_8rem_7rem_2.5rem] lg:items-start lg:border-0 lg:p-1"
              >
                <div>
                  <Label htmlFor={`line-${index}-description`} className="text-xs lg:sr-only">
                    Description
                  </Label>
                  <Textarea
                    id={`line-${index}-description`}
                    rows={1}
                    {...register(`lineItems.${index}.description`)}
                    placeholder="Instagram creatives — 12 posts"
                    aria-invalid={!!lineErrors?.description}
                    className="mt-1 min-h-[38px] lg:mt-0"
                  />
                  {fieldError(lineErrors?.description?.message)}
                </div>

                <div>
                  <Label htmlFor={`line-${index}-quantity`} className="text-xs lg:sr-only">
                    Qty
                  </Label>
                  <Input
                    id={`line-${index}-quantity`}
                    type="number"
                    step="0.01"
                    min="0"
                    inputMode="decimal"
                    {...register(`lineItems.${index}.quantity`)}
                    aria-invalid={!!lineErrors?.quantity}
                    className="mt-1 lg:mt-0"
                  />
                  {fieldError(lineErrors?.quantity?.message)}
                </div>

                <div>
                  <Label htmlFor={`line-${index}-unit`} className="text-xs lg:sr-only">
                    Unit
                  </Label>
                  <Input
                    id={`line-${index}-unit`}
                    {...register(`lineItems.${index}.unit`)}
                    placeholder="nos"
                    className="mt-1 lg:mt-0"
                  />
                </div>

                <div>
                  <Label htmlFor={`line-${index}-unitPrice`} className="text-xs lg:sr-only">
                    Rate
                  </Label>
                  <Input
                    id={`line-${index}-unitPrice`}
                    type="number"
                    step="0.01"
                    min="0"
                    inputMode="decimal"
                    {...register(`lineItems.${index}.unitPrice`)}
                    aria-invalid={!!lineErrors?.unitPrice}
                    className="mt-1 lg:mt-0"
                  />
                  {fieldError(lineErrors?.unitPrice?.message)}
                </div>

                <p className="self-center text-sm tabular-nums lg:pt-2 lg:text-right">
                  <span className="text-xs text-muted-foreground lg:hidden">Amount: </span>
                  {money(amount)}
                </p>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove line ${index + 1}`}
                  disabled={fields.length === 1}
                  onClick={() => remove(index)}
                  className="justify-self-end text-destructive hover:text-destructive lg:mt-0"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )
          })}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tax &amp; discount</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="taxType">Tax type</Label>
              <Select
                value={values.taxType}
                onValueChange={(value) => setValue("taxType", value as InvoiceFormValues["taxType"])}
              >
                <SelectTrigger id="taxType" className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CGST_SGST">CGST + SGST (same state)</SelectItem>
                  <SelectItem value="IGST">IGST (other state)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="taxPercent">Tax rate %</Label>
              <Input
                id="taxPercent"
                type="number"
                step="0.01"
                min="0"
                max="100"
                inputMode="decimal"
                {...register("taxPercent")}
                aria-invalid={!!errors.taxPercent}
                className="mt-1"
              />
              {fieldError(errors.taxPercent?.message)}
            </div>
            <div>
              <Label htmlFor="discountPercent">Discount %</Label>
              <Input
                id="discountPercent"
                type="number"
                step="0.01"
                min="0"
                max="100"
                inputMode="decimal"
                {...register("discountPercent")}
                aria-invalid={!!errors.discountPercent}
                className="mt-1"
              />
              {fieldError(errors.discountPercent?.message)}
            </div>
            <div>
              <Label htmlFor="currency">Currency</Label>
              <Input
                id="currency"
                maxLength={3}
                {...register("currency")}
                aria-invalid={!!errors.currency}
                className="mt-1 uppercase"
              />
              {fieldError(errors.currency?.message)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Totals</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd className="tabular-nums">{money(totals.subtotal)}</dd>
              </div>
              {totals.discountAmount > 0 && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Discount</dt>
                  <dd className="tabular-nums">−{money(totals.discountAmount)}</dd>
                </div>
              )}
              {values.taxType === "CGST_SGST" ? (
                <>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">CGST ({halfRate}%)</dt>
                    <dd className="tabular-nums">{money(totals.cgst)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">SGST ({halfRate}%)</dt>
                    <dd className="tabular-nums">{money(totals.sgst)}</dd>
                  </div>
                </>
              ) : (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">IGST ({Number(values.taxPercent) || 0}%)</dt>
                  <dd className="tabular-nums">{money(totals.igst)}</dd>
                </div>
              )}
              <Separator />
              <div className="flex justify-between text-base font-semibold">
                <dt>Total</dt>
                <dd className="tabular-nums">{money(totals.totalAmount)}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Terms &amp; notes</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="terms">Terms &amp; conditions</Label>
            <Textarea
              id="terms"
              rows={4}
              {...register("terms")}
              placeholder="50% advance, balance on delivery. Valid for 15 days."
              className="mt-1"
            />
            <p className="mt-1 text-xs text-muted-foreground">Printed on the document.</p>
          </div>
          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              rows={4}
              {...register("notes")}
              placeholder="Anything the client should read alongside the figures."
              className="mt-1"
            />
            <p className="mt-1 text-xs text-muted-foreground">Also printed — keep it client-safe.</p>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isEdit ? "Save changes" : "Create invoice"}
        </Button>
      </div>
    </form>
  )
}
