import { type NextRequest, NextResponse } from "next/server"
import path from "path"
import fs from "fs/promises"
import { prisma } from "@/lib/prisma"
import { requireCan } from "@/lib/api-auth"
import { logAuditAction } from "@/lib/audit"
import { imageDimensions } from "@/lib/images"

export const dynamic = "force-dynamic"

/** Raster and vector logos only. An arbitrary upload here would be served publicly. */
const ALLOWED = new Map([
  ["image/png", ".png"],
  ["image/jpeg", ".jpg"],
])

const MAX_BYTES = 2 * 1024 * 1024

/**
 * jsPDF embeds images as pixels, so dimensions decide the PDF size, not file size: a
 * 1500x1500 PNG of only 55KB once produced a 9MB payslip, which mail servers reject.
 *
 * The upload form downscales to 512px before sending, which is already generous for a
 * logo drawn at 14mm. This limit is the backstop for anything bypassing that — a direct
 * API call, or a browser without canvas — so it is set well above what the form sends
 * rather than at the same value.
 */
const MAX_LOGO_EDGE = 1024

/**
 * Replace a template's logo.
 *
 * Separate from the template's JSON CRUD so the common case — editing text and toggles
 * — stays a plain JSON request. The file is written under `public/uploads/payslips`,
 * which is where the rest of the app keeps served uploads.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCan("payroll", "update")
  if (!auth.ok) return auth.response

  const { id } = await params

  try {
    const template = await prisma.payslipTemplate.findUnique({
      where: { id },
      select: { id: true, name: true, logoUrl: true },
    })
    if (!template) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const formData = await request.formData()
    const file = formData.get("logo")

    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "Choose an image to upload" }, { status: 422 })
    }

    // The extension comes from the declared type, never from the client's filename —
    // a name like "logo.svg.php" must not decide what lands on disk.
    const extension = ALLOWED.get(file.type)
    if (!extension) {
      return NextResponse.json(
        { error: "Logo must be a PNG or JPEG image (those are what the PDF can embed)" },
        { status: 422 },
      )
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Logo must be 2MB or smaller" }, { status: 422 })
    }

    const bytes = Buffer.from(await file.arrayBuffer())
    const size = imageDimensions(bytes)
    if (!size) {
      return NextResponse.json(
        { error: "That file is not a readable PNG or JPEG image" },
        { status: 422 },
      )
    }
    if (size.width > MAX_LOGO_EDGE || size.height > MAX_LOGO_EDGE) {
      return NextResponse.json(
        {
          error: `Logo is ${size.width}x${size.height}px, which is too large to embed in a payslip (the limit is ${MAX_LOGO_EDGE}px). Uploading through Payroll → Payslip Templates resizes it for you.`,
        },
        { status: 422 },
      )
    }

    const uploadDir = path.join(process.cwd(), "public", "uploads", "payslips")
    await fs.mkdir(uploadDir, { recursive: true })

    const filename = `logo-${id}-${Date.now()}${extension}`
    await fs.writeFile(path.join(uploadDir, filename), bytes)
    const logoUrl = `/uploads/payslips/${filename}`

    await prisma.payslipTemplate.update({ where: { id }, data: { logoUrl } })

    // Remove the file this one replaced, best effort — a stale logo is dead weight.
    if (template.logoUrl?.startsWith("/uploads/payslips/")) {
      await fs
        .unlink(path.join(process.cwd(), "public", template.logoUrl))
        .catch(() => undefined)
    }

    await logAuditAction({
      userId: String(auth.userId),
      action: "UPDATE",
      entityType: "PayslipTemplate",
      entityId: id,
      newValues: JSON.stringify({ logoUrl }),
      ipAddress: request.headers.get("x-forwarded-for") || "unknown",
      userAgent: request.headers.get("user-agent") || "unknown",
    })

    return NextResponse.json({ logoUrl })
  } catch (error) {
    console.error("[payslip-templates/logo] upload failed:", error)
    return NextResponse.json({ error: "Could not upload the logo" }, { status: 500 })
  }
}

/** Remove the logo without deleting the template. */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireCan("payroll", "update")
  if (!auth.ok) return auth.response

  const { id } = await params

  try {
    const template = await prisma.payslipTemplate.findUnique({
      where: { id },
      select: { logoUrl: true },
    })
    if (!template) return NextResponse.json({ error: "Not found" }, { status: 404 })

    await prisma.payslipTemplate.update({ where: { id }, data: { logoUrl: null } })

    if (template.logoUrl?.startsWith("/uploads/payslips/")) {
      await fs
        .unlink(path.join(process.cwd(), "public", template.logoUrl))
        .catch(() => undefined)
    }

    return NextResponse.json({ removed: true })
  } catch (error) {
    console.error("[payslip-templates/logo] remove failed:", error)
    return NextResponse.json({ error: "Could not remove the logo" }, { status: 500 })
  }
}
