"use client"

import { memo, useState, type ReactNode } from "react"
import { format } from "date-fns"
import {
  AlertCircle,
  Check,
  CheckCheck,
  Copy,
  Download,
  FileText,
  Forward,
  Info,
  Plus,
  Loader2,
  MoreHorizontal,
  Pencil,
  Reply,
  RotateCcw,
  SmilePlus,
  Trash2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { EmojiPicker } from "./emoji-picker"
import { isEmojiOnly } from "./emoji-data"
import type { ChatMessage } from "./types"

export const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "🎉", "🙏"]

const formatSize = (n: number) =>
  n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`

export interface BubbleProps {
  message: ChatMessage
  mine: boolean
  /** Show the sender's name — groups only, and only at the start of a run. */
  showSender: boolean
  meId: number
  /** Tick state for my own messages; null for everyone else's. */
  receipt: "sent" | "delivered" | "read" | null
  highlighted?: boolean
  can: { edit: boolean; delete: boolean; react: boolean; forward: boolean }
  onReply: (m: ChatMessage) => void
  onEdit: (m: ChatMessage) => void
  onDelete: (m: ChatMessage) => void
  onReact: (m: ChatMessage, emoji: string) => void
  onForward: (m: ChatMessage) => void
  onRetry: (m: ChatMessage) => void
  onJumpTo: (messageId: string) => void
  /** Message info (who received and read it). Offered on my own messages only. */
  onInfo: (m: ChatMessage) => void
  /** Words being searched for in this thread, marked in the text. */
  searchTerms?: string[]
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

/** The body with every searched word wrapped in <mark>, case-insensitively. */
function highlight(text: string, terms: string[] | undefined): ReactNode {
  const words = (terms ?? []).filter((t) => t.length > 0)
  if (words.length === 0) return text
  const re = new RegExp(`(${words.map(escapeRe).join("|")})`, "gi")
  return text.split(re).map((part, i) =>
    i % 2 === 1 ? (
      <mark key={i} className="rounded-sm bg-amber-300 px-0.5 text-black">
        {part}
      </mark>
    ) : (
      part
    ),
  )
}

/** The six quick reactions, and "+" for the full emoji set. */
function ReactionPicker({ mine, onPick }: { mine: boolean; onPick: (emoji: string) => void }) {
  const [open, setOpen] = useState(false)
  const [more, setMore] = useState(false)
  const choose = (e: string) => {
    onPick(e)
    setOpen(false)
  }
  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) setMore(false)
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" aria-label="React to message">
          <SmilePlus className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-1" align={mine ? "end" : "start"}>
        {more ? (
          <EmojiPicker onPick={choose} />
        ) : (
          <div className="flex gap-0.5">
            {QUICK_REACTIONS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => choose(e)}
                className="grid h-9 w-9 place-items-center rounded-md text-lg hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`React with ${e}`}
              >
                {e}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setMore(true)}
              className="grid h-9 w-9 place-items-center rounded-md text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="More reactions"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

/**
 * One message. Memoised: a long thread re-renders on every incoming event, and only the
 * message that actually changed needs to repaint.
 */
export const MessageBubble = memo(function MessageBubble({
  message: m,
  mine,
  showSender,
  meId,
  receipt,
  highlighted,
  can,
  onReply,
  onEdit,
  onDelete,
  onReact,
  onForward,
  onRetry,
  onJumpTo,
  onInfo,
  searchTerms,
}: BubbleProps) {
  if (m.type === "SYSTEM") {
    return (
      <div className="my-2 flex justify-center px-4" role="note">
        <span className="rounded-full bg-muted px-3 py-1 text-center text-[11px] text-muted-foreground">{m.body}</span>
      </div>
    )
  }

  const deleted = !!m.deletedAt
  const grouped = new Map<string, { count: number; mine: boolean }>()
  for (const r of m.reactions) {
    const g = grouped.get(r.emoji) ?? { count: 0, mine: false }
    g.count++
    if (r.userId === meId) g.mine = true
    grouped.set(r.emoji, g)
  }

  const copy = async () => {
    if (!m.body) return
    try {
      await navigator.clipboard.writeText(m.body)
    } catch {
      // Clipboard access can be denied; nothing useful to do about it here.
    }
  }

  const time = format(new Date(m.createdAt), "HH:mm")

  return (
    <div
      id={`msg-${m.id}`}
      // Reactions hang off the bubble's bottom edge; reserve room for them so they never
      // sit on top of the next message or get cut off by the scroll edge.
      className={`group/msg flex scroll-my-24 px-3 py-0.5 sm:px-4 ${mine ? "justify-end" : "justify-start"} ${grouped.size > 0 ? "pb-5" : ""}`}
    >
      <div className={`flex max-w-[85%] items-end gap-1 sm:max-w-[70%] ${mine ? "flex-row-reverse" : "flex-row"}`}>
        <div
          className={`relative min-w-0 rounded-2xl px-3 py-2 text-sm shadow-xs ${
            mine
              ? "rounded-br-md bg-primary text-primary-foreground"
              : "rounded-bl-md border border-border bg-card text-card-foreground"
          } ${highlighted ? "ring-2 ring-amber-400" : ""} ${m.pending === "failed" ? "opacity-70" : ""}`}
        >
          {showSender && !mine && m.sender && (
            <p className="mb-0.5 text-xs font-semibold text-primary">{m.sender.name}</p>
          )}

          {m.forwarded && !deleted && (
            <p className={`mb-1 flex items-center gap-1 text-[11px] italic ${mine ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
              <Forward className="h-3 w-3" aria-hidden /> Forwarded
            </p>
          )}

          {m.replyTo && !deleted && (
            <button
              type="button"
              onClick={() => onJumpTo(m.replyTo!.id)}
              className={`mb-1.5 block w-full rounded-md border-l-2 px-2 py-1 text-left text-xs ${
                mine ? "border-primary-foreground/60 bg-primary-foreground/10" : "border-primary bg-muted"
              }`}
            >
              <span className="block font-semibold">{m.replyTo.senderName ?? "Unknown"}</span>
              <span className="line-clamp-2 opacity-80">
                {m.replyTo.deleted ? "Message deleted" : (m.replyTo.preview ?? "Attachment")}
              </span>
            </button>
          )}

          {deleted ? (
            <p className={`italic ${mine ? "text-primary-foreground/80" : "text-muted-foreground"}`}>This message was deleted</p>
          ) : (
            <>
              {m.attachments.map((a) => (
                <div key={a.id} className="mb-1.5">
                  {a.kind === "IMAGE" ? (
                    <a href={a.url} target="_blank" rel="noopener noreferrer" className="block">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={a.url}
                        alt={a.name}
                        loading="lazy"
                        className="max-h-72 w-auto max-w-full rounded-lg bg-muted object-contain"
                      />
                    </a>
                  ) : a.kind === "VIDEO" ? (
                    <video src={a.url} controls preload="metadata" className="max-h-72 w-full rounded-lg bg-black" />
                  ) : (
                    <a
                      href={`${a.url}?download=1`}
                      className={`flex items-center gap-2 rounded-lg px-2 py-2 ${mine ? "bg-primary-foreground/10" : "bg-muted"}`}
                    >
                      <FileText className="h-5 w-5 shrink-0" aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-medium">{a.name}</span>
                        <span className="block text-[10px] opacity-70">{formatSize(a.size)}</span>
                      </span>
                      <Download className="h-4 w-4 shrink-0" aria-label={`Download ${a.name}`} />
                    </a>
                  )}
                </div>
              ))}
              {m.body &&
                (isEmojiOnly(m.body) && m.attachments.length === 0 ? (
                  <p className="text-4xl leading-tight" aria-label={m.body}>{m.body}</p>
                ) : (
                  <p className="whitespace-pre-wrap break-words">{highlight(m.body, searchTerms)}</p>
                ))}
            </>
          )}

          {m.pending === "sending" && typeof m.progress === "number" && m.progress < 100 && (
            <Progress value={m.progress} className="mt-1.5 h-1" aria-label="Upload progress" />
          )}

          <div className={`mt-0.5 flex items-center justify-end gap-1 text-[10px] ${mine ? "text-primary-foreground/75" : "text-muted-foreground"}`}>
            {m.editedAt && !deleted && <span>edited</span>}
            <span className="tabular-nums">{time}</span>
            {mine &&
              (m.pending === "sending" ? (
                <Loader2 className="h-3 w-3 animate-spin" aria-label="Sending" />
              ) : m.pending === "failed" ? (
                <AlertCircle className="h-3 w-3" aria-label="Not sent" />
              ) : receipt === "read" ? (
                // Blue, as people expect. The bubble is near-black in light mode and
                // near-white in dark mode, so the shade flips to stay legible on both.
                <CheckCheck className="h-3.5 w-3.5 text-sky-400 dark:text-sky-600" aria-label="Read"><title>Read</title></CheckCheck>
              ) : receipt === "delivered" ? (
                <CheckCheck className="h-3.5 w-3.5" aria-label="Delivered"><title>Delivered</title></CheckCheck>
              ) : (
                <Check className="h-3.5 w-3.5" aria-label="Sent"><title>Sent</title></Check>
              ))}
          </div>

          {grouped.size > 0 && (
            // Bottom-left on both sides: the time and ticks live bottom-right.
            <div className="absolute -bottom-4 left-3 flex gap-0.5">
              {[...grouped.entries()].map(([emoji, g]) => (
                <button
                  key={emoji}
                  type="button"
                  disabled={!can.react}
                  onClick={() => onReact(m, emoji)}
                  aria-pressed={g.mine}
                  aria-label={`${emoji} ${g.count}${g.mine ? ", including you" : ""}`}
                  className={`inline-flex h-6 items-center gap-0.5 whitespace-nowrap rounded-full border px-1.5 text-xs leading-none shadow-xs ring-2 ring-background ${
                    g.mine ? "border-primary bg-primary/10 text-foreground" : "border-border bg-card text-foreground"
                  }`}
                >
                  {emoji}
                  {g.count > 1 && <span className="text-[11px] tabular-nums">{g.count}</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {m.pending === "failed" ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-destructive"
            onClick={() => onRetry(m)}
            aria-label="Retry sending this message"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        ) : (
          !deleted &&
          !m.pending && (
            // Always focusable and visible on touch; on desktop it fades in on hover.
            <div className="flex shrink-0 items-center opacity-100 transition-opacity sm:opacity-0 sm:group-hover/msg:opacity-100 sm:focus-within:opacity-100">
              {can.react && <ReactionPicker mine={mine} onPick={(e) => onReact(m, e)} />}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" aria-label="Message actions">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align={mine ? "end" : "start"}>
                  <DropdownMenuItem onClick={() => onReply(m)}>
                    <Reply className="mr-2 h-4 w-4" /> Reply
                  </DropdownMenuItem>
                  {m.body && (
                    <DropdownMenuItem onClick={copy}>
                      <Copy className="mr-2 h-4 w-4" /> Copy text
                    </DropdownMenuItem>
                  )}
                  {can.forward && (
                    <DropdownMenuItem onClick={() => onForward(m)}>
                      <Forward className="mr-2 h-4 w-4" /> Forward
                    </DropdownMenuItem>
                  )}
                  {mine && (
                    <DropdownMenuItem onClick={() => onInfo(m)}>
                      <Info className="mr-2 h-4 w-4" /> Info
                    </DropdownMenuItem>
                  )}
                  {mine && can.edit && m.type === "TEXT" && (
                    <DropdownMenuItem onClick={() => onEdit(m)}>
                      <Pencil className="mr-2 h-4 w-4" /> Edit
                    </DropdownMenuItem>
                  )}
                  {mine && can.delete && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => onDelete(m)} className="text-destructive focus:text-destructive">
                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )
        )}
      </div>
    </div>
  )
})
