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
