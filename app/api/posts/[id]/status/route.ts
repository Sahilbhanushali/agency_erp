import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PostStatus, WorkflowStage, ContentStatus } from "@prisma/client";
import { z } from "zod";
import nodemailer from "nodemailer";
import fs from "fs/promises";
import path from "path";
import CryptoJS from "crypto-js";
import { requireSession } from "@/lib/api-auth";
import { transitionPost, workflowErrorResponse } from "@/lib/posts/workflow";
import type { WorkflowAction } from "@/lib/posts/workflow-rules";

/** The status a legacy caller asks for → the workflow action that produces it. */
const STATUS_TO_ACTION: Partial<Record<PostStatus, WorkflowAction>> = {
  SUBMITTED: "SUBMIT",
  RESUBMITTED: "SUBMIT",
  APPROVED: "APPROVE",
  REJECTED: "REJECT",
  NEEDS_MINOR_CHANGE: "REQUEST_CHANGES",
  SCHEDULED: "SCHEDULE",
  POSTED: "PUBLISH",
  CANCELLED: "CANCEL",
  DRAFT: "REOPEN",
};
import { APP_BASE_URL } from "@/lib/utils"
import { formatFrom, htmlToText } from "@/lib/smtp"
// Load the email template
const emailTemplatePath = path.join(
  process.cwd(),
  "public/templates",
  "rejection-email-template.html"
);
let emailTemplate: string | null = null;

const fallbackEmailTemplate = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Post Rejected</title>
</head>
<body style="font-family: Arial, sans-serif; color: #333;">
  <h1 style="color: #111827;">Post Rejected</h1>
  <p>Dear {{ designerName }},</p>
  <p>The post <strong>{{ postTitle }}</strong> for the project <strong>{{ projectName }}</strong> has been rejected. Please review the feedback below and resubmit the post.</p>
  <p><strong>Feedback:</strong> {{ feedback }}</p>
  <p><strong>Rejected At:</strong> {{ rejectedAt }}</p>
  <p><a href="{{ dashboardUrl }}" style="color: #111827;">View Post in Dashboard</a></p>
  <p>&copy; {{ currentYear }} itsmeDezino. All rights reserved.</p>
</body>
</html>
`;

async function loadEmailTemplate() {
  try {
    emailTemplate = await fs.readFile(emailTemplatePath, "utf-8");
    console.log("[Design Status API] Email template loaded successfully");
  } catch (error) {
    console.error("[Design Status API] Error loading email template:", error);
    emailTemplate = fallbackEmailTemplate;
    console.log("[Design Status API] Using fallback email template");
  }
}

const postStatusSchema = z.object({
  status: z.nativeEnum(PostStatus),
  /** The post version the caller's screen showed; a mismatch is a 409, not an overwrite. */
  expectedVersion: z.coerce.number().int().positive().optional(),
  feedback: z.string().optional(),
  approvedAt: z.string().datetime().optional(),
  rejectedAt: z.string().datetime().optional(),
  scheduledAt: z.string().datetime().optional(),
  postedAt: z.string().datetime().optional(),
  postedPlatforms: z.array(z.string()).optional(),
});

// Helper function to determine workflow stage
function determineWorkflowStage(
  designStatus: PostStatus,
  contentStatus: ContentStatus
): WorkflowStage {
  if (designStatus === PostStatus.SUBMITTED) {
    return WorkflowStage.DESIGN_REVIEW;
  }
  if (designStatus === PostStatus.REJECTED || designStatus === PostStatus.NEEDS_MINOR_CHANGE) {
    return WorkflowStage.DESIGN_PENDING;
  }
  if (designStatus === PostStatus.RESUBMITTED) {
    return WorkflowStage.DESIGN_REVIEW;
  }
  if (designStatus === PostStatus.APPROVED) {
    if (contentStatus === ContentStatus.APPROVED) {
      return WorkflowStage.BOTH_APPROVED;
    }
    return WorkflowStage.DESIGN_REVIEW;
  }
  if (designStatus === PostStatus.SCHEDULED) {
    return WorkflowStage.SCHEDULED;
  }
  if (designStatus === PostStatus.POSTED) {
    return WorkflowStage.PUBLISHED;
  }
  if (designStatus === PostStatus.DRAFT) {
    return WorkflowStage.DESIGN_IN_PROGRESS;
  }
  return WorkflowStage.DESIGN_PENDING;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  console.log(`[Design Status API] Received PATCH request for post ID: ${id}`);

  try {
    if (!prisma) {
      console.error("[Design Status API] Prisma client not initialized");
      return NextResponse.json(
        { error: "Database not available" },
        { status: 503 }
      );
    }

    // Signed in is all this checks: the permission depends on the transition, so the
    // workflow engine authorizes each one (approve needs posts:approve, schedule needs
    // posts:publish, ...) together with the caller's scope over this post.
    const auth = await requireSession();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    if (!id) {
      console.warn("[Design Status API] Invalid post ID provided");
      return NextResponse.json({ error: "Invalid post ID" }, { status: 400 });
    }

    // Parse and validate request body
    let body: any = {};
    try {
      const contentType = request.headers.get("content-type") || "";

      if (contentType.includes("application/json")) {
        try {
          body = await request.json();
        } catch (err) {
          console.error("[Design Status API] Invalid JSON body:", err);
          return NextResponse.json(
            { error: "Invalid JSON in request body" },
            { status: 400 }
          );
        }
      } else if (contentType.includes("multipart/form-data")) {
        try {
          const formData = await request.formData();
          body = Object.fromEntries(formData.entries());
        } catch (err) {
          console.error("[Design Status API] Invalid form-data body:", err);
          return NextResponse.json(
            { error: "Invalid form-data in request body" },
            { status: 400 }
          );
        }
      } else {
        return NextResponse.json(
          { error: "Unsupported content type" },
          { status: 415 }
        );
      }
    } catch (error) {
      console.error("[Design Status API] Failed to parse request body:", error);
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }

    const parsedBody = postStatusSchema.safeParse(body);
    if (!parsedBody.success) {
      console.warn(
        "[Design Status API] Invalid request body:",
        parsedBody.error.errors
      );
      return NextResponse.json(
        { error: "Invalid request body", details: parsedBody.error.errors },
        { status: 400 }
      );
    }

    const { status, feedback, approvedAt, rejectedAt, scheduledAt, postedAt } =
      parsedBody.data;

    // Validate status
    if (!Object.values(PostStatus).includes(status)) {
      console.warn(`[Design Status API] Invalid status: ${status}`);
      return NextResponse.json(
        {
          error: `Status must be one of: ${Object.values(PostStatus).join(", ")}`,
        },
        { status: 400 }
      );
    }

    const post = await prisma.post.findUnique({
      where: { id: id },
      include: {
        project: true,
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
            role: { select: { name: true } }, // Include role details
          },
        },
      },
    });
    console.log(post, 'postssss')

    if (!post) {
      console.warn(`[Design Status API] Post not found: ${id}`);
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    // Validate RESUBMITTED status
    if (status === PostStatus.RESUBMITTED && ![PostStatus.REJECTED, PostStatus.NEEDS_MINOR_CHANGE].includes(post.status)) {
      console.warn(
        `[Design Status API] Cannot set RESUBMITTED status on post with status: ${post.status}`
      );
      return NextResponse.json(
        { error: "Can only resubmit a post that is in REJECTED or NEEDS_MINOR_CHANGE status" },
        { status: 400 }
      );
    }

    // Validate REJECTED or NEEDS_MINOR_CHANGE status
    if (([PostStatus.REJECTED, PostStatus.NEEDS_MINOR_CHANGE] as PostStatus[]).includes(status) && post.status === PostStatus.DRAFT) {
      console.warn(
        `[Design Status API] Cannot reject post with current design status: ${post.status}`
      );
      return NextResponse.json(
        { error: "Cannot reject or request minor changes for a design that is in Draft status." },
        { status: 400 }
      );
    }

    // Require feedback for REJECTED or NEEDS_MINOR_CHANGE status changes
    if (([PostStatus.REJECTED, PostStatus.NEEDS_MINOR_CHANGE] as PostStatus[]).includes(status)) {
      if (!feedback || !feedback.trim()) {
        console.warn("[Design Status API] Feedback is required for REJECTED or NEEDS_MINOR_CHANGE status changes");
        return NextResponse.json(
          { error: "Comment is required for design status rejection or minor change request" },
          { status: 400 }
        );
      }
    }

    const currentTime = new Date();
    const userId = parseInt(session.user.id, 10);
    const oldPost = { ...post };

    // The status itself changes ONLY through the workflow engine, which validates the
    // transition, records it in the post timeline and refuses stale or duplicate
    // requests. Everything below this point is the route's existing bookkeeping
    // (approval flow, task log, assignments, emails) for a transition that succeeded.
    const action = STATUS_TO_ACTION[status];
    if (!action || (action === "REOPEN" && post.status !== PostStatus.CANCELLED)) {
      return NextResponse.json(
        {
          error:
            status === PostStatus.C_APPROVED
              ? "Client approval is recorded by the client through their share link."
              : `A post cannot be moved to ${status} directly.`,
        },
        { status: 409 },
      );
    }
    try {
      await transitionPost({
        postId: id,
        action,
        actor: { type: "USER", session, userId },
        reason: feedback ?? null,
        expectedVersion: parsedBody.data.expectedVersion,
        scheduledAt:
          action === "SCHEDULE"
            ? scheduledAt
              ? new Date(scheduledAt)
              : post.scheduledAt
            : undefined,
      });
    } catch (error) {
      return workflowErrorResponse(error);
    }

    // Determine new workflow stage
    const newWorkflowStage = determineWorkflowStage(status, post.contentStatus);

    // Fetch project with assigned users for Team Lead handling
    const projectWithUsers = await prisma.project.findUnique({
      where: { id: post.project.id },
      include: {
        assignedUsers: {
          include: {
            role: true,
          },
        },
      },
    });

    // Status, timestamps and the designerHeadApproval mirror were written by the engine.
    // Only the existing business rule that approving the post approves its copy stays
    // here — and only for a real approval, no longer for SCHEDULED/POSTED.
    const updateData: any = {};
    if (status === PostStatus.APPROVED) {
      updateData.contentStatus = ContentStatus.APPROVED;
      updateData.contentApprovedAt = currentTime;
      updateData.contentApprovedById = userId;
    }

    let usersToNotify: { id: number; email: string | null; name: string | null }[] = [];

    // Prepare TaskLog data
    const taskLogData = {
      action: `DESIGN_${status}`,
      oldStatus: post.status,
      newStatus: status,
      oldValues: { status: post.status },
      newValues: { status },
      feedback: feedback || null,
      ipAddress:
        request.headers.get("x-forwarded-for") || null,
      userAgent: request.headers.get("user-agent") || null,
      postId: id,
      userId: userId,
    };

    // Prepare UserActivity data
    const activityTypeMap: { [key in PostStatus]?: string } = {
      [PostStatus.SUBMITTED]: "DESIGN_SUBMITTED",
      [PostStatus.RESUBMITTED]: "DESIGN_RESUBMITTED",
      [PostStatus.APPROVED]: "DESIGN_APPROVED",
      [PostStatus.REJECTED]: "DESIGN_REJECTED",
      [PostStatus.NEEDS_MINOR_CHANGE]: "DESIGN_NEEDS_MINOR_CHANGE",
      [PostStatus.SCHEDULED]: "POST_SCHEDULED",
      [PostStatus.POSTED]: "POST_POSTED",
      [PostStatus.DRAFT]: "DESIGN_STARTED",
    };

    const userActivityData = {
      activityType: activityTypeMap[status] || "DESIGN_UPLOADED",
      entityType: "Post",
      entityId: id,
      description: `Design status changed to ${status} for post: ${post.title}`,
      metadata: {
        oldStatus: post.status,
        newStatus: status,
        oldWorkflowStage: "DESIGN_REVIEW",
        newWorkflowStage: newWorkflowStage,
        feedback: feedback || null,
      },
      ipAddress:
        request.headers.get("x-forwarded-for") || null,
      userAgent: request.headers.get("user-agent") || null,
      createdAt: currentTime,
      userId: userId,
      projectId: post.projectId,
    };

    // Get existing approval flow
    const existingApprovalFlow = await prisma.approvalFlow.findFirst({
      where: {
        postId: id,
        flowType: "DESIGN",
      },
      orderBy: { createdAt: "desc" },
    });

    // Prepare ApprovalFlow data
    const approvalFlowData = {
      flowType: "DESIGN",
      status: status,
      feedback: feedback || null,
      reviewedAt: ([PostStatus.APPROVED, PostStatus.REJECTED, PostStatus.NEEDS_MINOR_CHANGE] as PostStatus[]).includes(status)
        ? currentTime
        : null,
      reviewedById: ([PostStatus.APPROVED, PostStatus.REJECTED, PostStatus.NEEDS_MINOR_CHANGE] as PostStatus[]).includes(status)
        ? userId
        : null,
      submittedById:
        status === PostStatus.SUBMITTED || status === PostStatus.RESUBMITTED
          ? userId
          : existingApprovalFlow?.submittedById,
      submittedAt:
        status === PostStatus.SUBMITTED || status === PostStatus.RESUBMITTED
          ? currentTime
          : existingApprovalFlow?.submittedAt,
      submissionCount: existingApprovalFlow
        ? existingApprovalFlow.submissionCount +
          (status === PostStatus.RESUBMITTED ? 1 : 0)
        : 1,
      version: existingApprovalFlow ? existingApprovalFlow.version + 1 : 1,
      postId: id,
      assignedToId:
        ([PostStatus.REJECTED, PostStatus.NEEDS_MINOR_CHANGE] as PostStatus[]).includes(status) ? post.assignedToId : null,
      rejectionReason:
        ([PostStatus.REJECTED, PostStatus.NEEDS_MINOR_CHANGE] as PostStatus[]).includes(status) ? feedback : null,
    };

    // Prepare ApprovalHistory data
    const approvalHistoryData = {
      action: status,
      fromStatus: post.status,
      toStatus: status,
      feedback: feedback || null,
      version: approvalFlowData.version,
      metadata: {
        oldStatus: post.status,
        newStatus: status,
        workflowStage: newWorkflowStage,
        reviewedBy: session.user.name,
      },
      createdAt: currentTime,
      approvalFlowId: "",
      performedById: userId,
    };

    // Determine next assignment
    let nextAssigneeId: number | null = null;
    let assignmentRole = "";
    let assignmentStage = newWorkflowStage;

    if (status === PostStatus.REJECTED || status === PostStatus.NEEDS_MINOR_CHANGE) {
      nextAssigneeId = post.assignedToId;
      assignmentRole = "DESIGNER";
      assignmentStage = WorkflowStage.DESIGN_PENDING;
    }

    // Execute transaction
    const result = await prisma.$transaction(async (tx: any) => {
      // Update the post
      const updatedPost = await tx.post.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          title: true,
          status: true,
          contentStatus: true,
          approvedAt: true,
          rejectedAt: true,
          scheduledAt: true,
          postedAt: true,
        },
      });

      // Update posted platforms if provided
      if (parsedBody.data.postedPlatforms !== undefined) {
        await tx.postPlatform.updateMany({
          where: { postId: id },
          data: { isPosted: false },
        });
        if (parsedBody.data.postedPlatforms.length > 0) {
          await tx.postPlatform.updateMany({
            where: {
              postId: id,
              platform: { in: parsedBody.data.postedPlatforms },
            },
            data: { isPosted: true },
          });
        }
      }

      // Create TaskLog
      const taskLog = await tx.taskLog.create({
        data: taskLogData,
      });

      // Create UserActivity
      const userActivity = await tx.userActivity.create({
        data: userActivityData,
      });

      // Create ApprovalFlow
      const approvalFlow = await tx.approvalFlow.create({
        data: approvalFlowData,
      });

      // Create ApprovalHistory
      const approvalHistory = await tx.approvalHistory.create({
        data: {
          ...approvalHistoryData,
          approvalFlowId: approvalFlow.id,
        },
      });

      // Update PostAssignment for designer
      const designerAssignment = await tx.postAssignment.findFirst({
        where: {
          postId: id,
          role: "DESIGNER",
          status: "ACTIVE",
        },
      });

      if (designerAssignment) {
        await tx.postAssignment.update({
          where: { id: designerAssignment.id },
          data: {
            status:
              status === PostStatus.APPROVED ? "COMPLETED" : "ACTIVE",
            completedAt:
              status === PostStatus.APPROVED ? currentTime : null,
            stage: newWorkflowStage,
          },
        });
      }

      // Create new assignment if needed
      if (nextAssigneeId && assignmentRole) {
        await tx.postAssignment.create({
          data: {
            postId: id,
            userId: nextAssigneeId,
            role: assignmentRole,
            stage: assignmentStage,
            status: "ACTIVE",
            assignedAt: currentTime,
          },
        });
      }

      // Handle Team Lead assignment when converting from RESUBMITTED to APPROVED
      if (status === PostStatus.APPROVED && oldPost.status === PostStatus.RESUBMITTED) {
        console.log(`[Debug] Triggering Team Lead resubmission logic for post ${id}`);
        const designerHeads = projectWithUsers!.assignedUsers.filter(
          (user: any) => user.role?.name === "Team Lead"
        );
        console.log(`[Debug] Found ${designerHeads.length} Team Leads`);
        for (const dhUser of designerHeads) {
          const dhAssignment = await tx.postAssignment.findFirst({
            where: { postId: id, userId: dhUser.id, role: "Team Lead" },
            orderBy: { assignedAt: "desc" },
          });
          if (dhAssignment) {
            await tx.postAssignment.update({
              where: { id: dhAssignment.id },
              data: { 
                status: "PENDING",
                stage: newWorkflowStage 
              },
            });
          } else {
            await tx.postAssignment.create({
              data: {
                postId: id,
                userId: dhUser.id,
                role: "Team Lead",
                stage: newWorkflowStage,
                status: "PENDING",
                assignedAt: currentTime,
              },
            });
          }
        }
      }

      // Create comment for status changes
      if (feedback) {
        // Check for pending audio attachments
        const pendingAttachments = await tx.approvalAttachment.findMany({
          where: {
            approvalFlow: {
              postId: id,
              flowType: "DESIGN",
            },
            type: "AUDIO",
          },
          orderBy: { uploadedAt: "desc" },
        });

        // Create comment with audio reference if attachments exist
        const commentContent = pendingAttachments.length > 0
          ? `${feedback}\n\n🎙️ Audio feedback attached (${pendingAttachments.length} file(s))`
          : feedback;

        await tx.comment.create({
          data: {
            content: `Design Status ${status}: ${commentContent}`,
            type: "DESIGN",
            postId: id,
            userId: userId,
          },
        });

        // Create UserActivity for comment with audio metadata
        await tx.userActivity.create({
          data: {
            activityType: "COMMENT_ADDED",
            entityType: "Post",
            entityId: id,
            description: `Comment added for design status ${status} on post: ${post.title}`,
            metadata: {
              comment: `Design Status ${status}: ${feedback}`,
              status: status,
              hasAudioAttachment: pendingAttachments.length > 0,
              audioAttachments: pendingAttachments.map((a: any) => ({
                id: a.id,
                url: a.url,
                filename: a.filename,
              })),
            },
            ipAddress: request.headers.get("x-forwarded-for") || null,
            userAgent: request.headers.get("user-agent") || null,
            createdAt: currentTime,
            userId: userId,
            projectId: post.projectId,
          },
        });
      }

      // Fetch users to notify
      let notifyUsers: any[] = [];

      if (post.assignedToId) {
        const assignedUser = await tx.user.findUnique({
          where: { id: post.assignedToId },
          select: { id: true, name: true, email: true },
        });

        if (assignedUser) {
          notifyUsers = [assignedUser];
        }
      }

      // Create notifications
      const notificationData = notifyUsers.map((user) => ({
        title: `Post: ${post.title}`,
        message: `The post "${post.title}" has been "${status}" by ${session.user.name}. ${feedback ? `Feedback: ${feedback}` : ""}`,
        userId: user.id,
        isRead: false,
        createdAt: currentTime,
        link: `/dashboard/projects/posts/${post.id}`,
      }));

      await tx.notification.createMany({
        data: notificationData,
      });

      return {
        updatedPost,
        taskLog,
        userActivity,
        approvalFlow,
        approvalHistory,
      };
    });

    // Send email notification for REJECTED or NEEDS_MINOR_CHANGE status
    if ((status === PostStatus.REJECTED || status === PostStatus.NEEDS_MINOR_CHANGE) && post.assignedTo) {
      try {
        if (!emailTemplate) {
          await loadEmailTemplate();
        }

        const smtpDetails = await prisma.smtpDetails.findUnique({
          where: { userId: userId },
          select: {
            host: true,
            port: true,
            username: true,
            password: true,
            encryption: true,
            isVerified: true,
          },
        });
        const encryptionKey = process.env.SMTP_PASSWORD_ENCRYPTION_KEY;
        if (!encryptionKey) {
          console.error('SMTP password encryption key not found in environment variables');
          return NextResponse.json({ error: 'SMTP password encryption key not configured' }, { status: 500 });
        }

        let decryptedPassword: string;
        try {
          const bytes = CryptoJS.AES.decrypt(smtpDetails.password, encryptionKey);
          decryptedPassword = bytes.toString(CryptoJS.enc.Utf8);
          if (!decryptedPassword) {
            throw new Error('Decryption failed: Invalid key or corrupted data');
          }
        } catch (decryptError: any) {
          console.error('Failed to decrypt SMTP password:', decryptError.message);
          return NextResponse.json(
            { error: 'Failed to decrypt SMTP password', details: decryptError.message },
            { status: 500 }
          );
        }

        if (!smtpDetails || !smtpDetails.isVerified) {
          console.error(
            `[Design Status API] SMTP not configured or verified for user ID: ${userId}`
          );
        } else {
          const transporter = nodemailer.createTransport({
            host: smtpDetails.host,
            port: smtpDetails.port,
            secure: smtpDetails.port === 465,
            auth: {
              user: smtpDetails.username,
              pass: decryptedPassword,
            },
            tls: {
              minVersion: "TLSv1.2",
              rejectUnauthorized: true,
            },
          });

          await transporter.verify();

          // Fetch asset URL
          let assetUrl: string | null = null;
          const postWithAssets = await prisma.post.findFirst({
            where: { id: id },
            select: {
              assets: {
                where: { isReference: false, isEdited: false },
                orderBy: { order: "asc" },
                select: { url: true },
                take: 1,
              },
            },
          });

          if (postWithAssets?.assets && postWithAssets.assets.length > 0) {
            assetUrl = `${APP_BASE_URL}${postWithAssets.assets[0].url}`;
          }

          // Populate email template
          let emailHtml = emailTemplate!;
          emailHtml = emailHtml.replace(
            "{{ designerName }}",
            post.assignedTo.name || "Designer"
          );
          emailHtml = emailHtml.replace("{{ postTitle }}", post.title);
          emailHtml = emailHtml.replace("{{ projectName }}", post.project.name);
          emailHtml = emailHtml.replace("{{ postTitle }}", post.title);
          emailHtml = emailHtml.replace("{{ projectName }}", post.project.name);
          emailHtml = emailHtml.replace(
            "{{ feedback }}",
            feedback || "No feedback provided"
          );
          emailHtml = emailHtml.replace(
            "{{ rejectedAt }}",
            currentTime.toLocaleString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
              hour: "numeric",
              minute: "numeric",
              hour12: true,
            })
          );
          emailHtml = emailHtml.replace(
            "{{ dashboardUrl }}",
            `${APP_BASE_URL}/dashboard/tasks?projectId=${post.projectId}`
          );
          emailHtml = emailHtml.replace(
            "{{ currentYear }}",
            currentTime.getFullYear().toString()
          );

          if (status === PostStatus.NEEDS_MINOR_CHANGE) {
            emailHtml = emailHtml.replace("<h1>Post Rejected</h1>", "<h1>Post Needs Minor Change</h1>");
            emailHtml = emailHtml.replace("has been rejected", "needs minor change");
          }

          // Handle conditional assetUrl section
          if (assetUrl) {
            emailHtml = emailHtml.replace("{{ #assetUrl }}", "");
            emailHtml = emailHtml.replace("{{ /assetUrl }}", "");
            emailHtml = emailHtml.replace("{{ assetUrl }}", assetUrl);
          } else {
            emailHtml = emailHtml.replace(
              /{{ #assetUrl }}[\s\S]*?{{ \/assetUrl }}/g,
              ""
            );
          }

          const emailSubject = status === PostStatus.REJECTED ? `Post Rejected: ${post.title}` : `Post Needs Minor Change: ${post.title}`;

          await transporter.sendMail({
            from: formatFrom(smtpDetails.username),
            to: post.assignedTo.email,
            subject: emailSubject,
            html: emailHtml,
            // HTML-only mail is a heavy spam signal; this is the text/plain alternative.
            text: htmlToText(emailHtml),
          });

          console.log(
            `[Design Status API] Rejection email sent successfully to ${post.assignedTo.email}`
          );
        }
      } catch (emailError: any) {
        console.error(
          "[Design Status API] Error sending rejection email:",
          emailError
        );
      }
    }

    console.log(
      `[Design Status API] Updated post ${id}: status=${status}, workflow stage=${newWorkflowStage}`
    );
    return NextResponse.json({
      message: "Design status updated successfully",
      workflowStage: newWorkflowStage,
      ...result,
    });
  } catch (error: any) {
    console.error("[Design Status API] Error updating post status:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
