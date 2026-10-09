import { z } from "zod"

/** Blank strings from HTML inputs mean "not set", not "empty value". */
const optionalText = z
  .string()
  .trim()
  .max(255)
  .optional()
  .transform((value) => (value === "" ? undefined : value))

export const companySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(255),
  legalName: optionalText,
  email: z
    .string()
    .trim()
    .email("Enter a valid email address")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  phone: optionalText,
  website: optionalText,
  logo: optionalText,
  letterhead: optionalText,
  signature: optionalText,

  gstNumber: optionalText,
  panNumber: optionalText,
  hsnNumber: optionalText,

  bankName: optionalText,
  bankAccountName: optionalText,
  bankAccountNumber: optionalText,
  bankIfsc: optionalText,
  bankBranch: optionalText,

  addressLine1: optionalText,
  addressLine2: optionalText,
  city: optionalText,
  state: optionalText,
  postalCode: optionalText,
  country: z.string().trim().max(100).default("India"),

  currency: z.string().trim().length(3, "Use a 3-letter currency code").default("INR"),
  isActive: z.boolean().default(true),
  notes: z.string().trim().max(5000).optional().transform((v) => (v === "" ? undefined : v)),
})

export const companyUpdateSchema = companySchema.partial()

export type CompanyInput = z.infer<typeof companySchema>
