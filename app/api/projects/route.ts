import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import fs from "fs/promises";
import path from "path";
import { can, requireCan } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

function generateStrategiesData(
  startDate: Date,
  postTypes: Record<string, number>,
  projectId: number
): Array<{ month: number; year: number; postTypes: Record<string, number>; total: number; projectId: number }> {
  const start = new Date(startDate);
  const startMonth = start.getMonth() + 1; // JS months are 0-based
  const startYear = start.getFullYear();
  const total = Object.values(postTypes).reduce((a: number, b: number) => a + b, 0);

  const strategiesData: Array<{ month: number; year: number; postTypes: Record<string, number>; total: number; projectId: number }> = [];

  // Generate for 50 years starting from startMonth/year
  let currentYear = startYear;
  let currentMonth = startMonth;

  while (currentYear < startYear + 50 || (currentYear === startYear + 50 && currentMonth <= startMonth)) {
    strategiesData.push({
      month: currentMonth,
      year: currentYear,
      postTypes,
      total,
      projectId,
    });

    currentMonth++;
    if (currentMonth > 12) {
      currentMonth = 1;
      currentYear++;
    }
  }

  return strategiesData;
}
export async function GET(request: NextRequest) {
  try {
    const auth = await requireCan("projects", "read");
    if (!auth.ok) return auth.response;
    const session = auth.session;
    const user = await prisma.user.findUnique({
      where: { id: parseInt(session.user.id) },
      select: { role: { select: { name: true } } },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // projects:read means "every project"; without it a caller sees only their own.
    const isAdminOrManager = await can(session, "projects", "read");

    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get("userId");
    const monthParam = searchParams.get("month");
    const yearParam = searchParams.get("year");

    // Get current month and year
    const now = new Date();
    const currentMonth = monthParam ? parseInt(monthParam) : now.getMonth() + 1; // 1-12
    const currentYear = yearParam ? parseInt(yearParam) : now.getFullYear();

    const projects = await prisma.project.findMany({
      where: {
        ...(isAdminOrManager
          ? { clientId: { not: undefined } }
          : {
              OR: [
                { managerId: parseInt(session.user.id) },
                {
                  assignedUsers: {
                    some: {
                      id: userId ? parseInt(userId) : parseInt(session.user.id),
                    },
                  },
                },
              ],
              clientId: { not: undefined },
            }),
        startDate: { not: undefined },
      },
      select: {
        id: true,
        name: true,
        description: true,
        startDate: true,
        endDate: true,
        isActive: true,
        image: true,
        postTypes: true,
        client: {
          select: { name: true, id: true, company: true },
        },
        manager: {
          select: { name: true },
        },
        posts: {
          select: {
            id: true,
            createdAt: true,
            scheduledAt: true,
            status: true,
            assets: {
              select: {
                id: true,
                isReference: true,
                createdAt: true,
              },
            },
          },
        },
        assignedUsers: { select: { name: true, id: true, role: { select: { name: true } } } },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(projects);
  } catch (error) {
    console.error("Failed to fetch projects:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireCan("projects", "create");
    if (!auth.ok) return auth.response;
    const session = auth.session;
    // Fetch user permissions
    const user = await prisma.user.findUnique({
      where: { id: parseInt(session.user.id) },
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });

    const permissions = user?.role?.permissions.map((rp: any) => rp.permission.name) || [];
    if (!permissions.includes("Manage-projects")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const name = formData.get("name") as string;
    const description = formData.get("description") as string | null;
    const startDate = formData.get("startDate") as string;
    const endDate = formData.get("endDate") as string | null;
    const clientId = formData.get("clientId") as string;
    const managerId = formData.get("managerId") as string | null;
    const assignedUserIdsRaw = formData.get("assignedUserIds") as string | null;
    const postTypesRaw = formData.get("postTypes") as string | null;
    const imageFile = formData.get("image") as File | null;

    const assignedUserIds: string[] = assignedUserIdsRaw ? JSON.parse(assignedUserIdsRaw) : [];
    const postTypes: Record<string, number> = postTypesRaw ? JSON.parse(postTypesRaw) : {};

    if (!name || !name.trim() || !clientId || !startDate) {
      return NextResponse.json({ error: "Name, client, and start date are required" }, { status: 400 });
    }

    // Validate postTypes
    const validPostTypes = ["REEL", "STORY", "CAROUSEL", "PHOTO", "BLOG"];
    for (const postType in postTypes) {
      if (!validPostTypes.includes(postType)) {
        return NextResponse.json({ error: `Invalid post type: ${postType}` }, { status: 400 });
      }
      if (typeof postTypes[postType] !== "number" || postTypes[postType] < 0) {
        return NextResponse.json({ error: `Invalid count for ${postType}` }, { status: 400 });
      }
    }

    // Validate assignedUserIds
    if (!Array.isArray(assignedUserIds)) {
      return NextResponse.json({ error: "assignedUserIds must be an array" }, { status: 400 });
    }

    // Fetch users with ADMIN and Manager roles
    const adminAndManagerUsers = await prisma.user.findMany({
      where: {
        role: {
          name: {
            in: ["Admin", "Manager"],
          },
        },
      },
      select: {
        id: true,
      },
    });

    // Combine provided assignedUserIds with ADMIN and Manager IDs
    const allAssignedUserIds = [
      ...new Set([
        ...assignedUserIds.map((id: string) => parseInt(id)),
        ...adminAndManagerUsers.map((user: any) => user.id),
      ]),
    ];

    let imageUrl: string | null = null;
    if (imageFile) {
      const buffer = Buffer.from(await imageFile.arrayBuffer());
      const uploadDir = path.join(process.cwd(), "public", "uploads", "projects");
      await fs.mkdir(uploadDir, { recursive: true });

      const filename = `${Date.now()}-${imageFile.name}`;
      const filePath = path.join(uploadDir, filename);
      await fs.writeFile(filePath, buffer);

      imageUrl = `/uploads/projects/${filename}`;
    }

    const project = await prisma.project.create({
      data: {
        name,
        description,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        clientId,
        managerId: managerId ? parseInt(managerId) : null,
        isActive: true,
        image: imageUrl,
        postTypes: postTypes || {},
        assignedUsers: {
          connect: allAssignedUserIds.map((id) => ({ id })),
        },
      },
    });

    const start = new Date(startDate);
    const startMonth = start.getMonth() + 1; // JS month is 0-based
    const year = start.getFullYear();

    // Calculate total posts for one month
    const total = Object.values(postTypes || {}).reduce((a: number, b: any) => a + Number(b), 0);

    const strategiesData = generateStrategiesData(new Date(startDate), postTypes || {}, project.id);

    await prisma.projectStrategy.createMany({
      data: strategiesData,
    });

    // Log user activity for project creation
    await prisma.userActivity.create({
      data: {
        activityType: "PROJECT_CREATED",
        entityType: "Project",
        entityId: project.id,
        description: `Project "${name}" created`,
        userId: parseInt(session.user.id),
        projectId: project.id,
        ipAddress: request.headers.get("x-forwarded-for") || null,
        userAgent: request.headers.get("user-agent") || null,
      },
    });

    return NextResponse.json({
      ...project,
      strategies: strategiesData,
    });
  } catch (error) {
    console.error("Failed to create project:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireCan("projects", "update");
    if (!auth.ok) return auth.response;
    const session = auth.session;
    // Fetch user permissions
    const user = await prisma.user.findUnique({
      where: { id: parseInt(session.user.id) },
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });

    const permissions = user?.role?.permissions.map((rp: any) => rp.permission.name) || [];
    if (!permissions.includes("Manage-projects")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, name, description, startDate, endDate, clientId, managerId, isActive, postTypes, assignedUserIds = [] } = await request.json();

    if (!id || !name || !name.trim() || !clientId || !startDate) {
      return NextResponse.json({ error: "ID, name, client, and start date are required" }, { status: 400 });
    }

    // Validate postTypes
    const validPostTypes = ["REEL", "STORY", "CAROUSEL", "PHOTO", "BLOG"];
    for (const postType in postTypes) {
      if (!validPostTypes.includes(postType)) {
        return NextResponse.json({ error: `Invalid post type: ${postType}` }, { status: 400 });
      }
      if (typeof postTypes[postType] !== "number" || postTypes[postType] < 0) {
        return NextResponse.json({ error: `Invalid count for ${postType}` }, { status: 400 });
      }
    }

    // Validate assignedUserIds
    if (!Array.isArray(assignedUserIds)) {
      return NextResponse.json({ error: "assignedUserIds must be an array" }, { status: 400 });
    }

    // Fetch current assigned users to disconnect those not in the new assignedUserIds
    const currentProject = await prisma.project.findUnique({
      where: { id },
      include: { assignedUsers: true },
    });

    const currentAssignedUserIds = currentProject?.assignedUsers.map((user: any) => user.id) || [];

    const project = await prisma.project.update({
      where: { id },
      data: {
        name,
        description,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        clientId,
        managerId: managerId ? parseInt(managerId) : null,
        isActive,
        postTypes: postTypes || {},
        assignedUsers: {
          disconnect: currentAssignedUserIds.map((id: any) => ({ id })), // Disconnect all existing users
          connect: assignedUserIds.map((id: any) => ({ id: parseInt(id) })), // Connect new users
        },
      },
    });

    // Log user activity for project update
    await prisma.userActivity.create({
      data: {
        activityType: "PROJECT_UPDATED",
        entityType: "Project",
        entityId: project.id,
        description: `Project "${name}" updated`,
        userId: parseInt(session.user.id),
        projectId: project.id,
        ipAddress: request.headers.get("x-forwarded-for") || null,
        userAgent: request.headers.get("user-agent") || null,
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    const now = new Date()
    const currentMonth = now.getMonth() + 1
    const currentYear = now.getFullYear()

    const strategyUpdate = project.strategies?.find(
      (s: any) => s.month === currentMonth && s.year === currentYear
    ) || null
    
    return NextResponse.json({
      ...project,
      project,
      strategyUpdate
    })
  } catch (error) {
    console.error("Failed to update project:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireCan("projects", "delete");
    if (!auth.ok) return auth.response;
    const session = auth.session;
    const user = await prisma.user.findUnique({
      where: { id: parseInt(session.user.id) },
      include: {
        role: {
          include: {
            permissions: { include: { permission: true } },
          },
        },
      },
    });

    const permissions = user?.role?.permissions.map((rp: any) => rp.permission.name) || [];
    if (!permissions.includes("Manage-projects")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Project ID is required" }, { status: 400 });
    }

    const project = await prisma.project.findUnique({
      where: { id },
      include: { posts: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Find all posts to delete their relations first
    const postsList = await prisma.post.findMany({
      where: { projectId: id },
      select: { id: true }
    });
    
    if (postsList.length > 0) {
      const postIds = postsList.map((p: any) => p.id);
      
      // Find approval flows to delete their relations
      const flows = await prisma.approvalFlow.findMany({
        where: { postId: { in: postIds } },
        select: { id: true }
      });
      const flowIds = flows.map((f: any) => f.id);

      if (flowIds.length > 0) {
        await prisma.approvalAttachment.deleteMany({ where: { approvalFlowId: { in: flowIds } } });
        await prisma.approvalHistory.deleteMany({ where: { approvalFlowId: { in: flowIds } } });
        await prisma.approvalFlow.deleteMany({ where: { id: { in: flowIds } } });
      }

      // Delete post direct relations
      await prisma.asset.deleteMany({ where: { postId: { in: postIds } } });
      await prisma.comment.deleteMany({ where: { postId: { in: postIds } } });
      await prisma.postPlatform.deleteMany({ where: { postId: { in: postIds } } });
      await prisma.taskLog.deleteMany({ where: { postId: { in: postIds } } });
      await prisma.postAssignment.deleteMany({ where: { postId: { in: postIds } } });

      // Finally delete posts
      await prisma.post.deleteMany({ where: { projectId: id } });
    }

    // Delete related records first to avoid foreign key constraint errors
    await prisma.projectStrategy.deleteMany({
      where: { projectId: id }
    });

    await prisma.credential.deleteMany({
      where: { projectId: id }
    });

    await prisma.userActivity.deleteMany({
      where: { projectId: id }
    });

    await prisma.exportLink.deleteMany({
      where: { projectId: id }
    });

    await prisma.project.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Project deleted successfully" });
  } catch (error) {
    console.error("Failed to delete project:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}