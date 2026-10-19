import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requireCan } from "@/lib/api-auth"
import { logAuditAction } from "@/lib/audit"
import { sendMail } from "@/lib/smtp"
import { PayrollService } from "@/lib/payroll/payroll-service"
import { PayrollPdfGenerator } from "@/lib/payroll/pdf-generator"
import { resolveTemplateForPayslip } from "@/lib/payroll/payslip-template"

export const dynamic = "force-dynamic"
export const maxDuration = 60

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

const Body = z.object({
  /** Render with a specific payslip template instead of the default. */
  templateId: z.string().trim().min(1).optional(),
  /** Override the recipient. Defaults to the employee's own address. */
  to: z.string().trim().email().optional(),
  cc: z.array(z.string().trim().email()).max(10).optional(),
  message: z.string().trim().max(2000).optional(),
})

const rupees = (paise: number) =>
  `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/**
 * Email one payslip to the employee, with the PDF attached.
 *
 * The PDF is generated here from the same service the download route uses, so the
 * attachment is byte-for-byte what the employee would get from the dashboard — there is
 * no second rendering path to drift out of step.
 *
 * Sending is recorded: the payslip is marked published and an audit entry is written.
 * Payslips are personal financial records, so who sent one and when has to be answerable
 * later.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCan("payroll", "update")
  if (!auth.ok) return auth.response

  const { id } = await params

  const parsed = Body.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 422 },
    )
  }

  try {
    const payslip = await prisma.payslip.findUnique({
      where: { id },
      select: {
        id: true,
        month: true,
        year: true,
        netSalary: true,
        status: true,
        user: { select: { id: true, name: true, email: true } },
      },
    })
    if (!payslip) return NextResponse.json({ error: "Not found" }, { status: 404 })

    // A payslip on hold is one somebody has deliberately stopped. Mailing it would
    // undo that decision silently.
    if (payslip.status === "ON_HOLD") {
      return NextResponse.json(
        { error: "This payslip is on hold. Release it before sending." },
        { status: 409 },
      )
    }

    const to = parsed.data.to ?? payslip.user.email
    if (!to) {
      return NextResponse.json(
        { error: `${payslip.user.name ?? "This employee"} has no email address on record.` },
        { status: 422 },
      )
    }

    // Same generator the download uses; `true` because the sender already holds
    // payroll:update, which is strictly more than the read this needs.
    const data = await PayrollService.getPayslipForPdf(id, Number(auth.userId), true)
    const template = await resolveTemplateForPayslip(id, parsed.data.templateId)
    const pdf = PayrollPdfGenerator.generatePayslipPdf({ ...data, template })

    const period = `${MONTHS[payslip.month - 1] ?? payslip.month} ${payslip.year}`
    const safeName = (payslip.user.name || "Employee").replace(/[^a-zA-Z0-9_-]/g, "_")
    const filename = `Payslip_${safeName}_${period.replace(/\s+/g, "_")}.pdf`

    const escapeHtml = (value: string) =>
      value.replace(/[&<>"']/g, (c) =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
      )

    await sendMail({
      to,
      cc: parsed.data.cc,
      subject: `Payslip for ${period}`,
      attachments: [{ filename, content: Buffer.from(pdf) }],
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#0f172a;">
          <h1 style="margin:0 0 4px 0;font-size:18px;">Payslip for ${escapeHtml(period)}</h1>
          <p style="margin:0 0 20px 0;font-size:13px;color:#64748b;">
            ${escapeHtml(payslip.user.name ?? "Hello")}, your payslip is attached as a PDF.
          </p>
          ${
            parsed.data.message
              ? `<p style="margin:0 0 20px 0;font-size:13px;white-space:pre-line;">${escapeHtml(parsed.data.message)}</p>`
              : ""
          }
          <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;">
            <tr>
              <td style="padding:10px 12px;font-size:13px;border-bottom:1px solid #f1f5f9;">Period</td>
              <td style="padding:10px 12px;font-size:13px;border-bottom:1px solid #f1f5f9;text-align:right;">${escapeHtml(period)}</td>
            </tr>
            <tr>
              <td style="padding:10px 12px;font-size:13px;font-weight:600;">Net pay</td>
              <td style="padding:10px 12px;font-size:13px;font-weight:600;text-align:right;">${rupees(payslip.netSalary)}</td>
            </tr>
          </table>
          <p style="margin:24px 0 0 0;font-size:11px;color:#94a3b8;">
            This payslip is confidential. If you think anything is wrong, reply to this
            email and we will look into it.
          </p>
        </div>`,
    })

    await prisma.payslip.update({ where: { id }, data: { isPublished: true } })

    await logAuditAction({
      userId: String(auth.userId),
      action: "UPDATE",
      entityType: "Payslip",
      entityId: id,
      newValues: JSON.stringify({ emailedTo: to, cc: parsed.data.cc ?? [], period }),
      ipAddress: request.headers.get("x-forwarded-for") || "unknown",
      userAgent: request.headers.get("user-agent") || "unknown",
    })

    return NextResponse.json({ sent: true, to, cc: parsed.data.cc ?? [], period })
  } catch (error) {
    console.error("[payslips/send] failed:", error)
    // Email configuration problems are the common cause and the message is useful.
    const message = error instanceof Error ? error.message : "Could not send the payslip"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
