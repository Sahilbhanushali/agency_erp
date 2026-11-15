import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requireCan } from "@/lib/api-auth"
import { logAuditAction } from "@/lib/audit"
import { setDefaultTemplate } from "@/lib/payroll/payslip-template"
import { deleteLocalFile } from "@/lib/storage"
import { templateFields } from "../route"
import { clientIp } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"

const UpdateTemplate = z.object(templateFields).partial()

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCan("payroll", "read")
  if (!auth.ok) return auth.response

  const { id } = await params
  const template = await prisma.payslipTemplate.findUnique({ where: { id } })
  if (!template) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json({ template })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCan("payroll", "update")
  if (!auth.ok) return auth.response

  const { id } = await params
  const parsed = UpdateTemplate.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 422 },
    )
  }
  const patch = parsed.data

  try {
    const before = await prisma.payslipTemplate.findUnique({
      where: { id },
      select: { id: true, name: true, isDefault: true, logoUrl: true },
    })
    if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 })

    /**
     * The default template cannot be deactivated or un-defaulted on its own — doing so
     * would leave payslips with no branding to render with. Point the default at
     * another template instead.
     */
    if (before.isDefault && (patch.isDefault === false || patch.isActive === false)) {
      return NextResponse.json(
        {
          error:
            "This is the default template. Make another template the default first, then change this one.",
        },
        { status: 409 },
      )
    }

    // Clean up replaced logo if changed
    const patchLogo = (patch as any).logoUrl
    if (patchLogo !== undefined && before.logoUrl && patchLogo !== before.logoUrl) {
      await deleteLocalFile(before.logoUrl)
    }

    const { isDefault, ...rest } = patch
    const template = await prisma.payslipTemplate.update({ where: { id }, data: rest })

    if (isDefault === true) await setDefaultTemplate(id)

    await logAuditAction({
      userId: String(auth.userId),
      action: "UPDATE",
      entityType: "PayslipTemplate",
      entityId: id,
      oldValues: JSON.stringify({ name: before.name }),
      newValues: JSON.stringify({ ...patch }),
      ipAddress: clientIp(request.headers) || "unknown",
      userAgent: request.headers.get("user-agent") || "unknown",
    })

    return NextResponse.json({
      template: isDefault === true ? { ...template, isDefault: true } : template,
    })
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      return NextResponse.json(
        { error: "A payslip template with that name already exists." },
        { status: 409 },
      )
    }
    console.error("[payslip-templates] update failed:", error)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireCan("payroll", "delete")
  if (!auth.ok) return auth.response

  const { id } = await params

  try {
    const template = await prisma.payslipTemplate.findUnique({
      where: { id },
      select: { id: true, name: true, isDefault: true, logoUrl: true },
    })
    if (!template) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const total = await prisma.payslipTemplate.count()

    // Deleting the only template, or the default one, would leave payslips unbranded.
    if (template.isDefault && total > 1) {
      return NextResponse.json(
        {
          error: `"${template.name}" is the default template. Make another one the default before deleting it.`,
        },
        { status: 409 },
      )
    }

    if (template.logoUrl) {
      await deleteLocalFile(template.logoUrl)
    }

    await prisma.payslipTemplate.delete({ where: { id } })

    await logAuditAction({
      userId: String(auth.userId),
      action: "DELETE",
      entityType: "PayslipTemplate",
      entityId: id,
      oldValues: JSON.stringify({ name: template.name }),
      ipAddress: clientIp(request.headers) || "unknown",
      userAgent: request.headers.get("user-agent") || "unknown",
    })

    // Keep exactly one default: promote whatever is left.
    const next = await prisma.payslipTemplate.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    })
    if (next) await setDefaultTemplate(next.id)

    return NextResponse.json({ deleted: true })
  } catch (error) {
    console.error("[payslip-templates] delete failed:", error)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}
