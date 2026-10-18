import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { isCronRequest } from "@/lib/cron-auth"
import { prisma } from "@/lib/prisma"
import { getJob } from "@/lib/jobs/registry"
import { markSchedulerSeen, scheduleForRunner } from "@/lib/jobs/service"

export const dynamic = "force-dynamic"

/**
 * The scheduler's own endpoint — not for browsers.
 *
 *   GET   what to run, when, and for whom (polled about once a minute)
 *   POST  the outcome of a run
 *
 * Authorised by the shared cron secret only. Keeping the schedule here rather than in
 * the scheduler process means an administrator's change takes effect on the next poll
 * with no restart, and the scheduler needs no database credentials of its own.
 */
export async function GET(request: NextRequest) {
  if (!isCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    markSchedulerSeen()
    return NextResponse.json({ jobs: await scheduleForRunner() })
  } catch (error) {
    console.error("[jobs/schedule] failed:", error)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}

const Result = z.object({
  key: z.string().min(1).max(100),
  ok: z.boolean(),
  message: z.string().max(2000).optional(),
  trigger: z.enum(["schedule", "manual"]).default("schedule"),
  startedAt: z.string().datetime().optional(),
})

export async function POST(request: NextRequest) {
  if (!isCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const parsed = Result.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 422 })

  const { key, ok, message, trigger, startedAt } = parsed.data
  if (!getJob(key)) return NextResponse.json({ error: "Not found" }, { status: 404 })

  try {
    const job = await prisma.scheduledJob.findUnique({ where: { key }, select: { id: true } })
    if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const finishedAt = new Date()
    await prisma.$transaction([
      prisma.jobRun.create({
        data: {
          jobId: job.id,
          startedAt: startedAt ? new Date(startedAt) : finishedAt,
          finishedAt,
          ok,
          message: message?.slice(0, 2000),
          trigger,
        },
      }),
      prisma.scheduledJob.update({
        where: { id: job.id },
        data: {
          lastRunAt: finishedAt,
          lastStatus: ok ? "ok" : "error",
          lastMessage: message?.slice(0, 2000) ?? null,
          // Cleared whether it worked or not: a manual run that failed should be
          // retried deliberately, not repeated every minute.
          runRequestedAt: null,
        },
      }),
      // A run is only history after it is a few weeks old; the table is a log, not data.
      prisma.jobRun.deleteMany({
        where: { jobId: job.id, startedAt: { lt: new Date(Date.now() - 30 * 86_400_000) } },
      }),
    ])

    return NextResponse.json({ recorded: true })
  } catch (error) {
    console.error("[jobs/schedule] recording a result failed:", error)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}
