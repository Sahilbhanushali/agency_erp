import { NextResponse } from "next/server"
import { requireCan } from "@/lib/api-auth"
import { prisma } from "@/lib/prisma"
import { describeCron } from "@/lib/jobs/registry"
import { getSchedulerSeenAt, listJobs } from "@/lib/jobs/service"

export const dynamic = "force-dynamic"

/** Every schedulable job with its current configuration, for Settings → Scheduled jobs. */
export async function GET() {
  const auth = await requireCan("settings", "read")
  if (!auth.ok) return auth.response

  try {
    const jobs = await listJobs()

    // One query for every user referenced as a recipient, instead of one per job.
    const ids = Array.from(
      new Set(
        jobs.flatMap(({ row }) =>
          Array.isArray(row.recipientUserIds)
            ? row.recipientUserIds.filter((v): v is number => Number.isInteger(v))
            : [],
        ),
      ),
    )
    const users = ids.length
      ? await prisma.user.findMany({
          where: { id: { in: ids } },
          select: { id: true, name: true, email: true },
        })
      : []
    const userById = new Map(users.map((u) => [u.id, u]))

    const seenAt = getSchedulerSeenAt()
    return NextResponse.json({
      // Null means this app process has not been asked for the schedule since it
      // started — which is also what a stopped scheduler looks like.
      schedulerSeenAt: seenAt,
      jobs: jobs.map(({ definition, row }) => ({
        key: row.key,
        label: definition.label,
        description: definition.description,
        cronExpression: row.cronExpression,
        cronLabel: describeCron(row.cronExpression),
        timezone: row.timezone,
        isEnabled: row.isEnabled,
        supportsRecipients: definition.supportsRecipients,
        autoRecipients: definition.autoRecipients,
        recipientMode: row.recipientMode,
        recipients: (Array.isArray(row.recipientUserIds) ? row.recipientUserIds : [])
          .filter((v): v is number => Number.isInteger(v))
          .flatMap((id) => {
            const user = userById.get(id)
            return user ? [user] : []
          }),
        recipientEmails: Array.isArray(row.recipientEmails)
          ? row.recipientEmails.filter((v): v is string => typeof v === "string")
          : [],
        runRequestedAt: row.runRequestedAt,
        lastRunAt: row.lastRunAt,
        lastStatus: row.lastStatus,
        lastMessage: row.lastMessage,
        updatedBy: row.updatedBy,
        updatedAt: row.updatedAt,
        runs: row.runs,
      })),
    })
  } catch (error) {
    console.error("[jobs] list failed:", error)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}
