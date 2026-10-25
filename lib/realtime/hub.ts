/**
 * Who is connected, and how to reach them.
 *
 * Every open tab holds one Server-Sent Events stream (app/api/events). This keeps
 * the list of those streams per user and pushes events into them.
 *
 * It is a delivery channel, not the source of truth. Messages are written to the
 * database before anything is published, and a client that reconnects re-reads what
 * it missed over REST — so an event lost to a dropped connection costs nothing.
 *
 * ponytail: in-process, so it only reaches tabs connected to this Node process. That is
 * exactly right for the current deployment (ecosystem.config.js: fork mode, 1 instance).
 * Scaling to more instances needs a shared bus — Redis pub/sub, or polling MySQL by
 * seq — behind this same `publish` signature.
 */

export type ChatEvent =
  | { type: "message"; conversationId: string; message: unknown }
  | { type: "message_updated"; conversationId: string; message: unknown }
  | { type: "read"; conversationId: string; userId: number; seq: number }
  | { type: "delivered"; conversationId: string; userIds: number[]; seq: number }
  | { type: "typing"; conversationId: string; userId: number; name: string }
  | { type: "presence"; userId: number; online: boolean }
  | { type: "conversation"; conversationId: string }
  | { type: "removed"; conversationId: string }
  /** Sent to the clearing member's own tabs: hide everything at or below `seq`. */
  | { type: "cleared"; conversationId: string; seq: number; hidden: boolean }
  /**
   * "Rows of these models changed — refetch what you show." Model names only: no ids
   * and no data, so it reveals nothing to someone who could not read the rows anyway,
   * and each tab refetches through its own permission-checked endpoints.
   */
  | { type: "invalidate"; models: string[] }

type Send = (event: ChatEvent) => void

interface Hub {
  connections: Map<number, Set<Send>>
}

// Survives Next's dev-mode module reloads, which would otherwise orphan every stream.
const g = globalThis as unknown as { __chatHub?: Hub }
const hub: Hub = (g.__chatHub ??= { connections: new Map() })

/** Registers a tab. Returns the function that unregisters it. */
export function subscribe(userId: number, send: Send): () => void {
  let set = hub.connections.get(userId)
  const cameOnline = !set || set.size === 0
  if (!set) {
    set = new Set()
    hub.connections.set(userId, set)
  }
  set.add(send)
  if (cameOnline) broadcastPresence(userId, true)

  return () => {
    const current = hub.connections.get(userId)
    if (!current) return
    current.delete(send)
    if (current.size === 0) {
      hub.connections.delete(userId)
      broadcastPresence(userId, false)
    }
  }
}

/** Online means at least one tab has a live stream. Reliable on a single instance. */
export function isOnline(userId: number): boolean {
  return (hub.connections.get(userId)?.size ?? 0) > 0
}

export function onlineUserIds(): number[] {
  return [...hub.connections.keys()]
}

/**
 * Sends an event to these users' tabs. Callers pass ids they have already checked
 * against conversation membership; this function does no authorization of its own.
 */
export function publish(userIds: Iterable<number>, event: ChatEvent) {
  for (const id of new Set(userIds)) {
    const set = hub.connections.get(id)
    if (!set) continue
    for (const send of set) {
      try {
        send(event)
      } catch {
        // A stream that has gone away is cleaned up by its own abort handler.
      }
    }
  }
}

/**
 * Presence goes to everyone connected. Who is online is already visible in any staff
 * directory, and limiting it to shared conversations would cost a query per change.
 */
function broadcastPresence(userId: number, online: boolean) {
  publish(hub.connections.keys(), { type: "presence", userId, online })
}

/**
 * Fixed-window rate limiter, per user and action.
 *
 * ponytail: in-memory, same single-instance ceiling as the hub; resets on restart,
 * which is harmless for a limiter.
 */
const windows = new Map<string, { start: number; count: number }>()

export function rateLimited(userId: number, action: string, limit: number, windowMs: number): boolean {
  const key = `${userId}:${action}`
  const now = Date.now()
  const w = windows.get(key)
  if (!w || now - w.start >= windowMs) {
    windows.set(key, { start: now, count: 1 })
    return false
  }
  w.count++
  return w.count > limit
}
