import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCan } from "@/lib/api-auth"
import { logAuditAction } from "@/lib/audit"
import { paymentSummary } from "@/lib/finance"

export const dynamic = "force-dynamic"

/**
 * Reverse a payment. Deleting money received is worth auditing loudly, and the invoice
 * status walks back with it — a PAID invoice returns to PARTIAL or SENT.
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string; paymentId: string }> },
) {
  const auth = await requireCan("invoices", "delete")
  if (!auth.ok) return auth.response

  try {
    const { id, paymentId } = await context.params

    // The payment must belong to this invoice — an id from the client is not trusted
    // to be under the route it was sent to.
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      select: {
        id: true,
        invoiceId: true,
        amount: true,
        method: true,
        reference: true,
        invoice: { select: { number: true, status: true, totalAmount: true } },
      },
    })
    if (!payment || payment.invoiceId !== id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const status = await prisma.$transaction(async (tx) => {
      await tx.payment.delete({ where: { id: paymentId } })

      const remaining = await tx.payment.findMany({
        where: { invoiceId: id },
        select: { amount: true },
      })
      const summary = paymentSummary(
        payment.invoice.totalAmount,
        remaining,
        payment.invoice.status,
      )
      await tx.invoice.update({ where: { id }, data: { status: summary.status } })
      return summary.status
    })

    await logAuditAction({
      userId: String(auth.userId),
      action: "PAYMENT_REVERSED",
      entityType: "Invoice",
      entityId: id,
      oldValues: JSON.stringify({
        number: payment.invoice.number,
        amount: String(payment.amount),
        method: payment.method,
        reference: payment.reference,
      }),
      newValues: JSON.stringify({ status }),
      ipAddress: request.headers.get("x-forwarded-for") || "unknown",
      userAgent: request.headers.get("user-agent") || "unknown",
    })

    return NextResponse.json({ message: "Payment reversed", status })
  } catch (error) {
    console.error("[payments] delete failed:", error)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}
