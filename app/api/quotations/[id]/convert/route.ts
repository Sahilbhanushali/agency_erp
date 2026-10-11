import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePermission } from "@/lib/api-auth"
import { logAuditAction } from "@/lib/audit"
import { invoiceDetailSelect, toNumber } from "@/lib/finance"
import { nextDocumentNumber, withNumberRetry } from "@/lib/document-number"

export const dynamic = "force-dynamic"

/**
 * Turn an accepted quotation into an invoice.
 *
 * The invoice is a copy, not a view: its lines and figures are snapshotted so editing
 * the quotation afterwards cannot alter what the client was billed. `Invoice.quotationId`
 * is unique, so a quotation can only ever produce one invoice — the second attempt is a
 * 409 naming the invoice that already exists.
 *
 * Creating an invoice needs Manage-invoices; the quotation is only read and stamped.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("Manage-invoices")
  if (!auth.ok) return auth.response

  try {
    const { id } = await context.params
    const body = await request.json().catch(() => ({}))
    const dueInDays = Math.min(365, Math.max(0, Number(body?.dueInDays) || 15))

    const quotation = await prisma.quotation.findUnique({
      where: { id },
      select: {
        id: true,
        number: true,
        status: true,
        title: true,
        currency: true,
        companyId: true,
        clientId: true,
        projectId: true,
        subtotal: true,
        discountPercent: true,
        taxType: true,
        taxPercent: true,
        totalAmount: true,
        terms: true,
        notes: true,
        company: { select: { isActive: true, name: true } },
        invoice: { select: { id: true, number: true } },
        lineItems: {
          orderBy: { position: "asc" },
          select: { description: true, quantity: true, unit: true, unitPrice: true, position: true },
        },
      },
    })
    if (!quotation) return NextResponse.json({ error: "Not found" }, { status: 404 })

    if (quotation.invoice) {
      return NextResponse.json(
        {
          error: `${quotation.number} was already invoiced as ${quotation.invoice.number}.`,
          invoiceId: quotation.invoice.id,
        },
        { status: 409 },
      )
    }
    if (quotation.status !== "ACCEPTED") {
      return NextResponse.json(
        {
          error: `Only an accepted quotation can be invoiced. ${quotation.number} is ${quotation.status.toLowerCase()}.`,
        },
        { status: 409 },
      )
    }
    if (!quotation.company.isActive) {
      return NextResponse.json(
        { error: `${quotation.company.name} is inactive and cannot issue new invoices.` },
        { status: 409 },
      )
    }
    if (quotation.lineItems.length === 0) {
      return NextResponse.json(
        { error: `${quotation.number} has no line items to invoice.` },
        { status: 409 },
      )
    }

    const issueDate = new Date()
    const dueDate = new Date(issueDate.getTime() + dueInDays * 24 * 60 * 60 * 1000)

    const invoice = await withNumberRetry(async () => {
      const number = await nextDocumentNumber("invoice", quotation.companyId)
      return prisma.$transaction(async (tx) => {
        const created = await tx.invoice.create({
          data: {
            companyId: quotation.companyId,
            clientId: quotation.clientId,
            projectId: quotation.projectId,
            quotationId: quotation.id,
            createdById: auth.userId,
            number,
            title: quotation.title,
            status: "DRAFT",
            currency: quotation.currency,
            subtotal: quotation.subtotal,
            discountPercent: quotation.discountPercent,
            taxType: quotation.taxType,
            taxPercent: quotation.taxPercent,
            totalAmount: quotation.totalAmount,
            issueDate,
            dueDate,
            terms: quotation.terms,
            notes: quotation.notes,
            lineItems: { create: quotation.lineItems },
          },
          select: invoiceDetailSelect,
        })

        await tx.quotation.update({
          where: { id: quotation.id },
          data: { status: "CONVERTED", convertedAt: issueDate },
        })

        return created
      })
    })

    await logAuditAction({
      userId: String(auth.userId),
      action: "CONVERTED",
      entityType: "Quotation",
      entityId: quotation.id,
      oldValues: JSON.stringify({ number: quotation.number, status: quotation.status }),
      newValues: JSON.stringify({
        invoice: invoice.number,
        total: toNumber(invoice.totalAmount),
      }),
      ipAddress: request.headers.get("x-forwarded-for") || "unknown",
      userAgent: request.headers.get("user-agent") || "unknown",
    })

    return NextResponse.json(
      { invoice: { ...invoice, paid: 0, balance: toNumber(invoice.totalAmount) } },
      { status: 201 },
    )
  } catch (error) {
    console.error("[quotations] convert failed:", error)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}
