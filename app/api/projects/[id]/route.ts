import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { logAudit } from "@/lib/audit"
import fs from "fs/promises"
import path from "path"

// Interface for postTypes JSON object
interface PostTypeCount {
  [key: string]: number
}
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

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    
    // Await params before using (Next.js 15+ requirement)
    const { id } = await params
    
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        client: true,
        manager: true,
        posts: {
          include: {
            createdBy: true,
            assignedTo: true,
            festival: true,
            assets: true,
            comments: true,
            platforms: true,
          },
          orderBy: {
            createdAt: 'desc'
          }
        },
        assignedUsers: {
      include: {
        role: true,  // This is CRITICAL - must include role relation
      }
    },
        strategies: {
          orderBy: [
            { year: 'desc' },
            { month: 'desc' }
          ]
        },
      },
    })
    
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    const now = new Date()
    const currentMonth = now.getMonth() + 1
    const currentYear = now.getFullYear()

    const strategyUpdate = project.strategies.find(
      (s: any) => s.month === currentMonth && s.year === currentYear
    ) || null
    
    return NextResponse.json({
      ...project,
      project,
      strategyUpdate
    })
  } catch (error) {
    console.error("Error fetching project:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // if (!["ADMIN", "Manager"].includes(session.user.role)) {
    //   return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    // }

    const { id } = await params;

    // Fetch current project with assigned users and strategies
    const oldProject = await prisma.project.findUnique({
      where: { id },
      include: { 
        assignedUsers: true,
        strategies: true
      },
    })

    if (!oldProject) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    const formData = await request.formData()
    const name = formData.get("name") as string
    const description = formData.get("description") as string | null
    const clientId = formData.get("clientId") as string
    const managerIdRaw = formData.get("managerId") as string | null
    const startDate = formData.get("startDate") as string
    const endDate = formData.get("endDate") as string | null
    const isActiveRaw = formData.get("isActive") as string | null
    const postTypesRaw = formData.get("postTypes") as string | null
    const assignedUserIdsRaw = formData.get("assignedUserIds") as string | null
    const monthRaw = formData.get("month") as string | null
    const yearRaw = formData.get("year") as string | null
    const imageFile = formData.get("image") as File | null
    const removeImage = formData.get("removeImage") as string | null

    const managerId = managerIdRaw ? parseInt(managerIdRaw) : null
    const isActive = isActiveRaw === "true"
    const postTypes = postTypesRaw ? JSON.parse(postTypesRaw) : null
    const assignedUserIds = assignedUserIdsRaw ? JSON.parse(assignedUserIdsRaw) : []
    const month = monthRaw ? parseInt(monthRaw) : null
    const year = yearRaw ? parseInt(yearRaw) : null

    if (!name || !clientId || !startDate) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Validate postTypes
    if (postTypes) {
      const postTypeUtility = await prisma.utility.findFirst({
        where: { type: "POST_TYPE" },
      })
      const validPostTypes = postTypeUtility?.values || ["REEL", "POST", "STORY", "PHOTO", "VIDEO", "CAROUSEL", "BLOG"]
      for (const postType in postTypes) {
        if (!validPostTypes.includes(postType)) {
          return NextResponse.json({ error: `Invalid post type: ${postType}` }, { status: 400 })
        }
        if (typeof postTypes[postType] !== "number" || postTypes[postType] < 0) {
          return NextResponse.json({ error: `Invalid count for ${postType}` }, { status: 400 })
        }
      }
    }

    // Validate assignedUserIds
    if (!Array.isArray(assignedUserIds)) {
      return NextResponse.json({ error: "assignedUserIds must be an array" }, { status: 400 })
    }

    const currentAssignedUserIds = oldProject.assignedUsers.map((user: any) => user.id) || [];

    // Handle strategy update for specific month/year if provided
    let strategyUpdate;
    if (month && year) {
      const totalPosts = Object.values(postTypes as Record<string, number>).reduce((a: number, b: any) => a + Number(b), 0);
      strategyUpdate = await prisma.projectStrategy.upsert({
        where: {
          projectId_month_year: {
            projectId: id,
            month,
            year,
          },
        },
        update: {
          postTypes,
          total: totalPosts,
        },
        create: {
          projectId: id,
          month,
          year,
          postTypes,
          total: totalPosts,
        },
      });
    }

    let imageUrl = oldProject.image;
    console.log("PUT project - imageFile:", imageFile ? (typeof imageFile === 'object' ? imageFile.name + ' (' + imageFile.size + ')' : imageFile) : null);
    console.log("PUT project - removeImage:", removeImage);

    if (removeImage) {
      imageUrl = null;
    } else if (imageFile && typeof imageFile === "object" && typeof imageFile.arrayBuffer === "function" && imageFile.size > 0) {
      const buffer = Buffer.from(await imageFile.arrayBuffer());
      const uploadDir = path.join(process.cwd(), "public", "uploads", "projects");
      await fs.mkdir(uploadDir, { recursive: true });

      const filename = `${Date.now()}-${imageFile.name}`;
      const filePath = path.join(uploadDir, filename);
      await fs.writeFile(filePath, buffer);

      imageUrl = `/uploads/projects/${filename}`;
    }

    const project = await prisma.project.update({
      where: { id },
      data: {
        name,
        description,
        clientId,
        managerId: managerId || null,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        isActive,
        image: imageUrl,
        postTypes: postTypes || {},
        assignedUsers: {
          disconnect: currentAssignedUserIds.map((id: any) => ({ id })), // Disconnect all existing users
          connect: assignedUserIds.map((id: any) => ({ id: parseInt(id) })), // Connect new users
        },
      },
      include: {
        client: true,
        manager: true,
        strategies: true,
      },
    })

    await logAudit({
      action: "PROJECT_UPDATED",
      userId: session.user.id,
      details: `Updated project: ${project.name}${month && year ? ` (Strategy for ${month}/${year})` : ''}`,
      metadata: { 
        projectId: project.id, 
        postTypes: JSON.stringify(postTypes),
        month,
        year
      },
    })
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

    return NextResponse.json({ project, strategyUpdate })
  } catch (error) {
    console.error("Error updating project:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params;

    const project = await prisma.project.findUnique({
      where: { id },
      include: { posts: true },
    })

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    // Find all posts to delete their relations first
    const posts = await prisma.post.findMany({
      where: { projectId: id },
      select: { id: true }
    })
    
    if (posts.length > 0) {
      const postIds = posts.map((p: any) => p.id)
      
      // Find approval flows to delete their relations
      const flows = await prisma.approvalFlow.findMany({
        where: { postId: { in: postIds } },
        select: { id: true }
      })
      const flowIds = flows.map((f: any) => f.id)

      if (flowIds.length > 0) {
        await prisma.approvalAttachment.deleteMany({ where: { approvalFlowId: { in: flowIds } } })
        await prisma.approvalHistory.deleteMany({ where: { approvalFlowId: { in: flowIds } } })
        await prisma.approvalFlow.deleteMany({ where: { id: { in: flowIds } } })
      }

      // Delete post direct relations
      await prisma.asset.deleteMany({ where: { postId: { in: postIds } } })
      await prisma.comment.deleteMany({ where: { postId: { in: postIds } } })
      await prisma.postPlatform.deleteMany({ where: { postId: { in: postIds } } })
      await prisma.taskLog.deleteMany({ where: { postId: { in: postIds } } })
      await prisma.postAssignment.deleteMany({ where: { postId: { in: postIds } } })

      // Finally delete posts
      await prisma.post.deleteMany({ where: { projectId: id } })
    }

    // Delete strategies and credentials first to avoid foreign key constraint errors
    await prisma.projectStrategy.deleteMany({
      where: { projectId: id }
    })

    await prisma.credential.deleteMany({
      where: { projectId: id }
    })

    await prisma.userActivity.deleteMany({
      where: { projectId: id }
    })

    await prisma.exportLink.deleteMany({
      where: { projectId: id }
    })

    await prisma.project.delete({
      where: { id },
    })

    await logAudit({
      action: "PROJECT_DELETED",
      userId: session.user.id,
      details: `Deleted project: ${project.name}`,
      metadata: { projectId: project.id },
    })

    return NextResponse.json({ message: "Project deleted successfully" })
  } catch (error) {
    console.error("Error deleting project:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}