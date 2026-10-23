"use client"

import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import toast from "react-hot-toast"
import { format, isSameDay, isToday, isYesterday } from "date-fns"
import { AlertCircle, ArrowDown, ArrowLeft, BellOff, ChevronDown, ChevronUp, Info, Loader2, Search, UserPlus, Users, X } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import DeleteConfirmationDialog from "@/components/dialogs/DeleteConfirmationDialog"
import { useCan } from "@/hooks/use-can"
import { useChat } from "./chat-provider"
import { Composer } from "./composer"
import { MessageBubble } from "./message-bubble"
import { ForwardDialog } from "./forward-dialog"
import { NewConversationDialog } from "./new-conversation-dialog"
import { MessageInfoDialog } from "./message-info-dialog"
import type { ChatConversation, ChatMessage } from "./types"

interface Member {
  id: number
  name: string
  avatar: string | null
  role: "MEMBER" | "ADMIN"
  lastReadSeq: number
  lastDeliveredSeq: number
  online: boolean
}

interface Details {
  conversation: { id: string; type: "DIRECT" | "GROUP"; members: Member[] }
  permissions: { active: boolean; canEditInfo: boolean; canManageMembers: boolean; canDelete: boolean; canLeave: boolean }
}

const newClientId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`

/** Sorted by the server's seq; unconfirmed messages always sit at the end in send order. */
function merge(list: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const byId = new Map(list.filter((m) => !m.pending).map((m) => [m.id, m]))
  let pending = list.filter((m) => m.pending)
  for (const m of incoming) {
    byId.set(m.id, m)
    // The server's copy of an optimistic message replaces it, matched by clientId.
    if (m.clientId) pending = pending.filter((p) => p.clientId !== m.clientId)
  }
  return [...[...byId.values()].sort((a, b) => a.seq - b.seq), ...pending]
}

function dayLabel(d: Date) {
  if (isToday(d)) return "Today"
  if (isYesterday(d)) return "Yesterday"
  return format(d, "EEEE, d MMMM yyyy")
}

export function Thread({
  conversation,
  meId,
  jumpTo,
  onBack,
  onShowDetails,
}: {
  conversation: ChatConversation
  meId: number
  /** From search: a message to scroll to once loaded. */
  jumpTo: { id: string; seq: number } | null
  onBack: () => void
  onShowDetails: () => void
}) {
  const chat = useChat()
  const { can } = useCan()
  const id = conversation.id

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [details, setDetails] = useState<Details | null>(null)
  const [typing, setTyping] = useState<Record<number, { name: string; until: number }>>({})
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null)
  const [editing, setEditing] = useState<ChatMessage | null>(null)
  const [deleting, setDeleting] = useState<ChatMessage | null>(null)
  const [deletingBusy, setDeletingBusy] = useState(false)
  const [forwarding, setForwarding] = useState<ChatMessage | null>(null)
  const [highlight, setHighlight] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [infoFor, setInfoFor] = useState<ChatMessage | null>(null)
  /**
   * True when the loaded window ends before the latest message — after jumping to an
   * old search hit. Live messages are then not appended (they would sit after a gap);
   * scrolling down or "Jump to latest" loads them.
   */
  const [hasNewer, setHasNewer] = useState(false)
  const hasNewerRef = useRef(false)
  hasNewerRef.current = hasNewer
  const [loadingNewer, setLoadingNewer] = useState(false)
  const [awayFromBottom, setAwayFromBottom] = useState(false)

  // In-thread search
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [hits, setHits] = useState<{ id: string; seq: number }[] | null>(null)
  const [hitIndex, setHitIndex] = useState(0)
  const [searchingThread, setSearchingThread] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const scrollRef = useRef<HTMLDivElement>(null)
  const atBottom = useRef(true)
  const prependAnchor = useRef<number | null>(null)
  const lastReadSent = useRef(0)
  const messagesRef = useRef(messages)
  messagesRef.current = messages

  const active = details?.permissions.active ?? conversation.me.active
  const maxSeq = messages.reduce((n, m) => (m.pending ? n : Math.max(n, m.seq)), 0)

  // --- loading -----------------------------------------------------------------
  const loadDetails = useCallback(async () => {
    const res = await fetch(`/api/chat/conversations/${id}`, { cache: "no-store" })
    if (res.ok) setDetails(await res.json())
  }, [id])

  useEffect(() => {
    let cancelled = false
    setMessages([])
    setLoading(true)
    setError(null)
    setReplyTo(null)
    setEditing(null)
    setTyping({})
    lastReadSent.current = 0
    atBottom.current = true

    const url = jumpTo
      ? `/api/chat/conversations/${id}/messages?around=${jumpTo.seq}`
      : `/api/chat/conversations/${id}/messages`
    Promise.all([fetch(url, { cache: "no-store" }).then(async (r) => ({ ok: r.ok, body: await r.json().catch(() => ({})) })), loadDetails()])
      .then(([r]) => {
        if (cancelled) return
        if (!r.ok) {
          setError(r.body.error ?? "Could not load messages")
          return
        }
        setMessages(r.body.messages)
        setHasMore(r.body.hasMore)
        setHasNewer(!!r.body.hasNewer)
        if (jumpTo) {
          atBottom.current = false
          requestAnimationFrame(() => {
            document.getElementById(`msg-${jumpTo.id}`)?.scrollIntoView({ block: "center" })
            setHighlight(jumpTo.id)
            setTimeout(() => setHighlight(null), 2000)
          })
        }
      })
      .catch(() => !cancelled && setError("Network error — check your connection"))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [id, jumpTo, loadDetails])

  // After a reconnect, read what arrived while the stream was down.
  useEffect(() => {
    if (chat.resyncToken === 0 || loading || hasNewerRef.current) return
    const after = messagesRef.current.reduce((n, m) => (m.pending ? n : Math.max(n, m.seq)), 0)
    fetch(`/api/chat/conversations/${id}/messages?after=${after}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        if (!body) return
        if (body.truncated) {
          // Away long enough that patching would be wrong; start again from the latest page.
          window.location.reload()
          return
        }
        if (body.messages.length) setMessages((prev) => merge(prev, body.messages))
      })
      .catch(() => {})
    void loadDetails()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat.resyncToken])

  const loadOlder = useCallback(async () => {
    if (loadingOlder || !hasMore) return
    const first = messagesRef.current.find((m) => !m.pending)
    if (!first) return
    setLoadingOlder(true)
    prependAnchor.current = scrollRef.current?.scrollHeight ?? null
    try {
      const r = await fetch(`/api/chat/conversations/${id}/messages?before=${first.seq}`, { cache: "no-store" })
      const body = await r.json()
      if (!r.ok) throw new Error(body.error)
      setMessages((prev) => merge(prev, body.messages))
      setHasMore(body.hasMore)
    } catch {
      toast.error("Could not load older messages")
      prependAnchor.current = null
    } finally {
      setLoadingOlder(false)
    }
  }, [id, hasMore, loadingOlder])

  /** Messages after the loaded window, when it was opened in the past. */
  const loadNewer = useCallback(async () => {
    if (loadingNewer || !hasNewerRef.current) return
    const last = messagesRef.current.reduce((n, m) => (m.pending ? n : Math.max(n, m.seq)), 0)
    setLoadingNewer(true)
    try {
      const r = await fetch(`/api/chat/conversations/${id}/messages?after=${last}`, { cache: "no-store" })
      const body = await r.json()
      if (!r.ok) throw new Error(body.error)
      setMessages((prev) => merge(prev, body.messages))
      setHasNewer(!!body.truncated)
    } catch {
      toast.error("Could not load newer messages")
    } finally {
      setLoadingNewer(false)
    }
  }, [id, loadingNewer])

  /** Back to the newest page, as when the thread first opens. */
  const loadLatest = useCallback(async () => {
    const r = await fetch(`/api/chat/conversations/${id}/messages`, { cache: "no-store" })
    const body = await r.json().catch(() => ({}))
    if (!r.ok) {
      toast.error(body.error ?? "Could not load the latest messages")
      return false
    }
    atBottom.current = true
    setAwayFromBottom(false)
    setMessages((prev) => merge(body.messages, prev.filter((m) => m.pending)))
    setHasMore(body.hasMore)
    setHasNewer(false)
    return true
  }, [id])

  const jumpToLatest = async () => {
    if (hasNewerRef.current) {
      await loadLatest()
      return
    }
    const el = scrollRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" })
  }

  /** Scrolls to a message, loading the history around it first if it is not on screen. */
  const showMessage = useCallback(
    async (messageId: string, seq: number, flash = true) => {
      let el = document.getElementById(`msg-${messageId}`)
      if (!el) {
        const r = await fetch(`/api/chat/conversations/${id}/messages?around=${seq}`, { cache: "no-store" })
        const body = await r.json().catch(() => ({}))
        if (!r.ok) {
          toast.error(body.error ?? "Could not open that message")
          return
        }
        atBottom.current = false
        setMessages(body.messages)
        setHasMore(body.hasMore)
        setHasNewer(!!body.hasNewer)
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
        el = document.getElementById(`msg-${messageId}`)
      }
      if (!el) return
      atBottom.current = false
      el.scrollIntoView({ block: "center", behavior: "smooth" })
      if (flash) {
        setHighlight(messageId)
        setTimeout(() => setHighlight((h) => (h === messageId ? null : h)), 2000)
      }
    },
    [id],
  )

  // --- in-thread search -------------------------------------------------------------
  const searchTerms = useMemo(
    () => (searchOpen && query.trim().length >= 2 ? query.trim().split(/\s+/) : undefined),
    [searchOpen, query],
  )

  useEffect(() => {
    const q = query.trim()
    if (!searchOpen || q.length < 2) {
      setHits(null)
      return
    }
    setSearchingThread(true)
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/chat/search?conversationId=${encodeURIComponent(id)}&q=${encodeURIComponent(q)}`)
        const body = r.ok ? await r.json() : { messages: [] }
        const found: { id: string; seq: number }[] = body.messages.map((m: { id: string; seq: number }) => ({ id: m.id, seq: m.seq }))
        setHits(found)
        // Start from the newest match, the way messaging apps do, and step back from there.
        setHitIndex(found.length - 1)
        if (found.length) void showMessage(found[found.length - 1].id, found[found.length - 1].seq, false)
      } finally {
        setSearchingThread(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [query, searchOpen, id, showMessage])

  const stepHit = (delta: number) => {
    if (!hits?.length) return
    const next = (hitIndex + delta + hits.length) % hits.length
    setHitIndex(next)
    void showMessage(hits[next].id, hits[next].seq, false)
  }

  const closeSearch = () => {
    setSearchOpen(false)
    setQuery("")
    setHits(null)
  }

  // Ctrl/Cmd+F inside a conversation searches the conversation, not the page.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
        e.preventDefault()
        setSearchOpen(true)
        requestAnimationFrame(() => searchInputRef.current?.focus())
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const currentHitId = searchOpen && hits?.length ? hits[hitIndex]?.id : null

  // --- scroll behaviour -----------------------------------------------------------
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    if (prependAnchor.current !== null) {
      // Keep the reader where they were when older messages land above them.
      el.scrollTop = el.scrollHeight - prependAnchor.current
      prependAnchor.current = null
    } else if (atBottom.current) {
      el.scrollTop = el.scrollHeight
    }
  }, [messages])

  const onScroll = () => {
    const el = scrollRef.current
    if (!el) return
    const fromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    atBottom.current = fromBottom < 80 && !hasNewerRef.current
    setAwayFromBottom(fromBottom > 400 || hasNewerRef.current)
    if (el.scrollTop < 120) void loadOlder()
    if (fromBottom < 200 && hasNewerRef.current) void loadNewer()
    if (atBottom.current) markRead()
  }

  // --- read state ----------------------------------------------------------------
  const markRead = useCallback(() => {
    if (document.visibilityState !== "visible" || !document.hasFocus()) return
    const seq = messagesRef.current.reduce((n, m) => (m.pending ? n : Math.max(n, m.seq)), 0)
    if (seq <= lastReadSent.current || seq <= 0) return
    lastReadSent.current = seq
    void fetch(`/api/chat/conversations/${id}/read`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seq }),
    })
  }, [id])

  useEffect(() => {
    if (!loading && atBottom.current) markRead()
  }, [loading, maxSeq, markRead])

  useEffect(() => {
    const onFocus = () => atBottom.current && markRead()
    window.addEventListener("focus", onFocus)
    document.addEventListener("visibilitychange", onFocus)
    return () => {
      window.removeEventListener("focus", onFocus)
      document.removeEventListener("visibilitychange", onFocus)
    }
  }, [markRead])

  // --- live events ----------------------------------------------------------------
  useEffect(
    () =>
      chat.on((e) => {
        if (e.type === "message" && e.conversationId === id) {
          // Reading an older window: the new message loads when they scroll down.
          if (!hasNewerRef.current) setMessages((prev) => merge(prev, [e.message]))
          setTyping((t) => {
            if (!e.message.sender) return t
            const next = { ...t }
            delete next[e.message.sender.id]
            return next
          })
        }
        if (e.type === "message_updated" && e.conversationId === id) setMessages((prev) => merge(prev, [e.message]))
        if (e.type === "read" && e.conversationId === id) {
          setDetails((d) =>
            d
              ? {
                  ...d,
                  conversation: {
                    ...d.conversation,
                    members: d.conversation.members.map((m) =>
                      m.id === e.userId
                        ? {
                            ...m,
                            lastReadSeq: Math.max(m.lastReadSeq, e.seq),
                            lastDeliveredSeq: Math.max(m.lastDeliveredSeq, e.seq),
                          }
                        : m,
                    ),
                  },
                }
              : d,
          )
        }
        if (e.type === "delivered" && e.conversationId === id) {
          setDetails((d) =>
            d
              ? {
                  ...d,
                  conversation: {
                    ...d.conversation,
                    members: d.conversation.members.map((m) =>
                      e.userIds.includes(m.id) ? { ...m, lastDeliveredSeq: Math.max(m.lastDeliveredSeq, e.seq) } : m,
                    ),
                  },
                }
              : d,
          )
        }
        if (e.type === "typing" && e.conversationId === id && e.userId !== meId) {
          setTyping((t) => ({ ...t, [e.userId]: { name: e.name, until: Date.now() + 5000 } }))
        }
        if ((e.type === "conversation" || e.type === "removed") && e.conversationId === id) void loadDetails()
      }),
    [chat, id, meId, loadDetails],
  )

  // Typing indicators expire on their own if the person stops.
  useEffect(() => {
    if (Object.keys(typing).length === 0) return
    const t = setInterval(() => {
      const now = Date.now()
      setTyping((prev) => Object.fromEntries(Object.entries(prev).filter(([, v]) => v.until > now)))
    }, 1000)
    return () => clearInterval(t)
  }, [typing])

  // --- sending --------------------------------------------------------------------
  const transmit = useCallback(
    (optimistic: ChatMessage, text: string, file: File | null) => {
      const fail = (msg: string) => {
        setMessages((prev) => prev.map((m) => (m.clientId === optimistic.clientId ? { ...m, pending: "failed" } : m)))
        toast.error(msg)
      }
      const succeed = (message: ChatMessage) => setMessages((prev) => merge(prev, [message]))

      if (!file) {
        fetch(`/api/chat/conversations/${id}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: text, clientId: optimistic.clientId, replyToId: optimistic.replyTo?.id ?? null }),
        })
          .then(async (r) => {
            const body = await r.json().catch(() => ({}))
            if (!r.ok) return fail(body.error ?? "Message not sent")
            succeed(body.message)
          })
          .catch(() => fail("Message not sent — check your connection"))
        return
      }

      // XHR rather than fetch: fetch cannot report upload progress.
      const form = new FormData()
      form.append("file", file)
      form.append("body", text)
      form.append("clientId", optimistic.clientId!)
      if (optimistic.replyTo) form.append("replyToId", optimistic.replyTo.id)
      const xhr = new XMLHttpRequest()
      xhr.open("POST", `/api/chat/conversations/${id}/messages`)
      xhr.upload.onprogress = (ev) => {
        if (!ev.lengthComputable) return
        const progress = Math.round((ev.loaded / ev.total) * 100)
        setMessages((prev) => prev.map((m) => (m.clientId === optimistic.clientId ? { ...m, progress } : m)))
      }
      xhr.onload = () => {
        let body: { message?: ChatMessage; error?: string } = {}
        try {
          body = JSON.parse(xhr.responseText)
        } catch {
          // fall through to the generic message
        }
        if (xhr.status >= 200 && xhr.status < 300 && body.message) succeed(body.message)
        else fail(body.error ?? "Upload failed")
      }
      xhr.onerror = () => fail("Upload failed — check your connection")
      xhr.send(form)
    },
    [id],
  )

  // Files kept for a retry. Not part of the message object, which must stay serialisable.
  const pendingFiles = useRef(new Map<string, File>())

  const send = async (text: string, file: File | null) => {
    // Sending from an older window: go to the present first, so the message lands where
    // it belongs instead of after a gap.
    if (hasNewerRef.current && !(await loadLatest())) return
    const clientId = newClientId()
    const optimistic: ChatMessage = {
      id: `pending-${clientId}`,
      conversationId: id,
      seq: Number.MAX_SAFE_INTEGER,
      type: file ? "ATTACHMENT" : "TEXT",
      body: text || null,
      forwarded: false,
      clientId,
      editedAt: null,
      deletedAt: null,
      createdAt: new Date().toISOString(),
      sender: { id: meId, name: "You", avatar: null },
      replyTo: replyTo
        ? { id: replyTo.id, senderName: replyTo.sender?.name ?? null, deleted: false, preview: replyTo.body ?? "Attachment" }
        : null,
      attachments: file
        ? [{ id: "local", name: file.name, mimeType: file.type, size: file.size, kind: "FILE", url: "#" }]
        : [],
      reactions: [],
      pending: "sending",
      progress: file ? 0 : undefined,
    }
    if (file) pendingFiles.current.set(clientId, file)
    atBottom.current = true
    setMessages((prev) => [...prev, optimistic])
    setReplyTo(null)
    transmit(optimistic, text, file)
  }

  const retry = (m: ChatMessage) => {
    setMessages((prev) => prev.map((x) => (x.clientId === m.clientId ? { ...x, pending: "sending", progress: 0 } : x)))
    // Same clientId: if the first attempt actually reached the server, this returns it.
    transmit(m, m.body ?? "", pendingFiles.current.get(m.clientId!) ?? null)
  }

  const saveEdit = async (m: ChatMessage, text: string) => {
    setEditing(null)
    const r = await fetch(`/api/chat/messages/${m.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: text }),
    })
    const body = await r.json().catch(() => ({}))
    if (!r.ok) return toast.error(body.error ?? "Could not edit")
    setMessages((prev) => merge(prev, [body.message]))
  }

  const confirmDelete = async (): Promise<void> => {
    if (!deleting) return
    setDeletingBusy(true)
    const r = await fetch(`/api/chat/messages/${deleting.id}`, { method: "DELETE" })
    const body = await r.json().catch(() => ({}))
    setDeletingBusy(false)
    if (!r.ok) {
      toast.error(body.error ?? "Could not delete")
      return
    }
    if (body.message) setMessages((prev) => merge(prev, [body.message]))
    setDeleting(null)
  }

  const react = async (m: ChatMessage, emoji: string) => {
    const r = await fetch(`/api/chat/messages/${m.id}/reactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emoji }),
    })
    const body = await r.json().catch(() => ({}))
    if (!r.ok) return toast.error(body.error ?? "Could not react")
    setMessages((prev) => merge(prev, [body.message]))
  }

  const jumpToMessage = async (messageId: string) => {
    for (let i = 0; i < 10; i++) {
      const el = document.getElementById(`msg-${messageId}`)
      if (el) {
        atBottom.current = false
        el.scrollIntoView({ block: "center", behavior: "smooth" })
        setHighlight(messageId)
        setTimeout(() => setHighlight(null), 2000)
        return
      }
      if (!hasMore) break
      await loadOlder()
      await new Promise((r) => setTimeout(r, 50))
    }
    toast("That message is too far back to show here")
  }

  // --- receipts ---------------------------------------------------------------------
  const others = useMemo(() => details?.conversation.members.filter((m) => m.id !== meId) ?? [], [details, meId])
  /**
   * WhatsApp's three ticks. In a group the message only reaches the next state once
   * everyone else has: "read" means read by all, not by one.
   */
  const receiptFor = (m: ChatMessage): "sent" | "delivered" | "read" | null => {
    if (m.sender?.id !== meId || m.pending) return null
    if (others.length === 0) return "sent"
    if (others.every((o) => o.lastReadSeq >= m.seq)) return "read"
    if (others.every((o) => o.lastDeliveredSeq >= m.seq)) return "delivered"
    return "sent"
  }

  const typingNames = Object.values(typing).map((t) => t.name)
  const otherOnline = conversation.type === "DIRECT" && conversation.other && chat.online.has(conversation.other.id)
  const muted = conversation.me.mutedUntil && new Date(conversation.me.mutedUntil) > new Date()

  const permissionsForBubbles = {
    edit: active && can("chat", "update"),
    delete: active && can("chat", "delete"),
    react: active,
    forward: active,
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border bg-card px-2 py-2 sm:px-4">
        <Button variant="ghost" size="icon" className="h-10 w-10 md:hidden" onClick={onBack} aria-label="Back to conversations">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <button
          type="button"
          onClick={onShowDetails}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-lg p-1 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="relative shrink-0">
            <Avatar className="h-9 w-9">
              {conversation.avatarUrl && <AvatarImage src={conversation.avatarUrl} alt="" />}
              <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
                {conversation.type === "GROUP" ? <Users className="h-4 w-4" /> : (conversation.name ?? "?").charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            {otherOnline && <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-card" aria-hidden />}
          </span>
          <span className="min-w-0">
            <span className="flex items-center gap-1.5">
              <span className="truncate text-sm font-semibold text-foreground">{conversation.name ?? "Conversation"}</span>
              {muted && <BellOff className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-label="Muted" />}
            </span>
            <span className="block truncate text-xs text-muted-foreground" aria-live="polite">
              {typingNames.length > 0
                ? `${typingNames.slice(0, 2).join(", ")}${typingNames.length > 2 ? " and others" : ""} ${typingNames.length === 1 ? "is" : "are"} typing…`
                : conversation.type === "DIRECT"
                  ? otherOnline
                    ? "Online"
                    : "Offline"
                  : `${conversation.memberCount} member${conversation.memberCount === 1 ? "" : "s"}`}
            </span>
          </span>
        </button>
        {/* Right where people look for it, not only inside the info panel. Shown when
            the server says this person may manage members; it re-checks on submit. */}
        {conversation.type === "GROUP" && details?.permissions.canManageMembers && (
          <Button variant="outline" size="sm" className="h-10 gap-1.5" onClick={() => setAdding(true)}>
            <UserPlus className="h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">Add members</span>
            <span className="sr-only sm:hidden">Add members</span>
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10"
          onClick={() => {
            if (searchOpen) closeSearch()
            else {
              setSearchOpen(true)
              requestAnimationFrame(() => searchInputRef.current?.focus())
            }
          }}
          aria-label={searchOpen ? "Close search" : "Search in this conversation"}
          aria-pressed={searchOpen}
        >
          <Search className="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-10 w-10" onClick={onShowDetails} aria-label="Conversation details">
          <Info className="h-5 w-5" />
        </Button>
      </div>

      {searchOpen && (
        <div className="flex items-center gap-1 border-b border-border bg-card px-2 py-1.5 sm:px-4" role="search">
          <label htmlFor="thread-search" className="sr-only">Search in {conversation.name ?? "this conversation"}</label>
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              id="thread-search"
              ref={searchInputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  stepHit(e.shiftKey ? 1 : -1)
                }
                if (e.key === "Escape") {
                  e.preventDefault()
                  closeSearch()
                }
              }}
              placeholder="Search messages and files"
              className="h-9 w-full rounded-md border border-input bg-background pl-8 pr-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <span className="min-w-[4.5rem] shrink-0 text-center text-xs tabular-nums text-muted-foreground" aria-live="polite">
            {searchingThread ? (
              <Loader2 className="mx-auto h-4 w-4 animate-spin" aria-label="Searching" />
            ) : hits === null ? (
              ""
            ) : hits.length === 0 ? (
              "No matches"
            ) : (
              `${hitIndex + 1} of ${hits.length}`
            )}
          </span>
          <Button variant="ghost" size="icon" className="h-10 w-10" disabled={!hits?.length} onClick={() => stepHit(-1)} aria-label="Previous (older) match">
            <ChevronUp className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-10 w-10" disabled={!hits?.length} onClick={() => stepHit(1)} aria-label="Next (newer) match">
            <ChevronDown className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-10 w-10" onClick={closeSearch} aria-label="Close search">
            <X className="h-5 w-5" />
          </Button>
        </div>
      )}

      {/* Messages */}
      <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="min-h-0 flex-1 overflow-y-auto bg-muted/30 py-3"
        role="log"
        aria-label={`Messages in ${conversation.name ?? "this conversation"}`}
        aria-live="polite"
      >
        {loading ? (
          <div className="space-y-3 px-4">
            {[40, 64, 52, 72, 48].map((w, i) => (
              <div key={i} className={`flex ${i % 2 ? "justify-end" : ""}`}>
                <Skeleton className="h-12 rounded-2xl" style={{ width: `${w}%` }} />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
            <AlertCircle className="h-6 w-6 text-destructive" aria-hidden />
            <p className="text-sm text-foreground">{error}</p>
            <Button size="sm" variant="outline" onClick={() => window.location.reload()}>
              Try again
            </Button>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <p className="text-sm font-medium text-foreground">No messages yet</p>
            <p className="mt-1 text-xs text-muted-foreground">Say hello — your first message starts the conversation.</p>
          </div>
        ) : (
          <>
            {hasMore && (
              <div className="flex justify-center py-2">
                <Button variant="ghost" size="sm" onClick={loadOlder} disabled={loadingOlder} className="text-xs">
                  {loadingOlder ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
                  Load earlier messages
                </Button>
              </div>
            )}
            {messages.map((m, i) => {
              const prev = messages[i - 1]
              const d = new Date(m.createdAt)
              const newDay = !prev || !isSameDay(new Date(prev.createdAt), d)
              const runStart = newDay || !prev || prev.sender?.id !== m.sender?.id || prev.type === "SYSTEM"
              return (
                <Fragment key={m.clientId && m.pending ? m.clientId : m.id}>
                  {newDay && (
                    <div className="my-3 flex justify-center">
                      <span className="rounded-full bg-card px-3 py-1 text-[11px] font-medium text-muted-foreground shadow-xs">
                        {dayLabel(d)}
                      </span>
                    </div>
                  )}
                  <div className={runStart && i > 0 ? "mt-2" : ""}>
                    <MessageBubble
                      message={m}
                      mine={m.sender?.id === meId}
                      showSender={conversation.type === "GROUP" && runStart}
                      meId={meId}
                      receipt={receiptFor(m)}
                      highlighted={highlight === m.id || currentHitId === m.id}
                      searchTerms={searchTerms}
                      onInfo={setInfoFor}
                      can={permissionsForBubbles}
                      onReply={setReplyTo}
                      onEdit={setEditing}
                      onDelete={setDeleting}
                      onReact={react}
                      onForward={setForwarding}
                      onRetry={retry}
                      onJumpTo={jumpToMessage}
                    />
                  </div>
                </Fragment>
              )
            })}
            {hasNewer && (
              <div className="flex justify-center py-2">
                <Button variant="ghost" size="sm" onClick={loadNewer} disabled={loadingNewer} className="text-xs">
                  {loadingNewer ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
                  Load newer messages
                </Button>
              </div>
            )}
            <div className="h-3" />
          </>
        )}
      </div>
      {!loading && awayFromBottom && (
        <Button
          size="icon"
          variant="secondary"
          onClick={() => void jumpToLatest()}
          className="absolute bottom-3 right-4 h-11 w-11 rounded-full border border-border shadow-md"
          aria-label="Jump to latest message"
        >
          <ArrowDown className="h-5 w-5" />
        </Button>
      )}
      </div>

      <Composer
        disabled={!active}
        disabledReason="You are no longer a member of this group. You can still read what was sent before you left."
        canAttach={can("chat", "share")}
        replyTo={replyTo}
        editing={editing}
        onCancelReply={() => setReplyTo(null)}
        onCancelEdit={() => setEditing(null)}
        onSend={send}
        onSaveEdit={saveEdit}
        onTyping={() => void fetch(`/api/chat/conversations/${id}/typing`, { method: "POST" }).catch(() => {})}
      />

      <DeleteConfirmationDialog
        isOpen={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        itemName={deleting?.body?.slice(0, 60) || "this message"}
        entityType="message"
        title="Delete this message for everyone?"
        isLoading={deletingBusy}
      />

      <ForwardDialog message={forwarding} onClose={() => setForwarding(null)} />

      <MessageInfoDialog message={infoFor} onClose={() => setInfoFor(null)} />

      <NewConversationDialog
        open={adding}
        mode="add"
        excludeIds={details?.conversation.members.map((m) => m.id) ?? []}
        onClose={() => setAdding(false)}
        onAdd={async (userIds) => {
          const r = await fetch(`/api/chat/conversations/${id}/members`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userIds }),
          })
          const body = await r.json().catch(() => ({}))
          if (!r.ok) {
            toast.error(body.error ?? "Could not add members")
            return
          }
          toast.success(`${body.added} member${body.added === 1 ? "" : "s"} added`)
          await Promise.all([loadDetails(), chat.refreshConversations()])
        }}
      />
    </div>
  )
}
