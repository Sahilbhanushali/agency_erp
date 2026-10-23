import { NextResponse, type NextRequest } from "next/server"
import { isCronRequest } from "@/lib/cron-auth"
import { requireCan } from "@/lib/api-auth"
import { claimDueJobs, releaseStaleClaims, runJob, type JobOutcome } from "@/lib/instagram/queue"

/**
 * The publishing worker.
 *
 * Driven by the existing cron supervisor rather than a timer in the browser or an
 * in-process setTimeout: both die with the thing that created them, and a post that
 * was supposed to go out at 09:00 would simply never go out.
 *
 * Each run reclaims whatever a dead worker abandoned, takes a small batch, and walks
 * each job forward by one step. Jobs waiting on Instagram to finish transcoding come
 * back on a later run instead of this request blocking on them, which keeps the run
 * well inside any request timeout.
 *
 * Registered in lib/jobs/registry.ts as `instagram-publish-queue`.
 */
export const dynamic = "force-dynamic"

/** Small on purpose: a run should finish quickly and leave the rest to the next tick. */
const BATCH_SIZE = 5

export async function POST(request: NextRequest) {
  // Either the scheduler, or an administrator pressing "Run now" in Settings.
  if (!isCronRequest(request)) {
    const auth = await requireCan("posts", "publish")
    if (!auth.ok) return auth.response
  }

  const reclaimed = await releaseStaleClaims()
  const jobs = await claimDueJobs(BATCH_SIZE)

  const results: (JobOutcome | { jobId: string; outcome: "errored"; note: string })[] = []
  for (const job of jobs) {
    // Sequential on purpose. These calls upload media to Meta, and running the batch
    // in parallel is the quickest way to hit a rate limit the queue then has to
    // recover from.
    try {
      results.push(await runJob(job))
    } catch (error) {
      // runJob handles its own failures; reaching here means something unexpected,
      // and the row stays claimed until releaseStaleClaims() picks it up.
      console.error(`[instagram/queue] job ${job.id} threw:`, error)
      results.push({ jobId: job.id, outcome: "errored" as const, note: "Unexpected failure" })
    }
  }

  const tally = (outcome: string) => results.filter((r) => r.outcome === outcome).length
  const published = tally("published")
  const failed = tally("failed") + tally("errored")
  const waiting = tally("waiting")

  return NextResponse.json({
    ok: failed === 0,
    message: `Instagram queue — ${published} published, ${waiting} waiting, ${failed} failed${
      reclaimed > 0 ? `, ${reclaimed} reclaimed` : ""
    }`,
    claimed: jobs.length,
    reclaimed,
    published,
    waiting,
    failed,
    results,
  })
}
