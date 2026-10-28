import { prisma } from "@/lib/prisma"

/**
 * Checks a client-supplied company id belongs to the project's client.
 * Returns the id to store (null for "no company"), or false when it doesn't belong.
 */
export async function resolveClientCompanyId(clientId: string, raw: unknown): Promise<string | null | false> {
  if (raw === undefined || raw === null || raw === "") return null
  if (typeof raw !== "string" || raw.length > 64) return false
  const found = await prisma.clientCompany.findFirst({ where: { id: raw, clientId }, select: { id: true } })
  return found ? found.id : false
}
