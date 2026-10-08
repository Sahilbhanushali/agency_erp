import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePermission } from "@/lib/api-auth"
import { logAuditAction } from "@/lib/audit"
import { companyUpdateSchema } from "@/lib/validation/company"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("View-companies")
  if (!auth.ok) return auth.response

  try {
    const { id } = await context.params
    const company = await prisma.company.findUnique({
      where: { id },
      include: { _count: { select: { quotations: true, invoices: true } } },
    })
    if (!company) return NextResponse.json({ error: "Not found" }, { status: 404 })

    return NextResponse.json({ company })
  } catch (error) {
    console.error("[companies] read failed:", error)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("Manage-companies")
  if (!auth.ok) return auth.response

  try {
    const { id } = await context.params
    const parsed = companyUpdateSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
        { status: 422 },
      )
    }

    const existing = await prisma.company.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const company = await prisma.company.update({ where: { id }, data: parsed.data })

    await logAuditAction({
      userId: String(auth.userId),
      action: "UPDATE",
      entityType: "Company",
      entityId: company.id,
      oldValues: JSON.stringify({ name: existing.name, isActive: existing.isActive }),
      newValues: JSON.stringify({ name: company.name, isActive: company.isActive }),
      ipAddress: request.headers.get("x-forwarded-for") || "unknown",
      userAgent: request.headers.get("user-agent") || "unknown",
    })

    return NextResponse.json({ company })
  } catch (error) {
    console.error("[companies] update failed:", error)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}

/**
 * Deleting a company that has issued documents would destroy financial history, so it
 * is refused. Deactivate it instead (isActive: false) to retire it from new documents.
 */
export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("Manage-companies")
  if (!auth.ok) return auth.response

  try {
    const { id } = await context.params
    const company = await prisma.company.findUnique({
      where: { id },
      include: { _count: { select: { quotations: true, invoices: true } } },
    })
    if (!company) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const { quotations, invoices } = company._count
    if (quotations > 0 || invoices > 0) {
      const blocking = [
        quotations > 0 && `${quotations} quotation${quotations === 1 ? "" : "s"}`,
        invoices > 0 && `${invoices} invoice${invoices === 1 ? "" : "s"}`,
      ].filter(Boolean)
      return NextResponse.json(
        {
          error: `${company.name} has ${blocking.join(" and ")}. Deactivate it instead of deleting.`,
        },
        { status: 409 },
      )
    }

    await prisma.company.delete({ where: { id } })

    await logAuditAction({
      userId: String(auth.userId),
      action: "DELETE",
      entityType: "Company",
      entityId: id,
      oldValues: JSON.stringify({ name: company.name }),
      ipAddress: request.headers.get("x-forwarded-for") || "unknown",
      userAgent: request.headers.get("user-agent") || "unknown",
    })

    return NextResponse.json({ message: "Company deleted" })
  } catch (error) {
    console.error("[companies] delete failed:", error)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}
