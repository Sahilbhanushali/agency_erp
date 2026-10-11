/** Shapes the finance screens consume. Money arrives from the API as a number. */

export interface Company {
  id: string
  name: string
  legalName: string | null
  email: string | null
  phone: string | null
  website: string | null
  logo: string | null
  letterhead: string | null
  signature: string | null
  gstNumber: string | null
  panNumber: string | null
  hsnNumber: string | null
  bankName: string | null
  bankAccountName: string | null
  bankAccountNumber: string | null
  bankIfsc: string | null
  bankBranch: string | null
  addressLine1: string | null
  addressLine2: string | null
  city: string | null
  state: string | null
  postalCode: string | null
  country: string
  currency: string
  isActive: boolean
  notes: string | null
  createdAt: string
  updatedAt: string
  _count?: { quotations: number; invoices: number }
}

export type TaxType = "CGST_SGST" | "IGST"

export type QuotationStatus =
  | "DRAFT"
  | "SENT"
  | "ACCEPTED"
  | "REJECTED"
  | "EXPIRED"
  | "CONVERTED"

export type InvoiceStatus = "DRAFT" | "SENT" | "PARTIAL" | "PAID" | "OVERDUE" | "CANCELLED"

export type PaymentMethod = "BANK_TRANSFER" | "UPI" | "CASH" | "CHEQUE" | "CARD" | "OTHER"

export interface DocumentLine {
  id?: string
  description: string
  quantity: number
  unit: string | null
  unitPrice: number
  position: number
}

/** Prisma Decimal columns serialize to strings over JSON — coerce with `toNumber`. */
export type Money = string | number

export interface QuotationLineItem {
  id: string
  description: string
  quantity: Money
  unit: string | null
  unitPrice: Money
  position: number
}

/** What a list row renders. */
export interface QuotationRow {
  id: string
  number: string
  title: string
  status: QuotationStatus
  currency: string
  totalAmount: Money
  validUntil: string | null
  createdAt: string
  shareToken: string | null
  company: { id: string; name: string }
  client: { id: string; name: string; company: string | null }
  project: { id: string; name: string } | null
  invoice: { id: string; number: string } | null
}

/** The whole document, as the editor and the printable sheet need it. */
export interface QuotationDetail extends QuotationRow {
  companyId: string
  clientId: string
  projectId: string | null
  subtotal: Money
  discountPercent: Money
  taxType: TaxType
  taxPercent: Money
  terms: string | null
  notes: string | null
  shareExpiresAt: string | null
  sentAt: string | null
  acceptedAt: string | null
  convertedAt: string | null
  updatedAt: string
  company: Company
  createdBy: { id: number; name: string | null } | null
  lineItems: QuotationLineItem[]
}

export interface Payment {
  id: string
  amount: Money
  method: PaymentMethod
  reference: string | null
  notes: string | null
  paidAt: string
  createdAt: string
  recordedBy: { id: number; name: string | null } | null
}

/** What an invoice list row renders. */
export interface InvoiceRow {
  id: string
  number: string
  title: string
  status: InvoiceStatus
  currency: string
  totalAmount: Money
  issueDate: string
  dueDate: string | null
  createdAt: string
  shareToken: string | null
  company: { id: string; name: string }
  client: { id: string; name: string; company: string | null }
  project: { id: string; name: string } | null
  quotation: { id: string; number: string } | null
  /** Summed server-side from the invoice's payments. */
  paid: Money
  balance: Money
}

export interface InvoiceDetail extends Omit<InvoiceRow, "paid" | "balance"> {
  companyId: string
  clientId: string
  projectId: string | null
  quotationId: string | null
  subtotal: Money
  discountPercent: Money
  taxType: TaxType
  taxPercent: Money
  terms: string | null
  notes: string | null
  shareExpiresAt: string | null
  sentAt: string | null
  updatedAt: string
  company: Company
  createdBy: { id: number; name: string | null } | null
  lineItems: QuotationLineItem[]
  payments: Payment[]
  paid: Money
  balance: Money
}

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  PARTIAL: "Part paid",
  PAID: "Paid",
  OVERDUE: "Overdue",
  CANCELLED: "Cancelled",
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  BANK_TRANSFER: "Bank transfer",
  UPI: "UPI",
  CASH: "Cash",
  CHEQUE: "Cheque",
  CARD: "Card",
  OTHER: "Other",
}
