import { PrismaClient } from '@prisma/client';
import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth"; // Adjust path to your auth options
import { can, requireCan } from "@/lib/api-auth";

const prisma = new PrismaClient();

export async function GET(request: Request) {
  try {
    const auth = await requireCan("posts", "read");
    if (!auth.ok) return auth.response;
    const session = auth.session as any;

    // Check if user is authenticated
    if (!session || !session.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized: User not logged in' },
        { status: 401 }
      );
    }

    const userId = session.user.id; // Get user ID from session (string)

    // Validate and parse userId
    const parsedUserId = parseInt(userId);
    if (isNaN(parsedUserId)) {
      return NextResponse.json(
        { error: 'Invalid user ID' },
        { status: 400 }
      );
    }

    // Fetch user role to check if ADMIN
    const user = await prisma.user.findUnique({
      where: { id: parsedUserId },
      select: { role: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId'); // Optional projectId filter

    // approvals:read decides whether this caller sees every project's approvals or
    // only their own. The previous list of role names left out any role created after
    // it was written, which silently restricted them with no way to grant access.
    const isFullAccessRole = await can(session, "approvals", "read");

    let projectIds: string[] = [];
    if (!isFullAccessRole) {
      // Fetch projects assigned to the user for non-full access users
      const assignedProjects = await prisma.project.findMany({
        where: {
          assignedUsers: {
            some: {
              id: parsedUserId,
            },
          },
          ...(projectId ? { id: projectId } : {}),
        },
        select: {
          id: true,
        },
      });

      projectIds = assignedProjects.map((project) => project.id);

      if (projectIds.length === 0 && !projectId) {
        return NextResponse.json([], { status: 200 });
      }
    }

    // Fetch all posts (remove the notIn filter so approved, rejected, etc. are all visible)
    const posts = await prisma.post.findMany({
      where: {
        ...(projectId
          ? { projectId: projectId }
          : !isFullAccessRole && projectIds.length > 0
          ? { projectId: { in: projectIds } }
          : {}),
      },
      include: {
        assets: {
          where: {
            isReference: false,
          },
          orderBy: [
            { order: 'asc' },
            { isEdited: 'desc' },
            { createdAt: 'desc' }
          ],
        },
        project: {
          include: {
            client: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                company: true,
                avatar: true,
              },
            },
          },
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
        approvalFlows: {
          where: {
            flowType: 'DESIGN',
          },
          orderBy: {
            version: 'desc',
          },
          take: 1,
          include: {
            submittedBy: {
              select: {
                id: true,
                name: true,
              },
            },
            reviewedBy: {
              select: {
                id: true,
                name: true,
              },
            },
            assignedTo: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Map posts to the expected ApprovalFlow structure
    const latestDesigns = posts.map((post) => {
      const latestFlow = post.approvalFlows[0];
      return {
        id: latestFlow?.id || `temp-flow-${post.id}`,
        flowType: 'DESIGN',
        status: latestFlow?.status || post.status || 'DRAFT',
        submittedAt: latestFlow?.submittedAt || post.createdAt,
        version: latestFlow?.version || 1,
        post: {
          ...post,
          approvalFlows: undefined, // remove to avoid circular structure or conflicts
        },
        submittedBy: latestFlow?.submittedBy || post.createdBy,
        reviewedBy: latestFlow?.reviewedBy || null,
        assignedTo: latestFlow?.assignedTo || post.assignedTo,
      };
    });

    return NextResponse.json(latestDesigns, { status: 200 });
  } catch (error) {
    console.error('Error fetching design approvals:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pending design approvals' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
