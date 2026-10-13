import { z } from "zod"

const optionalText = z
  .string()
  .trim()
  .max(255)
  .optional()
  .transform((value) => (value === "" ? undefined : value))

/** Blank means "not set" — an internal credential has no client or project. */
const optionalId = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((value) => (value === "" || value === undefined ? null : value))

export const credentialSchema = z.object({
  label: z.string().trim().min(1, "Say what this login is for").max(255),
  category: optionalText,
  clientId: optionalId,
  projectId: optionalId,
  location: z.string().trim().max(255).default(""),
  platform: z.string().trim().min(1, "Platform is required").max(255),
  userId: z.string().trim().min(1, "Username or email is required").max(255),
  password: z.string().min(1, "Password is required").max(1000),
  url: optionalText,
  notes: z.string().trim().max(5000).optional().transform((v) => (v === "" ? undefined : v)),
})

/** On update the password is optional — omitting it leaves the stored one alone. */
export const credentialUpdateSchema = credentialSchema
  .partial()
  .extend({ password: z.string().min(1).max(1000).optional() })

export type CredentialInput = z.infer<typeof credentialSchema>
