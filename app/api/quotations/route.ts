import { type NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { requireCan } from "@/lib/api-auth"
import { logAuditAction } from "@/lib/audit"
import { computeTotals } from "@/lib/finance"
import { nextDocumentNumber, withNumberRetry } from "@/lib/document-number"
import { quotationSchema } from "@/lib/validation/quotation"

export const dynamic = "force-dynamic"

const STATUSES = ["DRAFT", "SENT", "ACCEPTED", "REJECTED", "EXPIRED", "CONVERTED"] as const

/** Fields a list row renders — never the whole document. */
const listSelect = {
  id: true,
  number: true,
  title: true,
  status: true,
  currency: true,
  totalAmount: true,
  validUntil: true,
  createdAt: true,
  shareToken: true,
  company: { select: { id: true, name: true } },
  client: { select: { id: true, name: true, company: true } },
  project: { select: { id: true, name: true } },
  invoice: { select: { id: true, number: true } },
} satisfies Prisma.QuotationSelect

/**
 * List quotations, newest first. Filter with `?companyId=`, `?clientId=`, `?status=`
 * or `?search=` (number or title). Paged with `?page=` and `?limit=` (max 100).
 */
export async function GET(request: NextRequest) {
  const auth = await requireCan("quotations", "read")
  if (!auth.ok) return auth.response

  try {
    const query = request.nextUrl.searchParams
    const page = Math.max(1, Number(query.get("page")) || 1)
    const limit = Math.min(100, Math.max(1, Number(query.get("limit")) || 25))
    const status = query.get("status")
    const search = query.get("search")?.trim()

    const where: Prisma.QuotationWhereInput = {
      ...(query.get("companyId") ? { companyId: query.get("companyId")! } : {}),
      ...(query.get("clientId") ? { clientId: query.get("clientId")! } : {}),
      ...(status && STATUSES.includes(status as (typeof STATUSES)[number])
        ? { status: status as (typeof STATUSES)[number] }
        : {}),
      ...(search
        ? { OR: [{ number: { contains: search } }, { title: { contains: search } }] }
        : {}),
    }

    const [quotations, total] = await Promise.all([
      prisma.quotation.findMany({
        where,
        select: listSelect,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.quotation.count({ where }),
    ])

    return NextResponse.json({ quotations, total, page, limit })
  } catch (error) {
    console.error("[quotations] list failed:", error)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireCan("quotations", "create")
  if (!auth.ok) return auth.response

  try {
    const parsed = quotationSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
        { status: 422 },
      )
    }
    const input = parsed.data

    // A valid id from an untrusted caller is still untrusted: every reference is checked.
    const [company, client, project] = await Promise.all([
      prisma.company.findUnique({
        where: { id: input.companyId },
        select: { id: true, isActive: true, name: true },
      }),
      prisma.client.findUnique({ where: { id: input.clientId }, select: { id: true } }),
      input.projectId
        ? prisma.project.findUnique({
            where: { id: input.projectId },
            select: { id: true, clientId: true },
          })
        : null,
    ])

    if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 })
    if (!company.isActive) {
      return NextResponse.json(
        { error: `${company.name} is inactive and cannot issue new quotations.` },
        { status: 409 },
      )
    }
    if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 })
    if (input.projectId && !project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }
    if (project && project.clientId !== input.clientId) {
      return NextResponse.json(
        { error: "That project belongs to a different client." },
        { status: 422 },
      )
    }

    const totals = computeTotals(input)

    const quotation = await withNumberRetry(async () =>
      prisma.quotation.create({
        data: {
          companyId: input.companyId,
          clientId: input.clientId,
          projectId: input.projectId ?? null,
          createdById: auth.userId,
          number: await nextDocumentNumber("quotation", input.companyId),
          title: input.title,
          currency: input.currency,
          subtotal: totals.subtotal,
          discountPercent: input.discountPercent,
          taxType: input.taxType,
          taxPercent: input.taxPercent,
          totalAmount: totals.totalAmount,
          validUntil: input.validUntil,
          terms: input.terms,
          notes: input.notes,
          lineItems: {
            create: input.lineItems.map((line, position) => ({ ...line, position })),
          },
        },
        select: listSelect,
      }),
    )

    await logAuditAction({
      userId: String(auth.userId),
      action: "CREATE",
      entityType: "Quotation",
      entityId: quotation.id,
      newValues: JSON.stringify({ number: quotation.number, total: totals.totalAmount }),
      ipAddress: request.headers.get("x-forwarded-for") || "unknown",
      userAgent: request.headers.get("user-agent") || "unknown",
    })

    return NextResponse.json({ quotation }, { status: 201 })
  } catch (error) {
    console.error("[quotations] create failed:", error)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}
