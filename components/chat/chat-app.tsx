"use client"

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import toast from "react-hot-toast"
import { useRouter, useSearchParams } from "next/navigation"
import { format, isToday, isYesterday } from "date-fns"
import {
  AlertCircle,
  Bell,
  BellOff,
  BellRing,
  FileText,
  Loader2,
  MessageSquarePlus,
  Search,
  Users,
  Volume2,
  VolumeX,
  WifiOff,
  X,
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Switch } from "@/components/ui/switch"
import { useCan } from "@/hooks/use-can"
import { useChat } from "./chat-provider"
import { Thread } from "./thread"
import { DetailsSheet } from "./details-sheet"
import { NewConversationDialog } from "./new-conversation-dialog"
import type { ChatConversation, ChatMessage } from "./types"

interface SearchMessage {
  id: string
  conversationId: string
  seq: number
  body: string | null
  fileName: string | null
  createdAt: string
  senderName: string | null
  conversationName: string
}

interface SearchResults {
  conversations: { id: string; type: string; name: string }[]
  people: { id: number; name: string; avatar: string | null; role: string | null }[]
  messages: SearchMessage[]
  hasMore: boolean
}

const EMPTY_RESULTS: SearchResults = { conversations: [], people: [], messages: [], hasMore: false }

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

/** Marks each searched word, so it is obvious why a result matched. */
function Marked({ text, terms }: { text: string; terms: string[] }) {
  if (terms.length === 0) return <>{text}</>
  const parts = text.split(new RegExp(`(${terms.map(escapeRe).join("|")})`, "gi"))
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <mark key={i} className="rounded-sm bg-amber-200 px-0.5 text-foreground dark:bg-amber-500/40">
            {p}
          </mark>
        ) : (
          p
        ),
      )}
    </>
  )
}

/**
 * The part of a long message around the first match, so the match is visible in a
 * two-line preview instead of being cut off past the end.
 */
function snippet(body: string, terms: string[]): string {
  const lower = body.toLowerCase()
  const at = Math.min(...terms.map((t) => lower.indexOf(t.toLowerCase())).filter((i) => i >= 0), Infinity)
  if (!Number.isFinite(at) || at < 40) return body
  return `…${body.slice(at - 30)}`
}

function listTime(iso: string) {
  const d = new Date(iso)
  if (isToday(d)) return format(d, "HH:mm")
  if (isYesterday(d)) return "Yesterday"
  return format(d, "d MMM")
}

function preview(m: ChatMessage | null, meId: number, type: ChatConversation["type"]) {
  if (!m) return "No messages yet"
  if (m.type === "SYSTEM") return m.body ?? ""
  if (m.deletedAt) return "Message deleted"
  const who = m.sender?.id === meId ? "You: " : type === "GROUP" && m.sender ? `${m.sender.name.split(" ")[0]}: ` : ""
  const a = m.attachments[0]
  const what = m.body ?? (a ? (a.kind === "IMAGE" ? "📷 Photo" : a.kind === "VIDEO" ? "🎥 Video" : `📎 ${a.name}`) : "")
  return `${who}${what}`
}

export function ChatApp({ meId }: { meId: number }) {
  const chat = useChat()
  const { can, ready } = useCan()
  const router = useRouter()
  const params = useSearchParams()
  const selectedId = params.get("c")

  const [filter, setFilter] = useState("")
  const [search, setSearch] = useState("")
  const [results, setResults] = useState<SearchResults | null>(null)
  const [searching, setSearching] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const [jumpTo, setJumpTo] = useState<{ id: string; seq: number } | null>(null)
  const [newMode, setNewMode] = useState<"direct" | "group" | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)

  const select = (id: string | null) => {
    setDetailsOpen(false)
    router.replace(id ? `/dashboard/chat?c=${encodeURIComponent(id)}` : "/dashboard/chat", { scroll: false })
  }

  // Tell the provider what this tab shows, so it is never notified about it.
  useEffect(() => {
    chat.setActiveConversation(selectedId)
    return () => chat.setActiveConversation(null)
  }, [chat, selectedId])

  // Server-side search, debounced; below two characters the list just filters itself.
  useEffect(() => {
    const q = search.trim()
    if (q.length < 2) {
      setResults(null)
      return
    }
    setSearching(true)
    let cancelled = false
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/chat/search?q=${encodeURIComponent(q)}`)
        const body = r.ok ? await r.json() : EMPTY_RESULTS
        if (!cancelled) setResults(body)
      } catch {
        if (!cancelled) setResults(EMPTY_RESULTS)
      } finally {
        if (!cancelled) setSearching(false)
      }
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [search])

  const loadMoreResults = async () => {
    if (!results) return
    setLoadingMore(true)
    try {
      const r = await fetch(`/api/chat/search?q=${encodeURIComponent(search.trim())}&offset=${results.messages.length}`)
      if (!r.ok) throw new Error()
      const body: SearchResults = await r.json()
      setResults((prev) => (prev ? { ...prev, messages: [...prev.messages, ...body.messages], hasMore: body.hasMore } : prev))
    } catch {
      toast.error("Could not load more results")
    } finally {
      setLoadingMore(false)
    }
  }

  // "/" or Ctrl/Cmd+K jumps to search from anywhere on the chat page.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && (e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName))
      if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") || (e.key === "/" && !typing)) {
        e.preventDefault()
        searchRef.current?.focus()
        searchRef.current?.select()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const startChatWith = async (userId: number) => {
    try {
      const r = await fetch("/api/chat/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "DIRECT", userId }),
      })
      const body = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(body.error ?? "Could not start the conversation")
      await chat.refreshConversations()
      setSearch("")
      setFilter("")
      setJumpTo(null)
      select(body.id)
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const list = useMemo(() => {
    const all = chat.conversations ?? []
    const q = filter.trim().toLowerCase()
    return q ? all.filter((c) => (c.name ?? "").toLowerCase().includes(q)) : all
  }, [chat.conversations, filter])

  const selected = (chat.conversations ?? []).find((c) => c.id === selectedId) ?? null

  // A deep link to a conversation this person cannot see falls back to the list.
  useEffect(() => {
    if (selectedId && chat.conversations && !selected) select(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, chat.conversations, selected])

  const n = chat.notifications
  const showPermissionBanner = n.supported && n.permission === "default"
  const blocked = n.supported && n.permission === "denied"

  const canDirect = ready && can("chat", "create")
  const canGroup = ready && can("chat_groups", "create")

  return (
    <div className="flex h-[calc(100dvh-8.5rem)] min-h-[480px] overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      {/* ---------------- conversation list ---------------- */}
      <aside
        className={`flex w-full min-w-0 flex-col border-r border-border md:w-80 lg:w-96 ${selected ? "hidden md:flex" : "flex"}`}
        aria-label="Conversations"
      >
        <div className="space-y-2 border-b border-border p-3">
          <div className="flex items-center justify-between gap-2">
            <h1 className="text-lg font-semibold tracking-tight">Chat</h1>
            <div className="flex items-center gap-1">
              {!chat.connected && (
                <span className="inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400" role="status">
                  <WifiOff className="h-3.5 w-3.5" aria-hidden /> Reconnecting…
                </span>
              )}
              <NotificationSettings />
            </div>
          </div>
          {/* Labelled, not an icon behind a menu: "New group" was hidden in a dropdown
              under an unlabelled icon, and people reported it as missing. */}
          {(canDirect || canGroup) && (
            <div className="flex gap-2">
              {canDirect && (
                <Button size="sm" variant="outline" className="h-9 flex-1 gap-1.5" onClick={() => setNewMode("direct")}>
                  <MessageSquarePlus className="h-4 w-4" aria-hidden /> New chat
                </Button>
              )}
              {canGroup && (
                <Button size="sm" variant="outline" className="h-9 flex-1 gap-1.5" onClick={() => setNewMode("group")}>
                  <Users className="h-4 w-4" aria-hidden /> New group
                </Button>
              )}
            </div>
          )}
          <div className="relative">
            <Label htmlFor="chat-search" className="sr-only">Search conversations and messages</Label>
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              id="chat-search"
              ref={searchRef}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setFilter(e.target.value)
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape" && search) {
                  e.preventDefault()
                  setSearch("")
                  setFilter("")
                }
              }}
              placeholder="Search chats, people, messages, files"
              title="Search (/ or Ctrl+K)"
              className="h-9 pl-8 pr-8"
            />
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch("")
                  setFilter("")
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {showPermissionBanner && (
          <div className="flex items-start gap-2 border-b border-border bg-primary/5 px-3 py-2.5">
            <BellRing className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
            <div className="min-w-0 flex-1 text-xs">
              <p className="font-medium text-foreground">Get notified about new messages</p>
              <p className="text-muted-foreground">Desktop alerts with sound, even when you're on another page.</p>
            </div>
            <Button size="sm" className="h-8 shrink-0" onClick={() => void n.request()}>
              Turn on
            </Button>
          </div>
        )}
        {blocked && n.enabled && (
          <div className="border-b border-border bg-amber-50 px-3 py-2.5 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            <p className="font-medium">Desktop notifications are blocked</p>
            <p className="mt-0.5">
              Click the lock or site-settings icon left of the address bar, set <strong>Notifications</strong> to Allow, then reload.
              On macOS also check System Settings → Notifications for your browser; on Windows, Settings → System → Notifications.
            </p>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto">
          {results ? (
            <SearchResultsList
              results={results}
              terms={search.trim().split(/\s+/).filter(Boolean)}
              searching={searching}
              loadingMore={loadingMore}
              onMore={loadMoreResults}
              canStart={canDirect}
              onStartChat={startChatWith}
              onOpenConversation={(id) => {
                setJumpTo(null)
                select(id)
              }}
              onOpenMessage={(m) => {
                setJumpTo({ id: m.id, seq: m.seq })
                select(m.conversationId)
              }}
            />
          ) : chat.conversationsError ? (
            <div className="flex flex-col items-center gap-3 p-8 text-center">
              <AlertCircle className="h-6 w-6 text-destructive" aria-hidden />
              <p className="text-sm">{String(chat.conversationsError.message)}</p>
              <Button size="sm" variant="outline" onClick={() => void chat.refreshConversations()}>Try again</Button>
            </div>
          ) : !chat.conversations ? (
            <div className="space-y-1 p-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-2">
                  <Skeleton className="h-11 w-11 rounded-full" />
                  <div className="flex-1 space-y-2"><Skeleton className="h-3.5 w-1/2" /><Skeleton className="h-3 w-3/4" /></div>
                </div>
              ))}
            </div>
          ) : list.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-12 text-center">
              <span className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-muted">
                <MessageSquarePlus className="h-5 w-5 text-muted-foreground" aria-hidden />
              </span>
              <p className="text-sm font-medium">{filter ? "No conversations match" : "No conversations yet"}</p>
              {!filter && (canDirect || canGroup) && (
                <p className="mt-1 text-xs text-muted-foreground">Start a chat with a teammate, or create a group for a project.</p>
              )}
              {!filter && (canDirect || canGroup) && (
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {canDirect && (
                    <Button size="sm" className="gap-1.5" onClick={() => setNewMode("direct")}>
                      <MessageSquarePlus className="h-4 w-4" aria-hidden /> New chat
                    </Button>
                  )}
                  {canGroup && (
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setNewMode("group")}>
                      <Users className="h-4 w-4" aria-hidden /> New group
                    </Button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <ul>
              {list.map((c) => {
                const online = c.type === "DIRECT" && c.other && chat.online.has(c.other.id)
                const muted = c.me.mutedUntil && new Date(c.me.mutedUntil) > new Date()
                const isSel = c.id === selectedId
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setJumpTo(null)
                        select(c.id)
                      }}
                      aria-current={isSel ? "true" : undefined}
                      className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${
                        isSel ? "bg-accent" : "hover:bg-muted/60"
                      } ${c.me.active ? "" : "opacity-70"}`}
                    >
                      <span className="relative shrink-0">
                        <Avatar className="h-11 w-11">
                          {c.avatarUrl && <AvatarImage src={c.avatarUrl} alt="" />}
                          <AvatarFallback className="bg-primary/10 font-semibold text-primary">
                            {c.type === "GROUP" ? <Users className="h-5 w-5" /> : (c.name ?? "?").charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        {online && <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-card" aria-label="Online" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className={`truncate text-sm ${c.unread ? "font-semibold text-foreground" : "font-medium text-foreground"}`}>
                            {c.name ?? "Conversation"}
                          </span>
                          <span className={`shrink-0 text-xs tabular-nums ${c.unread ? "font-semibold text-primary" : "text-muted-foreground"}`}>
                            {listTime(c.lastMessageAt)}
                          </span>
                        </span>
                        <span className="mt-0.5 flex items-center justify-between gap-2">
                          <span className={`truncate text-xs ${c.unread ? "text-foreground" : "text-muted-foreground"}`}>
                            {c.me.active ? preview(c.lastMessage, meId, c.type) : "You left this group"}
                          </span>
                          <span className="flex shrink-0 items-center gap-1">
                            {muted && <BellOff className="h-3.5 w-3.5 text-muted-foreground" aria-label="Muted" />}
                            {c.unread > 0 && (
                              <Badge className={`h-5 min-w-5 justify-center rounded-full px-1.5 text-[10px] tabular-nums ${muted ? "bg-muted-foreground" : ""}`}>
                                {c.unread > 99 ? "99+" : c.unread}
                                <span className="sr-only"> unread</span>
                              </Badge>
                            )}
                          </span>
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </aside>

      {/* ---------------- thread ---------------- */}
      <section className={`min-w-0 flex-1 ${selected ? "flex" : "hidden md:flex"} flex-col`} aria-label="Conversation">
        {selected ? (
          <>
            <Thread
              key={selected.id}
              conversation={selected}
              meId={meId}
              jumpTo={jumpTo}
              onBack={() => select(null)}
              onShowDetails={() => setDetailsOpen(true)}
            />
            <DetailsSheet
              conversation={selected}
              meId={meId}
              open={detailsOpen}
              onOpenChange={setDetailsOpen}
              onGone={() => select(null)}
            />
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center bg-muted/30 px-6 text-center">
            <span className="mb-3 grid h-14 w-14 place-items-center rounded-full bg-card shadow-sm">
              <MessageSquarePlus className="h-6 w-6 text-muted-foreground" aria-hidden />
            </span>
            <p className="text-sm font-medium">Select a conversation</p>
            <p className="mt-1 max-w-xs text-xs text-muted-foreground">
              Messages are private to the people in each conversation and stay here after you sign out.
            </p>
          </div>
        )}
      </section>

      <NewConversationDialog
        open={newMode !== null}
        mode={newMode ?? "direct"}
        onClose={() => setNewMode(null)}
        onCreated={async (id) => {
          await chat.refreshConversations()
          setJumpTo(null)
          select(id)
        }}
      />
    </div>
  )
}

function SearchResultsList({
  results,
  terms,
  searching,
  loadingMore,
  onMore,
  canStart,
  onStartChat,
  onOpenConversation,
  onOpenMessage,
}: {
  results: SearchResults
  terms: string[]
  searching: boolean
  loadingMore: boolean
  onMore: () => void
  canStart: boolean
  onStartChat: (userId: number) => void
  onOpenConversation: (id: string) => void
  onOpenMessage: (m: SearchMessage) => void
}) {
  const people = canStart ? results.people : []
  const nothing = results.conversations.length === 0 && people.length === 0 && results.messages.length === 0
  if (searching && nothing) {
    return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-label="Searching" /></div>
  }
  if (nothing) {
    return (
      <div className="px-6 py-10 text-center">
        <p className="text-sm font-medium">Nothing matches “{terms.join(" ")}”</p>
        <p className="mt-1 text-xs text-muted-foreground">Try fewer or different words. Every word you type has to appear in the message or file name.</p>
      </div>
    )
  }
  const heading = (label: string, count?: number): ReactNode => (
    <p className="px-3 pb-1 pt-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      {label}
      {count !== undefined && <span className="ml-1 tabular-nums">({count}{results.hasMore ? "+" : ""})</span>}
    </p>
  )
  const row = "flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
  return (
    <div className="py-1" aria-busy={searching}>
      {results.conversations.length > 0 && (
        <>
          {heading("Chats")}
          {results.conversations.map((c) => (
            <button key={c.id} type="button" onClick={() => onOpenConversation(c.id)} className={`${row} text-sm`}>
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {c.type === "GROUP" ? <Users className="h-4 w-4" aria-hidden /> : c.name.charAt(0).toUpperCase()}
              </span>
              <span className="truncate"><Marked text={c.name} terms={terms} /></span>
            </button>
          ))}
        </>
      )}
      {people.length > 0 && (
        <>
          {heading("Start a chat")}
          {people.map((p) => (
            <button key={p.id} type="button" onClick={() => onStartChat(p.id)} className={`${row} text-sm`} aria-label={`Start a chat with ${p.name}`}>
              <Avatar className="h-8 w-8">
                {p.avatar && <AvatarImage src={p.avatar} alt="" />}
                <AvatarFallback className="text-xs">{p.name.charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              <span className="min-w-0 flex-1">
                <span className="block truncate"><Marked text={p.name} terms={terms} /></span>
                {p.role && <span className="block truncate text-xs text-muted-foreground">{p.role}</span>}
              </span>
              <MessageSquarePlus className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            </button>
          ))}
        </>
      )}
      {results.messages.length > 0 && (
        <>
          {heading("Messages", results.messages.length)}
          {results.messages.map((m) => (
            <button key={m.id} type="button" onClick={() => onOpenMessage(m)} className="block w-full px-3 py-2 text-left hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
              <span className="flex justify-between gap-2 text-xs">
                <span className="truncate font-medium text-foreground">{m.conversationName}</span>
                <span className="shrink-0 text-muted-foreground">{listTime(m.createdAt)}</span>
              </span>
              <span className="line-clamp-2 text-xs text-muted-foreground">
                {m.senderName ? `${m.senderName}: ` : ""}
                {m.body && <Marked text={snippet(m.body, terms)} terms={terms} />}
              </span>
              {m.fileName && (
                <span className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                  <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span className="truncate"><Marked text={m.fileName} terms={terms} /></span>
                </span>
              )}
            </button>
          ))}
          {results.hasMore && (
            <div className="flex justify-center p-2">
              <Button variant="ghost" size="sm" onClick={onMore} disabled={loadingMore} className="text-xs">
                {loadingMore && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                Show more messages
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

/** Per-device notification and sound switches, with a test button. */
function NotificationSettings() {
  const { notifications: n } = useChat()
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="icon" variant="ghost" className="h-10 w-10" aria-label="Notification settings">
          {n.enabled && n.permission === "granted" ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-3">
        <p className="text-sm font-semibold">Notifications on this device</p>
        {!n.supported ? (
          <p className="text-xs text-muted-foreground">This browser does not support desktop notifications. You'll still hear the sound and see unread counts.</p>
        ) : n.permission === "default" ? (
          <Button size="sm" className="w-full" onClick={() => void n.request()}>Allow desktop notifications</Button>
        ) : n.permission === "denied" ? (
          <p className="text-xs text-amber-800 dark:text-amber-300">
            Blocked in your browser. Allow notifications for this site from the address bar's site settings, then reload.
          </p>
        ) : (
          <div className="flex items-center justify-between">
            <Label htmlFor="n-desktop" className="text-sm font-normal">Desktop alerts</Label>
            <Switch id="n-desktop" checked={n.enabled} onCheckedChange={n.setEnabled} />
          </div>
        )}
        <div className="flex items-center justify-between">
          <Label htmlFor="n-sound" className="flex items-center gap-1.5 text-sm font-normal">
            {n.sound ? <Volume2 className="h-4 w-4" aria-hidden /> : <VolumeX className="h-4 w-4" aria-hidden />} Sound
          </Label>
          <Switch id="n-sound" checked={n.sound} onCheckedChange={n.setSound} />
        </div>
        <Button size="sm" variant="outline" className="w-full" onClick={n.test}>Send a test</Button>
        <p className="text-xs text-muted-foreground">Muted conversations never notify. Mute one from its info panel.</p>
      </PopoverContent>
    </Popover>
  )
}
