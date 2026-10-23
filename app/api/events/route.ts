import type { NextRequest } from "next/server"
import { requireSession } from "@/lib/api-auth"
import { prisma } from "@/lib/prisma"
import { onlineUserIds, subscribe, type ChatEvent } from "@/lib/realtime/hub"
import { deliverPending } from "@/lib/chat/service"

/**
 * Server-Sent Events: one stream per open tab, for every signed-in user.
 *
 * It carries two kinds of traffic. Chat events go only to members of the conversation
 * concerned. Invalidations ("posts changed") go to everyone and carry no data, which is
 * what makes every module update live without a refresh.
 *
 * SSE rather than WebSockets because App Router route handlers can serve it natively —
 * no second server process and no new dependency. Sending stays plain POSTs, which get
 * the same authentication and validation as every other route.
 *
 * Authorization happens at the source, not here: the hub only ever publishes an event
 * to users the database says are current members of that conversation. This stream
 * just carries what it is given.
 */
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/** Under the 60s idle timeout most proxies (nginx included) apply. */
const HEARTBEAT_MS = 25_000

export async function GET(request: NextRequest) {
  // Session only: live updates are for everyone. Chat traffic is still filtered at the
  // source to conversation members, so opening this stream grants no chat access.
  const auth = await requireSession()
  if (!auth.ok) return auth.response
  const userId = auth.userId

  const encoder = new TextEncoder()
  let unsubscribe: (() => void) | null = null
  let heartbeat: ReturnType<typeof setInterval> | null = null

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false
      const close = () => {
        if (closed) return
        closed = true
        unsubscribe?.()
        if (heartbeat) clearInterval(heartbeat)
        try {
          controller.close()
        } catch {
          // already closed by the client
        }
      }

      const write = (event: string, data: unknown) => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
        } catch {
          close()
        }
      }

      unsubscribe = subscribe(userId, (e: ChatEvent) => write(e.type, e))

      // The client re-reads conversations and missed messages on every `ready`, so a
      // reconnect after a network drop catches up without replaying a buffer.
      write("ready", { userId, online: onlineUserIds() })

      // Whatever arrived while this person was offline has now reached them.
      void deliverPending(userId).catch((error) => console.error("[chat] deliverPending failed:", error))

      heartbeat = setInterval(async () => {
        // The session was checked when this stream opened; a stream can stay open for
        // hours. Re-check the account so deactivation ends delivery promptly.
        try {
          const user = await prisma.user.findUnique({ where: { id: userId }, select: { isActive: true } })
          if (!user?.isActive) {
            write("revoked", { reason: "deactivated" })
            close()
            return
          }
        } catch {
          // A database blip should not drop every connected tab.
        }
        if (!closed) controller.enqueue(encoder.encode(`: ping\n\n`))
      }, HEARTBEAT_MS)

      request.signal.addEventListener("abort", close)
    },
    cancel() {
      unsubscribe?.()
      if (heartbeat) clearInterval(heartbeat)
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // nginx buffers responses by default, which would hold events back until it
      // filled a buffer. This tells it not to.
      "X-Accel-Buffering": "no",
    },
  })
}
