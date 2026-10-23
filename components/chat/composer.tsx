"use client"

import { useEffect, useRef, useState } from "react"
import { Paperclip, Pencil, Reply, Send, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import type { ChatMessage } from "./types"

/** Mirrors lib/chat/file-rules.ts, so most bad picks are caught before uploading. */
const ACCEPT =
  "image/jpeg,image/png,image/gif,image/webp,video/mp4,video/quicktime,video/webm,application/pdf," +
  ".doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip"

const TYPING_EVERY_MS = 3000

export function Composer({
  disabled,
  disabledReason,
  canAttach,
  replyTo,
  editing,
  onCancelReply,
  onCancelEdit,
  onSend,
  onSaveEdit,
  onTyping,
}: {
  disabled: boolean
  disabledReason?: string
  canAttach: boolean
  replyTo: ChatMessage | null
  editing: ChatMessage | null
  onCancelReply: () => void
  onCancelEdit: () => void
  onSend: (text: string, file: File | null) => void
  onSaveEdit: (message: ChatMessage, text: string) => void
  onTyping: () => void
}) {
  const [text, setText] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const lastTyping = useRef(0)

  // Entering edit mode loads the message; leaving it clears the box.
  useEffect(() => {
    if (editing) {
      setText(editing.body ?? "")
      setFile(null)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [editing])

  useEffect(() => {
    if (replyTo) inputRef.current?.focus()
  }, [replyTo])

  // Grow with the text, up to a limit, instead of a fixed tiny box.
  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }, [text])

  const submit = () => {
    const trimmed = text.trim()
    if (editing) {
      if (trimmed && trimmed !== editing.body) onSaveEdit(editing, trimmed)
      else onCancelEdit()
      setText("")
      return
    }
    if (!trimmed && !file) return
    onSend(trimmed, file)
    setText("")
    setFile(null)
    if (fileRef.current) fileRef.current.value = ""
  }

  if (disabled) {
    return (
      <div className="border-t border-border bg-muted/40 px-4 py-3 text-center text-sm text-muted-foreground">
        {disabledReason ?? "You can't send messages here."}
      </div>
    )
  }

  return (
    <div className="border-t border-border bg-card">
      {(replyTo || editing) && (
        <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-3 py-2 text-xs">
          {editing ? <Pencil className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden /> : <Reply className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />}
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-foreground">
              {editing ? "Editing message" : `Replying to ${replyTo?.sender?.name ?? "message"}`}
            </p>
            {replyTo && (
              <p className="truncate text-muted-foreground">
                {replyTo.body ?? (replyTo.attachments[0]?.name ? `📎 ${replyTo.attachments[0].name}` : "Attachment")}
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => {
              if (editing) {
                onCancelEdit()
                setText("")
              } else onCancelReply()
            }}
            aria-label={editing ? "Cancel editing" : "Cancel reply"}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {file && (
        <div className="flex items-center gap-2 border-b border-border px-3 py-2 text-xs">
          <Paperclip className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
          <span className="min-w-0 flex-1 truncate">{file.name}</span>
          <span className="tabular-nums text-muted-foreground">{(file.size / 1024 / 1024).toFixed(1)} MB</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => {
              setFile(null)
              if (fileRef.current) fileRef.current.value = ""
            }}
            aria-label={`Remove ${file.name}`}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      <div className="flex items-end gap-2 p-2 sm:p-3">
        {canAttach && !editing && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPT}
              className="sr-only"
              id="chat-file"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-11 w-11 shrink-0 text-muted-foreground"
              onClick={() => fileRef.current?.click()}
              aria-label="Attach a file"
            >
              <Paperclip className="h-5 w-5" />
            </Button>
          </>
        )}
        <Label htmlFor="chat-input" className="sr-only">
          Message
        </Label>
        <textarea
          id="chat-input"
          ref={inputRef}
          rows={1}
          value={text}
          maxLength={4000}
          placeholder={file ? "Add a caption (optional)" : "Type a message"}
          onChange={(e) => {
            setText(e.target.value)
            const now = Date.now()
            if (e.target.value && now - lastTyping.current > TYPING_EVERY_MS) {
              lastTyping.current = now
              onTyping()
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              submit()
            }
            if (e.key === "Escape" && (editing || replyTo)) {
              e.preventDefault()
              if (editing) {
                onCancelEdit()
                setText("")
              } else onCancelReply()
            }
          }}
          className="min-h-11 flex-1 resize-none rounded-xl border border-input bg-background px-3 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <Button
          size="icon"
          className="h-11 w-11 shrink-0 rounded-full"
          onClick={submit}
          disabled={!text.trim() && !file}
          aria-label={editing ? "Save edit" : "Send message"}
        >
          <Send className="h-5 w-5" />
        </Button>
      </div>
    </div>
  )
}
