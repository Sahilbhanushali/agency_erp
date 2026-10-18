import { type NextRequest, NextResponse } from "next/server"
import { requireCan } from "@/lib/api-auth"
import { isCronRequest } from "@/lib/cron-auth"
import { sendOverdueTaskReminders } from "@/lib/tasks-reminders"

export const dynamic = "force-dynamic"
export const maxDuration = 60

/** `GET ?dryRun=1` previews; `POST` sends. The cron calls the same function. */
export async function GET(request: NextRequest) {
  const auth = await requireCan("tasks", "update")
  if (!auth.ok) return auth.response
  try {
    return NextResponse.json(
      await sendOverdueTaskReminders({ dryRun: request.nextUrl.searchParams.get("dryRun") !== "0" }),
    )
  } catch (error) {
    console.error("[tasks/reminders] preview failed:", error)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  if (!isCronRequest(request)) {
    const auth = await requireCan("tasks", "update")
    if (!auth.ok) return auth.response
  }
  try {
    return NextResponse.json(await sendOverdueTaskReminders())
  } catch (error) {
    console.error("[tasks/reminders] send failed:", error)
    return NextResponse.json({ error: "Could not send reminders" }, { status: 500 })
  }
}
