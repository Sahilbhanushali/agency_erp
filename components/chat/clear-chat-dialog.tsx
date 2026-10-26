"use client"

import { useState } from "react"
import toast from "react-hot-toast"
import { Loader2 } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import type { ChatConversation } from "./types"

export type ClearMode = "clear" | "delete"

/**
 * Confirms "Clear chat" or "Delete chat" and does it. Both are for the caller only —
 * the copy says so, because "delete" on a shared conversation is easy to misread as
 * deleting it for everyone.
 */
export function ClearChatDialog({
  conversation,
  mode,
  onClose,
  onDone,
}: {
  conversation: ChatConversation
  mode: ClearMode | null
  onClose: () => void
  onDone: (result: { clearedSeq: number; hidden: boolean }) => void
}) {
  const [busy, setBusy] = useState(false)
  const name = conversation.name ?? "this chat"

  const run = async () => {
    if (!mode) return
    setBusy(true)
    try {
      const r = await fetch(`/api/chat/conversations/${conversation.id}/clear`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delete: mode === "delete" }),
      })
      const body = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(body.error ?? "Could not do that")
      toast.success(mode === "delete" ? `Deleted "${name}" from your chats` : `Cleared "${name}"`)
      onDone(body)
      onClose()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AlertDialog open={mode !== null} onOpenChange={(o) => !o && !busy && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{mode === "delete" ? `Delete chat with "${name}"?` : `Clear all messages in "${name}"?`}</AlertDialogTitle>
          <AlertDialogDescription>
            {mode === "delete"
              ? "It's removed from your chat list and its messages are cleared for you. "
              : "Every message currently in this chat is removed from your view; the chat stays in your list. "}
            {conversation.type === "GROUP" ? "Other members" : "The other person"} still {conversation.type === "GROUP" ? "have" : "has"} every message.
            {mode === "delete" && " If a new message arrives, the chat comes back with just that."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              void run()
            }}
            disabled={busy}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === "delete" ? "Delete chat" : "Clear chat"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
