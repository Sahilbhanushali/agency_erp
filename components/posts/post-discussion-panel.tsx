"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import useSWR from "swr"
import { useSearchParams } from "next/navigation"
import { format } from "date-fns"
import toast from "react-hot-toast"
import { AlertCircle, CornerUpLeft, FileText, Loader2, MessagesSquare, Paperclip, Send, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { useLiveRefresh } from "@/hooks/use-live-refresh"

interface DiscussionMessage {
  id: string
  seq: number
  type: "TEXT" | "ATTACHMENT" | "SYSTEM"
  body: string | null
  createdAt: string
  editedAt: string | null
  deletedAt: string | null
  sender: { id: number; name: string; avatar: string | null } | null
  replyTo: { id: string; senderName: string | null; deleted: boolean; preview: string | null } | null
  attachments: { id: string; name: string; mimeType: string; size: number; kind: string; url: string }[]
}

interface DiscussionResponse {
  conversationId: string
  messages: DiscussionMessage[]
  hasMore: boolean
  lastReadSeq: number
  unread: number
  participants: { id: number; name: string; avatar: string | null; role: string | null }[]
}

const MAX_BODY = 4000
const POLL_MS = 15_000

const fetcher = async (url: string): Promise<DiscussionResponse> => {
  const res = await fetch(url)
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error ?? "Could not load the discussion")
  return body as DiscussionResponse
}

const attachmentUrl = (id: string, download = false) => `/api/chat/attachments/${id}${download ? "?download=1" : ""}`
const sizeLabel = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`

/**
 * The approval discussion for one post: creator, assignees and reviewers talk about the
 * creative in place. Workflow decisions (changes requested, resubmitted, approved) are
 * written into the same thread by the server, so feedback and the reply sit together.
 */
export function PostDiscussionPanel({ postId, currentUserId }: { postId: string; currentUserId: number }) {
  const url = `/api/posts/${postId}/discussion`
  const { data, error, isLoading, mutate } = useSWR(url, fetcher, { refreshInterval: POLL_MS })
  useLiveRefresh(() => mutate(), ["ChatMessage"])

  const [older, setOlder] = useState<DiscussionMessage[]>([])
  const [olderHasMore, setOlderHasMore] = useState<boolean | null>(null)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [text, setText] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [replyTo, setReplyTo] = useState<DiscussionMessage | null>(null)
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [unreadAtOpen, setUnreadAtOpen] = useState<number | null>(null)

  const listRef = useRef<HTMLDivElement>(null)
  const sectionRef = useRef<HTMLElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const markedSeq = useRef(0)
  const searchParams = useSearchParams()

  const messages = [...older, ...(data?.messages ?? [])].filter(
    (m, i, all) => all.findIndex((x) => x.id === m.id) === i,
  )
  const latestSeq = messages.length ? messages[messages.length - 1].seq : 0
  const roleOf = new Map((data?.participants ?? []).map((p) => [p.id, p.role]))

  // A notification links here with ?tab=discussion: bring the thread into view.
  useEffect(() => {
    if (searchParams.get("tab") !== "discussion" || !data) return
    sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    inputRef.current?.focus({ preventScroll: true })
  }, [searchParams, data])

  // Remember how many were unread when the thread first loaded, for the badge.
  useEffect(() => {
    if (data && unreadAtOpen === null) setUnreadAtOpen(data.unread)
  }, [data, unreadAtOpen])

  // Keep the newest message in view as messages arrive.
  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [latestSeq])

  // Seen means read: move the marker once the newest message is on screen.
  useEffect(() => {
    if (!data || latestSeq <= Math.max(data.lastReadSeq, markedSeq.current)) return
    markedSeq.current = latestSeq
    void fetch(`${url}/read`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seq: latestSeq }),
    }).catch((err) => console.error("[discussion] mark read failed:", err))
  }, [data, latestSeq, url])

  const loadOlder = async () => {
    const first = messages[0]
    if (!first) return
    setLoadingOlder(true)
    try {
      const page = await fetcher(`${url}?before=${first.seq}`)
      setOlder((prev) => [...page.messages, ...prev])
      setOlderHasMore(page.hasMore)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load earlier messages")
    } finally {
      setLoadingOlder(false)
    }
  }

  const send = useCallback(async () => {
    const body = text.trim()
    if ((!body && !file) || sending) return
    if (body.length > MAX_BODY) {
      setSendError(`Keep messages under ${MAX_BODY} characters.`)
      return
    }
    setSending(true)
    setSendError(null)
    const clientId = crypto.randomUUID()
    try {
      let res: Response
      if (file) {
        const form = new FormData()
        form.append("file", file)
        form.append("body", body)
        form.append("clientId", clientId)
        if (replyTo) form.append("replyToId", replyTo.id)
        res = await fetch(url, { method: "POST", body: form })
      } else {
        res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body, clientId, replyToId: replyTo?.id ?? null }),
        })
      }
      const result = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(result.error ?? "Could not send the message")
      setText("")
      setFile(null)
      setReplyTo(null)
      if (fileRef.current) fileRef.current.value = ""
      await mutate()
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Could not send the message")
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }, [text, file, sending, replyTo, url, mutate])

  const participants = data?.participants ?? []
  const showLoadOlder = olderHasMore ?? data?.hasMore ?? false

  return (
    <section ref={sectionRef} id="discussion" aria-labelledby={`discussion-title-${postId}`} className="scroll-mt-20">
      <Card className="flex h-[640px] flex-col">
        <CardHeader className="flex-shrink-0 border-b border-border bg-muted/30 px-4 py-3">
          <CardTitle id={`discussion-title-${postId}`} className="flex items-center gap-2 text-sm font-semibold">
            <MessagesSquare className="size-4 text-primary" aria-hidden="true" />
            Discussion
            {!!unreadAtOpen && unreadAtOpen > 0 && (
              <Badge variant="default" className="h-5 px-1.5 text-[11px]" aria-label={`${unreadAtOpen} unread messages`}>
                {unreadAtOpen} new
              </Badge>
            )}
          </CardTitle>
          <CardDescription className="text-xs">
            {participants.length > 0
              ? `With ${participants.map((p) => p.name).slice(0, 4).join(", ")}${participants.length > 4 ? ` and ${participants.length - 4} more` : ""}`
              : "Talk through changes with the creator and reviewers. Decisions are noted here automatically."}
          </CardDescription>
        </CardHeader>

        <CardContent className="flex min-h-0 flex-1 flex-col p-0">
          <div
            ref={listRef}
            className="flex-1 space-y-3 overflow-y-auto px-3 py-3"
            role="log"
            aria-live="polite"
            aria-label="Discussion messages"
          >
            {isLoading && (
              <div className="space-y-3" aria-busy="true">
                {[0, 1, 2].map((i) => (
                  <div key={i} className={`flex ${i % 2 ? "justify-end" : ""}`}>
                    <Skeleton className="h-14 w-2/3 rounded-xl" />
                  </div>
                ))}
              </div>
            )}

            {error && (
              <div role="alert" className="flex flex-col items-center gap-2 py-8 text-center">
                <AlertCircle className="size-6 text-destructive" aria-hidden="true" />
                <p className="text-sm text-foreground">{error.message}</p>
                <Button size="sm" variant="outline" onClick={() => mutate()}>Try again</Button>
              </div>
            )}

            {data && messages.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <MessagesSquare className="size-8 text-muted-foreground/60" aria-hidden="true" />
                <p className="text-sm font-medium text-foreground">No messages yet</p>
                <p className="max-w-xs text-xs text-muted-foreground">
                  Ask a question or explain a change. The creator and reviewers are notified.
                </p>
              </div>
            )}

            {data && showLoadOlder && (
              <div className="flex justify-center">
                <Button size="sm" variant="ghost" onClick={loadOlder} disabled={loadingOlder} className="text-xs">
                  {loadingOlder && <Loader2 className="mr-1.5 size-3.5 animate-spin" aria-hidden="true" />}
                  Load earlier messages
                </Button>
              </div>
            )}

            {messages.map((m) => {
              if (m.type === "SYSTEM") {
                return (
                  <p key={m.id} className="mx-auto max-w-[90%] rounded-md bg-muted/70 px-3 py-1.5 text-center text-xs text-muted-foreground">
                    {m.body}
                    <span className="ml-1.5 whitespace-nowrap opacity-80">· {format(new Date(m.createdAt), "MMM d, HH:mm")}</span>
                  </p>
                )
              }
              const mine = m.sender?.id === currentUserId
              const role = m.sender ? roleOf.get(m.sender.id) : null
              return (
                <div key={m.id} className={`group flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] rounded-xl px-3 py-2 text-sm shadow-xs ${
                      mine ? "bg-primary text-primary-foreground" : "border border-border bg-card text-foreground"
                    }`}
                  >
                    <p className={`text-[11px] font-semibold ${mine ? "text-primary-foreground/85" : "text-foreground"}`}>
                      {mine ? "You" : (m.sender?.name ?? "Former member")}
                      {role && <span className="font-normal opacity-75"> · {role}</span>}
                    </p>
                    {m.replyTo && (
                      <p className={`mt-1 line-clamp-2 border-l-2 pl-2 text-xs ${mine ? "border-primary-foreground/50 text-primary-foreground/80" : "border-primary/50 text-muted-foreground"}`}>
                        <span className="font-medium">{m.replyTo.senderName ?? "Message"}: </span>
                        {m.replyTo.deleted ? "Deleted message" : (m.replyTo.preview ?? "")}
                      </p>
                    )}
                    {m.deletedAt ? (
                      <p className="mt-1 text-xs italic opacity-75">This message was deleted</p>
                    ) : (
                      <>
                        {m.body && <p className="mt-1 whitespace-pre-wrap break-words">{m.body}</p>}
                        {m.attachments.map((a) =>
                          a.kind === "IMAGE" ? (
                            <a key={a.id} href={attachmentUrl(a.id)} target="_blank" rel="noopener noreferrer" className="mt-2 block">
                              {/* eslint-disable-next-line @next/next/no-img-element -- authenticated attachment */}
                              <img src={attachmentUrl(a.id)} alt={a.name} loading="lazy" className="max-h-48 rounded-md border border-border/60 object-contain" />
                            </a>
                          ) : (
                            <a
                              key={a.id}
                              href={attachmentUrl(a.id, true)}
                              className={`mt-2 flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs ${mine ? "border-primary-foreground/30 hover:bg-primary-foreground/10" : "border-border hover:bg-muted"}`}
                            >
                              <FileText className="size-4 flex-shrink-0" aria-hidden="true" />
                              <span className="min-w-0 flex-1 truncate">{a.name}</span>
                              <span className="opacity-75">{sizeLabel(a.size)}</span>
                            </a>
                          ),
                        )}
                      </>
                    )}
                    <div className="mt-1 flex items-center justify-end gap-2">
                      <time dateTime={m.createdAt} className={`text-[10px] ${mine ? "text-primary-foreground/75" : "text-muted-foreground"}`}>
                        {format(new Date(m.createdAt), "MMM d, HH:mm")}
                        {m.editedAt && " · edited"}
                      </time>
                      {!m.deletedAt && (
                        <button
                          type="button"
                          onClick={() => {
                            setReplyTo(m)
                            inputRef.current?.focus()
                          }}
                          className={`rounded p-1 opacity-70 transition hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${mine ? "hover:bg-primary-foreground/10" : "hover:bg-muted"}`}
                          aria-label={`Reply to ${m.sender?.name ?? "message"}`}
                        >
                          <CornerUpLeft className="size-3.5" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <form
            className="flex-shrink-0 space-y-2 border-t border-border bg-muted/20 p-3"
            onSubmit={(e) => {
              e.preventDefault()
              void send()
            }}
          >
            {replyTo && (
              <div className="flex items-start gap-2 rounded-md border border-border bg-card px-2 py-1.5 text-xs">
                <CornerUpLeft className="mt-0.5 size-3.5 flex-shrink-0 text-primary" aria-hidden="true" />
                <p className="min-w-0 flex-1 line-clamp-2 text-muted-foreground">
                  <span className="font-medium text-foreground">Replying to {replyTo.sender?.name ?? "message"}: </span>
                  {replyTo.body ?? replyTo.attachments[0]?.name ?? ""}
                </p>
                <button type="button" onClick={() => setReplyTo(null)} className="rounded p-0.5 hover:bg-muted" aria-label="Cancel reply">
                  <X className="size-3.5" aria-hidden="true" />
                </button>
              </div>
            )}
            {file && (
              <div className="flex items-center gap-2 rounded-md border border-border bg-card px-2 py-1.5 text-xs">
                <Paperclip className="size-3.5 text-muted-foreground" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate">{file.name}</span>
                <span className="text-muted-foreground">{sizeLabel(file.size)}</span>
                <button
                  type="button"
                  onClick={() => {
                    setFile(null)
                    if (fileRef.current) fileRef.current.value = ""
                  }}
                  className="rounded p-0.5 hover:bg-muted"
                  aria-label={`Remove ${file.name}`}
                >
                  <X className="size-3.5" aria-hidden="true" />
                </button>
              </div>
            )}
            {sendError && (
              <p role="alert" className="text-xs text-destructive">{sendError}</p>
            )}
            <div className="flex items-end gap-2">
              <input
                ref={fileRef}
                id={`discussion-file-${postId}`}
                type="file"
                className="sr-only"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-11 flex-shrink-0"
                onClick={() => fileRef.current?.click()}
                aria-label="Attach a file or reference image"
                disabled={sending || !data}
              >
                <Paperclip className="size-4" aria-hidden="true" />
              </Button>
              <label htmlFor={`discussion-input-${postId}`} className="sr-only">Message</label>
              <Textarea
                ref={inputRef}
                id={`discussion-input-${postId}`}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault()
                    void send()
                  }
                }}
                rows={1}
                maxLength={MAX_BODY}
                placeholder="Write a message… (Shift+Enter for a new line)"
                className="max-h-32 min-h-11 flex-1 resize-none text-sm"
                disabled={!data}
              />
              <Button
                type="submit"
                size="icon"
                className="size-11 flex-shrink-0"
                disabled={sending || (!text.trim() && !file) || !data}
                aria-label="Send message"
              >
                {sending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Send className="size-4" aria-hidden="true" />}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </section>
  )
}
