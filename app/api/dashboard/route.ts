// app/api/dashboard/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { contentScope } from "@/lib/api-auth";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = parseInt(session.user.id as string, 10);

  // Scope follows the permission, not the role name. Without posts:read a caller sees
  // only what they are attached to — work assigned to them, or projects belonging to
  // the client they are. That covers designers and client logins in one branch, and a
  // role created tomorrow is scoped correctly without editing this file.
  const scope = await contentScope(session);
  const ownPostFilter = {
    OR: [
      { assignedToId: userId },
      { assignedUsers: { some: { id: userId } } },
      { project: { client: { email: session.user.email ?? "" } } },
    ],
  };
  const ownProjectFilter = {
    OR: [
      { assignedUsers: { some: { id: userId } } },
      { client: { email: session.user.email ?? "" } },
    ],
  };

  // Parse query params
  const { searchParams } = new URL(request.url);
  const postType = searchParams.get('type') || 'all';

  // Build where clause based on user role
  let whereClause: any = {
    project: { isActive: true }
  };

  if (scope === "own") {
    whereClause = { AND: [{ project: { isActive: true } }, ownPostFilter] };
  }

  // Add type filter if specified
  const baseWhere = { ...whereClause };
  if (postType !== 'all') {
    baseWhere.type = postType;
  }

  // Build project queries (unchanged, as they are not type-specific)
  let activeProjectsQuery: any = { isActive: true };
  let totalProjectsQuery: any = {};
  if (scope === "own") {
    activeProjectsQuery = { AND: [ownProjectFilter], isActive: true };
    totalProjectsQuery = { AND: [ownProjectFilter] };
  }

  try {
    // Fetch all posts for monthly breakdown calculations, filtered by baseWhere
    const allPosts = await prisma.post.findMany({
      where: baseWhere,
      select: {
        id: true,
        status: true,
        contentStatus: true,
        designerHeadApproval: true,
        createdAt: true,
        scheduledAt: true,
        scheduledFor: true,
        type: true, // Ensure type is selected if needed
      },
    });

    // Fetch Project Strategies to get the target post counts
    let projectStrategyWhere: any = {};
    projectStrategyWhere =
      scope === "all"
        ? { project: { isActive: true } }
        : { project: { AND: [ownProjectFilter], isActive: true } };

    const strategies = await prisma.projectStrategy.findMany({
      where: projectStrategyWhere,
    });

    // Calculate monthly breakdown with detailed stats, filtered by type
    const monthlyBreakdown: Record<string, any> = {};

    strategies.forEach((strategy: any) => {
      const monthKey = `${strategy.year}-${String(strategy.month).padStart(2, '0')}`;
      if (!monthlyBreakdown[monthKey]) {
        monthlyBreakdown[monthKey] = {
          total: 0,
          approved: 0,
          rejected: 0,
          pending: 0,
          scheduled: 0,
          posted: 0,
          contentWritten: 0,
          contentApproved: 0,
          contentPending: 0,
          contentRejected: 0,
          contentResubmitted: 0,
          designAssigned: 0,
          designSubmitted: 0,
          designApproved: 0,
          designPending: 0,
          designRejected: 0,
        };
      }
      
      let typeTotal = Number(strategy.total || 0);
      if (postType !== 'all') {
        typeTotal = Number((strategy.postTypes as Record<string, number>)?.[postType] || 0);
      }
      monthlyBreakdown[monthKey].total += typeTotal;
    });

    let totalStrategyCount = 0;
    Object.values(monthlyBreakdown).forEach((m: any) => {
      totalStrategyCount += m.total;
    });

    allPosts.forEach((post: any) => {
      const dateToUse = post.scheduledAt || post.scheduledFor || post.createdAt;
      const date = new Date(dateToUse);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthlyBreakdown[monthKey]) {
        monthlyBreakdown[monthKey] = {
          total: 0,
          totalPosts: 0,
          approved: 0,
          rejected: 0,
          pending: 0,
          scheduled: 0,
          posted: 0,
          contentWritten: 0,
          contentApproved: 0,
          contentPending: 0,
          contentRejected: 0,
          contentResubmitted: 0,
          designAssigned: 0,
          designSubmitted: 0,
          designApproved: 0,
          designPending: 0,
          designRejected: 0,
        };
      }

      monthlyBreakdown[monthKey].totalPosts++;

      // Track post status for general stats
      switch (post.status) {
        case 'APPROVED':
          monthlyBreakdown[monthKey].approved++;
          break;
        case 'REJECTED':
          monthlyBreakdown[monthKey].rejected++;
          break;
        case 'SCHEDULED':
          monthlyBreakdown[monthKey].scheduled++;
          break;
        case 'POSTED':
          monthlyBreakdown[monthKey].posted++;
          break;
        case 'SUBMITTED':
          monthlyBreakdown[monthKey].pending++;
          break;
        case 'RESUBMITTED':
          monthlyBreakdown[monthKey].pending++;
          break;
        case 'DRAFT':
          monthlyBreakdown[monthKey].pending++;
          break;
      }

      // Track content status
      switch (post.contentStatus) {
        case 'SUBMITTED':
        case 'PENDING_REVIEW':
          monthlyBreakdown[monthKey].contentWritten++;
          monthlyBreakdown[monthKey].contentPending++;
          break;
        case 'APPROVED':
          monthlyBreakdown[monthKey].contentWritten++;
          monthlyBreakdown[monthKey].contentApproved++;
          break;
        case 'REJECTED':
          monthlyBreakdown[monthKey].contentWritten++;
          monthlyBreakdown[monthKey].contentRejected++;
          break;
        case 'RESUBMITTED':
          monthlyBreakdown[monthKey].contentWritten++;
          monthlyBreakdown[monthKey].contentResubmitted++;
          break;
        case 'NEEDS_REVISION':
          monthlyBreakdown[monthKey].contentWritten++;
          break;
      }

      // Track design stats if content is approved
      if (post.contentStatus === 'APPROVED') {
        monthlyBreakdown[monthKey].designAssigned++;
        switch (post.status) {
          case 'SUBMITTED':
          case 'RESUBMITTED':
            monthlyBreakdown[monthKey].designSubmitted++;
            monthlyBreakdown[monthKey].designPending++;
            break;
          case 'APPROVED':
          case 'SCHEDULED':
          case 'POSTED':
            monthlyBreakdown[monthKey].designSubmitted++;
            monthlyBreakdown[monthKey].designApproved++;
            break;
          case 'DRAFT':
            // Assigned but not submitted yet
            break;
        }
      }

      // Design rejected should match general rejected as per requirement
      if (post.status === 'REJECTED') {
        monthlyBreakdown[monthKey].designRejected++;
      }
    });

    // We already calculated totalStrategyCount above

    // Calculate Strategy & Content Stats, filtered by baseWhere
    const contentWritten = await prisma.post.count({
      where: {
        ...baseWhere,
        contentStatus: { in: ["SUBMITTED", "APPROVED", "NEEDS_REVISION", "RESUBMITTED", "PENDING_REVIEW", "NEEDS_MINOR_CHANGE"] },
      },
    });

    const contentApproved = await prisma.post.count({
      where: {
        ...baseWhere,
        contentStatus: "APPROVED",
      },
    });

    const contentPending = await prisma.post.count({
      where: {
        ...baseWhere,
        contentStatus: { in: ["SUBMITTED", "PENDING_REVIEW"] },
      },
    });

    const contentRejected = await prisma.post.count({
      where: {
        ...baseWhere,
        contentStatus: "REJECTED",
      },
    });

    const contentResubmitted = await prisma.post.count({
      where: {
        ...baseWhere,
        contentStatus: "RESUBMITTED",
      },
    });

    // Calculate Design Stats, filtered by baseWhere
    const designAssigned = await prisma.post.count({
      where: {
        ...baseWhere,
        contentStatus: "APPROVED",
      },
    });

    const designSubmitted = await prisma.post.count({
      where: {
        ...baseWhere,
        contentStatus: "APPROVED",
        status: { in: ["SUBMITTED", "RESUBMITTED", "APPROVED", "REJECTED", "SCHEDULED", "POSTED"] },
      },
    });

    const designApproved = await prisma.post.count({
      where: {
        ...baseWhere,
        contentStatus: "APPROVED",
        status: { in: ["APPROVED", "SCHEDULED", "POSTED"] },
      },
    });

    const designPending = await prisma.post.count({
      where: {
        ...baseWhere,
        contentStatus: "APPROVED",
        status: { in: ["SUBMITTED", "RESUBMITTED"] },
      },
    });

    const designRejected = await prisma.post.count({
      where: {
        ...baseWhere,
        status: "REJECTED",
      },
    });

    // Calculate Posting Stats, filtered by baseWhere
    const posted = await prisma.post.count({
      where: {
        ...baseWhere,
        status: "POSTED",
      },
    });

    const scheduled = await prisma.post.count({
      where: {
        ...baseWhere,
        status: "SCHEDULED",
      },
    });

    const readyToSchedule = await prisma.post.count({
      where: {
        ...baseWhere,
        status: "APPROVED",
      },
    });

    // Fetch existing dashboard data, filtered by baseWhere
    const [
      totalPosts,
      pendingPosts,
      approvedPosts,
      rejectedPosts,
      recentPosts,
      scheduledPosts,
      postedThisWeek,
      postedLastWeek,
      activeProjects,
      totalProjects,
    ] = await Promise.all([
      prisma.post.count({ where: baseWhere }),
      prisma.post.count({
        where: {
          ...baseWhere,
          status: { in: ["DRAFT", "SUBMITTED", "REJECTED", "SCHEDULED"] },
        },
      }),
      prisma.post.count({ where: { ...baseWhere, status: { in: ["APPROVED", "POSTED"] } } }),
      prisma.post.count({ where: { ...baseWhere, status: "REJECTED" } }),
      prisma.post.findMany({
        where: baseWhere,
        include: {
          project: { 
            include: { client: true } 
          },
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
            }
          },
          platforms: {
            select: {
              platform: true,
            }
          },
          assets: {
            select: {
              id: true,
              isReference: true,
              createdAt: true,
            }
          },
        },
        orderBy: { updatedAt: "desc" },
        take: 50, // Increased to allow client-side filtering
      }),
      prisma.post.count({ where: { ...baseWhere, status: "SCHEDULED" } }),
      prisma.post.count({
        where: {
          ...baseWhere,
          status: "POSTED",
          postedAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      }),
      prisma.post.count({
        where: {
          ...baseWhere,
          status: "POSTED",
          postedAt: {
            gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
            lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      }),
      prisma.project.count({ where: activeProjectsQuery }),
      prisma.project.count({ where: totalProjectsQuery }),
    ]);

    const formattedRecentPosts = recentPosts.map((post: any) => ({
      id: post.id,
      title: post.title,
      status: post.status,
      type: post.type,
      platforms: post.platforms.map((p: any) => p.platform),
      updatedAt: post.updatedAt,
      createdAt: post.createdAt,
      scheduledAt: post.scheduledAt,
      scheduledFor: post.scheduledFor,
      assets: post.assets || [],
      project: {
        client: {
          name: post.project.client?.name || "No Client",
        },
      },
      createdBy: {
        name: post.createdBy?.name || "Deleted User",
      },
    }));

    const dashboardData = {
      totalPosts,
      pendingPosts,
      approvedPosts,
      rejectedPosts,
      recentPosts: formattedRecentPosts,
      scheduledPosts,
      postedThisWeek,
      activeProjects,
      postedLastWeek,
      totalProjects,
      monthlyBreakdown,
      strategyStats: {
        totalStrategy: totalPosts, // Changed from totalStrategyCount to use actual total posts
        contentWritten,
        contentApproved,
        contentPending,
        contentRejected,
        contentResubmitted,
      },
      
      designStats: {
        designAssigned,
        designSubmitted,
        designApproved,
        designPending,
        designRejected,
      },
      
      postingStats: {
        posted,
        scheduled,
        readyToSchedule,
      },
    };

    return NextResponse.json(dashboardData);
  } catch (error) {
    // Never answer a failure with zeros and a 200: that is indistinguishable from
    // "this account has no data" and hid real failures behind an empty dashboard.
    console.error("Dashboard data fetch error:", error);
    return NextResponse.json({ error: "Could not load dashboard data" }, { status: 500 });
  }
}
