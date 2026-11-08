"use client"

import { useMemo, useRef, useState } from "react"
import { Clock, Search } from "lucide-react"
import { ALL_EMOJI, EMOJI_CATEGORIES, type EmojiEntry } from "./emoji-data"

const RECENT_KEY = "chat:recent-emoji"
const RECENT_MAX = 16

function readRecent(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]")
    return Array.isArray(v) ? v.filter((x) => typeof x === "string").slice(0, RECENT_MAX) : []
  } catch {
    return []
  }
}

function rememberRecent(emoji: string) {
  try {
    const next = [emoji, ...readRecent().filter((e) => e !== emoji)].slice(0, RECENT_MAX)
    localStorage.setItem(RECENT_KEY, JSON.stringify(next))
  } catch {
    // Private window or blocked storage: recents are a convenience, not a requirement.
  }
}

const byEmoji = new Map(ALL_EMOJI.map((e) => [e.emoji, e]))

/**
 * Searchable emoji grid. Used by the composer (inserts at the cursor) and by message
 * reactions. Keeps itself open so several can be picked in a row; the caller closes it.
 */
export function EmojiPicker({ onPick, autoFocus = true }: { onPick: (emoji: string) => void; autoFocus?: boolean }) {
  const [query, setQuery] = useState("")
  const [recent, setRecent] = useState<string[]>(() => readRecent())
  const [tab, setTab] = useState(recent.length ? "Recent" : EMOJI_CATEGORIES[0].label)
  const gridRef = useRef<HTMLDivElement>(null)

  const shown: EmojiEntry[] = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q) {
      const words = q.split(/\s+/)
      return ALL_EMOJI.filter((e) => words.every((w) => e.keywords.includes(w)))
    }
    if (tab === "Recent") return recent.map((e) => byEmoji.get(e) ?? { emoji: e, name: "emoji", keywords: "" })
    return EMOJI_CATEGORIES.find((c) => c.label === tab)?.emojis ?? []
  }, [query, tab, recent])

  const pick = (emoji: string) => {
    rememberRecent(emoji)
    setRecent(readRecent())
    onPick(emoji)
  }

  // Arrow keys move through the grid, as in any native picker.
  const onGridKey = (e: React.KeyboardEvent) => {
    const buttons = Array.from(gridRef.current?.querySelectorAll<HTMLButtonElement>("button") ?? [])
    const i = buttons.indexOf(document.activeElement as HTMLButtonElement)
    if (i < 0) return
    const cols = 8
    const move = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols }[e.key]
    if (move === undefined) return
    e.preventDefault()
    buttons[Math.max(0, Math.min(buttons.length - 1, i + move))]?.focus()
  }

  const tabs = [...(recent.length ? [{ label: "Recent", icon: null }] : []), ...EMOJI_CATEGORIES]

  return (
    <div className="w-[min(20rem,calc(100vw-2rem))]">
      <div className="relative p-2 pb-1">
        <label htmlFor="emoji-search" className="sr-only">Search emoji</label>
        <Search className="pointer-events-none absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input
          id="emoji-search"
          autoFocus={autoFocus}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && shown[0]) {
              e.preventDefault()
              pick(shown[0].emoji)
            }
            if (e.key === "ArrowDown") {
              e.preventDefault()
              gridRef.current?.querySelector("button")?.focus()
            }
          }}
          placeholder="Search emoji (e.g. thanks, party)"
          className="h-9 w-full rounded-md border border-input bg-background pl-8 pr-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {!query && (
        <div role="tablist" aria-label="Emoji categories" className="flex gap-0.5 overflow-x-auto border-b border-border px-2 pb-1">
          {tabs.map((c) => (
            <button
              key={c.label}
              type="button"
              role="tab"
              aria-selected={tab === c.label}
              aria-label={c.label}
              title={c.label}
              onClick={() => setTab(c.label)}
              className={`grid h-9 w-9 shrink-0 place-items-center rounded-md text-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                tab === c.label ? "bg-accent" : "hover:bg-muted"
              }`}
            >
              {c.icon ?? <Clock className="h-4 w-4 text-muted-foreground" aria-hidden />}
            </button>
          ))}
        </div>
      )}

      <p className="px-3 pt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground" aria-live="polite">
        {query ? `${shown.length} result${shown.length === 1 ? "" : "s"}` : tab}
      </p>
      <div ref={gridRef} onKeyDown={onGridKey} className="grid max-h-56 grid-cols-8 gap-0.5 overflow-y-auto p-2 pt-1">
        {shown.map((e) => (
          <button
            key={e.emoji}
            type="button"
            onClick={() => pick(e.emoji)}
            title={e.name}
            aria-label={e.name}
            className="grid aspect-square place-items-center rounded-md text-xl leading-none hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {e.emoji}
          </button>
        ))}
        {shown.length === 0 && (
          <p className="col-span-8 py-6 text-center text-xs text-muted-foreground">No emoji match “{query}”.</p>
        )}
      </div>
    </div>
  )
}
