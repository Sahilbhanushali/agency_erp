import { type NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { requirePermission } from "@/lib/api-auth"
import { logAuditAction } from "@/lib/audit"
import { companySchema } from "@/lib/validation/company"

export const dynamic = "force-dynamic"

/** List billing companies, newest first. `?search=` matches name, legal name or GST. */
export async function GET(request: NextRequest) {
  const auth = await requirePermission("View-companies")
  if (!auth.ok) return auth.response

  try {
    const search = request.nextUrl.searchParams.get("search")?.trim()
    const where: Prisma.CompanyWhereInput = search
      ? {
          OR: [
            { name: { contains: search } },
            { legalName: { contains: search } },
            { gstNumber: { contains: search } },
          ],
        }
      : {}

    const companies = await prisma.company.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { quotations: true, invoices: true } } },
    })

    return NextResponse.json({ companies })
  } catch (error) {
    console.error("[companies] list failed:", error)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await requirePermission("Manage-companies")
  if (!auth.ok) return auth.response

  try {
    const parsed = companySchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
        { status: 422 },
      )
    }

    const company = await prisma.company.create({ data: parsed.data })

    await logAuditAction({
      userId: String(auth.userId),
      action: "CREATE",
      entityType: "Company",
      entityId: company.id,
      newValues: JSON.stringify({ name: company.name, gstNumber: company.gstNumber }),
      ipAddress: request.headers.get("x-forwarded-for") || "unknown",
      userAgent: request.headers.get("user-agent") || "unknown",
    })

    return NextResponse.json({ company }, { status: 201 })
  } catch (error) {
    console.error("[companies] create failed:", error)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}
