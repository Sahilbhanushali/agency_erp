"use client"

import { useEffect, useRef, useState } from "react"
import useSWR from "swr"
import { Bell, BellOff } from "lucide-react"
import { Button } from "@/components/ui/button"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

interface Note {
  id: string | number
  title: string
  message: string
  link?: string | null
  isRead?: boolean
  createdAt: string
}

/**
 * Desktop notifications for task activity.
 *
 * Polls the same unread rows the bell icon uses, so there is one source of truth and no
 * second delivery path to keep in sync. Only notifications created *after* this mounted
 * are raised — otherwise opening the app would replay every unread item as a burst of
 * system popups.
 *
 * Permission is requested on an explicit click, never on load: browsers reject
 * unprompted requests, and users resent them.
 */
export default function DesktopNotifications() {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default")
  const seen = useRef<Set<string>>(new Set())
  const since = useRef<number>(Date.now())

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setPermission("unsupported")
      return
    }
    setPermission(Notification.permission)
  }, [])

  const enabled = permission === "granted"

  const { data } = useSWR<Note[]>(enabled ? "/api/notifications" : null, fetcher, {
    refreshInterval: 60_000,
    revalidateOnFocus: true,
  })

  useEffect(() => {
    if (!enabled || !Array.isArray(data)) return

    for (const note of data) {
      const id = String(note.id)
      if (seen.current.has(id)) continue
      seen.current.add(id)

      // Anything from before this session is history, not news.
      if (new Date(note.createdAt).getTime() < since.current) continue

      try {
        const shown = new Notification(note.title, {
          body: note.message,
          tag: id, // collapses duplicates when several tabs are open
        })
        shown.onclick = () => {
          window.focus()
          if (note.link) window.location.href = note.link
          shown.close()
        }
      } catch {
        // The browser may refuse (focus rules, OS settings). The in-app bell still has it.
      }
    }
  }, [data, enabled])

  if (permission === "unsupported") return null

  if (permission === "granted") {
    return (
      <span className="hidden items-center gap-1 text-xs text-muted-foreground sm:inline-flex">
        <Bell className="h-3.5 w-3.5" aria-hidden="true" />
        Desktop alerts on
      </span>
    )
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-xs"
      onClick={async () => setPermission(await Notification.requestPermission())}
    >
      <BellOff className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
      {permission === "denied" ? "Alerts blocked" : "Enable alerts"}
    </Button>
  )
}
