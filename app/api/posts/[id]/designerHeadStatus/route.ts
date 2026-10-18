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
import { requireCan } from "@/lib/api-auth";
import { APP_BASE_URL } from "@/lib/utils"
import { formatFrom, htmlToText } from "@/lib/smtp"

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

const designerHeadApprovalSchema = z.object({
  designerHeadApproval: z.nativeEnum(PostStatus),
  feedback: z.string().optional(),
  approvedAt: z.string().datetime().optional(),
  rejectedAt: z.string().datetime().optional(),
  scheduledAt: z.string().datetime().optional(),
  postedAt: z.string().datetime().optional(),
});

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
  if (designStatus === PostStatus.APPROVED || (designStatus as any) === "C_APPROVED") {
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
  console.log(`[Team Lead Approval API] Received PATCH request for post ID: ${id}`);

  try {
    if (!prisma) {
      console.error("[Team Lead Approval API] Prisma client not initialized");
      return NextResponse.json(
        { error: "Database not available" },
        { status: 503 }
      );
    }

    const auth = await requireCan("posts", "approve");
    if (!auth.ok) return auth.response;
    const session = auth.session;
    // Was a hardcoded deny-list of role names. The same policy now lives in the
    // permission catalog as posts:status, so an administrator can change who may
    // move a post through its workflow without editing this file.
    const statusAuth = await requireCan("posts", "status");
    if (!statusAuth.ok) return statusAuth.response;

    if (!id) {
      console.warn("[Team Lead Approval API] Invalid post ID provided");
      return NextResponse.json({ error: "Invalid post ID" }, { status: 400 });
    }

    let body: any = {};
    try {
      const contentType = request.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        try {
          body = await request.json();
        } catch (err) {
          console.error("[Team Lead Approval API] Invalid JSON body:", err);
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
          console.error("[Team Lead Approval API] Invalid form-data body:", err);
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
      console.error("[Team Lead Approval API] Failed to parse request body:", error);
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }

    const parsedBody = designerHeadApprovalSchema.safeParse(body);
    if (!parsedBody.success) {
      console.warn(
        "[Team Lead Approval API] Invalid request body:",
        parsedBody.error.errors
      );
      return NextResponse.json(
        { error: "Invalid request body", details: parsedBody.error.errors },
        { status: 400 }
      );
    }

    const { designerHeadApproval, feedback, approvedAt, rejectedAt } =
      parsedBody.data;

    if (!Object.values(PostStatus).includes(designerHeadApproval)) {
      console.warn(`[Team Lead Approval API] Invalid status: ${designerHeadApproval}`);
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
    console.log(post,'postssss')

    const projectManager = await prisma.project.findUnique({
      where: { id: post.project.id },
      include: {
        assignedUsers: {
          include: {
            role: true, // 👈 include the role relation
          },
        },
      },
    });

    if (!post) {
      console.warn(`[Team Lead Approval API] Post not found: ${id}`);
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    if (designerHeadApproval === PostStatus.RESUBMITTED && post.designerHeadApproval !== PostStatus.REJECTED && post.designerHeadApproval !== PostStatus.NEEDS_MINOR_CHANGE) {
      console.warn(
        `[Team Lead Approval API] Cannot set RESUBMITTED status on post with status: ${post.designerHeadApproval}`
      );
      return NextResponse.json(
        { error: "Can only resubmit a post that is in REJECTED or NEEDS_MINOR_CHANGE status" },
        { status: 400 }
      );
    }

    // Validate REJECTED or NEEDS_MINOR_CHANGE status
    if (([PostStatus.REJECTED, PostStatus.NEEDS_MINOR_CHANGE] as PostStatus[]).includes(designerHeadApproval) && post.status === PostStatus.DRAFT) {
      console.warn(
        `[Team Lead Approval API] Cannot reject post when design is in status: ${post.status}`
      );
      return NextResponse.json(
        { error: "Cannot reject or request minor changes for a design that is in Draft status." },
        { status: 400 }
      );
    }

    if ((designerHeadApproval === PostStatus.REJECTED || designerHeadApproval === PostStatus.NEEDS_MINOR_CHANGE) && !feedback) {
      console.warn("[Team Lead Approval API] Feedback is required for REJECTED or NEEDS_MINOR_CHANGE status");
      return NextResponse.json(
        { error: "Feedback is required for rejected or needs minor change posts" },
        { status: 400 }
      );
    }

    const currentTime = new Date();
    const userId = parseInt(session.user.id, 10);
    const oldPost = { ...post };

    const newWorkflowStage = determineWorkflowStage(designerHeadApproval, post.contentStatus);

    const updateData: any = {
      designerHeadApproval,
      status: designerHeadApproval,
    };

    if (designerHeadApproval === PostStatus.APPROVED || (designerHeadApproval as any) === "C_APPROVED") {
      updateData.designApprovedAt = approvedAt ? new Date(approvedAt) : currentTime;
      updateData.designApprovedById = userId;
      updateData.contentStatus = ContentStatus.APPROVED;
      updateData.contentApprovedAt = currentTime;
      updateData.contentApprovedById = userId;
    } else if (designerHeadApproval === PostStatus.REJECTED || designerHeadApproval === PostStatus.NEEDS_MINOR_CHANGE) {
      updateData.designRejectedAt = rejectedAt ? new Date(rejectedAt) : currentTime;
      updateData.designRejectedById = userId;
    }
      let usersToNotify: { id: number; email: string | null; name: string | null }[] = [];

    const taskLogData = {
      action: `DESIGNER_HEAD_${designerHeadApproval}`,
      oldStatus: post.designerHeadApproval,
      newStatus: designerHeadApproval,
      oldValues: { designerHeadApproval: post.designerHeadApproval },
      newValues: { designerHeadApproval },
      feedback: feedback || null,
      ipAddress:
        request.headers.get("x-forwarded-for") || null,
      userAgent: request.headers.get("user-agent") || null,
      postId: id,
      userId: userId,
    };

    const activityTypeMap: { [key in PostStatus]?: any } = {
      [PostStatus.APPROVED]: "DESIGNER_HEAD_APPROVED",
      [PostStatus.C_APPROVED]: "DESIGNER_HEAD_APPROVED",
      [PostStatus.REJECTED]: "DESIGNER_HEAD_REJECTED",
      [PostStatus.NEEDS_MINOR_CHANGE]: "DESIGNER_HEAD_NEEDS_MINOR_CHANGE",
    };

    const userActivityData = {
      activityType: activityTypeMap[designerHeadApproval] || "DESIGNER_HEAD_REJECTED",
      entityType: "Post",
      entityId: id,
      description: `Team Lead approval status changed to ${designerHeadApproval} for post: ${post.title}`,
      metadata: {
        oldStatus: post.designerHeadApproval,
        newStatus: designerHeadApproval,
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

    const existingApprovalFlow = await prisma.approvalFlow.findFirst({
      where: {
        postId: id,
        flowType: "DESIGNER_HEAD",
      },
      orderBy: { createdAt: "desc" },
    });

    const approvalFlowData = {
      flowType: "DESIGNER_HEAD",
      status: designerHeadApproval,
      feedback: feedback || null,
      reviewedAt: ([PostStatus.APPROVED, PostStatus.REJECTED, PostStatus.NEEDS_MINOR_CHANGE] as PostStatus[]).includes(designerHeadApproval)
        ? currentTime
        : null,
      reviewedById: ([PostStatus.APPROVED, PostStatus.REJECTED, PostStatus.NEEDS_MINOR_CHANGE] as PostStatus[]).includes(designerHeadApproval)
        ? userId
        : null,
      submittedById:
        designerHeadApproval === PostStatus.SUBMITTED || designerHeadApproval === PostStatus.RESUBMITTED
          ? userId
          : existingApprovalFlow?.submittedById,
      submittedAt:
        designerHeadApproval === PostStatus.SUBMITTED || designerHeadApproval === PostStatus.RESUBMITTED
          ? currentTime
          : existingApprovalFlow?.submittedAt,
      submissionCount: existingApprovalFlow
        ? existingApprovalFlow.submissionCount +
          (designerHeadApproval === PostStatus.RESUBMITTED ? 1 : 0)
        : 1,
      version: existingApprovalFlow ? existingApprovalFlow.version + 1 : 1,
      postId: id,
      assignedToId:
        (designerHeadApproval === PostStatus.REJECTED || designerHeadApproval === PostStatus.NEEDS_MINOR_CHANGE) ? post.assignedToId : null,
      rejectionReason:
        (designerHeadApproval === PostStatus.REJECTED || designerHeadApproval === PostStatus.NEEDS_MINOR_CHANGE) ? feedback : null,
    };

    const approvalHistoryData = {
      action: designerHeadApproval,
      fromStatus: post.designerHeadApproval,
      toStatus: designerHeadApproval,
      feedback: feedback || null,
      version: approvalFlowData.version,
      metadata: {
        oldStatus: post.designerHeadApproval,
        newStatus: designerHeadApproval,
        workflowStage: newWorkflowStage,
        reviewedBy: session.user.name,
      },
      createdAt: currentTime,
      approvalFlowId: "",
      performedById: userId,
    };

    let nextAssigneeId: number | null = null;
    let assignmentRole = "";
    let assignmentStage = newWorkflowStage;

    if (designerHeadApproval === PostStatus.REJECTED || designerHeadApproval === PostStatus.NEEDS_MINOR_CHANGE) {
      nextAssigneeId = post.assignedToId;
      assignmentRole = "DESIGNER";
      assignmentStage = WorkflowStage.DESIGN_PENDING;
    }

    const result = await prisma.$transaction(async (tx: any) => {
      const updatedPost = await tx.post.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          title: true,
          designerHeadApproval: true,
          contentStatus: true,
          designApprovedAt: true,
          designRejectedAt: true,
          status: true,
        },
      });

      const taskLog = await tx.taskLog.create({
        data: taskLogData,
      });

      const userActivity = await tx.userActivity.create({
        data: userActivityData,
      });

      const approvalFlow = await tx.approvalFlow.create({
        data: approvalFlowData,
      });

      const approvalHistory = await tx.approvalHistory.create({
        data: {
          ...approvalHistoryData,
          approvalFlowId: approvalFlow.id,
        },
      });

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
              designerHeadApproval === PostStatus.APPROVED ? "COMPLETED" : "ACTIVE",
            completedAt:
              designerHeadApproval === PostStatus.APPROVED ? currentTime : null,
            stage: newWorkflowStage,
          },
        });
      }

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

      if ((designerHeadApproval === PostStatus.REJECTED || designerHeadApproval === PostStatus.NEEDS_MINOR_CHANGE) && feedback) {
        const pendingAttachments = await tx.approvalAttachment.findMany({
          where: {
            approvalFlow: {
              postId: id,
              flowType: "DESIGNER_HEAD",
            },
            type: "AUDIO",
          },
          orderBy: { uploadedAt: "desc" },
        });

        const commentContent = pendingAttachments.length > 0
          ? `${feedback}\n\n🎙️ Audio feedback attached (${pendingAttachments.length} file(s))`
          : feedback;

        await tx.comment.create({
          data: {
            content: commentContent,
            type: "DESIGNER_HEAD",
            postId: id,
            userId: userId,
          },
        });

        await tx.userActivity.create({
          data: {
            activityType: "COMMENT_ADDED",
            entityType: "Post",
            entityId: id,
            description: `Comment added for Team Lead approval status ${designerHeadApproval} on post: ${post.title}`,
            metadata: {
              oldStatus: post.designerHeadApproval,
              newStatus: designerHeadApproval,
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

usersToNotify = [];

// 1️⃣ Check the user assigned to the post
if (post.assignedTo) {
  usersToNotify.push(post.assignedTo);
}

// 2️⃣ Also check assigned project users who have "Social Media Manager" role
const socialMediaManagers = projectManager.assignedUsers.filter(
  (user: any) => user.role?.name === "Social Media Manager" 
);
console.log(socialMediaManagers,"wowowo")

usersToNotify.push(...socialMediaManagers);

// 3️⃣ (Optional) Remove duplicates if any
usersToNotify = usersToNotify.filter(
  (user, index, self) => index === self.findIndex((u) => u.id === user.id)
);

console.log("Users to notify (Social Media Manager only):", usersToNotify);

      const notificationData = usersToNotify.map((user) => ({
        title: `Post: ${post.title}`,
        message: `The post "${post.title}" Team Lead approval has been "${designerHeadApproval}" by ${session.user.name}. ${feedback ? `Feedback: ${feedback}` : ""}`,
        userId: user.id,
        isRead: false,
        link: `/dashboard/projects/posts/${post.id}`,
        createdAt: currentTime,
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

if ((designerHeadApproval === PostStatus.REJECTED || designerHeadApproval === PostStatus.NEEDS_MINOR_CHANGE) && post.assignedTo) {
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
      if (!decryptedPassword) throw new Error('Decryption failed: Invalid key or corrupted data');
    } catch (decryptError: any) {
      console.error('Failed to decrypt SMTP password:', decryptError.message);
      return NextResponse.json(
        { error: 'Failed to decrypt SMTP password', details: decryptError.message },
        { status: 500 }
      );
    }

    if (!smtpDetails || !smtpDetails.isVerified) {
      console.error(`[Team Lead Approval API] SMTP not configured or verified for user ID: ${userId}`);
      return;
    }

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

    // Get the first asset URL if available
    let assetUrl: string | null = null;
    const postWithAssets = await prisma.post.findFirst({
      where: { id: post.id },
      select: {
        assets: {
          where: { isReference: false, isEdited: false },
          orderBy: { order: "asc" },
          select: { url: true },
          take: 1,
        },
      },
    });

    if (postWithAssets?.assets?.length) {
      assetUrl = `${APP_BASE_URL}${postWithAssets.assets[0].url}`;
    }

    // Loop through all usersToNotify
    for (const user of usersToNotify) {
      if (!user.email) continue;

      let emailHtml = emailTemplate!;
      const recipientName = user.name || "Team Member";

      // Replace placeholders
      emailHtml = emailHtml.replace("{{ designerName }}", user.name || "Designer");
      emailHtml = emailHtml.replace("{{ postTitle }}", post.title);
      emailHtml = emailHtml.replace("{{ projectName }}", post.project.name);
      emailHtml = emailHtml.replace("{{ feedback }}", feedback || "No feedback provided");
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
      emailHtml = emailHtml.replace("{{ currentYear }}", currentTime.getFullYear().toString());

      if (assetUrl) {
        emailHtml = emailHtml.replace("{{ #assetUrl }}", "");
        emailHtml = emailHtml.replace("{{ /assetUrl }}", "");
        emailHtml = emailHtml.replace("{{ assetUrl }}", assetUrl);
      } else {
        emailHtml = emailHtml.replace(/{{ #assetUrl }}[\s\S]*?{{ \/assetUrl }}/g, "");
      }

      if (designerHeadApproval === PostStatus.NEEDS_MINOR_CHANGE) {
        emailHtml = emailHtml.replace("Post Rejected", "Needs Minor Change");
        emailHtml = emailHtml.replace("has been rejected", "needs minor change");
      }

      try {
        await transporter.sendMail({
          from: formatFrom(smtpDetails.username),
          to: user.email,
          subject: designerHeadApproval === PostStatus.NEEDS_MINOR_CHANGE
            ? `Team Lead Approval - Needs Minor Change: ${post.title}`
            : `Team Lead Approval Rejected: ${post.title}`,
          html: emailHtml,
          // HTML-only mail is a heavy spam signal; this is the text/plain alternative.
          text: htmlToText(emailHtml),
        });
        console.log(`[Team Lead Approval API] Rejection/Minor change email sent successfully to ${user.email}`);
      } catch (sendError: any) {
        console.error(`[Team Lead Approval API] Error sending email to ${user.email}:`, sendError);
      }
    }
  } catch (emailError: any) {
    console.error("[Team Lead Approval API] Error sending rejection emails:", emailError);
  }
}


    console.log(
      `[Team Lead Approval API] Updated post ${id}: designerHeadApproval=${designerHeadApproval}, workflow stage=${newWorkflowStage}`
    );
    return NextResponse.json({
      message: "Team Lead approval updated successfully",
      workflowStage: newWorkflowStage,
      ...result,
    });
  } catch (error: any) {
    console.error("[Team Lead Approval API] Error updating post Team Lead approval:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
