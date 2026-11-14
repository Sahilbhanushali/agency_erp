"use client"

import { useCallback, useEffect, useState } from "react"
import { format, isToday, isYesterday } from "date-fns"
import { AlertCircle, Check, CheckCheck, Loader2 } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useChat } from "./chat-provider"
import type { ChatMessage } from "./types"

interface Person {
  id: number
  name: string
  avatar: string | null
  left: boolean
  status: "read" | "delivered" | "sent"
  readAt: string | null
  deliveredAt: string | null
}

interface Info {
  sentAt: string
  editedAt: string | null
  deleted: boolean
  people: Person[]
}

function when(iso: string | null) {
  if (!iso) return "Earlier"
  const d = new Date(iso)
  const time = format(d, "HH:mm")
  if (isToday(d)) return `Today, ${time}`
  if (isYesterday(d)) return `Yesterday, ${time}`
  return format(d, "d MMM yyyy, HH:mm")
}

/**
 * Who a message of mine reached and who read it, and when — WhatsApp's "Message info".
 * Refreshes itself as read and delivered events arrive, so it fills in while open.
 */
export function MessageInfoDialog({ message, onClose }: { message: ChatMessage | null; onClose: () => void }) {
  const chat = useChat()
  const [info, setInfo] = useState<Info | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!message) return
    try {
      const r = await fetch(`/api/chat/messages/${message.id}/info`, { cache: "no-store" })
      const body = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(body.error ?? "Could not load message info")
      setInfo(body)
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    }
  }, [message])

  useEffect(() => {
    setInfo(null)
    setError(null)
    void load()
  }, [load])

  useEffect(() => {
    if (!message) return
    return chat.on((e) => {
      if ((e.type === "read" || e.type === "delivered") && e.conversationId === message.conversationId && e.seq >= message.seq) {
        void load()
      }
    })
  }, [chat, message, load])

  const read = info?.people.filter((p) => p.status === "read") ?? []
  const delivered = info?.people.filter((p) => p.status === "delivered") ?? []
  const waiting = info?.people.filter((p) => p.status === "sent") ?? []
  const direct = info?.people.length === 1

  return (
    <Dialog open={!!message} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Message info</DialogTitle>
          <DialogDescription className="sr-only">Who this message was delivered to and who has read it.</DialogDescription>
        </DialogHeader>

        {message && (
          <div className="rounded-xl bg-muted/50 p-3">
            <p className="line-clamp-4 whitespace-pre-wrap break-words text-sm">
              {message.body ?? (message.attachments[0] ? `📎 ${message.attachments[0].name}` : "")}
            </p>
            <p className="mt-1 text-right text-xs text-muted-foreground">
              Sent {when(info?.sentAt ?? message.createdAt)}
              {info?.editedAt && ` · edited ${when(info.editedAt)}`}
            </p>
          </div>
        )}

        {error ? (
          <div role="alert" className="flex flex-col items-center gap-2 py-6 text-center">
            <AlertCircle className="h-5 w-5 text-destructive" aria-hidden />
            <p className="text-sm">{error}</p>
            <Button size="sm" variant="outline" onClick={() => void load()}>Try again</Button>
          </div>
        ) : !info ? (
          <div className="flex justify-center py-8" aria-busy="true">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-label="Loading" />
          </div>
        ) : info.people.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Nobody else was in this conversation when it was sent.</p>
        ) : direct ? (
          // A DM: two lines, as in WhatsApp, rather than lists of one.
          <dl className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="flex items-center gap-2 font-medium">
                <CheckCheck className="h-4 w-4 text-sky-500" aria-hidden /> Read
              </dt>
              <dd className="text-muted-foreground">{info.people[0].status === "read" ? when(info.people[0].readAt) : "Not yet"}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="flex items-center gap-2 font-medium">
                <CheckCheck className="h-4 w-4 text-muted-foreground" aria-hidden /> Delivered
              </dt>
              <dd className="text-muted-foreground">
                {info.people[0].status !== "sent" ? when(info.people[0].deliveredAt) : "Not yet — they haven't opened the app since"}
              </dd>
            </div>
          </dl>
        ) : (
          <div className="space-y-4">
            <Group title="Read by" icon={<CheckCheck className="h-4 w-4 text-sky-500" aria-hidden />} people={read} time={(p) => when(p.readAt)} />
            <Group
              title="Delivered to"
              icon={<CheckCheck className="h-4 w-4 text-muted-foreground" aria-hidden />}
              people={delivered}
              time={(p) => when(p.deliveredAt)}
            />
            <Group title="Not delivered yet" icon={<Check className="h-4 w-4 text-muted-foreground" aria-hidden />} people={waiting} time={() => ""} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function Group({ title, icon, people, time }: { title: string; icon: React.ReactNode; people: Person[]; time: (p: Person) => string }) {
  if (people.length === 0) return null
  return (
    <section>
      <h3 className="mb-1.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {icon} {title} <span className="tabular-nums">({people.length})</span>
      </h3>
      <ul className="space-y-1">
        {people.map((p) => (
          <li key={p.id} className="flex items-center gap-3 rounded-lg px-1 py-1.5">
            <Avatar className="h-8 w-8">
              {p.avatar && <AvatarImage src={p.avatar} alt="" />}
              <AvatarFallback className="text-xs">{p.name.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            <span className="min-w-0 flex-1 truncate text-sm">
              {p.name}
              {p.left && <span className="ml-1 text-xs text-muted-foreground">(left)</span>}
            </span>
            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{time(p)}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
