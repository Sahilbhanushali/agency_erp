import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma"; // Assume prisma client is set up
import { NextResponse } from "next/server";
import { requireCan } from "@/lib/api-auth";

export async function GET() {
    const auth = await requireCan("posts", "read");
    if (!auth.ok) return auth.response;
    const session = auth.session as any;
  const userId = parseInt(session.user.id as string);
  const today = new Date();
  const currentMonth = today.getMonth() + 1; // 1-12
  const currentYear = today.getFullYear();

  try {
    // Fetch projects assigned to the user
    const projects = await prisma.project.findMany({
      where: {
        assignedUsers: {
          some: {
            id: userId,
          },
        },
      },
      include: {
        client: true,
        posts: {
          include: {
            assets: true,
            platforms: true,
            assignedTo: true,
            comments: true,
          },
        },
        strategies: {
          where: {
            month: currentMonth,
            year: currentYear,
          },
        },
      },
    });

    // Map to ProjectGroup format
    const projectGroups = projects.map((project: any) => {
      // Calculate stats for current month
      const currentStrategy = project.strategies[0] || { postTypes: {}, total: 0 };
      const requiredByType = currentStrategy.postTypes || {};
      const requiredTotal = currentStrategy.total || 0;

      // Count created posts by type for the current month
      const createdByType: Record<string, number> = {};
      const currentMonthPosts = project.posts.filter((post: any) => {
        if (!post.scheduledAt) return false;
        const scheduledDate = new Date(post.scheduledAt);
        return scheduledDate.getMonth() + 1 === currentMonth && scheduledDate.getFullYear() === currentYear;
      });

      currentMonthPosts.forEach((post: any) => {
        createdByType[post.type] = (createdByType[post.type] || 0) + 1;
      });

      const createdTotal = currentMonthPosts.length;

      // Calculate remaining posts by type
      const leftByType: Record<string, number> = {};
      Object.entries(requiredByType).forEach(([type, required]: [string, any]) => {
        const created = createdByType[type] || 0;
        leftByType[type] = Math.max(0, required - created);
      });

      const leftTotal = requiredTotal - createdTotal;

      return {
        projectId: project.id,
        projectName: project.name,
        clientName: project.client.name,
        tasks: project.posts.map((post: any) => ({
          id: post.id,
          title: post.title,
          caption: post.caption,
          type: post.type,
          status: post.status,
          contentStatus: post.contentStatus,
          scheduledAt: post.scheduledAt?.toISOString(),
          createdAt: post.createdAt.toISOString(),
          updatedAt: post.updatedAt.toISOString(),
          Comments: post.comments,
          project: {
            id: project.id,
            name: project.name,
            client: {
              name: project.client.name,
            },
          },
          assets: post.assets.map((asset: any) => ({
            id: asset.id,
            filename: asset.filename,
            url: asset.url,
            createdAt: asset.createdAt?.toISOString(),
          })),
          platforms: post.platforms.map((platform: any) => ({
            id: platform.id,
            platform: platform.platform,
          })),
          assignedToId: post.assignedToId,
          assignedTo: post.assignedTo
            ? {
                name: post.assignedTo.name,
                email: post.assignedTo.email,
              }
            : undefined,
          feedback: post.notes, // Adjust if feedback is separate
          priority: undefined, // Add if available
        })),
        strategies: project.strategies.map((strategy: any) => ({
          id: strategy.id,
          month: strategy.month,
          year: strategy.year,
          postTypes: strategy.postTypes,
          total: strategy.total,
        })),
        stats: {
          total: project.posts.length,
          draft: project.posts.filter((post: any) => ["DRAFT", "REJECTED"].includes(post.status)).length,
          pending: project.posts.filter((post: any) => ["SUBMITTED", "RESUBMITTED"].includes(post.status)).length,
          approved: project.posts.filter((post: any) => ["APPROVED", "SCHEDULED", "POSTED"].includes(post.status)).length,
          overdue: project.posts.filter((post: any) => {
            let contentDueDate = post.designDueDate ? new Date(post.designDueDate) : null;
            if (!contentDueDate && post.scheduledAt) {
              contentDueDate = new Date(post.scheduledAt);
              contentDueDate.setDate(contentDueDate.getDate() - 14);
            }
            if (!contentDueDate) return false;
            return contentDueDate < today && ["DRAFT", "REJECTED"].includes(post.status);
          }).length,
          thisWeek: project.posts.filter((post: any) => {
            let contentDueDate = post.designDueDate ? new Date(post.designDueDate) : null;
            if (!contentDueDate && post.scheduledAt) {
              contentDueDate = new Date(post.scheduledAt);
              contentDueDate.setDate(contentDueDate.getDate() - 14);
            }
            if (!contentDueDate) return false;
            const weekFromNow = new Date(today);
            weekFromNow.setDate(today.getDate() + 7);
            return contentDueDate >= today && contentDueDate <= weekFromNow;
          }).length,
          current: {
            required: requiredTotal,
            created: createdTotal,
            left: Math.max(0, leftTotal),
            requiredByType,
            createdByType,
            leftByType,
          },
          next: {
            required: 0,
            created: 0,
            left: 0,
            requiredByType: {},
            createdByType: {},
            leftByType: {},
          },
          future: {
            required: 0,
            created: 0,
            left: 0,
            requiredByType: {},
            createdByType: {},
            leftByType: {},
          },
          unscheduled: project.posts.filter((post: any) => !post.scheduledAt).length,
        },
      };
    });

    return NextResponse.json(projectGroups);
  } catch (error) {
    console.error("Error fetching content tasks:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}