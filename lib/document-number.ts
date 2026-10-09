import { prisma } from "@/lib/prisma"

const PREFIX = { quotation: "QT", invoice: "INV" } as const

/**
 * Next document number for a company, e.g. QT-2026-0001. Numbering is per company and
 * per calendar year, so two companies can each hold QT-2026-0001.
 *
 * ponytail: zero-padded to 4 so a string sort finds the latest. Breaks past 9999
 * documents per company per year — widen the padding if that day ever comes.
 */
export async function nextDocumentNumber(
  kind: keyof typeof PREFIX,
  companyId: string,
): Promise<string> {
  const prefix = `${PREFIX[kind]}-${new Date().getFullYear()}-`
  const where = { companyId, number: { startsWith: prefix } }
  const latest =
    kind === "quotation"
      ? await prisma.quotation.findFirst({ where, orderBy: { number: "desc" }, select: { number: true } })
      : await prisma.invoice.findFirst({ where, orderBy: { number: "desc" }, select: { number: true } })

  const sequence = latest ? Number(latest.number.slice(prefix.length)) + 1 : 1
  return `${prefix}${String(sequence).padStart(4, "0")}`
}

/**
 * Two people creating a document at once can pick the same number;
 * @@unique([companyId, number]) rejects the loser with P2002, so take the next one.
 */
export async function withNumberRetry<T>(create: () => Promise<T>, attempts = 5): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await create()
    } catch (error) {
      const isDuplicate = (error as { code?: string }).code === "P2002"
      if (!isDuplicate || attempt >= attempts) throw error
    }
  }
}

