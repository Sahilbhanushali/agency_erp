import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PostAssigned } from '@/components/emails/PostAssigned';
import { createEmailService } from '@/lib/emailService';
import { renderPostAssignedEmail } from '@/lib/renderEmail';
import { promises as fs } from "fs";
import path from "path";


import { PostStatus, Platform, PostType, ContentStatus } from '@prisma/client';

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse form data
    const formData = await request.formData();
    const title = formData.get('title')?.toString();
    const caption = formData.get('caption')?.toString();
    const type = formData.get('type')?.toString() as PostType | undefined;
    const platformsRaw = formData.get('platforms')?.toString();
    const projectId = formData.get('projectId')?.toString();
    const scheduledAt = formData.get('scheduledAt')?.toString();
    const designDueDate = formData.get('designDueDate')?.toString();
    const assignedToId = formData.get('assignedToId')?.toString();
    const assignedToIdsRaw = formData.get('assignedToIds')?.toString();
    const festivalId = formData.get('festivalId')?.toString();
    const customDataRaw = formData.get('customData')?.toString();
    const notes = formData.get('notes')?.toString();
    const referenceUrl = formData.get('referenceUrl')?.toString();
    const writeUp = formData.get('writeUp')?.toString();
    const keyword = formData.get('keyword')?.toString();

    // Validate required fields
    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }
    if (!type) {
      return NextResponse.json({ error: 'Content type is required' }, { status: 400 });
    }
    if (!projectId) {
      return NextResponse.json({ error: 'Valid project ID is required' }, { status: 400 });
    }

    // Validate platforms
    let platforms: string[];
    try {
      platforms = platformsRaw ? JSON.parse(platformsRaw) : [];
      if (!Array.isArray(platforms) || platforms.some((p) => typeof p !== 'string')) {
        return NextResponse.json({ error: 'Platforms must be an array of strings' }, { status: 400 });
      }
      if (platforms.length === 0) {
        return NextResponse.json({ error: 'At least one platform is required' }, { status: 400 });
      }
    } catch (error) {
      return NextResponse.json({ error: 'Invalid platforms format' }, { status: 400 });
    }

    // Validate platform values
    const validPlatforms: Platform[] = ['INSTAGRAM', 'FACEBOOK', 'TWITTER', 'LINKEDIN', 'YOUTUBE', 'IGTV', 'THREADS', 'GMB', 'PINTEREST'];
    const invalidPlatforms = platforms.filter((p) => !validPlatforms.includes(p as Platform));
    if (invalidPlatforms.length > 0) {
      return NextResponse.json(
        { error: `Invalid platforms: ${invalidPlatforms.join(', ')}. Must be one of: ${validPlatforms.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate post type
    const validPostTypes: PostType[] = ['PHOTO', 'REEL', 'STORY', 'CAROUSEL', 'BLOG', 'CUSTOM', 'UNKNOWN'];
    if (!validPostTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid content type. Must be one of: ${validPostTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate project
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { client: true },
    });
    if (!project) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }

    // Validate assigned designers
    let validatedAssignedToId: number | null = null;
    let validatedAssignedUserIds: number[] = [];
    
    // Legacy support for single assignedToId (fallback)
    if (assignedToId && assignedToId !== 'unassigned' && assignedToId.trim() !== '') {
      const assignedIdNum = parseInt(assignedToId, 10);
      if (!isNaN(assignedIdNum)) {
        validatedAssignedToId = assignedIdNum;
        validatedAssignedUserIds.push(assignedIdNum);
      }
    }

    // New support for multiple assignedToIds
    if (assignedToIdsRaw) {
      try {
        const parsedIds = JSON.parse(assignedToIdsRaw);
        if (Array.isArray(parsedIds)) {
          parsedIds.forEach(id => {
            const numId = parseInt(id, 10);
            if (!isNaN(numId) && !validatedAssignedUserIds.includes(numId)) {
              validatedAssignedUserIds.push(numId);
            }
          });
          // Also set the first one as primary for legacy compatibility
          if (validatedAssignedUserIds.length > 0 && validatedAssignedToId === null) {
            validatedAssignedToId = validatedAssignedUserIds[0];
          }
        }
      } catch (e) {
        return NextResponse.json({ error: 'Invalid assignedToIds format' }, { status: 400 });
      }
    }

    let assignedUsers: any[] = [];
    if (validatedAssignedUserIds.length > 0) {
      assignedUsers = await prisma.user.findMany({
        where: { id: { in: validatedAssignedUserIds } },
        select: { id: true, name: true, email: true, role: true },
      });
      
      if (assignedUsers.length === 0) {
        return NextResponse.json({ error: 'Invalid assigned designer IDs' }, { status: 400 });
      }

      for (const user of assignedUsers) {
        if (
          !user.role ||
          (
            user.role.name.toLowerCase() !== "designer" &&
            user.role.name.toLowerCase() !== "video editor" &&
            user.role.name !== "Creative Executive(Design & Media)"
          )
        ) {
          return NextResponse.json(
            { error: `Assigned user ${user.name} must have Designer/Video Editor role` },
            { status: 400 }
          );
        }
      }
    }

    // Validate festival
    let validatedFestivalId: number | null = null;
    if (festivalId && festivalId.trim() !== '') {
      const festivalIdNum = parseInt(festivalId, 10);
      if (isNaN(festivalIdNum)) {
        return NextResponse.json({ error: 'Invalid festivalId format' }, { status: 400 });
      }
      const festival = await prisma.festival.findUnique({
        where: { id: festivalIdNum },
      });
      if (!festival) {
        return NextResponse.json({ error: 'Invalid festival ID' }, { status: 400 });
      }
      validatedFestivalId = festivalIdNum;
    }

    // Parse custom data
    let customData: any = null;
    if (customDataRaw && customDataRaw.trim() !== '') {
      try {
        customData = JSON.parse(customDataRaw);
      } catch (error) {
        return NextResponse.json({ error: 'Invalid customData format' }, { status: 400 });
      }
    }

    // Story-specific validation
    // if (type === 'STORY') {
    //   // if (validatedFestivalId ) {
    //   //   return NextResponse.json({ error: 'Story posts cannot have both festival and custom data' }, { status: 400 });
    //   // }
    //   if (!validatedFestivalId && !customData) {
    //     return NextResponse.json({ error: 'Story posts must have either festival or custom data' }, { status: 400 });
    //   }
    //   if (customData && !customData.customType) {
    //     return NextResponse.json({ error: 'Custom story posts must have a customType' }, { status: 400 });
    //   }
    // }

    // Process assets
    const assets: { filename: string; generatedName: string; type: string; size: number }[] = [];
    const uploadDir = path.join(process.cwd(), "public", "uploads");
    await fs.mkdir(uploadDir, { recursive: true });

    const maxSize = 500 * 1024 * 1024;
    const allowedTypes = ['image/', 'video/', 'application/pdf'];

    for (const [key, value] of formData.entries()) {
      if (key === 'assets' && value instanceof File) {
        const file = value;

        if (file.size > maxSize) {
          return NextResponse.json({ error: `File ${file.name} is too large. Maximum size is 100MB.` }, { status: 400 });
        }

        if (!allowedTypes.some((type) => file.type.startsWith(type))) {
          return NextResponse.json(
            { error: `File ${file.name} has invalid type. Only images, videos, and PDFs are allowed.` },
            { status: 400 }
          );
        }

        const originalName = file.name;
        const sanitizedBaseName = originalName
          .replace(/\s+/g, "_")
          .replace(/[^\w.-]/g, "")
          .toLowerCase();
        const generatedName = `${Date.now()}-${sanitizedBaseName}`;
        const filePath = path.join(uploadDir, generatedName);

        const fileBuffer = Buffer.from(await file.arrayBuffer());
        await fs.writeFile(filePath, fileBuffer);

        assets.push({
          filename: originalName,
          generatedName,
          type: file.type,
          size: file.size,
        });
      }
    }

    // Determine content status
    const contentStatus: ContentStatus = 'PENDING_REVIEW';
    const status: PostStatus = 'DRAFT';

    // Create post
    const post = await prisma.post.create({
      data: {
        title,
        caption: caption || null,
        type,
        status,
        contentStatus,
        projectId,
        createdById: parseInt(session.user.id, 10),
        assignedToId: validatedAssignedToId,
        assignedUsers: {
          connect: validatedAssignedUserIds.map(id => ({ id }))
        },
        festivalId: validatedFestivalId,
        customData,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        designDueDate: designDueDate ? new Date(designDueDate) : null,
        notes: notes || null,
        referenceUrl: referenceUrl || null,
        writeUp: writeUp || null,
        keyword: keyword || null,
        platforms: {
          create: platforms.map((platform) => ({
            platform: platform as Platform,
          })),
        },
        assets: {
          create: assets.map((asset, index) => ({
            filename: asset.filename,
            url: `/api/uploads/${asset.generatedName}`,
            type: asset.type,
            size: asset.size,
            order: index,
            uploadedById: parseInt(session.user.id, 10),
            isReference: true,
          })),
        },
        approvalFlows: {
          create: [
            {
              flowType: 'CONTENT',
              status: 'SUBMITTED',
              submissionCount: 1,
              version: 1,
              submittedById: parseInt(session.user.id, 10),
              assignedToId: validatedAssignedToId,
              submittedAt: new Date(),
            },
            {
              flowType: 'DESIGN',
              status: 'SUBMITTED',
              submissionCount: 1,
              version: 1,
              submittedById: parseInt(session.user.id, 10),
              assignedToId: validatedAssignedToId,
              submittedAt: new Date(),
            }
          ],
        },
      },
      include: {
        project: { include: { client: true } },
        createdBy: { select: { id: true, name: true, email: true, role: true } },
        assignedTo: { select: { id: true, name: true, email: true, role: true } },
        festival: { select: { id: true, name: true, description: true, date: true, primaryType: true } },
        assets: { 
          orderBy: [
            { order: 'asc' },
            { isEdited: 'desc' },
            { createdAt: 'desc' }
          ]
        },
        platforms: true,
      },
    });

    // Log post creation
    await prisma.taskLog.create({
      data: {
        action: 'CREATE',
        newStatus: post.status,
        newValues: JSON.parse(JSON.stringify(post)),
        postId: post.id,
        userId: parseInt(session.user.id, 10),
        ipAddress: request.headers.get('x-forwarded-for') ?? null,
        userAgent: request.headers.get('user-agent') ?? null,
      },
    });
      // CREATE ApprovalHistory for initial submissions
  const approvalFlows = await prisma.approvalFlow.findMany({
    where: { postId: post.id }
  });

  for (const flow of approvalFlows) {
    await prisma.approvalHistory.create({
      data: {
        action: 'SUBMITTED',
        fromStatus: null,
        toStatus: 'SUBMITTED',
        version: 1,
        metadata: { initialCreation: true },
        approvalFlowId: flow.id,
        performedById: parseInt(session.user.id, 10),
      },
    }); 
  }

    // Handle designer assignments and logging
    if (assignedUsers.length > 0) {
      // Create post assignments for each user
      await prisma.postAssignment.createMany({
        data: assignedUsers.map(user => ({
          postId: post.id,
          userId: user.id,
          role: 'DESIGNER',
          stage: 'DESIGN_PENDING',
          status: 'ACTIVE',
        })),
      });

      // Log assignment in UserActivity for each user
      await Promise.all(assignedUsers.map(user => 
        prisma.userActivity.create({
          data: {
            activityType: 'POST_ASSIGNED',
            entityType: 'Post',
            entityId: post.id,
            description: `Post "${title}" assigned to ${user.name}`,
            metadata: {
              projectId,
              assignedUserId: user.id,
              role: user.role.name,
            },
            userId: parseInt(session.user.id, 10),
            projectId,
            ipAddress: request.headers.get('x-forwarded-for') || null,
            userAgent: request.headers.get('user-agent') || null,
          },
        })
      ));

      await prisma.taskLog.create({
        data: {
          action: 'ASSIGNED',
          oldValues: { assignedToIds: [] },
          newValues: { assignedToIds: validatedAssignedUserIds },
          feedback: 'Initial assignment to designers',
          postId: post.id,
          userId: parseInt(session.user.id, 10),
          ipAddress: request.headers.get('x-forwarded-for') ?? null,
          userAgent: request.headers.get('user-agent') ?? null,
        },
      });

      // Find smtpDetails for email
      const smtpDetails = await prisma.smtpDetails.findUnique({
        where: { userId: parseInt(session.user.id, 10) },
      });

      // Create email tasks for all assigned designers
      const emailPromises = assignedUsers.map(async (assignedUser) => {
        if (assignedUser.email && smtpDetails && smtpDetails.isActive) {
          try {
            const emailService = createEmailService(parseInt(session.user.id, 10));
            await emailService.initialize();
            
            const { html, text } = renderPostAssignedEmail({
              post: {
                title: post.title,
                project: { name: project.name },
                type: post.type,
                platforms: platforms.map(p => ({ platform: p })),
              },
              designerName: assignedUser.name,
            });

            await emailService.sendEmail({
              to: assignedUser.email,
              subject: `New Post Assignment: ${post.title}`,
              html,
              text,
            });
            console.log(`Email sent successfully to ${assignedUser.email}`);
          } catch (emailError) {
            console.error(`Failed to send assignment email to ${assignedUser.email}:`, emailError);
          }
        }
      });
      
      await Promise.allSettled(emailPromises);
    }

    return NextResponse.json(post, { status: 201 });
  } catch (error: any) {
    console.error('Error creating post:', {
      message: error.message,
      stack: error.stack,
      details: error,
    });

    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'A post with this title already exists for this project' }, { status: 400 });
    }
    if (error.code === 'P2003') {
      return NextResponse.json({ error: 'Invalid reference to project, user, or festival' }, { status: 400 });
    }

    return NextResponse.json(
      { error: 'Internal server error', details: process.env.NODE_ENV === 'development' ? error.message : undefined },
      { status: 500 }
    );
  }
}



export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const assignedToMe = searchParams.get("assignedToMe") === "true";
    const status = searchParams.get("status");
    const projectId = searchParams.get("projectId");

    const whereClause: any = {};

    // Role-based filtering
    if (session.user.role === "CLIENT") {
      whereClause.project = { client: { email: session.user.email } };
    } else if (session.user.role === "Designer" && assignedToMe) {
      whereClause.assignedToId = session.user.id;
    }

    // Status filtering
    if (status && status !== "all") {
      if (status === "pending") {
        whereClause.status = {
          in: ["DRAFT", "SUBMITTED", "REJECTED", "SCHEDULED"]
        };
      } else {
        whereClause.status = status.toUpperCase();
      }
    }

    // Project filtering - handle as string (UUID)
    if (projectId && projectId !== "all") {
      whereClause.projectId = projectId;
    }

    const posts = await prisma.post.findMany({
      where: whereClause,
      include: {
        project: { include: { client: true } },
        createdBy: true,
        assignedTo: true,
        assets: true,
        comments: {
          include: { user: true },
          orderBy: { createdAt: "desc" },
          take: 3,
        },
        platforms: true,
        approvalFlows: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: {
            reviewedBy: { select: { id: true, name: true } },
            submittedBy: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(posts);
  } catch (error: any) {
    console.error("Error fetching posts:", {
      message: error.message,
      stack: error.stack,
      details: error,
    });
    return NextResponse.json(
      { error: "Internal server error", details: error.message }, 
      { status: 500 }
    );
  }
}