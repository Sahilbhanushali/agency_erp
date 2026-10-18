import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCan } from "@/lib/api-auth"
import { logAuditAction } from "@/lib/audit"
import { paymentSummary, toNumber } from "@/lib/finance"
import { paymentSchema } from "@/lib/validation/invoice"

export const dynamic = "force-dynamic"

const paymentSelect = {
  id: true,
  amount: true,
  method: true,
  reference: true,
  notes: true,
  paidAt: true,
  createdAt: true,
  recordedBy: { select: { id: true, name: true } },
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireCan("invoices", "read")
  if (!auth.ok) return auth.response

  try {
    const { id } = await context.params
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      select: { id: true, status: true, totalAmount: true, payments: { select: { amount: true } } },
    })
    if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const payments = await prisma.payment.findMany({
      where: { invoiceId: id },
      select: paymentSelect,
      orderBy: { paidAt: "desc" },
    })
    const summary = paymentSummary(invoice.totalAmount, invoice.payments, invoice.status)

    return NextResponse.json({ payments, paid: summary.paid, balance: summary.balance })
  } catch (error) {
    console.error("[payments] list failed:", error)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}

/**
 * Record a payment. The invoice's status is recalculated from the resulting total in
 * the same transaction — PARTIAL while something is still owed, PAID once it is not —
 * so the status can never disagree with the money received.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireCan("invoices", "create")
  if (!auth.ok) return auth.response

  try {
    const { id } = await context.params
    const parsed = paymentSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
        { status: 422 },
      )
    }
    const input = parsed.data

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      select: {
        id: true,
        number: true,
        status: true,
        totalAmount: true,
        payments: { select: { amount: true } },
      },
    })
    if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 })

    if (invoice.status === "CANCELLED") {
      return NextResponse.json(
        { error: `${invoice.number} is cancelled. Reopen it as a draft before recording payments.` },
        { status: 409 },
      )
    }

    const before = paymentSummary(invoice.totalAmount, invoice.payments, invoice.status)
    if (before.balance <= 0) {
      return NextResponse.json(
        { error: `${invoice.number} is already settled in full.` },
        { status: 409 },
      )
    }

    const { payment, status } = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          invoiceId: id,
          recordedById: auth.userId,
          amount: input.amount,
          method: input.method,
          reference: input.reference,
          notes: input.notes,
          ...(input.paidAt ? { paidAt: input.paidAt } : {}),
        },
        select: paymentSelect,
      })

      // Recomputed from every payment, including the one just written — not from the
      // stale pre-transaction figure.
      const all = await tx.payment.findMany({ where: { invoiceId: id }, select: { amount: true } })
      // A draft that receives money has in effect been issued, so treat it as sent
      // before deriving PARTIAL/PAID — otherwise the status would stay DRAFT forever.
      const baseline = invoice.status === "DRAFT" ? "SENT" : invoice.status
      const summary = paymentSummary(invoice.totalAmount, all, baseline)

      await tx.invoice.update({
        where: { id },
        data: {
          status: summary.status,
          ...(invoice.status === "DRAFT" ? { sentAt: new Date() } : {}),
        },
      })
      return { payment, status: summary.status }
    })

    await logAuditAction({
      userId: String(auth.userId),
      action: "PAYMENT_RECORDED",
      entityType: "Invoice",
      entityId: id,
      newValues: JSON.stringify({
        number: invoice.number,
        amount: input.amount,
        method: input.method,
        status,
      }),
      ipAddress: request.headers.get("x-forwarded-for") || "unknown",
      userAgent: request.headers.get("user-agent") || "unknown",
    })

    const after = paymentSummary(
      invoice.totalAmount,
      [...invoice.payments, { amount: input.amount }],
      status,
    )
    return NextResponse.json(
      { payment, status, paid: after.paid, balance: after.balance },
      { status: 201 },
    )
  } catch (error) {
    console.error("[payments] create failed:", error)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}
