import path from "path"
import fs from "fs/promises"
import { prisma } from "@/lib/prisma"

/**
 * The branding and layout a payslip PDF is rendered with.
 *
 * Shaped to be safe to use without a database row: `fallbackTemplate` supplies honest
 * values so a payslip can still be produced before any template is configured. What it
 * deliberately does NOT do is invent a company address — the generator used to default
 * to "101 Creative Avenue, Tech City, Karnataka 560001", which printed on real payslips
 * sent to employees. An absent address is now simply absent.
 */
export interface PayslipTemplateView {
  id: string | null
  name: string
  companyName: string
  companyAddress: string | null
  logoUrl: string | null
  signatoryText: string
  footerNote: string | null
  showBankDetails: boolean
  showPan: boolean
  showLeaveSummary: boolean
  showEmployerCost: boolean
  showAmountInWords: boolean
  /**
   * The logo as a base64 data URL, ready for jsPDF's addImage.
   *
   * Resolved here rather than in the generator so the PDF code stays free of filesystem
   * access. SVG is deliberately excluded — jsPDF cannot rasterise it, so an SVG logo is
   * simply not drawn rather than corrupting the page.
   */
  logoDataUrl?: string | null
  /** Ordered body sections; null means the built-in order. */
  sections?: { key: string; visible: boolean }[] | null
  accentColor?: string | null
  paperSize?: string | null
}

const SELECT = {
  id: true,
  name: true,
  companyName: true,
  companyAddress: true,
  logoUrl: true,
  signatoryText: true,
  footerNote: true,
  showBankDetails: true,
  showPan: true,
  showLeaveSummary: true,
  showEmployerCost: true,
  showAmountInWords: true,
  sections: true,
  accentColor: true,
  paperSize: true,
} as const

/** Used when no template exists yet. Company name comes from payroll settings. */
export async function fallbackTemplate(): Promise<PayslipTemplateView> {
  const settings = await prisma.payrollSettings
    .findUnique({ where: { id: "default" }, select: { companyName: true } })
    .catch(() => null)

  return {
    id: null,
    name: "Default",
    companyName: settings?.companyName || "Your Company",
    companyAddress: null,
    logoUrl: null,
    signatoryText: "Authorized Signatory",
    footerNote: null,
    showBankDetails: true,
    showPan: true,
    showLeaveSummary: true,
    showEmployerCost: false,
    showAmountInWords: true,
    sections: null,
    accentColor: "#0F172A",
    paperSize: "A4",
  }
}

/**
 * Narrow the stored JSON into the section list.
 *
 * `sections` is a Json column, so Prisma hands back `JsonValue`. Anything that is not
 * a well-formed list is treated as "not configured", which falls back to the built-in
 * order — a corrupt value must not stop a payslip rendering.
 */
export function parseSections(value: unknown): { key: string; visible: boolean }[] | null {
  if (!Array.isArray(value)) return null
  const parsed = value.flatMap((entry) =>
    entry && typeof entry === "object" && typeof (entry as any).key === "string"
      ? [{ key: (entry as any).key, visible: (entry as any).visible !== false }]
      : [],
  )
  return parsed.length > 0 ? parsed : null
}

/**
 * Resolve the template to render with: the one asked for, else the default, else the
 * first active one, else the fallback. Never throws — a missing template must not stop
 * an employee getting their payslip.
 */
export async function resolvePayslipTemplate(id?: string | null): Promise<PayslipTemplateView> {
  try {
    if (id) {
      const named = await prisma.payslipTemplate.findUnique({ where: { id }, select: SELECT })
      if (named)
        return {
          ...named,
          sections: parseSections(named.sections),
          logoDataUrl: await loadLogoDataUrl(named.logoUrl),
        }
    }
    const chosen =
      (await prisma.payslipTemplate.findFirst({
        where: { isDefault: true, isActive: true },
        select: SELECT,
      })) ??
      (await prisma.payslipTemplate.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: "asc" },
        select: SELECT,
      }))
    if (chosen)
      return {
        ...chosen,
        sections: parseSections(chosen.sections),
        logoDataUrl: await loadLogoDataUrl(chosen.logoUrl),
      }
  } catch (error) {
    console.error("[payslip-template] could not resolve, using fallback:", error)
  }
  return fallbackTemplate()
}

const PDF_SAFE = new Map([
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
])

/** Read a stored logo into a data URL. Returns null for anything jsPDF cannot draw. */
export async function loadLogoDataUrl(logoUrl: string | null): Promise<string | null> {
  if (!logoUrl || !logoUrl.startsWith("/uploads/")) return null
  const mime = PDF_SAFE.get(path.extname(logoUrl).toLowerCase())
  if (!mime) return null
  try {
    const bytes = await fs.readFile(path.join(process.cwd(), "public", logoUrl))
    return `data:${mime};base64,${bytes.toString("base64")}`
  } catch (error) {
    console.error("[payslip-template] could not read the logo:", error)
    return null
  }
}

/**
 * Make one template the default and clear the flag on every other, in a transaction.
 * Two defaults would make which branding a payslip gets depend on row order.
 */
export async function setDefaultTemplate(id: string) {
  await prisma.$transaction([
    prisma.payslipTemplate.updateMany({
      where: { id: { not: id }, isDefault: true },
      data: { isDefault: false },
    }),
    prisma.payslipTemplate.update({ where: { id }, data: { isDefault: true, isActive: true } }),
  ])
}

/**
 * Which template a given payslip renders with, in priority order:
 *
 *   1. an explicit id — a one-off preview or "download with this template"
 *   2. the template attached to that payslip's payroll run
 *   3. the default template
 *
 * The run-level choice is what makes "use this template for this payroll" work: set it
 * once on the run and every payslip in it, downloaded or emailed, matches.
 */
export async function resolveTemplateForPayslip(
  payslipId: string,
  explicitId?: string | null,
): Promise<PayslipTemplateView> {
  if (explicitId) return resolvePayslipTemplate(explicitId)
  try {
    const payslip = await prisma.payslip.findUnique({
      where: { id: payslipId },
      select: { payrollRun: { select: { payslipTemplateId: true } } },
    })
    const fromRun = payslip?.payrollRun?.payslipTemplateId
    if (fromRun) return resolvePayslipTemplate(fromRun)
  } catch (error) {
    console.error("[payslip-template] run lookup failed:", error)
  }
  return resolvePayslipTemplate(null)
}
