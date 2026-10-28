import type { z } from "zod";

export { companySchema } from "@/lib/client-company";

export const companySelect = {
  id: true,
  name: true,
  website: true,
  industry: true,
  gstin: true,
  panNumber: true,
  address: true,
  city: true,
  state: true,
  country: true,
  postalCode: true,
  logo: true,
  _count: { select: { projects: true, invoices: true, quotations: true } },
} as const;

export const fieldErrors = (e: z.ZodError) =>
  Object.fromEntries(e.issues.map((i) => [i.path.join("."), i.message]));
