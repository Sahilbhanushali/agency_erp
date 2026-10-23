import { NextResponse, type NextRequest } from "next/server"
import { can, requireCan } from "@/lib/api-auth"
import { prisma } from "@/lib/prisma"
import { isOnline } from "@/lib/realtime/hub"
import { chatEligibleUserWhere } from "@/lib/chat/service"

/** People you can start a chat with or add to a group. */
export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const auth = await requireCan("chat", "read")
  if (!auth.ok) return auth.response

  const q = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 100)
  const users = await prisma.user.findMany({
    where: {
      ...chatEligibleUserWhere,
      id: { not: auth.userId },
      ...(q ? { OR: [{ name: { contains: q } }, { email: { contains: q } }] } : {}),
    },
    select: { id: true, name: true, avatar: true, role: { select: { name: true } } },
    orderBy: { name: "asc" },
    take: 50,
  })

  /**
   * Why somebody you expect is missing.
   *
   * "Nobody else can use chat" used to be the whole answer, which sent an administrator
   * looking for a broken feature when the real causes were in the data: people with no
   * role, a role whose chat boxes were never saved, a deactivated account. Only
   * people who administer users see the breakdown — names and roles of colleagues
   * without access are theirs to know, not everyone's.
   */
  let unavailable: null | {
    deactivated: number
    noRole: { count: number; names: string[] }
    rolesWithoutChat: { role: string; count: number }[]
  } = null

  if (!q && (await can(auth.session, "users", "read"))) {
    const others = await prisma.user.findMany({
      where: { id: { not: auth.userId }, NOT: chatEligibleUserWhere },
      select: { name: true, isActive: true, role: { select: { name: true } } },
      orderBy: { name: "asc" },
    })
    const byRole = new Map<string, number>()
    for (const u of others) {
      if (u.isActive && u.role) byRole.set(u.role.name, (byRole.get(u.role.name) ?? 0) + 1)
    }
    const noRole = others.filter((u) => u.isActive && !u.role)
    unavailable = {
      deactivated: others.filter((u) => !u.isActive).length,
      noRole: { count: noRole.length, names: noRole.slice(0, 6).map((u) => u.name) },
      rolesWithoutChat: [...byRole.entries()].map(([role, count]) => ({ role, count })),
    }
  }

  return NextResponse.json({
    users: users.map((u) => ({ id: u.id, name: u.name, avatar: u.avatar, role: u.role?.name ?? null, online: isOnline(u.id) })),
    unavailable,
  })
}
