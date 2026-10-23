import { onlineUserIds, publish } from "./hub"

/**
 * Turns database writes into "refetch" signals for every open tab.
 *
 * Called by the Prisma extension in lib/prisma.ts after every write, so it covers every
 * module, every route, and writes made by background work (the Instagram worker, cron
 * jobs) — not only changes made through a browser.
 *
 * Three rules keep it correct:
 *   1. Publish after the response is sent (Next's after()), so the transaction has
 *      committed. Publishing mid-transaction would make other tabs refetch the old rows
 *      and then sit on them.
 *   2. Never publish for writes made while serving a GET. A GET that writes would
 *      otherwise trigger a refetch that writes again: a refresh loop across every tab.
 *      middleware.ts stamps the method onto each request for this check.
 *   3. Coalesce. A bulk import of 500 posts sends one event, not 500.
 */

/**
 * Models whose writes are not "data someone is looking at", or that already have
 * their own targeted events. Without this, chat read markers and the minute-by-minute
 * job runner would make every open page refetch constantly.
 */
const QUIET_MODELS = new Set([
  "AuditLog",
  "UserActivity",
  "SocialOAuthState",
  "ScheduledJob",
  "JobRun",
  // Chat publishes its own fine-grained events to members only.
  "Conversation",
  "ConversationMember",
  "ChatMessage",
  "ChatAttachment",
  "ChatReaction",
])

export const METHOD_HEADER = "x-request-method"

const COALESCE_MS = 150

const g = globalThis as unknown as { __invalidate?: { pending: Set<string>; timer: ReturnType<typeof setTimeout> | null } }
const state = (g.__invalidate ??= { pending: new Set(), timer: null })

function flush() {
  state.timer = null
  if (state.pending.size === 0) return
  const models = [...state.pending]
  state.pending.clear()
  publish(onlineUserIds(), { type: "invalidate", models })
}

function queue(model: string) {
  state.pending.add(model)
  if (!state.timer) state.timer = setTimeout(flush, COALESCE_MS)
}

/** True while serving a GET/HEAD. Outside any request (scripts, timers) it is false. */
async function servingRead(): Promise<boolean> {
  try {
    const { headers } = await import("next/headers")
    const method = (await headers()).get(METHOD_HEADER)
    return method === "GET" || method === "HEAD"
  } catch {
    return false
  }
}

export async function noteWrite(model: string | undefined) {
  if (!model || QUIET_MODELS.has(model)) return
  if (await servingRead()) return

  try {
    // Inside a request: wait until the response has gone, by which point the
    // transaction this write belongs to has committed or rolled back.
    const { after } = await import("next/server")
    after(() => queue(model))
  } catch {
    // Outside a request (a script, a timer): there is no response to wait for.
    queue(model)
  }
}
