import type { InvoiceStatus, Prisma, QuotationStatus, TaxType } from "@prisma/client"

/**
 * One money/tax engine for quotations and invoices so the two can never disagree.
 * Everything rounds to 2 decimals at each boundary — the same order the printed
 * document reads, so the figures on screen always add up on paper.
 */

/** Kills float residue (0.1*3 = 0.30000000000000004) before rounding to paise. */
const round2 = (value: number) => Math.round(Number((value * 100).toFixed(4))) / 100

export interface TotalsInput {
  lineItems: { quantity: number; unitPrice: number }[]
  discountPercent?: number
  taxPercent?: number
  taxType?: TaxType
}

export interface Totals {
  subtotal: number
  discountAmount: number
  taxableAmount: number
  /** Half the tax each when taxType is CGST_SGST, otherwise 0. */
  cgst: number
  sgst: number
  /** The whole tax when taxType is IGST, otherwise 0. */
  igst: number
  taxAmount: number
  totalAmount: number
}

export function computeTotals({
  lineItems,
  discountPercent = 0,
  taxPercent = 0,
  taxType = "CGST_SGST",
}: TotalsInput): Totals {
  const subtotal = round2(
    lineItems.reduce((sum, line) => sum + round2(line.quantity * line.unitPrice), 0),
  )
  const discountAmount = round2((subtotal * discountPercent) / 100)
  const taxableAmount = round2(subtotal - discountAmount)
  const taxAmount = round2((taxableAmount * taxPercent) / 100)

  // CGST and SGST split the rate; halving the computed tax keeps the two halves
  // summing to exactly taxAmount even when the paise doesn't divide evenly.
  const half = round2(taxAmount / 2)
  const isSplit = taxType === "CGST_SGST"

  return {
    subtotal,
    discountAmount,
    taxableAmount,
    cgst: isSplit ? half : 0,
    sgst: isSplit ? round2(taxAmount - half) : 0,
    igst: isSplit ? 0 : taxAmount,
    taxAmount,
    totalAmount: round2(taxableAmount + taxAmount),
  }
}

/** Decimal columns arrive as Prisma Decimal; the UI and the math both want numbers. */
export const toNumber = (value: unknown): number => Number(value ?? 0)

export function formatMoney(amount: number, currency = "INR"): string {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    return `${currency} ${amount.toFixed(2)}`
  }
}

/**
 * Every field a rendered quotation needs — the staff view, the printable sheet and the
 * public client link all read exactly this, so the three can never drift apart.
 * Type-only Prisma import: this module stays runnable for lib/finance.check.ts.
 */
export const quotationDetailSelect = {
  id: true,
  number: true,
  title: true,
  status: true,
  currency: true,
  subtotal: true,
  discountPercent: true,
  taxType: true,
  taxPercent: true,
  totalAmount: true,
  validUntil: true,
  terms: true,
  notes: true,
  shareToken: true,
  shareExpiresAt: true,
  sentAt: true,
  acceptedAt: true,
  convertedAt: true,
  createdAt: true,
  updatedAt: true,
  companyId: true,
  clientId: true,
  projectId: true,
  company: true,
  client: { select: { id: true, name: true, email: true, phone: true, company: true } },
  project: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
  invoice: { select: { id: true, number: true } },
  lineItems: {
    orderBy: { position: "asc" },
    select: { id: true, description: true, quantity: true, unit: true, unitPrice: true, position: true },
  },
} satisfies Prisma.QuotationSelect

/**
 * Where a quotation may go next. CONVERTED is terminal — an invoice depends on it —
 * and is only ever set by the conversion itself, never chosen by hand.
 * The API enforces this; the UI reads it to decide which buttons to show.
 */
export const QUOTATION_TRANSITIONS: Record<QuotationStatus, QuotationStatus[]> = {
  DRAFT: ["SENT", "EXPIRED"],
  SENT: ["ACCEPTED", "REJECTED", "EXPIRED", "DRAFT"],
  ACCEPTED: ["CONVERTED", "SENT"],
  REJECTED: ["DRAFT"],
  EXPIRED: ["DRAFT", "SENT"],
  CONVERTED: [],
}

/**
 * What an invoice is owed, derived from its payments rather than stored, so a recorded
 * or deleted payment can never drift out of step with the balance.
 */
export interface PaymentSummary {
  paid: number
  balance: number
  /** The status the payments imply. CANCELLED and DRAFT are never overridden. */
  status: InvoiceStatus
}

export function paymentSummary(
  totalAmount: unknown,
  payments: { amount: unknown }[],
  currentStatus: InvoiceStatus,
): PaymentSummary {
  const total = round2(toNumber(totalAmount))
  const paid = round2(payments.reduce((sum, p) => sum + toNumber(p.amount), 0))
  const balance = round2(total - paid)

  // A cancelled invoice is closed, and a draft has not been issued yet — neither is
  // reinterpreted by whatever money happens to have arrived.
  if (currentStatus === "CANCELLED" || currentStatus === "DRAFT") {
    return { paid, balance, status: currentStatus }
  }
  if (total > 0 && paid >= total) return { paid, balance, status: "PAID" }
  if (paid > 0) return { paid, balance, status: "PARTIAL" }
  return { paid, balance, status: currentStatus === "PAID" ? "SENT" : currentStatus }
}

/**
 * OVERDUE is computed for display, never stored: storing it would need a nightly job
 * to flip invoices the moment they age past their due date.
 * ponytail: derive at read time; add a cron only if OVERDUE ever has to be queryable.
 */
export function isInvoiceOverdue(invoice: {
  dueDate: Date | string | null
  status: InvoiceStatus
}, balance: number): boolean {
  if (!invoice.dueDate || balance <= 0) return false
  if (invoice.status !== "SENT" && invoice.status !== "PARTIAL") return false
  return new Date(invoice.dueDate) < new Date(new Date().toDateString())
}

/**
 * Where an invoice may go next. PAID and PARTIAL are reached by recording payments,
 * never chosen by hand, so they are absent from every list here.
 */
export const INVOICE_TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  DRAFT: ["SENT", "CANCELLED"],
  SENT: ["DRAFT", "CANCELLED"],
  PARTIAL: ["CANCELLED"],
  PAID: [],
  OVERDUE: ["SENT", "CANCELLED"],
  CANCELLED: ["DRAFT"],
}

/** Every field a rendered invoice needs — staff view, printable sheet and client link. */
export const invoiceDetailSelect = {
  id: true,
  number: true,
  title: true,
  status: true,
  currency: true,
  subtotal: true,
  discountPercent: true,
  taxType: true,
  taxPercent: true,
  totalAmount: true,
  issueDate: true,
  dueDate: true,
  terms: true,
  notes: true,
  shareToken: true,
  shareExpiresAt: true,
  sentAt: true,
  createdAt: true,
  updatedAt: true,
  companyId: true,
  clientId: true,
  projectId: true,
  quotationId: true,
  company: true,
  client: { select: { id: true, name: true, email: true, phone: true, company: true } },
  project: { select: { id: true, name: true } },
  quotation: { select: { id: true, number: true } },
  createdBy: { select: { id: true, name: true } },
  lineItems: {
    orderBy: { position: "asc" },
    select: { id: true, description: true, quantity: true, unit: true, unitPrice: true, position: true },
  },
  payments: {
    orderBy: { paidAt: "desc" },
    select: {
      id: true,
      amount: true,
      method: true,
      reference: true,
      notes: true,
      paidAt: true,
      createdAt: true,
      recordedBy: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.InvoiceSelect
