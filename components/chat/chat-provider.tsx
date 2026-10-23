"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import useSWR, { useSWRConfig } from "swr"
import { useRouter } from "next/navigation"
import type { ChatConversation, ChatEvent, ChatMessage } from "./types"
import { LIVE_REFRESH_EVENT } from "@/hooks/use-live-refresh"

/**
 * The live connection every dashboard page shares, and chat on top of it.
 *
 * Two jobs:
 *   - Live updates for every module. The server sends "these models changed" after any
 *     write (lib/realtime/invalidate.ts); this refetches what the page shows. That runs
 *     for everyone signed in, chat permission or not.
 *   - Chat: presence, the conversation list, unread totals and desktop notifications —
 *     only when `enabled` (chat:read).
 *
 * Mounted once in the dashboard layout so a message arriving while you are on the
 * Projects page still notifies you, and the sidebar badge stays right.
 */

type Listener = (event: ChatEvent) => void

interface ChatContextValue {
  enabled: boolean
  connected: boolean
  online: Set<number>
  conversations: ChatConversation[] | undefined
  conversationsError: Error | undefined
  refreshConversations: () => Promise<unknown>
  unreadTotal: number
  /** Subscribe to raw events. Returns an unsubscribe function. */
  on: (listener: Listener) => () => void
  /** Bumps whenever the stream (re)connects, so open views re-read what they missed. */
  resyncToken: number
  /** The conversation this tab is showing, so it is never notified about it. */
  setActiveConversation: (id: string | null) => void
  notifications: NotificationState
}

interface NotificationState {
  supported: boolean
  permission: NotificationPermission | "unsupported"
  enabled: boolean
  sound: boolean
  request: () => Promise<void>
  setEnabled: (v: boolean) => void
  setSound: (v: boolean) => void
  test: () => void
}

const ChatContext = createContext<ChatContextValue | null>(null)

export function useChat() {
  const ctx = useContext(ChatContext)
  if (!ctx) throw new Error("useChat must be used inside ChatProvider")
  return ctx
}

/** Safe outside the provider — for the sidebar badge, which renders either way. */
export function useChatUnread(): number {
  return useContext(ChatContext)?.unreadTotal ?? 0
}

const fetcher = async (url: string) => {
  const res = await fetch(url, { cache: "no-store" })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error ?? "Could not load conversations")
  return body
}

// --- per-device preferences ---------------------------------------------------
// localStorage is right for these: they describe this browser, not the account.
const PREF_NOTIFY = "chat:notify"
const PREF_SOUND = "chat:sound"
const readPref = (key: string, fallback: boolean) => {
  try {
    const v = localStorage.getItem(key)
    return v === null ? fallback : v === "1"
  } catch {
    return fallback
  }
}
const writePref = (key: string, value: boolean) => {
  try {
    localStorage.setItem(key, value ? "1" : "0")
  } catch {
    // private mode: the preference simply does not persist
  }
}

/** A short two-tone chime, synthesised so there is no audio file to ship or cache. */
function chime(ctx: AudioContext | null) {
  if (!ctx) return
  const now = ctx.currentTime
  for (const [i, freq] of [880, 1320].entries()) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = "sine"
    osc.frequency.value = freq
    const start = now + i * 0.12
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(0.18, start + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22)
    osc.connect(gain).connect(ctx.destination)
    osc.start(start)
    osc.stop(start + 0.25)
  }
}

/** What a notification may say: text only, trimmed, never the raw attachment name list. */
function previewOf(m: ChatMessage): string {
  if (m.deletedAt) return "Message deleted"
  if (m.body) return m.body.length > 120 ? `${m.body.slice(0, 117)}…` : m.body
  const a = m.attachments[0]
  if (!a) return "New message"
  return a.kind === "IMAGE" ? "📷 Photo" : a.kind === "VIDEO" ? "🎥 Video" : `📎 ${a.name}`
}

const TAB_ID = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Math.random())

export function ChatProvider({ enabled, userId, children }: { enabled: boolean; userId: number; children: ReactNode }) {
  const router = useRouter()
  const { mutate: revalidate } = useSWRConfig()
  const listeners = useRef(new Set<Listener>())

  // Several writes in a row (a bulk import, a save that touches three tables) arrive as
  // a burst; refetch once at the end of it rather than once per event.
  const pendingModels = useRef(new Set<string>())
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scheduleRefresh = useCallback(
    (models: string[]) => {
      for (const m of models) pendingModels.current.add(m)
      if (refreshTimer.current) return
      refreshTimer.current = setTimeout(() => {
        refreshTimer.current = null
        const changed = [...pendingModels.current]
        pendingModels.current.clear()
        // One argument only: that means "revalidate". Passing data would overwrite it.
        void revalidate(() => true)
        // Pages that load with useEffect + fetch listen for this (hooks/use-live-refresh).
        window.dispatchEvent(new CustomEvent(LIVE_REFRESH_EVENT, { detail: { models: changed } }))
        // Server components re-render too; client state such as an open form is kept.
        router.refresh()
      }, 400)
    },
    [revalidate, router],
  )
  const [connected, setConnected] = useState(false)
  const [online, setOnline] = useState<Set<number>>(new Set())
  const [resyncToken, setResyncToken] = useState(0)

  const {
    data,
    error: conversationsError,
    mutate,
  } = useSWR<{ conversations: ChatConversation[] }>(enabled ? "/api/chat/conversations" : null, fetcher, {
    revalidateOnFocus: true,
  })
  const conversations = data?.conversations
  const conversationsRef = useRef(conversations)
  conversationsRef.current = conversations

  const on = useCallback((l: Listener) => {
    listeners.current.add(l)
    return () => {
      listeners.current.delete(l)
    }
  }, [])

  // --- what every tab is looking at -----------------------------------------------
  const activeRef = useRef<string | null>(null)
  const tabsRef = useRef(new Map<string, { conversationId: string | null; focused: boolean; at: number }>())
  const channelRef = useRef<BroadcastChannel | null>(null)

  const announce = useCallback(() => {
    const focused = document.visibilityState === "visible" && document.hasFocus()
    const state = { tabId: TAB_ID, conversationId: activeRef.current, focused, at: Date.now() }
    tabsRef.current.set(TAB_ID, state)
    channelRef.current?.postMessage({ kind: "tab", ...state })
  }, [])

  const setActiveConversation = useCallback(
    (id: string | null) => {
      activeRef.current = id
      announce()
    },
    [announce],
  )

  useEffect(() => {
    if (!enabled || typeof BroadcastChannel === "undefined") return
    const ch = new BroadcastChannel("chat-tabs")
    channelRef.current = ch
    ch.onmessage = (e) => {
      const d = e.data
      if (d?.kind === "tab") tabsRef.current.set(d.tabId, { conversationId: d.conversationId, focused: d.focused, at: d.at })
      if (d?.kind === "gone") tabsRef.current.delete(d.tabId)
    }
    const onChange = () => announce()
    window.addEventListener("focus", onChange)
    window.addEventListener("blur", onChange)
    document.addEventListener("visibilitychange", onChange)
    const beat = setInterval(announce, 15_000)
    const gone = () => ch.postMessage({ kind: "gone", tabId: TAB_ID })
    window.addEventListener("pagehide", gone)
    announce()
    return () => {
      gone()
      clearInterval(beat)
      window.removeEventListener("focus", onChange)
      window.removeEventListener("blur", onChange)
      document.removeEventListener("visibilitychange", onChange)
      window.removeEventListener("pagehide", gone)
      ch.close()
      channelRef.current = null
    }
  }, [enabled, announce])

  /** Is anyone, in any tab, actually looking at this conversation right now? */
  const beingViewed = (conversationId: string) => {
    const now = Date.now()
    for (const t of tabsRef.current.values()) {
      if (now - t.at < 30_000 && t.focused && t.conversationId === conversationId) return true
    }
    return false
  }

  // --- leader election: exactly one tab shows notifications and plays the sound ---
  const isLeader = useRef(false)
  useEffect(() => {
    if (!enabled) return
    const locks = (navigator as Navigator & { locks?: LockManager }).locks
    if (!locks) {
      // No Web Locks: every tab notifies. The notification `tag` still collapses the
      // popups into one; only the sound can repeat.
      isLeader.current = true
      return
    }
    const abort = new AbortController()
    locks
      .request("chat-notification-leader", { signal: abort.signal }, () => {
        isLeader.current = true
        // Held until this tab closes, then handed to the next tab in line.
        return new Promise<void>(() => {})
      })
      .catch(() => {})
    return () => {
      isLeader.current = false
      abort.abort()
    }
  }, [enabled])

  // --- notification preferences ----------------------------------------------------
  const supported = typeof window !== "undefined" && "Notification" in window
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default")
  const [notifyEnabled, setNotifyEnabledState] = useState(true)
  const [sound, setSoundState] = useState(true)
  const audioRef = useRef<AudioContext | null>(null)

  useEffect(() => {
    setPermission(supported ? Notification.permission : "unsupported")
    setNotifyEnabledState(readPref(PREF_NOTIFY, true))
    setSoundState(readPref(PREF_SOUND, true))
  }, [supported])

  // Browsers refuse to play audio until the page has had a user gesture. Create the
  // audio context on the first click so later chimes are allowed.
  useEffect(() => {
    const unlock = () => {
      if (!audioRef.current) {
        const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        if (Ctx) audioRef.current = new Ctx()
      }
      void audioRef.current?.resume()
    }
    window.addEventListener("pointerdown", unlock, { once: true })
    window.addEventListener("keydown", unlock, { once: true })
    return () => {
      window.removeEventListener("pointerdown", unlock)
      window.removeEventListener("keydown", unlock)
    }
  }, [])

  const notifState: NotificationState = {
    supported,
    permission,
    enabled: notifyEnabled,
    sound,
    // Only ever called from a click handler — browsers penalise a prompt on page load.
    request: async () => {
      if (!supported) return
      const result = await Notification.requestPermission()
      setPermission(result)
      if (result === "granted") {
        setNotifyEnabledState(true)
        writePref(PREF_NOTIFY, true)
      }
    },
    setEnabled: (v) => {
      setNotifyEnabledState(v)
      writePref(PREF_NOTIFY, v)
    },
    setSound: (v) => {
      setSoundState(v)
      writePref(PREF_SOUND, v)
    },
    test: () => {
      if (sound) chime(audioRef.current)
      if (supported && Notification.permission === "granted") {
        new Notification("Notifications are working", { body: "You will see new chat messages like this.", tag: "chat-test" })
      }
    },
  }
  const notifRef = useRef(notifState)
  notifRef.current = notifState

  const notify = useCallback(
    (m: ChatMessage) => {
      if (m.type === "SYSTEM" || m.sender?.id === userId) return // never about yourself
      if (!isLeader.current) return
      const conv = conversationsRef.current?.find((c) => c.id === m.conversationId)
      if (conv?.me.mutedUntil && new Date(conv.me.mutedUntil) > new Date()) return
      if (beingViewed(m.conversationId)) return

      const prefs = notifRef.current
      if (prefs.sound) chime(audioRef.current)
      if (!prefs.enabled || !supported || Notification.permission !== "granted") return

      const title =
        conv?.type === "GROUP" ? `${m.sender?.name ?? "Someone"} in ${conv.name ?? "a group"}` : (m.sender?.name ?? "New message")
      try {
        // tag = message id: should two tabs ever both get here, the OS shows one.
        const n = new Notification(title, { body: previewOf(m), tag: `chat-${m.id}`, silent: true })
        n.onclick = () => {
          window.focus()
          router.push(`/dashboard/chat?c=${encodeURIComponent(m.conversationId)}`)
          n.close()
        }
      } catch {
        // Some mobile browsers expose Notification but refuse to construct it.
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userId, supported, router],
  )

  // --- the stream itself -----------------------------------------------------------
  // Connected for everyone: live updates are not a chat feature.
  useEffect(() => {
    let es: EventSource | null = null
    let retry: ReturnType<typeof setTimeout> | null = null
    let attempt = 0
    let stopped = false
    let hadConnected = false

    const dispatch = (event: ChatEvent) => {
      for (const l of listeners.current) l(event)
    }

    const connect = () => {
      if (stopped) return
      es = new EventSource("/api/events")

      es.addEventListener("ready", (e) => {
        attempt = 0
        setConnected(true)
        const d = JSON.parse((e as MessageEvent).data)
        setOnline(new Set<number>(d.online ?? []))
        // Anything missed while disconnected is re-read, not replayed.
        setResyncToken((t) => t + 1)
        // A reconnect, not the first connect: anything may have changed meanwhile.
        if (hadConnected) scheduleRefresh(["*"])
        hadConnected = true
        if (enabled) void mutate()
      })

      es.addEventListener("invalidate", (e) => {
        const { models } = JSON.parse((e as MessageEvent).data) as { models: string[] }
        scheduleRefresh(models)
      })

      const relay = (name: ChatEvent["type"]) =>
        es!.addEventListener(name, (e) => {
          const event = JSON.parse((e as MessageEvent).data) as ChatEvent
          if (event.type === "presence") {
            setOnline((prev) => {
              const next = new Set(prev)
              if (event.online) next.add(event.userId)
              else next.delete(event.userId)
              return next
            })
          }
          if (enabled && event.type === "message") notify(event.message)
          if (enabled && (event.type === "message" || event.type === "read" || event.type === "conversation" || event.type === "removed" || event.type === "message_updated")) {
            void mutate()
          }
          dispatch(event)
        })
      for (const name of ["message", "message_updated", "read", "delivered", "typing", "presence", "conversation", "removed"] as const) {
        relay(name)
      }

      es.addEventListener("revoked", () => {
        stopped = true
        es?.close()
        window.location.href = "/auth/signin?reason=deactivated"
      })

      es.onerror = () => {
        setConnected(false)
        // EventSource retries on its own for network drops, but gives up for good on
        // an HTTP error. Close it and retry ourselves with backoff so both cases recover.
        es?.close()
        if (stopped) return
        const delay = Math.min(30_000, 1000 * 2 ** attempt++) + Math.random() * 500
        retry = setTimeout(connect, delay)
      }
    }

    connect()
    // Coming back online is the moment to reconnect, not whenever the backoff ends.
    const onOnline = () => {
      if (es?.readyState === EventSource.OPEN) return
      if (retry) clearTimeout(retry)
      attempt = 0
      es?.close()
      connect()
    }
    window.addEventListener("online", onOnline)
    return () => {
      stopped = true
      if (retry) clearTimeout(retry)
      window.removeEventListener("online", onOnline)
      es?.close()
      setConnected(false)
    }
  }, [enabled, mutate, notify, scheduleRefresh])

  const unreadTotal = useMemo(
    () => (conversations ?? []).reduce((n, c) => n + (c.me.active ? c.unread : 0), 0),
    [conversations],
  )

  // Reflect unread in the tab title, which every tab shares.
  useEffect(() => {
    if (!enabled) return
    const base = document.title.replace(/^\(\d+\)\s*/, "")
    document.title = unreadTotal > 0 ? `(${unreadTotal}) ${base}` : base
  }, [enabled, unreadTotal])

  const value: ChatContextValue = {
    enabled,
    connected,
    online,
    conversations,
    conversationsError,
    refreshConversations: mutate,
    unreadTotal,
    on,
    resyncToken,
    setActiveConversation,
    notifications: notifState,
  }

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}
