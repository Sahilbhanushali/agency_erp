import type { Prisma, QuotationStatus, TaxType } from "@prisma/client"

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
