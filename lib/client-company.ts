import { z } from "zod"

/**
 * The company name to show for a project: the client company it names, falling back
 * to the client's legacy single `company`, for projects created before a client could
 * run several companies.
 */
export function projectCompanyName(
  project: { clientCompany?: { name: string } | null; client?: { company?: string | null } | null } | null | undefined
): string | null {
  return project?.clientCompany?.name || project?.client?.company || null
}

/** The logo to show for a project: its company's, falling back to the client's photo. */
export function projectLogo(
  project: { clientCompany?: { logo?: string | null } | null; client?: { avatar?: string | null } | null } | null | undefined
): string | null {
  return project?.clientCompany?.logo || project?.client?.avatar || null
}

const opt = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null)
    .nullable()
    .optional();

/** Fields of one of a client's companies, as the client page sends them. */
export const companySchema = z.object({
  name: z.string().trim().min(1, "Company name is required").max(150),
  website: opt(255),
  industry: opt(100),
  gstin: z
    .string()
    .trim()
    .toUpperCase()
    .refine((v) => v === "" || /^[0-9A-Z]{15}$/.test(v), "GSTIN is 15 letters and digits")
    .transform((v) => v || null)
    .nullable()
    .optional(),
  panNumber: z
    .string()
    .trim()
    .toUpperCase()
    .refine((v) => v === "" || /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(v), "PAN looks like ABCDE1234F")
    .transform((v) => v || null)
    .nullable()
    .optional(),
  address: opt(1000),
  city: opt(100),
  state: opt(100),
  country: opt(100),
  postalCode: opt(20),
});
