import { NextResponse } from "next/server";
import { Prisma, type PostStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { can, requireCan } from "@/lib/api-auth";

/**
 * The approval queue.
 *
 *   ?queue=mine|pending|client|approved|rejected|changes|scheduled   (default: pending)
 *   &page=1&pageSize=24&search=&projectId=&client=&assignedToId=
 *
 * Returns { items, total, page, pageSize, counts, canApprove }. Filtering, counting and
 * paging happen in the database. This used to load EVERY post in the system — with all
 * its assets and its client's phone and email — and filter it in the browser, and it
 * called prisma.$disconnect() on the shared client after every request.
 *
 * Visibility: approvals:read sees every project; anyone else sees projects they are
 * assigned to. "mine" is the posts waiting for THIS person's decision — pending posts on
 * projects they manage or belong to — and is empty without posts:approve.
 */

const QUEUES = ["mine", "pending", "client", "approved", "rejected", "changes", "scheduled"] as const;
type Queue = (typeof QUEUES)[number];

const PENDING: PostStatus[] = ["SUBMITTED", "RESUBMITTED"];

function queueWhere(queue: Queue, userId: number): Prisma.PostWhereInput {
  switch (queue) {
    case "mine":
      return {
        status: { in: PENDING },
        OR: [{ project: { managerId: userId } }, { project: { assignedUsers: { some: { id: userId } } } }],
      };
    case "pending":
      return { status: { in: PENDING } };
    case "client":
      return { status: "APPROVED", requiresClientApproval: true };
    case "approved":
      return { OR: [{ status: "APPROVED", requiresClientApproval: false }, { status: "C_APPROVED" }] };
    case "rejected":
      return { status: "REJECTED" };
    case "changes":
      return { status: "NEEDS_MINOR_CHANGE" };
    case "scheduled":
      return { status: "SCHEDULED" };
  }
}

const postInclude = {
  // Only the delivered creative (reference material is not what is being approved).
  assets: {
    where: { isReference: false },
    orderBy: [{ order: "asc" as const }, { isEdited: "desc" as const }, { createdAt: "desc" as const }],
  },
  project: {
    include: {
      client: { select: { id: true, name: true, company: true, avatar: true } },
      clientCompany: { select: { name: true, logo: true } },
      manager: { select: { id: true, name: true } },
    },
  },
  assignedTo: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
  approvalFlows: {
    where: { flowType: "DESIGN" },
    orderBy: { version: "desc" as const },
    take: 1,
    include: {
      submittedBy: { select: { id: true, name: true } },
      reviewedBy: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.PostInclude;

type PostWithQueueData = Prisma.PostGetPayload<{ include: typeof postInclude }>;

/** The ApprovalFlow-shaped row the approvals screen renders. */
const toApprovalRow = (post: PostWithQueueData) => {
  const latestFlow = post.approvalFlows[0];
  return {
    id: latestFlow?.id || `temp-flow-${post.id}`,
    flowType: "DESIGN",
    status: latestFlow?.status || post.status || "DRAFT",
    submittedAt: latestFlow?.submittedAt || post.createdAt,
    version: post.version,
    post: { ...post, approvalFlows: undefined },
    submittedBy: latestFlow?.submittedBy || post.createdBy,
    reviewedBy: latestFlow?.reviewedBy || null,
    assignedTo: latestFlow?.assignedTo || post.assignedTo,
  };
};

export async function GET(request: Request) {
  const auth = await requireCan("posts", "read");
  if (!auth.ok) return auth.response;
  const { session, userId } = auth;

  try {
    const params = new URL(request.url).searchParams;
    const queueParam = params.get("queue");
    const queue: Queue = QUEUES.includes(queueParam as Queue) ? (queueParam as Queue) : "pending";
    const page = Math.max(1, Number(params.get("page")) || 1);
    const pageSize = Math.min(60, Math.max(1, Number(params.get("pageSize")) || 24));
    const search = params.get("search")?.trim();
    const projectId = params.get("projectId") || undefined;
    const clientName = params.get("client")?.trim() || undefined;
    const assignedToId = Number(params.get("assignedToId")) || undefined;

    const [fullAccess, canApprove] = await Promise.all([
      can(session, "approvals", "read"),
      can(session, "posts", "approve"),
    ]);

    const scope: Prisma.PostWhereInput = fullAccess
      ? {}
      : { project: { assignedUsers: { some: { id: userId } } } };

    const filters: Prisma.PostWhereInput[] = [
      scope,
      ...(projectId ? [{ projectId }] : []),
      ...(assignedToId ? [{ OR: [{ assignedToId }, { assignedUsers: { some: { id: assignedToId } } }] }] : []),
      ...(clientName
        ? [{ OR: [{ project: { client: { name: clientName } } }, { project: { clientCompany: { name: clientName } } }] }]
        : []),
      ...(search
        ? [
            {
              OR: [
                { title: { contains: search } },
                { project: { name: { contains: search } } },
                { project: { client: { name: { contains: search } } } },
                { createdBy: { name: { contains: search } } },
              ],
            },
          ]
        : []),
    ];
    const whereFor = (q: Queue): Prisma.PostWhereInput =>
      q === "mine" && !canApprove ? { id: "__none__" } : { AND: [...filters, queueWhere(q, userId)] };

    const [items, total, ...countValues] = await Promise.all([
      prisma.post.findMany({
        where: whereFor(queue),
        include: postInclude,
        // Oldest submission first in the pending queues (first in, first reviewed);
        // most recent first everywhere else.
        orderBy: queue === "mine" || queue === "pending" ? { updatedAt: "asc" } : { updatedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.post.count({ where: whereFor(queue) }),
      ...QUEUES.map((q) => prisma.post.count({ where: whereFor(q) })),
    ]);

    const counts = Object.fromEntries(QUEUES.map((q, i) => [q, countValues[i]])) as Record<Queue, number>;

    // Legacy callers (no queue param) received a plain array; keep that shape for them.
    if (!queueParam) return NextResponse.json(items.map(toApprovalRow));

    return NextResponse.json({ items: items.map(toApprovalRow), total, page, pageSize, counts, canApprove });
  } catch (error) {
    console.error("Error fetching design approvals:", error);
    return NextResponse.json({ error: "Failed to load the approval queue" }, { status: 500 });
  }
}
