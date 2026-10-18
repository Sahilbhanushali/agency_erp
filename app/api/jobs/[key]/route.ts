import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireCan } from "@/lib/api-auth"
import { logAudit } from "@/lib/audit"
import { prisma } from "@/lib/prisma"
import { describeCron, getJob, isValidCron, TIMEZONES } from "@/lib/jobs/registry"

export const dynamic = "force-dynamic"

const Patch = z.object({
  cronExpression: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .refine(isValidCron, "Not a valid five-field cron expression")
    .optional(),
  timezone: z.enum(TIMEZONES).optional(),
  isEnabled: z.boolean().optional(),
  recipientMode: z.enum(["AUTO", "EXPLICIT", "BOTH"]).optional(),
  recipientUserIds: z.array(z.number().int().positive()).max(50).optional(),
  recipientEmails: z.array(z.string().trim().email().max(200)).max(50).optional(),
})

/** Change when a job runs, in which timezone, whether it runs, and who it mails. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const auth = await requireCan("settings", "update")
  if (!auth.ok) return auth.response

  const { key } = await params
  const definition = getJob(key)
  if (!definition) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const parsed = Patch.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 422 },
    )
  }
  const patch = parsed.data

  // Silently storing recipients for a job that ignores them would read as configured.
  if (!definition.supportsRecipients && (patch.recipientUserIds || patch.recipientEmails)) {
    return NextResponse.json(
      { error: `${definition.label} always mails ${definition.autoRecipients}` },
      { status: 422 },
    )
  }

  // A job that mails an empty list is a job that does nothing, so refuse the save
  // rather than let it look scheduled.
  const mode = patch.recipientMode
  if (mode === "EXPLICIT") {
    const existing = await prisma.scheduledJob.findUnique({
      where: { key },
      select: { recipientUserIds: true, recipientEmails: true },
    })
    const users = patch.recipientUserIds ?? (existing?.recipientUserIds as number[] | null) ?? []
    const emails = patch.recipientEmails ?? (existing?.recipientEmails as string[] | null) ?? []
    if (users.length === 0 && emails.length === 0) {
      return NextResponse.json(
        { error: "Choose at least one recipient, or switch back to Automatic" },
        { status: 422 },
      )
    }
  }

  try {
    const job = await prisma.scheduledJob.update({
      where: { key },
      data: {
        ...patch,
        label: definition.label,
        description: definition.description,
        updatedById: auth.userId,
      },
      select: {
        key: true,
        cronExpression: true,
        timezone: true,
        isEnabled: true,
        recipientMode: true,
      },
    })

    await logAudit({
      action: "UPDATE",
      userId: String(auth.userId),
      details: `Scheduled job "${definition.label}" updated: ${describeCron(job.cronExpression)} ${job.timezone}, ${job.isEnabled ? "enabled" : "disabled"}, recipients ${job.recipientMode}`,
      metadata: { jobKey: key, ...patch },
    })

    return NextResponse.json(job)
  } catch (error) {
    if ((error as { code?: string }).code === "P2025") {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    console.error("[jobs] update failed:", error)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}
