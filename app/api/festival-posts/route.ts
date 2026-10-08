import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PostAssigned } from '@/components/emails/PostAssigned';
import { createEmailService } from '@/lib/emailService';
import { renderPostAssignedEmail } from '@/lib/renderEmail';
import { promises as fs } from "fs";
import path from "path";

type PostStatus = 'DRAFT' | 'SCHEDULED' | 'PUBLISHED';
type Platform = 'INSTAGRAM' | 'FACEBOOK' | 'TWITTER' | 'LINKEDIN' | 'YOUTUBE' | 'IGTV' | 'THREADS' | 'GMB' | 'PINTEREST';
type PostType = 'PHOTO' | 'REEL' | 'STORY' | 'CAROUSEL' | 'CUSTOM';
type ContentStatus = 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const session = await getServerSession(authOptions);

    // Parse JSON body
    const {
      title,
      caption,
      type,
      platforms,
      projectId,
      scheduledAt,
      assignedToId,
      festivalId,
      createdById,
    } = await request.json();

    // Validate required fields
    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }
    if (type !== 'STORY') {
      return NextResponse.json({ error: 'Festival posts must be of type STORY' }, { status: 400 });
    }
    if (!projectId) {
      return NextResponse.json({ error: 'Valid project ID is required' }, { status: 400 });
    }
    if (!festivalId) {
      return NextResponse.json({ error: 'Valid festival ID is required' }, { status: 400 });
    }
    if (!createdById) {
      return NextResponse.json({ error: 'Valid createdById is required' }, { status: 400 });
    }

    // Validate platforms
    if (!Array.isArray(platforms) || platforms.length === 0) {
      return NextResponse.json({ error: 'At least one platform is required' }, { status: 400 });
    }
    const validPlatforms: Platform[] = ['INSTAGRAM', 'FACEBOOK', 'TWITTER', 'LINKEDIN', 'YOUTUBE', 'IGTV', 'THREADS', 'GMB', 'PINTEREST'];
    const invalidPlatforms = platforms.filter((p: string) => !validPlatforms.includes(p as Platform));
    if (invalidPlatforms.length > 0) {
      return NextResponse.json(
        { error: `Invalid platforms: ${invalidPlatforms.join(', ')}. Must be one of: ${validPlatforms.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate project and fetch assigned users
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        client: true,
        assignedUsers: {
          include: {
            role: true,
          },
        },
      },
    });
    if (!project) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }

    // Validate festival
    const festival = await prisma.festival.findUnique({
      where: { id: parseInt(festivalId) },
    });
    if (!festival) {
      return NextResponse.json({ error: 'Invalid festival ID' }, { status: 400 });
    }

    // Validate or assign designer
    let validatedAssignedToId: number | null = null;
    let assignedUser: { id: number; name: string; email: string | null; role: { id: number; name: string; description: string } } | null = null;

    // Check if assignedToId is provided and valid
    if (assignedToId && assignedToId !== 'unassigned' && assignedToId.trim() !== '') {
      const assignedIdNum = parseInt(assignedToId, 10);
      if (isNaN(assignedIdNum)) {
        return NextResponse.json({ error: 'Invalid assignedToId format' }, { status: 400 });
      }
      assignedUser = await prisma.user.findUnique({
        where: { id: assignedIdNum },
        select: { id: true, name: true, email: true, role: true },
      });
      if (!assignedUser) {
        return NextResponse.json({ error: 'Invalid assigned designer ID' }, { status: 400 });
      }
      if (!assignedUser.role || assignedUser.role.name.toLowerCase() !== "designer") {
        return NextResponse.json(
          { error: "Assigned user must have Designer role" },
          { status: 400 }
        );
      }
      // Verify the assigned user is part of the project's assignedUsers
      const isAssignedToProject = project.assignedUsers.some(
        (user: any) => user.id === assignedIdNum && user.role?.name.toLowerCase() === "designer"
      );
      if (!isAssignedToProject) {
        return NextResponse.json(
          { error: "Assigned user is not a designer associated with this project" },
          { status: 400 }
        );
      }
      validatedAssignedToId = assignedIdNum;
    } else {
      // Automatically assign a designer from the project's assigned users
      const projectDesigners = project.assignedUsers.filter(
        (user: any) => user.role?.name.toLowerCase() === "designer"
      );
      if (projectDesigners.length === 0) {
        return NextResponse.json(
          { error: "No designers are assigned to this project" },
          { status: 400 }
        );
      }
      // Select the first designer (or implement logic to choose one, e.g., based on workload)
      assignedUser = projectDesigners[0] as any;
      validatedAssignedToId = assignedUser?.id || null;
    }

    // Create post
    const contentStatus: ContentStatus = 'PENDING_REVIEW';
    const status: PostStatus = 'DRAFT';

    const post = await prisma.post.create({
      data: {
        title,
        caption: caption || null,
        type: 'STORY',
        status,
        contentStatus,
        projectId,
        createdById: parseInt(createdById, 10),
        assignedToId: validatedAssignedToId,
        festivalId: parseInt(festivalId),
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        platforms: {
          create: platforms.map((platform: string) => ({
            platform: platform as Platform,
          })),
        },
      },
      include: {
        project: { include: { client: true } },
        createdBy: { select: { id: true, name: true, email: true, role: true } },
        assignedTo: { select: { id: true, name: true, email: true, role: true } },
        festival: { select: { id: true, name: true, description: true, date: true, primaryType: true } },
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
        userId: parseInt(createdById, 10),
        ipAddress: request.headers.get('x-forwarded-for') ?? null,
        userAgent: request.headers.get('user-agent') ?? null,
      },
    });

    // Create ApprovalFlow and ApprovalHistory
    const approvalFlow = await prisma.approvalFlow.create({
      data: {
        flowType: 'CONTENT',
        status: 'SUBMITTED',
        submissionCount: 1,
        version: 1,
        postId: post.id,
        submittedById: parseInt(createdById, 10),
        assignedToId: validatedAssignedToId,
        submittedAt: new Date(),
      },
    });

    await prisma.approvalHistory.create({
      data: {
        action: 'SUBMITTED',
        fromStatus: null,
        toStatus: 'SUBMITTED',
        version: 1,
        metadata: { initialCreation: true },
        approvalFlowId: approvalFlow.id,
        performedById: parseInt(createdById, 10),
      },
    });

    // Handle designer assignment and email
    if (validatedAssignedToId && assignedUser && assignedUser.email) {
      await prisma.postAssignment.create({
        data: {
          postId: post.id,
          userId: validatedAssignedToId,
          role: 'DESIGNER',
          stage: 'DESIGN_PENDING',
          status: 'ACTIVE',
        },
      });

      await prisma.userActivity.create({
        data: {
          activityType: 'POST_ASSIGNED',
          entityType: 'Post',
          entityId: post.id,
          description: `Post "${title}" assigned to ${assignedUser.name}`,
          metadata: {
            projectId,
            assignedUserId: validatedAssignedToId,
            role: assignedUser.role.name,
          },
          userId: parseInt(createdById, 10),
          projectId,
          ipAddress: request.headers.get('x-forwarded-for') || null,
          userAgent: request.headers.get('user-agent') || null,
        },
      });

      await prisma.taskLog.create({
        data: {
          action: 'ASSIGNED',
          oldValues: { assignedToId: null },
          newValues: { assignedToId: validatedAssignedToId },
          feedback: 'Initial assignment to designer',
          postId: post.id,
          userId: parseInt(createdById, 10),
          ipAddress: request.headers.get('x-forwarded-for') ?? null,
          userAgent: request.headers.get('user-agent') ?? null,
        },
      });

      try {
        const emailService = createEmailService(parseInt(createdById, 10));
        await emailService.initialize();
        const { html, text } = renderPostAssignedEmail({
          post: {
            title: post.title,
            project: { name: post.project.name },
            type: post.type,
            platforms: post.platforms,
            writeUp: post.caption,
          } as any,
          designerName: assignedUser.name,
        });
        await emailService.sendEmail({
          to: assignedUser.email,
          subject: 'New Festival Post Assigned to You',
          html,
          text,
        });
        console.log(`Email sent successfully to ${assignedUser.email}`);
      } catch (emailError) {
        console.error('Error sending assignment email:', emailError);
      }
    }

    return NextResponse.json(post, { status: 201 });
  } catch (error: any) {
    console.error('Error creating festival post:', {
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