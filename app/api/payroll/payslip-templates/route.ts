import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requireCan } from "@/lib/api-auth"
import { logAuditAction } from "@/lib/audit"
import { setDefaultTemplate } from "@/lib/payroll/payslip-template"

export const dynamic = "force-dynamic"

/** Shared field rules; PATCH reuses these as a partial. */
export const templateFields = {
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(500).nullable().optional(),
  companyName: z.string().trim().min(1).max(120),
  companyAddress: z.string().trim().max(400).nullable().optional(),
  signatoryText: z.string().trim().max(120).optional(),
  footerNote: z.string().trim().max(500).nullable().optional(),
  showBankDetails: z.boolean().optional(),
  showPan: z.boolean().optional(),
  showLeaveSummary: z.boolean().optional(),
  showEmployerCost: z.boolean().optional(),
  showAmountInWords: z.boolean().optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
}

const CreateTemplate = z.object(templateFields)

/** Every template, newest default first, for the Payslip Templates screen. */
export async function GET() {
  const auth = await requireCan("payroll", "read")
  if (!auth.ok) return auth.response

  try {
    const templates = await prisma.payslipTemplate.findMany({
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    })
    return NextResponse.json({ templates })
  } catch (error) {
    console.error("[payslip-templates] list failed:", error)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireCan("payroll", "update")
  if (!auth.ok) return auth.response

  const parsed = CreateTemplate.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 422 },
    )
  }

  try {
    const existingCount = await prisma.payslipTemplate.count()

    const template = await prisma.payslipTemplate.create({
      data: {
        ...parsed.data,
        // The first template has to be the default, or nothing would render with it.
        isDefault: existingCount === 0 ? true : (parsed.data.isDefault ?? false),
      },
    })

    if (template.isDefault) await setDefaultTemplate(template.id)

    await logAuditAction({
      userId: String(auth.userId),
      action: "CREATE",
      entityType: "PayslipTemplate",
      entityId: template.id,
      newValues: JSON.stringify({ name: template.name, isDefault: template.isDefault }),
      ipAddress: request.headers.get("x-forwarded-for") || "unknown",
      userAgent: request.headers.get("user-agent") || "unknown",
    })

    return NextResponse.json({ template }, { status: 201 })
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      return NextResponse.json(
        { error: "A payslip template with that name already exists." },
        { status: 409 },
      )
    }
    console.error("[payslip-templates] create failed:", error)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}
