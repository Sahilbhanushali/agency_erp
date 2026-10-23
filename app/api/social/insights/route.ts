import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { requireCan } from "@/lib/api-auth"
import { prisma } from "@/lib/prisma"

/**
 * Everything the Instagram insights screen renders, in one request.
 *
 * Reads our own tables, never Meta — the sync job owns that. So this stays fast, works
 * when Instagram is down, and cannot exhaust the account's Graph API rate limit no
 * matter how often somebody reloads the page.
 */
export const dynamic = "force-dynamic"

const querySchema = z.object({
  accountId: z.string().min(1).optional(),
  days: z.coerce.number().int().min(7).max(90).default(30),
})

/** Midnight UTC, n days back. Matches how the sync job keys a day. */
function utcDaysAgo(n: number): Date {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  d.setUTCDate(d.getUTCDate() - n)
  return d
}

const sum = (rows: { [k: string]: any }[], key: string) =>
  rows.reduce((total, row) => total + (row[key] ?? 0), 0)

export async function GET(request: NextRequest) {
  const auth = await requireCan("social_accounts", "read")
  if (!auth.ok) return auth.response

  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 })
  }
  const { days } = parsed.data

  const accounts = await prisma.socialAccount.findMany({
    where: { platform: "INSTAGRAM" },
    select: {
      id: true,
      username: true,
      profilePictureUrl: true,
      status: true,
      lastSyncedAt: true,
      client: { select: { id: true, name: true, company: true } },
    },
    orderBy: { username: "asc" },
  })

  if (accounts.length === 0) {
    return NextResponse.json({ accounts: [], account: null, series: [], totals: null, topMedia: [] })
  }

  // Default to the first account rather than erroring on a missing parameter.
  const account = accounts.find((a) => a.id === parsed.data.accountId) ?? accounts[0]

  // Two windows: the one being shown, and the one before it, for the change figures.
  const windowStart = utcDaysAgo(days - 1)
  const priorStart = utcDaysAgo(days * 2 - 1)

  const [rows, topMedia] = await Promise.all([
    prisma.instagramAccountInsight.findMany({
      where: { socialAccountId: account.id, date: { gte: priorStart } },
      select: {
        date: true,
        reach: true,
        views: true,
        totalInteractions: true,
        accountsEngaged: true,
        likes: true,
        comments: true,
        shares: true,
        saves: true,
        followersCount: true,
      },
      orderBy: { date: "asc" },
    }),
    prisma.instagramMediaInsight.findMany({
      where: { socialAccountId: account.id, publishedAt: { gte: windowStart } },
      select: {
        id: true,
        mediaId: true,
        postId: true,
        mediaType: true,
        permalink: true,
        caption: true,
        thumbnailUrl: true,
        publishedAt: true,
        reach: true,
        views: true,
        likes: true,
        comments: true,
        shares: true,
        saved: true,
        totalInteractions: true,
        avgWatchTimeMs: true,
      },
      // Bounded: this is a leaderboard, not a paged archive.
      orderBy: [{ reach: "desc" }, { publishedAt: "desc" }],
      take: 10,
    }),
  ])

  const current = rows.filter((r) => r.date >= windowStart)
  const prior = rows.filter((r) => r.date < windowStart)

  // The most recent non-null reading, not the last row — the sync only writes a
  // follower count on the day it ran.
  const followersNow = [...current].reverse().find((r) => r.followersCount !== null)?.followersCount ?? null
  const followersThen = [...prior].reverse().find((r) => r.followersCount !== null)?.followersCount ?? null

  const totalsFor = (set: typeof current) => ({
    reach: sum(set, "reach"),
    views: sum(set, "views"),
    interactions: sum(set, "totalInteractions"),
    accountsEngaged: sum(set, "accountsEngaged"),
    likes: sum(set, "likes"),
    comments: sum(set, "comments"),
    shares: sum(set, "shares"),
    saves: sum(set, "saves"),
  })

  return NextResponse.json({
    accounts: accounts.map((a) => ({
      id: a.id,
      username: a.username,
      status: a.status,
      client: a.client?.company || a.client?.name || null,
    })),
    account: {
      id: account.id,
      username: account.username,
      profilePictureUrl: account.profilePictureUrl,
      status: account.status,
      lastSyncedAt: account.lastSyncedAt,
      client: account.client?.company || account.client?.name || null,
    },
    days,
    series: current.map((r) => ({
      date: r.date,
      reach: r.reach,
      views: r.views,
      interactions: r.totalInteractions,
    })),
    totals: {
      current: totalsFor(current),
      previous: totalsFor(prior),
      followers: followersNow,
      followersChange:
        followersNow !== null && followersThen !== null ? followersNow - followersThen : null,
      /** How many days actually hold data, so the UI can say "no data yet" honestly. */
      daysWithData: current.length,
    },
    topMedia,
  })
}
