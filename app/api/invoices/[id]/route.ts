import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCan } from "@/lib/api-auth"
import { logAuditAction } from "@/lib/audit"
import {
  INVOICE_TRANSITIONS,
  computeTotals,
  invoiceDetailSelect,
  isInvoiceOverdue,
  paymentSummary,
  toNumber,
} from "@/lib/finance"
import { invoiceUpdateSchema } from "@/lib/validation/invoice"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireCan("invoices", "read")
  if (!auth.ok) return auth.response

  try {
    const { id } = await context.params
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      select: invoiceDetailSelect,
    })
    if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const summary = paymentSummary(invoice.totalAmount, invoice.payments, invoice.status)
    return NextResponse.json({
      invoice: {
        ...invoice,
        paid: summary.paid,
        balance: summary.balance,
        overdue: isInvoiceOverdue(invoice, summary.balance),
      },
    })
  } catch (error) {
    console.error("[invoices] read failed:", error)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireCan("invoices", "update")
  if (!auth.ok) return auth.response

  try {
    const { id } = await context.params
    const parsed = invoiceUpdateSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
        { status: 422 },
      )
    }
    const input = parsed.data

    const existing = await prisma.invoice.findUnique({
      where: { id },
      select: {
        id: true,
        number: true,
        status: true,
        companyId: true,
        clientId: true,
        issueDate: true,
        discountPercent: true,
        taxPercent: true,
        taxType: true,
        totalAmount: true,
        lineItems: { select: { quantity: true, unitPrice: true } },
        payments: { select: { amount: true } },
      },
    })
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const paid = existing.payments.reduce((sum, p) => sum + toNumber(p.amount), 0)

    // Once money has arrived against an invoice, its figures are part of the client's
    // records. Reverse the payment first if the amounts were genuinely wrong.
    const changesFigures =
      input.lineItems !== undefined ||
      input.discountPercent !== undefined ||
      input.taxPercent !== undefined ||
      input.taxType !== undefined
    if (paid > 0 && changesFigures) {
      return NextResponse.json(
        {
          error: `${existing.number} already has payments recorded against it. Delete those payments before changing the amounts.`,
        },
        { status: 409 },
      )
    }

    if (input.status && input.status !== existing.status) {
      if (!INVOICE_TRANSITIONS[existing.status].includes(input.status)) {
        return NextResponse.json(
          {
            error: `A ${existing.status.toLowerCase()} invoice cannot become ${input.status.toLowerCase()}.`,
          },
          { status: 409 },
        )
      }
    }

    // The company is part of the number series, so the document cannot be moved.
    if (input.companyId && input.companyId !== existing.companyId) {
      return NextResponse.json(
        { error: `${existing.number} is numbered under its current company and cannot be moved.` },
        { status: 409 },
      )
    }

    const clientId = input.clientId ?? existing.clientId
    if (input.clientId && input.clientId !== existing.clientId) {
      const client = await prisma.client.findUnique({
        where: { id: input.clientId },
        select: { id: true },
      })
      if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 })
    }
    if (input.projectId) {
      const project = await prisma.project.findUnique({
        where: { id: input.projectId },
        select: { id: true, clientId: true },
      })
      if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 })
      if (project.clientId !== clientId) {
        return NextResponse.json(
          { error: "That project belongs to a different client." },
          { status: 422 },
        )
      }
    }

    const issueDate = input.issueDate ?? existing.issueDate
    if (input.dueDate && issueDate && input.dueDate < issueDate) {
      return NextResponse.json(
        { error: "Invalid input", details: { dueDate: ["Due date cannot be before the issue date"] } },
        { status: 422 },
      )
    }

    // Totals always come from the stored lines, never from the client.
    const lineItems =
      input.lineItems ??
      existing.lineItems.map((line) => ({
        quantity: toNumber(line.quantity),
        unitPrice: toNumber(line.unitPrice),
        description: "",
      }))
    const totals = computeTotals({
      lineItems,
      discountPercent: input.discountPercent ?? toNumber(existing.discountPercent),
      taxPercent: input.taxPercent ?? toNumber(existing.taxPercent),
      taxType: input.taxType ?? existing.taxType,
    })

    const now = new Date()
    const invoice = await prisma.$transaction(async (tx) => {
      if (input.lineItems) {
        // Lines are owned by the document: replace the set rather than diffing ids.
        await tx.invoiceLine.deleteMany({ where: { invoiceId: id } })
        await tx.invoiceLine.createMany({
          data: input.lineItems.map((line, position) => ({ ...line, invoiceId: id, position })),
        })
      }

      return tx.invoice.update({
        where: { id },
        data: {
          ...(input.clientId ? { clientId: input.clientId } : {}),
          ...(input.projectId !== undefined ? { projectId: input.projectId ?? null } : {}),
          ...(input.title ? { title: input.title } : {}),
          ...(input.currency ? { currency: input.currency } : {}),
          ...(input.issueDate ? { issueDate: input.issueDate } : {}),
          ...(input.dueDate !== undefined ? { dueDate: input.dueDate } : {}),
          ...(input.terms !== undefined ? { terms: input.terms } : {}),
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
          discountPercent: input.discountPercent ?? existing.discountPercent,
          taxPercent: input.taxPercent ?? existing.taxPercent,
          taxType: input.taxType ?? existing.taxType,
          subtotal: totals.subtotal,
          totalAmount: totals.totalAmount,
          ...(input.status ? { status: input.status } : {}),
          ...(input.status === "SENT" && !existing.status.match(/SENT|PARTIAL|PAID/)
            ? { sentAt: now }
            : {}),
        },
        select: invoiceDetailSelect,
      })
    })

    await logAuditAction({
      userId: String(auth.userId),
      action: "UPDATE",
      entityType: "Invoice",
      entityId: id,
      oldValues: JSON.stringify({ status: existing.status, total: toNumber(existing.totalAmount) }),
      newValues: JSON.stringify({ status: invoice.status, total: totals.totalAmount }),
      ipAddress: request.headers.get("x-forwarded-for") || "unknown",
      userAgent: request.headers.get("user-agent") || "unknown",
    })

    const summary = paymentSummary(invoice.totalAmount, invoice.payments, invoice.status)
    return NextResponse.json({
      invoice: { ...invoice, paid: summary.paid, balance: summary.balance },
    })
  } catch (error) {
    console.error("[invoices] update failed:", error)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}

/**
 * Deleting an invoice with payments against it would erase a record of money received,
 * so it is refused. Cancel it instead — that keeps the document and its history.
 */
export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireCan("invoices", "delete")
  if (!auth.ok) return auth.response

  try {
    const { id } = await context.params
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      select: {
        id: true,
        number: true,
        status: true,
        quotationId: true,
        _count: { select: { payments: true } },
      },
    })
    if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 })

    if (invoice._count.payments > 0) {
      return NextResponse.json(
        {
          error: `${invoice.number} has ${invoice._count.payments} payment${
            invoice._count.payments === 1 ? "" : "s"
          } recorded. Cancel it instead of deleting.`,
        },
        { status: 409 },
      )
    }

    await prisma.$transaction(async (tx) => {
      // Lines cascade with the document. The source quotation, if any, goes back to
      // ACCEPTED so it can be converted again.
      await tx.invoice.delete({ where: { id } })
      if (invoice.quotationId) {
        await tx.quotation.update({
          where: { id: invoice.quotationId },
          data: { status: "ACCEPTED", convertedAt: null },
        })
      }
    })

    await logAuditAction({
      userId: String(auth.userId),
      action: "DELETE",
      entityType: "Invoice",
      entityId: id,
      oldValues: JSON.stringify({ number: invoice.number, status: invoice.status }),
      ipAddress: request.headers.get("x-forwarded-for") || "unknown",
      userAgent: request.headers.get("user-agent") || "unknown",
    })

    return NextResponse.json({ message: `${invoice.number} deleted` })
  } catch (error) {
    console.error("[invoices] delete failed:", error)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}
