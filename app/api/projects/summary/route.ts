import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { startOfMonth, endOfMonth } from 'date-fns';

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions) as any;

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = Number(session.user.id);
  
    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      include: { role: { select: { name: true } } },
    });
    const userRole = dbUser?.role?.name || '';
    const isAdminOrManager = ['ADMIN', 'Manager', 'Social Media Manager'].includes(userRole);

    const url = new URL(request.url);
    const filter = url.searchParams.get('filter') || 'all';

    const now = new Date();
    const currentMonth = now.getMonth() + 1; // 1-12
    const currentYear = now.getFullYear();

    let targetYear = currentYear;
    let targetMonth = currentMonth;
    let isSpecificMonth = false;

    if (filter !== 'all') {
      if (filter === 'current') {
        isSpecificMonth = true;
      } else {
        const [y, m] = filter.split('-');
        if (y && m) {
          targetYear = parseInt(y, 10);
          targetMonth = parseInt(m, 10);
          isSpecificMonth = true;
        }
      }
    }

    const monthStart = new Date(targetYear, targetMonth - 1, 1);
    const monthEnd = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999);

    const strategyWhere = isSpecificMonth 
      ? { year: targetYear, month: targetMonth }
      : {
          OR: [
            { year: { lt: currentYear } },
            { year: currentYear, month: { lte: currentMonth } }
          ]
        };

    const postsWhere: any = {};
    const postsAndConditions: any[] = [];

    if (isSpecificMonth) {
      postsAndConditions.push({
        OR: [
          { scheduledAt: { gte: monthStart, lte: monthEnd } },
          { scheduledAt: null, designDueDate: { gte: monthStart, lte: monthEnd } },
          { scheduledAt: null, designDueDate: null, createdAt: { gte: monthStart, lte: monthEnd } }
        ]
      });
    }

    if (!isAdminOrManager) {
      postsAndConditions.push({
        OR: [
          { assignedToId: userId },
          { assignedUsers: { some: { id: userId } } }
        ]
      });
    }

    if (postsAndConditions.length > 0) {
      postsWhere.AND = postsAndConditions;
    }

    const projectWhere: any = isAdminOrManager
      ? { isActive: true }
      : {
          AND: [
            { isActive: true },
            {
              OR: [
                { assignedUsers: { some: { id: userId } } },
                { posts: { some: { assignedToId: userId } } },
                { posts: { some: { assignedUsers: { some: { id: userId } } } } }
              ]
            }
          ]
        };

    // Fetch active projects with their strategies and posts
    const projects = await prisma.project.findMany({
      where: projectWhere,
      include: {
        client: true,
        strategies: {
          where: strategyWhere
        },
        posts: {
          where: postsWhere
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const summary = projects.map((project: any, index: number) => {
      // Calculate target
      const target = project.strategies.length > 0 ? project.strategies.reduce((sum: number, strategy: any) => sum + (strategy.total || 0), 0) : 0;

      // Calculate post counts by status
      let posted = 0;
      let approved = 0;
      let c_approved = 0;
      let review = 0;
      let draft = 0;

      project.posts.forEach((post: any) => {
        if (post.status === "POSTED" || post.status === "SCHEDULED") {
          posted++;
        } else if (post.status === "APPROVED") {
          approved++;
        } else if (post.status === "C_APPROVED") {
          c_approved++;
        } else if (post.status === "SUBMITTED" || post.status === "RESUBMITTED" || post.status === "NEEDS_MINOR_CHANGE") {
          review++;
        } else if (post.status === "DRAFT" || post.status === "REJECTED") {
          draft++;
        }
      });

      const postsCreated = project.posts.length;
      const remaining = target > postsCreated ? target - postsCreated : 0;

      return {
        id: project.id,
        indexNo: index + 1,
        projectName: project.name,
        clientName: project.client?.company || project.client?.name || "No Client",
        image: project.image,
        target,
        postsCreated,
        posted,
        approved,
        c_approved,
        review,
        draft,
        remaining,
      };
    });

    return NextResponse.json(summary);
  } catch (error) {
    console.error('Error fetching project summary:', error);
    return NextResponse.json(
      { error: 'Failed to fetch project summary' },
      { status: 500 }
    );
  }
}
