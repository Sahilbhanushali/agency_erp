import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { contentScope, requireCan } from "@/lib/api-auth";

export async function GET() {
  const auth = await requireCan("calendar", "read");
  if (!auth.ok) return auth.response;
  const session = auth.session as any;

  // Validate user ID
  const userId = session.user.id ? parseInt(session.user.id) : null;
  if (!userId || isNaN(userId)) {
    return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
  }

  // Who sees the whole calendar vs only their own work. posts:create is the set that
  // plans content for every client, which is exactly who the old role-name list named.
  const isFullAccess = (await contentScope(session)) === "all";

  let whereClause: any = {};
  if (!isFullAccess) {
    whereClause = {
      OR: [
        { assignedToId: userId },
        { assignedUsers: { some: { id: userId } } },
        { assignments: { some: { userId: userId } } },
        // A client login sees its own projects' posts and nothing else.
        { project: { client: { email: session.user.email ?? "" } } },
      ],
    };
  }

  /**
   * Explicit selects, not `include`. This used to `include: { createdBy: true }`,
   * which put every author's bcrypt hash in the JSON the browser receives, and
   * `client: true`, which added GSTIN, PAN, address and private notes. The calendar
   * renders a name, a company and a thumbnail — that is all it is given.
   */
  const postsRaw = await prisma.post.findMany({
    where: {
      AND: [
        Object.keys(whereClause).length > 0 ? whereClause : {},
        { project: { isActive: true } },
        {
          OR: [
            { scheduledAt: { not: null } },
            { designDueDate: { not: null } },
          ],
        },
      ],
    },
    select: {
      id: true,
      title: true,
      type: true,
      status: true,
      scheduledAt: true,
      designDueDate: true,
      projectId: true,
      project: {
        select: {
          id: true,
          name: true,
          client: {
            select: { id: true, name: true, email: true, company: true, avatar: true },
          },
        },
      },
      createdBy: { select: { id: true, name: true, email: true } },
      platforms: { select: { id: true, platform: true, postId: true } },
      // One thumbnail per entry; the count drives the "+N" chip on a carousel.
      assets: {
        select: { id: true, url: true, type: true, filename: true },
        orderBy: { order: "asc" },
        take: 1,
      },
      _count: { select: { assets: true } },
    },
    orderBy: { scheduledAt: "asc" },
  });

  const posts = postsRaw.map(({ _count, createdBy, ...post }) => ({
    ...post,
    scheduledAt: post.scheduledAt ? post.scheduledAt.toISOString() : null,
    designDueDate: post.designDueDate ? post.designDueDate.toISOString() : null,
    assetCount: _count.assets,
    createdBy: createdBy
      ? { ...createdBy, id: String(createdBy.id), name: createdBy.name ?? "" }
      : null,
    project: post.project
      ? {
          ...post.project,
          client: post.project.client
            ? { ...post.project.client, name: post.project.client.name ?? "" }
            : null,
        }
      : null,
  }));

  // The calendar's project filter was unscoped, so a client login was handed the name
  // and contact details of every other client's projects. It follows the same scope as
  // the posts above.
  const projectsRaw = await prisma.project.findMany({
    where: isFullAccess
      ? { isActive: true }
      : {
          isActive: true,
          OR: [
            { assignedUsers: { some: { id: userId } } },
            { managerId: userId },
            { client: { email: session.user.email ?? "" } },
          ],
        },
    select: {
      id: true,
      name: true,
      isActive: true,
      client: { select: { id: true, name: true, email: true, company: true } },
    },
    orderBy: { name: "asc" },
  });

  const projects = projectsRaw.map((project) => ({
    ...project,
    client: project.client
      ? { ...project.client, name: project.client.name ?? "" }
      : null,
  }));

  // Whoever sees every post sees the posting-date calendar; someone scoped to their
  // own work gets design dates, which is what they act on.
  const currentUser = {
    id: session.user.id ?? "",
    email: session.user.email ?? "",
    role: session.user.role as any,
    name: session.user.name ?? "",
    showPostingCalendar: isFullAccess,
  };

  return NextResponse.json({ posts, projects, currentUser });
}
