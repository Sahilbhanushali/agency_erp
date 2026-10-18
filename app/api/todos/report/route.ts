import { type NextRequest, NextResponse } from "next/server"
import { requireCan } from "@/lib/api-auth"
import { isCronRequest } from "@/lib/cron-auth"
import { sendEndOfDayReports } from "@/lib/todos/report"

export const dynamic = "force-dynamic"
export const maxDuration = 60

/**
 * Send the end-of-day report now, or preview who would receive it.
 *
 *   GET  ?dryRun=1   who would be emailed, and with how many people in each report
 *   POST             actually send
 *
 * The cron job calls the same code directly; this exists so an administrator can
 * trigger or inspect a report without waiting for 19:00.
 */
export async function GET(request: NextRequest) {
  const auth = await requireCan("todos", "export")
  if (!auth.ok) return auth.response

  try {
    const dateParam = request.nextUrl.searchParams.get("date")
    const result = await sendEndOfDayReports({
      date: dateParam ? new Date(dateParam) : undefined,
      dryRun: request.nextUrl.searchParams.get("dryRun") !== "0",
    })
    return NextResponse.json(result)
  } catch (error) {
    console.error("[todos/report] preview failed:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Something went wrong" },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  // The scheduler presents a shared secret; a human presents a session.
  if (!isCronRequest(request)) {
    const auth = await requireCan("todos", "export")
    if (!auth.ok) return auth.response
  }

  try {
    const dateParam = request.nextUrl.searchParams.get("date")
    const result = await sendEndOfDayReports({
      date: dateParam ? new Date(dateParam) : undefined,
    })
    return NextResponse.json(result)
  } catch (error) {
    console.error("[todos/report] send failed:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not send the report" },
      { status: 500 },
    )
  }
}
