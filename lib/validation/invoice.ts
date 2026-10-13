import { z } from "zod"
import { lineItemSchema } from "@/lib/validation/quotation"

/** Invoices bill the same lines a quotation quotes, so the line rules are shared. */
export { lineItemSchema }

const optionalLongText = z
  .string()
  .trim()
  .max(5000)
  .optional()
  .transform((value) => (value === "" ? undefined : value))

const optionalId = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value === "" ? undefined : value))

const optionalDate = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((value) => (value ? new Date(value) : null))
  .refine((value) => value === null || !Number.isNaN(value.getTime()), "Enter a valid date")

export const invoiceSchema = z.object({
  companyId: z.string().trim().min(1, "Choose the company issuing this invoice"),
  clientId: z.string().trim().min(1, "Choose a client"),
  projectId: optionalId,
  title: z.string().trim().min(1, "Give this invoice a title").max(255),
  currency: z.string().trim().length(3, "Use a 3-letter currency code").default("INR"),
  discountPercent: z.coerce.number().min(0).max(100, "Discount cannot exceed 100%").default(0),
  taxType: z.enum(["CGST_SGST", "IGST"]).default("CGST_SGST"),
  taxPercent: z.coerce.number().min(0).max(100, "Tax cannot exceed 100%").default(18),
  issueDate: optionalDate,
  dueDate: optionalDate,
  terms: optionalLongText,
  notes: optionalLongText,
  lineItems: z.array(lineItemSchema).min(1, "Add at least one line item").max(200),
})

/**
 * PAID and PARTIAL are absent on purpose: those are derived from payments, so letting
 * them be set by hand would let the status disagree with the money received.
 */
export const invoiceUpdateSchema = invoiceSchema.partial().extend({
  status: z.enum(["DRAFT", "SENT", "OVERDUE", "CANCELLED"]).optional(),
})

export const paymentSchema = z.object({
  amount: z.coerce.number().positive("Enter an amount greater than zero").max(100_000_000),
  method: z
    .enum(["BANK_TRANSFER", "UPI", "CASH", "CHEQUE", "CARD", "OTHER"])
    .default("BANK_TRANSFER"),
  reference: z
    .string()
    .trim()
    .max(255)
    .optional()
    .transform((value) => (value === "" ? undefined : value)),
  notes: optionalLongText,
  paidAt: optionalDate,
})

/** Same rules shaped for react-hook-form: dates stay strings, no transforms run. */
export const invoiceFormSchema = z.object({
  companyId: z.string().min(1, "Choose the company issuing this invoice"),
  clientId: z.string().min(1, "Choose a client"),
  projectId: z.string(),
  title: z.string().trim().min(1, "Give this invoice a title").max(255),
  currency: z.string().trim().length(3, "Use a 3-letter code"),
  discountPercent: z.coerce.number().min(0, "Cannot be negative").max(100, "Max 100%"),
  taxType: z.enum(["CGST_SGST", "IGST"]),
  taxPercent: z.coerce.number().min(0, "Cannot be negative").max(100, "Max 100%"),
  issueDate: z.string(),
  dueDate: z.string(),
  terms: z.string().max(5000),
  notes: z.string().max(5000),
  lineItems: z
    .array(
      z.object({
        description: z.string().trim().min(1, "Required").max(2000),
        quantity: z.coerce.number().min(0, "Cannot be negative").max(1_000_000),
        unit: z.string().max(50),
        unitPrice: z.coerce.number().min(0, "Cannot be negative").max(100_000_000),
      }),
    )
    .min(1, "Add at least one line item")
    .max(200),
})

export type InvoiceInput = z.infer<typeof invoiceSchema>
export type InvoiceFormValues = z.infer<typeof invoiceFormSchema>
