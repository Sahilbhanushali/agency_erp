import { POST_CONTENT_TYPES, isPresentationFile, isSocialPublishable } from "@/lib/posts/content-types";
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
import { can, contentScope, isClientContact, requireCan } from "@/lib/api-auth";
import { namesSatisfying } from "@/lib/permissions/catalog";

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const auth = await requireCan("posts", "create");
    if (!auth.ok) return auth.response;
    const session = auth.session;
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
    // Validated against the shared list, so an unknown type is a 400 rather than a
    // Prisma enum error surfacing as a 500.
    if (!POST_CONTENT_TYPES.some((t) => t.value === type)) {
      return NextResponse.json({ error: 'Choose a valid content type' }, { status: 400 });
    }
    const requiresClientApproval = formData.get('requiresClientApproval')?.toString() === 'true';
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
      // A presentation is an internal deliverable; it is not published to a platform.
      if (platforms.length === 0 && isSocialPublishable(type)) {
        return NextResponse.json({ error: 'At least one platform is required' }, { status: 400 });
      }
    } catch (error) {
      return NextResponse.json({ error: 'Invalid platforms format' }, { status: 400 });
    }

    // Validate platform values
    // The enum is the one list: a platform added to the schema is accepted here too.
    const validPlatforms = Object.values(Platform);
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
        select: {
          id: true,
          name: true,
          email: true,
          role: {
            select: {
              name: true,
              permissions: { select: { permission: { select: { name: true } } } },
            },
          },
        },
      });
      
      if (assignedUsers.length === 0) {
        return NextResponse.json({ error: 'Invalid assigned designer IDs' }, { status: 400 });
      }

      /**
       * Whoever a post is assigned to has to be able to work on it, which is
       * `posts:update` — not a role whose name happens to be one of three strings.
       *
       * The previous check listed "designer", "video editor" and
       * "Creative Executive(Design & Media)" literally, so on an install with its own
       * roles there was nobody a post could be assigned to at all.
       */
      const accepted = namesSatisfying("posts", "update");
      for (const user of assignedUsers) {
        const held = user.role?.permissions.map((rp: any) => rp.permission.name) ?? [];
        if (!accepted.some((name: string) => held.includes(name))) {
          return NextResponse.json(
            {
              error: `${user.name ?? user.email} cannot be assigned work on posts — their role needs the "Update" permission for Content & Posts.`,
            },
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

        if (!allowedTypes.some((type) => file.type.startsWith(type)) && !isPresentationFile(file)) {
          return NextResponse.json(
            { error: `File ${file.name} has invalid type. Only images, videos, PDFs and presentations (.ppt, .pptx) are allowed.` },
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
        requiresClientApproval,
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
        project: { include: { client: true, clientCompany: { select: { name: true, logo: true } } } },
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
    const auth = await requireCan("posts", "read");
    if (!auth.ok) return auth.response;
    const session = auth.session;
    const { searchParams } = new URL(request.url);
    const assignedToMe = searchParams.get("assignedToMe") === "true";
    const status = searchParams.get("status");
    const contentStatus = searchParams.get("contentStatus");
    const type = searchParams.get("type");
    const projectId = searchParams.get("projectId");
    const search = searchParams.get("search");
    const pageParam = searchParams.get("page");
    const limitParam = searchParams.get("limit");
    const formatPaginated = searchParams.get("format") === "paginated";

    const whereClause: any = {};

    // A client login is scoped to its own projects. This is decided from the client
    // record matching their address, not from a role being named "CLIENT" — renaming
    // or recreating that role used to hand one client every other client's content.
    if (await isClientContact(session)) {
      whereClause.project = { client: { email: session.user.email } };
    } else if ((await contentScope(session)) === "own") {
      whereClause.OR = [
        { assignedToId: Number(session.user.id) },
        { assignedUsers: { some: { id: Number(session.user.id) } } },
      ];
    } else if (assignedToMe) {
      whereClause.assignedToId = Number(session.user.id);
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

    // Content status filtering
    if (contentStatus && contentStatus !== "all") {
      whereClause.contentStatus = contentStatus.toUpperCase();
    }

    // Type filtering
    if (type && type !== "all") {
      whereClause.type = type.toUpperCase();
    }

    // Project filtering
    if (projectId && projectId !== "all") {
      whereClause.projectId = projectId;
    }

    // Search query across title, caption, project name, client name
    if (search && search.trim()) {
      const q = search.trim();
      whereClause.OR = [
        { title: { contains: q } },
        { caption: { contains: q } },
        { project: { name: { contains: q } } },
        { project: { client: { name: { contains: q } } } },
      ];
    }

    // Pagination parameters
    const page = pageParam ? Math.max(1, parseInt(pageParam, 10)) : null;
    const limit = limitParam ? Math.max(1, parseInt(limitParam, 10)) : 50;

    const findOptions: any = {
      where: whereClause,
      include: {
        project: { include: { client: true, clientCompany: { select: { name: true, logo: true } } } },
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
    };

    if (page) {
      findOptions.skip = (page - 1) * limit;
      findOptions.take = limit;
    }

    const [posts, totalCount] = await Promise.all([
      prisma.post.findMany(findOptions),
      prisma.post.count({ where: whereClause }),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    const headers = new Headers();
    headers.set("X-Total-Count", String(totalCount));
    headers.set("X-Total-Pages", String(totalPages));
    if (page) {
      headers.set("X-Current-Page", String(page));
      headers.set("X-Page-Size", String(limit));
    }

    if (formatPaginated) {
      return NextResponse.json(
        {
          data: posts,
          pagination: {
            total: totalCount,
            page: page || 1,
            limit,
            totalPages,
          },
        },
        { headers }
      );
    }

    return NextResponse.json(posts, { headers });
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