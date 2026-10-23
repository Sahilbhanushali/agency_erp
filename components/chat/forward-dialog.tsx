"use client"

import { useState } from "react"
import toast from "react-hot-toast"
import { Loader2, Search, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useChat } from "./chat-provider"
import type { ChatMessage } from "./types"

const MAX_TARGETS = 5

/** Pick up to five conversations to forward a message into. */
export function ForwardDialog({ message, onClose }: { message: ChatMessage | null; onClose: () => void }) {
  const { conversations } = useChat()
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [q, setQ] = useState("")
  const [busy, setBusy] = useState(false)

  // Only places you can still post. The server checks again either way.
  const options = (conversations ?? [])
    .filter((c) => c.me.active && c.id !== message?.conversationId)
    .filter((c) => !q || (c.name ?? "").toLowerCase().includes(q.toLowerCase()))

  const close = () => {
    setPicked(new Set())
    setQ("")
    onClose()
  }

  const submit = async () => {
    if (!message || picked.size === 0) return
    setBusy(true)
    try {
      const r = await fetch(`/api/chat/messages/${message.id}/forward`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationIds: [...picked] }),
      })
      const body = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(body.error ?? "Could not forward")
      toast.success(`Forwarded to ${body.forwarded} conversation${body.forwarded === 1 ? "" : "s"}`)
      close()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={message !== null} onOpenChange={(open) => !open && close()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Forward message</DialogTitle>
          <DialogDescription>Choose up to {MAX_TARGETS} conversations. The text and any file are copied.</DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Label htmlFor="fwd-search" className="sr-only">Search conversations</Label>
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input id="fwd-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="pl-8" />
        </div>
        <div className="max-h-72 space-y-1 overflow-y-auto">
          {options.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No other conversations to forward to.</p>
          ) : (
            options.map((c) => {
              const checked = picked.has(c.id)
              const full = !checked && picked.size >= MAX_TARGETS
              return (
                <label
                  key={c.id}
                  className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted ${full ? "opacity-50" : ""}`}
                >
                  <Checkbox
                    checked={checked}
                    disabled={full}
                    onCheckedChange={(v) =>
                      setPicked((prev) => {
                        const next = new Set(prev)
                        if (v) next.add(c.id)
                        else next.delete(c.id)
                        return next
                      })
                    }
                  />
                  {c.type === "GROUP" && <Users className="h-4 w-4 text-muted-foreground" aria-hidden />}
                  <span className="truncate text-sm">{c.name ?? "Conversation"}</span>
                </label>
              )
            })
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={close}>Cancel</Button>
          <Button onClick={submit} disabled={busy || picked.size === 0}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Forward{picked.size > 0 ? ` (${picked.size})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
