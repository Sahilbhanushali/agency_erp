import { type NextRequest, NextResponse } from "next/server"
import { requireCan } from "@/lib/api-auth"
import { logAudit } from "@/lib/audit"
import { prisma } from "@/lib/prisma"
import { getJob } from "@/lib/jobs/registry"
import { getSchedulerSeenAt } from "@/lib/jobs/service"

export const dynamic = "force-dynamic"

/**
 * Ask for one run, now.
 *
 * The request is recorded, not executed: the scheduler picks it up on its next poll and
 * runs it exactly as it would a scheduled run — same code, same recipients, same entry
 * in the run history. That keeps one execution path instead of two that can drift, and
 * keeps a report that takes a minute out of the web process.
 */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const auth = await requireCan("settings", "update")
  if (!auth.ok) return auth.response

  const { key } = await params
  const definition = getJob(key)
  if (!definition) return NextResponse.json({ error: "Not found" }, { status: 404 })

  try {
    await prisma.scheduledJob.update({
      where: { key },
      data: { runRequestedAt: new Date() },
      select: { id: true },
    })

    await logAudit({
      action: "UPDATE",
      userId: String(auth.userId),
      details: `Scheduled job "${definition.label}" run requested manually`,
      metadata: { jobKey: key },
    })

    // Saying "queued" when nothing is listening would be a lie the admin acts on.
    const seenAt = getSchedulerSeenAt()
    return NextResponse.json({
      queued: true,
      schedulerSeenAt: seenAt,
      message: seenAt
        ? "Queued — the scheduler picks this up within a minute."
        : "Queued, but the scheduler has not checked in. It may not be running.",
    })
  } catch (error) {
    if ((error as { code?: string }).code === "P2025") {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    console.error("[jobs] run request failed:", error)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}
