"use client"

import { useEffect, useState } from "react"
import useSWR from "swr"
import Link from "next/link"
import toast from "react-hot-toast"
import { Info, Loader2, Search, X } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

interface Person {
  id: number
  name: string
  avatar: string | null
  role: string | null
  online: boolean
}

/** Only sent to people who administer users — see app/api/chat/users. */
interface Unavailable {
  deactivated: number
  noRole: { count: number; names: string[] }
  rolesWithoutChat: { role: string; count: number }[]
}

const fetcher = (url: string) => fetch(url).then((r) => (r.ok ? r.json() : { users: [] }))

/**
 * Start a direct chat (pick one person) or create a group (pick several, name it).
 * Also used to add members to an existing group — `mode="add"`.
 */
export function NewConversationDialog({
  open,
  mode,
  excludeIds = [],
  onClose,
  onCreated,
  onAdd,
}: {
  open: boolean
  mode: "direct" | "group" | "add"
  excludeIds?: number[]
  onClose: () => void
  onCreated?: (conversationId: string) => void
  onAdd?: (userIds: number[]) => Promise<void>
}) {
  const [search, setSearch] = useState("")
  const [q, setQ] = useState("")
  const [picked, setPicked] = useState<Map<number, Person>>(new Map())
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [nameError, setNameError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setQ(search.trim()), 200)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    if (!open) {
      setSearch("")
      setPicked(new Map())
      setName("")
      setDescription("")
      setNameError(null)
    }
  }, [open])

  const { data, isLoading } = useSWR<{ users: Person[]; unavailable: Unavailable | null }>(
    open ? `/api/chat/users${q ? `?q=${encodeURIComponent(q)}` : ""}` : null,
    fetcher,
  )
  const people = (data?.users ?? []).filter((p) => !excludeIds.includes(p.id))

  const startDirect = async (person: Person) => {
    setBusy(true)
    try {
      const r = await fetch("/api/chat/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "DIRECT", userId: person.id }),
      })
      const body = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(body.error ?? "Could not start the conversation")
      onCreated?.(body.id)
      onClose()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const submitGroup = async () => {
    if (mode === "add") {
      if (picked.size === 0) return
      setBusy(true)
      try {
        await onAdd?.([...picked.keys()])
        onClose()
      } finally {
        setBusy(false)
      }
      return
    }
    if (!name.trim()) {
      setNameError("Give the group a name")
      return
    }
    setBusy(true)
    try {
      const r = await fetch("/api/chat/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "GROUP", name: name.trim(), description: description.trim() || undefined, memberIds: [...picked.keys()] }),
      })
      const body = await r.json().catch(() => ({}))
      if (!r.ok) {
        if (body.details?.name) setNameError(body.details.name[0])
        throw new Error(body.error ?? "Could not create the group")
      }
      if (body.skipped > 0) toast(`${body.skipped} selected ${body.skipped === 1 ? "person" : "people"} can't use chat and were left out`)
      onCreated?.(body.id)
      onClose()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const title = mode === "direct" ? "New chat" : mode === "group" ? "New group" : "Add members"
  const multi = mode !== "direct"

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {mode === "direct"
              ? "Choose someone to message."
              : mode === "group"
                ? "Name the group and choose who is in it. You'll be its admin."
                : "Choose people to add to this group."}
          </DialogDescription>
        </DialogHeader>

        {mode === "group" && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="group-name">Group name</Label>
              <Input
                id="group-name"
                value={name}
                maxLength={120}
                onChange={(e) => {
                  setName(e.target.value)
                  setNameError(null)
                }}
                aria-invalid={!!nameError}
                aria-describedby={nameError ? "group-name-error" : undefined}
                placeholder="e.g. Acme launch team"
              />
              {nameError && <p id="group-name-error" className="text-xs text-destructive">{nameError}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="group-desc">Description (optional)</Label>
              <Textarea id="group-desc" rows={2} maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
          </div>
        )}

        {multi && picked.size > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {[...picked.values()].map((p) => (
              <Badge key={p.id} variant="secondary" className="gap-1 pr-1">
                {p.name}
                <button
                  type="button"
                  onClick={() => setPicked((prev) => { const n = new Map(prev); n.delete(p.id); return n })}
                  className="rounded-full p-0.5 hover:bg-muted-foreground/20"
                  aria-label={`Remove ${p.name}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}

        <div className="relative">
          <Label htmlFor="people-search" className="sr-only">Search people</Label>
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input id="people-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search people" className="pl-8" />
        </div>

        <div className="max-h-72 space-y-0.5 overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : people.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {q
                ? "Nobody matches that search."
                : data?.unavailable
                  ? "Nobody else can use chat yet — here's why:"
                  : "Nobody else can use chat yet. Ask an administrator to give their roles Chat access."}
            </p>
          ) : (
            people.map((p) => {
              const row = (
                <>
                  <span className="relative">
                    <Avatar className="h-8 w-8">
                      {p.avatar && <AvatarImage src={p.avatar} alt="" />}
                      <AvatarFallback className="text-xs">{p.name.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    {p.online && <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-background" aria-label="Online" />}
                  </span>
                  <span className="min-w-0 flex-1 text-left">
                    <span className="block truncate text-sm font-medium">{p.name}</span>
                    {p.role && <span className="block truncate text-xs text-muted-foreground">{p.role}</span>}
                  </span>
                </>
              )
              return multi ? (
                <label key={p.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted">
                  <Checkbox
                    checked={picked.has(p.id)}
                    onCheckedChange={(v) =>
                      setPicked((prev) => {
                        const n = new Map(prev)
                        if (v) n.set(p.id, p)
                        else n.delete(p.id)
                        return n
                      })
                    }
                  />
                  {row}
                </label>
              ) : (
                <button
                  key={p.id}
                  type="button"
                  disabled={busy}
                  onClick={() => startDirect(p)}
                  className="flex min-h-11 w-full items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {row}
                </button>
              )
            })
          )}
        </div>

        {!q && data?.unavailable && <UnavailableHint info={data.unavailable} onNavigate={onClose} />}

        {multi && (
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={submitGroup} disabled={busy || (mode === "add" && picked.size === 0)}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === "add" ? `Add${picked.size ? ` (${picked.size})` : ""}` : "Create group"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}

/**
 * Who is missing from the list and what would fix it. Each line names the cause and
 * links to the screen that fixes it, because the usual reasons — no role, a role whose
 * Chat boxes were never saved, a deactivated account — all look identical from here.
 */
function UnavailableHint({ info, onNavigate }: { info: Unavailable; onNavigate: () => void }) {
  const lines: React.ReactNode[] = []
  for (const r of info.rolesWithoutChat) {
    lines.push(
      <li key={`role-${r.role}`}>
        <strong>{r.count}</strong> {r.count === 1 ? "person has" : "people have"} the <strong>{r.role}</strong> role, which
        doesn&apos;t include Chat.{" "}
        <Link href="/dashboard/users?tab=roles" onClick={onNavigate} className="font-medium text-primary underline-offset-2 hover:underline">
          Edit {r.role}
        </Link>{" "}
        and save with <em>Chat → Use chat</em> ticked.
      </li>,
    )
  }
  if (info.noRole.count > 0) {
    lines.push(
      <li key="no-role">
        <strong>{info.noRole.count}</strong> {info.noRole.count === 1 ? "person has" : "people have"} no role at all
        {info.noRole.names.length > 0 && ` (${info.noRole.names.join(", ")}${info.noRole.count > info.noRole.names.length ? ", …" : ""})`}.{" "}
        <Link href="/dashboard/users" onClick={onNavigate} className="font-medium text-primary underline-offset-2 hover:underline">
          Assign them a role
        </Link>
        .
      </li>,
    )
  }
  if (info.deactivated > 0) {
    lines.push(
      <li key="deactivated">
        <strong>{info.deactivated}</strong> deactivated {info.deactivated === 1 ? "account is" : "accounts are"} hidden.{" "}
        <Link href="/dashboard/users" onClick={onNavigate} className="font-medium text-primary underline-offset-2 hover:underline">
          Reactivate
        </Link>{" "}
        to include {info.deactivated === 1 ? "it" : "them"}.
      </li>,
    )
  }
  if (lines.length === 0) return null
  return (
    <div className="flex gap-2 rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
      <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="space-y-1">
        <p className="font-medium text-foreground">Not everyone can be added yet</p>
        <ul className="list-disc space-y-1 pl-4">{lines}</ul>
      </div>
    </div>
  )
}
