"use client"

import useSWR from "swr"
import { useLiveRefresh } from "@/hooks/use-live-refresh"

const MAX_POSTS = 200

const fetcher = async (url: string): Promise<Record<string, number>> => {
  const res = await fetch(url)
  if (!res.ok) throw new Error("Could not load unread discussions")
  return ((await res.json()) as { counts: Record<string, number> }).counts
}

/** Unread approval-discussion messages for these posts, keyed by post id. */
export function useDiscussionUnread(postIds: string[]): Record<string, number> {
  // shortcut: counts the first 200 posts on screen, the endpoint's cap; page the request if a list ever shows more.
  const ids = [...new Set(postIds)].slice(0, MAX_POSTS).sort()
  const key = ids.length ? `/api/posts/discussions/unread?postIds=${encodeURIComponent(ids.join(","))}` : null
  const { data, mutate } = useSWR(key, fetcher, { refreshInterval: 30_000, revalidateOnFocus: true })
  useLiveRefresh(() => mutate(), ["ChatMessage", "ConversationMember"])
  return data ?? {}
}
