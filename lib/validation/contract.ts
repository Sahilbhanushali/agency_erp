import { z } from "zod"

/** Blank strings from HTML inputs mean "not set", not "empty value". */
const optionalText = z
  .string()
  .trim()
  .max(255)
  .optional()
  .transform((value) => (value === "" ? undefined : value))

export const contractSchema = z.object({
  clientId: z.string().min(1, "Client is required"),
  projectId: optionalText,
  contractNumber: optionalText,
  title: z.string().trim().min(1, "Title is required").max(255),
  type: z
    .enum(["RETAINER", "FIXED_SOW", "NDA", "MASTER_SERVICES_AGREEMENT", "ONE_TIME", "CUSTOM"])
    .default("RETAINER"),
  status: z
    .enum(["DRAFT", "ACTIVE", "EXPIRING_SOON", "EXPIRED", "TERMINATED", "RENEWED"])
    .default("ACTIVE"),
  value: z.coerce.number().min(0, "Contract value must be non-negative").default(0),
  currency: z.string().trim().length(3, "Currency must be a 3-letter code").default("INR"),
  billingCycle: z.enum(["MONTHLY", "QUARTERLY", "ANNUALLY", "ONE_TIME"]).default("MONTHLY"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: optionalText,
  renewalDate: optionalText,
  autoRenew: z.boolean().default(false),
  noticePeriodDays: z.coerce.number().min(0).default(30),
  retainerHours: z.coerce.number().optional().nullable(),
  deliverableQuota: z.record(z.string(), z.any()).optional().nullable(),
  documentUrl: optionalText,
  signedAt: optionalText,
  signedBy: optionalText,
  notes: z
    .string()
    .trim()
    .max(5000)
    .optional()
    .transform((v) => (v === "" ? undefined : v)),
})

export const contractUpdateSchema = contractSchema.partial()

export type ContractInput = z.infer<typeof contractSchema>
