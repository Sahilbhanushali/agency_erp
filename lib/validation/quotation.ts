import { z } from "zod"

/** Blank strings from HTML inputs mean "not set", not "empty value". */
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

/** `<input type="date">` sends "" when cleared and "YYYY-MM-DD" otherwise. */
const optionalDate = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((value) => (value ? new Date(value) : null))
  .refine((value) => value === null || !Number.isNaN(value.getTime()), "Enter a valid date")

export const lineItemSchema = z.object({
  description: z.string().trim().min(1, "Describe what is being billed").max(2000),
  quantity: z.coerce.number().min(0, "Quantity cannot be negative").max(1_000_000),
  unit: z.string().trim().max(50).optional().transform((v) => (v === "" ? undefined : v)),
  unitPrice: z.coerce.number().min(0, "Rate cannot be negative").max(100_000_000),
})

export const quotationSchema = z.object({
  companyId: z.string().trim().min(1, "Choose the company issuing this quotation"),
  clientId: z.string().trim().min(1, "Choose a client"),
  /** One of that client's companies; null bills the client by name. */
  clientCompanyId: z.string().trim().max(64).nullable().optional().transform((v) => v || null),
  projectId: optionalId,
  title: z.string().trim().min(1, "Give this quotation a title").max(255),
  currency: z.string().trim().length(3, "Use a 3-letter currency code").default("INR"),
  discountPercent: z.coerce.number().min(0).max(100, "Discount cannot exceed 100%").default(0),
  taxType: z.enum(["CGST_SGST", "IGST"]).default("CGST_SGST"),
  taxPercent: z.coerce.number().min(0).max(100, "Tax cannot exceed 100%").default(18),
  validUntil: optionalDate,
  terms: optionalLongText,
  notes: optionalLongText,
  lineItems: z.array(lineItemSchema).min(1, "Add at least one line item").max(200),
})

/** Status moves through its own endpoint-level rules; the editor never sets it directly. */
export const quotationUpdateSchema = quotationSchema.partial().extend({
  status: z.enum(["DRAFT", "SENT", "ACCEPTED", "REJECTED", "EXPIRED", "CONVERTED"]).optional(),
})

export type QuotationInput = z.infer<typeof quotationSchema>

/**
 * The same rules as `quotationSchema`, but shaped for react-hook-form: dates stay
 * strings (`<input type="date">`) and no transforms run, so the resolver's input and
 * output types match what the inputs actually hold. The wire schema above re-validates
 * everything server-side — this exists for inline field errors, not for trust.
 */
export const quotationFormSchema = z.object({
  companyId: z.string().min(1, "Choose the company issuing this quotation"),
  clientId: z.string().min(1, "Choose a client"),
  clientCompanyId: z.string(),
  projectId: z.string(),
  title: z.string().trim().min(1, "Give this quotation a title").max(255),
  currency: z.string().trim().length(3, "Use a 3-letter code"),
  discountPercent: z.coerce.number().min(0, "Cannot be negative").max(100, "Max 100%"),
  taxType: z.enum(["CGST_SGST", "IGST"]),
  taxPercent: z.coerce.number().min(0, "Cannot be negative").max(100, "Max 100%"),
  validUntil: z.string(),
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

export type QuotationFormValues = z.infer<typeof quotationFormSchema>
