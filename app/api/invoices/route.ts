import { type NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { resolveClientCompanyId } from "@/lib/client-company-server"
import { requireCan } from "@/lib/api-auth"
import { logAuditAction } from "@/lib/audit"
import { computeTotals, paymentSummary, toNumber } from "@/lib/finance"
import { nextDocumentNumber, withNumberRetry } from "@/lib/document-number"
import { invoiceSchema } from "@/lib/validation/invoice"

export const dynamic = "force-dynamic"

const STATUSES = ["DRAFT", "SENT", "PARTIAL", "PAID", "OVERDUE", "CANCELLED"] as const

/** Fields a list row renders. Payments come through as amounts only, to be summed. */
const listSelect = {
  id: true,
  number: true,
  title: true,
  status: true,
  currency: true,
  totalAmount: true,
  issueDate: true,
  dueDate: true,
  createdAt: true,
  shareToken: true,
  company: { select: { id: true, name: true } },
  client: { select: { id: true, name: true, company: true } },
  clientCompany: { select: { id: true, name: true } },
  project: { select: { id: true, name: true } },
  quotation: { select: { id: true, number: true } },
  payments: { select: { amount: true } },
} satisfies Prisma.InvoiceSelect

/**
 * List invoices, newest first. Filter with `?companyId=`, `?clientId=`, `?status=`,
 * `?unpaid=1` (anything still owed) or `?search=` (number or title).
 * Paged with `?page=` and `?limit=` (max 100).
 */
export async function GET(request: NextRequest) {
  const auth = await requireCan("invoices", "read")
  if (!auth.ok) return auth.response

  try {
    const query = request.nextUrl.searchParams
    const page = Math.max(1, Number(query.get("page")) || 1)
    const limit = Math.min(100, Math.max(1, Number(query.get("limit")) || 25))
    const status = query.get("status")
    const search = query.get("search")?.trim()

    const where: Prisma.InvoiceWhereInput = {
      ...(query.get("companyId") ? { companyId: query.get("companyId")! } : {}),
      ...(query.get("clientId") ? { clientId: query.get("clientId")! } : {}),
      ...(status && STATUSES.includes(status as (typeof STATUSES)[number])
        ? { status: status as (typeof STATUSES)[number] }
        : {}),
      ...(query.get("unpaid") === "1" ? { status: { in: ["SENT", "PARTIAL", "OVERDUE"] } } : {}),
      ...(search
        ? { OR: [{ number: { contains: search } }, { title: { contains: search } }] }
        : {}),
    }

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        select: listSelect,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.invoice.count({ where }),
    ])

    // Balances are derived, never stored, so a recorded payment cannot drift out of
    // step with what the list shows.
    const rows = invoices.map(({ payments, ...invoice }) => {
      const summary = paymentSummary(invoice.totalAmount, payments, invoice.status)
      return { ...invoice, paid: summary.paid, balance: summary.balance }
    })

    const outstanding = rows.reduce(
      (sum, row) => (row.status === "CANCELLED" ? sum : sum + row.balance),
      0,
    )

    return NextResponse.json({ invoices: rows, total, page, limit, outstanding })
  } catch (error) {
    console.error("[invoices] list failed:", error)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireCan("invoices", "create")
  if (!auth.ok) return auth.response

  try {
    const parsed = invoiceSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
        { status: 422 },
      )
    }
    const input = parsed.data

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
        { error: `${company.name} is inactive and cannot issue new invoices.` },
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
    const clientCompanyId = await resolveClientCompanyId(input.clientId, input.clientCompanyId)
    if (clientCompanyId === false) {
      return NextResponse.json(
        { error: "Invalid input", details: { clientCompanyId: ["That company doesn't belong to the selected client"] } },
        { status: 422 },
      )
    }
    if (input.issueDate && input.dueDate && input.dueDate < input.issueDate) {
      return NextResponse.json(
        { error: "Invalid input", details: { dueDate: ["Due date cannot be before the issue date"] } },
        { status: 422 },
      )
    }

    const totals = computeTotals(input)

    const invoice = await withNumberRetry(async () =>
      prisma.invoice.create({
        data: {
          companyId: input.companyId,
          clientId: input.clientId,
          clientCompanyId,
          projectId: input.projectId ?? null,
          createdById: auth.userId,
          number: await nextDocumentNumber("invoice", input.companyId),
          title: input.title,
          currency: input.currency,
          subtotal: totals.subtotal,
          discountPercent: input.discountPercent,
          taxType: input.taxType,
          taxPercent: input.taxPercent,
          totalAmount: totals.totalAmount,
          ...(input.issueDate ? { issueDate: input.issueDate } : {}),
          dueDate: input.dueDate,
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
      entityType: "Invoice",
      entityId: invoice.id,
      newValues: JSON.stringify({ number: invoice.number, total: totals.totalAmount }),
      ipAddress: request.headers.get("x-forwarded-for") || "unknown",
      userAgent: request.headers.get("user-agent") || "unknown",
    })

    const { payments, ...row } = invoice
    return NextResponse.json(
      { invoice: { ...row, paid: 0, balance: toNumber(row.totalAmount) } },
      { status: 201 },
    )
  } catch (error) {
    console.error("[invoices] create failed:", error)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}
