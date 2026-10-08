import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePermission } from "@/lib/api-auth"
import { logAuditAction } from "@/lib/audit"
import {
  QUOTATION_TRANSITIONS,
  computeTotals,
  quotationDetailSelect,
  toNumber,
} from "@/lib/finance"
import { quotationUpdateSchema } from "@/lib/validation/quotation"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("View-quotations")
  if (!auth.ok) return auth.response

  try {
    const { id } = await context.params
    const quotation = await prisma.quotation.findUnique({
      where: { id },
      select: quotationDetailSelect,
    })
    if (!quotation) return NextResponse.json({ error: "Not found" }, { status: 404 })

    return NextResponse.json({ quotation })
  } catch (error) {
    console.error("[quotations] read failed:", error)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("Manage-quotations")
  if (!auth.ok) return auth.response

  try {
    const { id } = await context.params
    const parsed = quotationUpdateSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
        { status: 422 },
      )
    }
    const input = parsed.data

    const existing = await prisma.quotation.findUnique({
      where: { id },
      select: {
        id: true,
        number: true,
        status: true,
        companyId: true,
        clientId: true,
        discountPercent: true,
        taxPercent: true,
        taxType: true,
        totalAmount: true,
        lineItems: { select: { quantity: true, unitPrice: true } },
      },
    })
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

    if (existing.status === "CONVERTED") {
      return NextResponse.json(
        { error: `${existing.number} has been converted to an invoice and can no longer change.` },
        { status: 409 },
      )
    }

    if (input.status && input.status !== existing.status) {
      if (!QUOTATION_TRANSITIONS[existing.status].includes(input.status)) {
        return NextResponse.json(
          { error: `A ${existing.status.toLowerCase()} quotation cannot become ${input.status.toLowerCase()}.` },
          { status: 409 },
        )
      }
      // CONVERTED is only ever set by the quotation → invoice conversion, never by hand.
      if (input.status === "CONVERTED") {
        return NextResponse.json(
          { error: "Convert this quotation into an invoice instead of setting the status by hand." },
          { status: 409 },
        )
      }
    }

    // The company a document was issued under is part of its number — moving it would
    // make the number meaningless, so it stays put.
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
    const quotation = await prisma.$transaction(async (tx) => {
      if (input.lineItems) {
        // Lines are owned by the document: replace the set rather than diffing ids.
        await tx.quotationLine.deleteMany({ where: { quotationId: id } })
        await tx.quotationLine.createMany({
          data: input.lineItems.map((line, position) => ({ ...line, quotationId: id, position })),
        })
      }

      return tx.quotation.update({
        where: { id },
        data: {
          ...(input.clientId ? { clientId: input.clientId } : {}),
          ...(input.projectId !== undefined ? { projectId: input.projectId ?? null } : {}),
          ...(input.title ? { title: input.title } : {}),
          ...(input.currency ? { currency: input.currency } : {}),
          ...(input.validUntil !== undefined ? { validUntil: input.validUntil } : {}),
          ...(input.terms !== undefined ? { terms: input.terms } : {}),
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
          discountPercent: input.discountPercent ?? existing.discountPercent,
          taxPercent: input.taxPercent ?? existing.taxPercent,
          taxType: input.taxType ?? existing.taxType,
          subtotal: totals.subtotal,
          totalAmount: totals.totalAmount,
          ...(input.status ? { status: input.status } : {}),
          ...(input.status === "SENT" ? { sentAt: now } : {}),
          ...(input.status === "ACCEPTED" ? { acceptedAt: now } : {}),
        },
        select: quotationDetailSelect,
      })
    })

    await logAuditAction({
      userId: String(auth.userId),
      action: "UPDATE",
      entityType: "Quotation",
      entityId: id,
      oldValues: JSON.stringify({ status: existing.status, total: toNumber(existing.totalAmount) }),
      newValues: JSON.stringify({ status: quotation.status, total: totals.totalAmount }),
      ipAddress: request.headers.get("x-forwarded-for") || "unknown",
      userAgent: request.headers.get("user-agent") || "unknown",
    })

    return NextResponse.json({ quotation })
  } catch (error) {
    console.error("[quotations] update failed:", error)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("Manage-quotations")
  if (!auth.ok) return auth.response

  try {
    const { id } = await context.params
    const quotation = await prisma.quotation.findUnique({
      where: { id },
      select: { id: true, number: true, status: true, invoice: { select: { number: true } } },
    })
    if (!quotation) return NextResponse.json({ error: "Not found" }, { status: 404 })

    if (quotation.invoice) {
      return NextResponse.json(
        {
          error: `${quotation.number} was invoiced as ${quotation.invoice.number}. Delete that invoice first, or mark this quotation rejected.`,
        },
        { status: 409 },
      )
    }

    // Lines cascade with the document (onDelete: Cascade in the schema).
    await prisma.quotation.delete({ where: { id } })

    await logAuditAction({
      userId: String(auth.userId),
      action: "DELETE",
      entityType: "Quotation",
      entityId: id,
      oldValues: JSON.stringify({ number: quotation.number, status: quotation.status }),
      ipAddress: request.headers.get("x-forwarded-for") || "unknown",
      userAgent: request.headers.get("user-agent") || "unknown",
    })

    return NextResponse.json({ message: `${quotation.number} deleted` })
  } catch (error) {
    console.error("[quotations] delete failed:", error)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}
