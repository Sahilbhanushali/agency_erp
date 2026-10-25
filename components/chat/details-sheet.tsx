"use client"

import { useEffect, useRef, useState } from "react"
import useSWR from "swr"
import toast from "react-hot-toast"
import { Camera, Crown, Eraser, Loader2, LogOut, MoreHorizontal, Trash2, UserPlus, Users } from "lucide-react"
import { ClearChatDialog, type ClearMode } from "./clear-chat-dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import { useChat } from "./chat-provider"
import { NewConversationDialog } from "./new-conversation-dialog"
import type { ChatConversation } from "./types"

interface Member {
  id: number
  name: string
  avatar: string | null
  jobRole: string | null
  role: "MEMBER" | "ADMIN"
  online: boolean
}

interface DetailsResponse {
  conversation: {
    id: string
    type: "DIRECT" | "GROUP"
    name: string | null
    description: string | null
    avatarUrl: string | null
    membersCanEditInfo: boolean
    createdAt: string
    createdBy: { id: number; name: string } | null
    members: Member[]
  }
  permissions: { active: boolean; isGroupAdmin: boolean; canEditInfo: boolean; canManageMembers: boolean; canDelete: boolean; canLeave: boolean }
}

const fetcher = async (url: string) => {
  const r = await fetch(url, { cache: "no-store" })
  const body = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(body.error ?? "Could not load details")
  return body
}

type Confirm =
  | { kind: "leave" }
  | { kind: "delete" }
  | { kind: "remove"; member: Member }
  | null

export function DetailsSheet({
  conversation,
  meId,
  open,
  onOpenChange,
  onGone,
}: {
  conversation: ChatConversation
  meId: number
  open: boolean
  onOpenChange: (o: boolean) => void
  /** The conversation was deleted, or this person left it. */
  onGone: () => void
}) {
  const chat = useChat()
  const { data, error, mutate } = useSWR<DetailsResponse>(open ? `/api/chat/conversations/${conversation.id}` : null, fetcher)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [saving, setSaving] = useState(false)
  const [adding, setAdding] = useState(false)
  const [confirm, setConfirm] = useState<Confirm>(null)
  const [busy, setBusy] = useState(false)
  const [clearMode, setClearMode] = useState<ClearMode | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const c = data?.conversation
  const perms = data?.permissions

  useEffect(() => {
    if (c) {
      setName(c.name ?? "")
      setDescription(c.description ?? "")
    }
  }, [c?.id, c?.name, c?.description]) // eslint-disable-line react-hooks/exhaustive-deps

  // Live changes from other people — someone renamed the group, added a member.
  useEffect(
    () => chat.on((e) => (e.type === "conversation" || e.type === "read") && e.conversationId === conversation.id && void mutate()),
    [chat, conversation.id, mutate],
  )

  const call = async (url: string, init: RequestInit, success?: string) => {
    const r = await fetch(url, init)
    const body = await r.json().catch(() => ({}))
    if (!r.ok) {
      toast.error(body.error ?? "Something went wrong")
      return false
    }
    if (success) toast.success(success)
    await Promise.all([mutate(), chat.refreshConversations()])
    return true
  }

  const saveInfo = async () => {
    if (!name.trim()) return toast.error("Give the group a name")
    setSaving(true)
    await call(
      `/api/chat/conversations/${conversation.id}`,
      { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim(), description: description.trim() || null }) },
      "Group updated",
    )
    setSaving(false)
  }

  const uploadAvatar = async (file: File) => {
    const form = new FormData()
    form.append("avatar", file)
    setSaving(true)
    await call(`/api/chat/conversations/${conversation.id}`, { method: "PATCH", body: form }, "Group picture updated")
    setSaving(false)
    if (fileRef.current) fileRef.current.value = ""
  }

  const mute = (hours: number) =>
    call(
      `/api/chat/conversations/${conversation.id}/mute`,
      { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ hours }) },
      hours === 0 ? "Notifications on" : "Muted",
    )

  const runConfirm = async () => {
    if (!confirm) return
    setBusy(true)
    let ok = false
    if (confirm.kind === "leave") {
      ok = await call(`/api/chat/conversations/${conversation.id}/members/${meId}`, { method: "DELETE" }, "You left the group")
    } else if (confirm.kind === "delete") {
      ok = await call(`/api/chat/conversations/${conversation.id}`, { method: "DELETE" }, "Group deleted")
    } else {
      ok = await call(
        `/api/chat/conversations/${conversation.id}/members/${confirm.member.id}`,
        { method: "DELETE" },
        `${confirm.member.name} removed`,
      )
    }
    setBusy(false)
    setConfirm(null)
    if (ok && confirm.kind !== "remove") {
      onOpenChange(false)
      onGone()
    }
  }

  const mutedUntil = conversation.me.mutedUntil ? new Date(conversation.me.mutedUntil) : null
  const muteValue = !mutedUntil || mutedUntil < new Date() ? "0" : mutedUntil.getFullYear() > 9000 ? "-1" : "on"

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{conversation.type === "GROUP" ? "Group info" : "Conversation info"}</SheetTitle>
          <SheetDescription className="sr-only">Details, members and settings for this conversation</SheetDescription>
        </SheetHeader>

        {error ? (
          <p className="mt-6 text-sm text-destructive">{String(error.message)}</p>
        ) : !c || !perms ? (
          <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="mt-4 space-y-6 px-1 pb-6">
            {/* Identity */}
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="relative">
                <Avatar className="h-20 w-20">
                  {(c.type === "GROUP" ? c.avatarUrl : conversation.avatarUrl) && (
                    <AvatarImage src={(c.type === "GROUP" ? c.avatarUrl : conversation.avatarUrl)!} alt="" />
                  )}
                  <AvatarFallback className="bg-primary/10 text-2xl text-primary">
                    {c.type === "GROUP" ? <Users className="h-8 w-8" /> : (conversation.name ?? "?").charAt(0)}
                  </AvatarFallback>
                </Avatar>
                {perms.canEditInfo && (
                  <>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      className="sr-only"
                      onChange={(e) => e.target.files?.[0] && uploadAvatar(e.target.files[0])}
                    />
                    <Button
                      size="icon"
                      variant="secondary"
                      className="absolute -bottom-1 -right-1 h-9 w-9 rounded-full shadow"
                      onClick={() => fileRef.current?.click()}
                      aria-label="Change group picture"
                    >
                      <Camera className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
              {c.type === "DIRECT" && <p className="text-lg font-semibold">{conversation.name}</p>}
              {c.type === "GROUP" && c.createdBy && (
                <p className="text-xs text-muted-foreground">
                  Created by {c.createdBy.name} · {new Date(c.createdAt).toLocaleDateString("en-GB")}
                </p>
              )}
            </div>

            {/* Group details */}
            {c.type === "GROUP" && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="g-name">Name</Label>
                  <Input id="g-name" value={name} maxLength={120} disabled={!perms.canEditInfo} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="g-desc">Description</Label>
                  <Textarea id="g-desc" rows={3} maxLength={2000} disabled={!perms.canEditInfo} value={description} onChange={(e) => setDescription(e.target.value)} placeholder={perms.canEditInfo ? "What this group is for" : "No description"} />
                </div>
                {perms.canEditInfo && (name !== (c.name ?? "") || description !== (c.description ?? "")) && (
                  <Button size="sm" onClick={saveInfo} disabled={saving}>
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save changes
                  </Button>
                )}
                {perms.canManageMembers && (
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                    <Label htmlFor="g-policy" className="text-sm font-normal">
                      Let all members edit name, description and picture
                    </Label>
                    <Switch
                      id="g-policy"
                      checked={c.membersCanEditInfo}
                      onCheckedChange={(v) =>
                        call(`/api/chat/conversations/${c.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ membersCanEditInfo: v }) })
                      }
                    />
                  </div>
                )}
              </div>
            )}

            {/* Notifications */}
            <div className="space-y-1.5">
              <Label htmlFor="g-mute">Notifications</Label>
              <Select
                value={muteValue}
                onValueChange={(v) => {
                  if (v !== "on") void mute(Number(v))
                }}
              >
                <SelectTrigger id="g-mute">
                  <SelectValue>
                    {muteValue === "0" ? "On" : muteValue === "-1" ? "Muted until I turn them on" : `Muted until ${mutedUntil?.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}`}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">On</SelectItem>
                  <SelectItem value="8">Mute for 8 hours</SelectItem>
                  <SelectItem value="168">Mute for 1 week</SelectItem>
                  <SelectItem value="-1">Mute until I turn them on</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Members */}
            {c.type === "GROUP" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">{c.members.length} member{c.members.length === 1 ? "" : "s"}</h3>
                  {perms.canManageMembers && (
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setAdding(true)}>
                      <UserPlus className="h-4 w-4" /> Add
                    </Button>
                  )}
                </div>
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {c.members.map((m) => (
                    <li key={m.id} className="flex items-center gap-3 px-3 py-2">
                      <span className="relative">
                        <Avatar className="h-8 w-8">
                          {m.avatar && <AvatarImage src={m.avatar} alt="" />}
                          <AvatarFallback className="text-xs">{m.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        {chat.online.has(m.id) && <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-background" aria-label="Online" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{m.name}{m.id === meId ? " (you)" : ""}</span>
                        {m.jobRole && <span className="block truncate text-xs text-muted-foreground">{m.jobRole}</span>}
                      </span>
                      {m.role === "ADMIN" && (
                        <Badge variant="secondary" className="gap-1 text-[10px]"><Crown className="h-3 w-3" aria-hidden />Admin</Badge>
                      )}
                      {perms.canManageMembers && m.id !== meId && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Actions for ${m.name}`}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() =>
                                call(
                                  `/api/chat/conversations/${c.id}/members/${m.id}`,
                                  { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role: m.role === "ADMIN" ? "MEMBER" : "ADMIN" }) },
                                  m.role === "ADMIN" ? `${m.name} is no longer an admin` : `${m.name} is now an admin`,
                                )
                              }
                            >
                              <Crown className="mr-2 h-4 w-4" />
                              {m.role === "ADMIN" ? "Remove as admin" : "Make admin"}
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setConfirm({ kind: "remove", member: m })}>
                              <Trash2 className="mr-2 h-4 w-4" /> Remove from group
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <Separator />
            <div className="space-y-2">
              <Button variant="outline" className="w-full justify-start gap-2" onClick={() => setClearMode("clear")}>
                <Eraser className="h-4 w-4" /> Clear chat
              </Button>
              {/* A group you are still in is left first (below); then it can be deleted. */}
              {(conversation.type === "DIRECT" || !perms.active) && (
                <Button variant="outline" className="w-full justify-start gap-2 text-destructive hover:text-destructive" onClick={() => setClearMode("delete")}>
                  <Trash2 className="h-4 w-4" /> Delete chat
                </Button>
              )}
              {perms.canLeave && (
                <Button variant="outline" className="w-full justify-start gap-2 text-destructive hover:text-destructive" onClick={() => setConfirm({ kind: "leave" })}>
                  <LogOut className="h-4 w-4" /> Leave group
                </Button>
              )}
              {perms.canDelete && (
                <Button variant="outline" className="w-full justify-start gap-2 text-destructive hover:text-destructive" onClick={() => setConfirm({ kind: "delete" })}>
                  <Trash2 className="h-4 w-4" /> Delete group for everyone
                </Button>
              )}
            </div>
          </div>
        )}

        <ClearChatDialog
          conversation={conversation}
          mode={clearMode}
          onClose={() => setClearMode(null)}
          onDone={({ hidden }) => {
            void chat.refreshConversations()
            if (hidden) {
              onOpenChange(false)
              onGone()
            }
          }}
        />

        <NewConversationDialog
          open={adding}
          mode="add"
          excludeIds={c?.members.map((m) => m.id) ?? []}
          onClose={() => setAdding(false)}
          onAdd={async (userIds) => {
            await call(
              `/api/chat/conversations/${conversation.id}/members`,
              { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userIds }) },
              "Members added",
            )
          }}
        />

        <AlertDialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {confirm?.kind === "leave"
                  ? `Leave "${c?.name}"?`
                  : confirm?.kind === "delete"
                    ? `Delete "${c?.name}" for everyone?`
                    : `Remove ${confirm?.kind === "remove" ? confirm.member.name : ""}?`}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {confirm?.kind === "leave"
                  ? "You'll stop receiving messages. You can still read what was sent before you left."
                  : confirm?.kind === "delete"
                    ? `Every message and file in this group is permanently deleted for all ${c?.members.length ?? 0} members. This cannot be undone.`
                    : "They'll stop receiving new messages and lose access to anything sent after now."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault()
                  void runConfirm()
                }}
                disabled={busy}
                className="bg-destructive text-white hover:bg-destructive/90"
              >
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {confirm?.kind === "leave" ? "Leave" : confirm?.kind === "delete" ? "Delete group" : "Remove"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SheetContent>
    </Sheet>
  )
}
