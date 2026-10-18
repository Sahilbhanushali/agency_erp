import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PostStatus, WorkflowStage, ContentStatus } from "@prisma/client";
import { promises as fs } from "fs";
import path from "path";
import { z } from "zod";
import nodemailer from "nodemailer";
import CryptoJS from "crypto-js"; // Import crypto-js
import { can, requireCan } from "@/lib/api-auth";
import { APP_BASE_URL } from "@/lib/utils"
import { formatFrom, htmlToText } from "@/lib/smtp"

// Load email templates
const rejectionEmailTemplatePath = path.join(process.cwd(), "public/templates", "rejection-email-template.html");
const submissionEmailTemplatePath = path.join(process.cwd(), "public/templates", "submission-email-template.html");
let rejectionEmailTemplate: string | null = null;
let submissionEmailTemplate: string | null = null;

const fallbackRejectionEmailTemplate = `
Post Rejected
Dear {{ designerName }},
The post {{ postTitle }} for the project {{ projectName }} has been rejected. Please review the feedback below and resubmit the post.
Feedback: {{ feedback }}
Rejected At: {{ rejectedAt }}
View Post in Dashboard
© {{ currentYear }} itsmeDezino. All rights reserved.
`;

const fallbackSubmissionEmailTemplate = `
Post {{ status }} 
Dear {{ recipientName }},
The post {{ postTitle }} for the project {{ projectName }} has been {{ statusVerb }} by {{ submittedByName }}.
{{ #feedback }}
Feedback: {{ feedback }}
{{ /feedback }}
Submitted At: {{ submittedAt }}
View Post in Dashboard
© {{ currentYear }} itsmeDezino. All rights reserved.
`;

async function loadEmailTemplates() {
  try {
    rejectionEmailTemplate = await fs.readFile(rejectionEmailTemplatePath, "utf-8");
    submissionEmailTemplate = await fs.readFile(submissionEmailTemplatePath, "utf-8");
    console.log("[Design Status API] Email templates loaded successfully");
  } catch (error) {
    console.error("[Design Status API] Error loading email templates:", error);
    rejectionEmailTemplate = fallbackRejectionEmailTemplate;
    submissionEmailTemplate = fallbackSubmissionEmailTemplate;
    console.log("[Design Status API] Using fallback email templates");
  }
}

// Helper function to determine workflow stage
function determineWorkflowStage(designStatus: PostStatus, contentStatus: ContentStatus): WorkflowStage {
  if (designStatus === PostStatus.SUBMITTED) {
    return WorkflowStage.DESIGN_REVIEW;
  }
  if (designStatus === PostStatus.RESUBMITTED) {
    return WorkflowStage.DESIGN_REVIEW;
  }
  if (designStatus === PostStatus.REJECTED) {
    return WorkflowStage.DESIGN_PENDING;
  }
  if (designStatus === PostStatus.APPROVED) {
    return contentStatus === ContentStatus.APPROVED ? WorkflowStage.BOTH_APPROVED : WorkflowStage.DESIGN_REVIEW;
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

// POST endpoint for uploading design assets
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  try {
    const auth = await requireCan("assets", "create");
    if (!auth.ok) return auth.response;
    const session = auth.session;
    const formData = await request.formData();
    const files = formData.getAll("files") as File[];
    const feedback = formData.get("feedback") as string | null;
    const linkUrl = formData.get("linkUrl") as string | null;

    if (!files.length && !linkUrl) {
      return NextResponse.json({ error: "No files or link provided" }, { status: 400 });
    }

const post = await prisma.post.findUnique({
      where: { id: params.id },
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

console.log(JSON.stringify(projectManager, null, 2));


    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    const maxFileSize = 500 * 1024 * 1024; // 100MB
    const uploadDir = path.join(process.cwd(), "public", "uploads");

    await fs.mkdir(uploadDir, { recursive: true });

    for (const file of files) {
      if (file.size > maxFileSize) {
        return NextResponse.json({ error: `File ${file.name} exceeds 100MB limit` }, { status: 400 });
      }
      if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
        return NextResponse.json({ error: `File ${file.name} is not an image or video` }, { status: 400 });
      }
    }

    const currentTime = new Date();
    const userId = parseInt(session.user.id, 10);

    let newStatus: PostStatus | undefined;
    if (post.status === PostStatus.DRAFT) {
      newStatus = PostStatus.SUBMITTED;
    } else if (post.status === PostStatus.SUBMITTED || post.status === PostStatus.REJECTED) {
      newStatus = PostStatus.RESUBMITTED;
    }
     else if (post.status === PostStatus.RESUBMITTED ) {
      newStatus = PostStatus.RESUBMITTED;
    }

    const lastApprovalFlow = await prisma.approvalFlow.findFirst({
      where: { postId: params.id, flowType: "DESIGN" },
      orderBy: { createdAt: "desc" },
    });

    const isResubmissionAfterRejection = post.status === PostStatus.REJECTED && newStatus === PostStatus.RESUBMITTED;
    const submissionCount = lastApprovalFlow
      ? isResubmissionAfterRejection
        ? lastApprovalFlow.submissionCount + 1
        : lastApprovalFlow.submissionCount
      : 1;
    const version = lastApprovalFlow ? lastApprovalFlow.version + 1 : 1;
    const newWorkflowStage = determineWorkflowStage(newStatus || post.status, post.contentStatus);

    const savedFiles: { filename: string; generatedName: string; size: number; type: string }[] = [];
    const fsNode = await import('fs');
    for (const file of files) {
      const originalName = file.name;
      const sanitizedBaseName = originalName.replace(/\s+/g, "_").replace(/[^\w.-]/g, "").toLowerCase();
      const fileName = `${Date.now()}-${sanitizedBaseName}`;
      const filePath = path.join(uploadDir, fileName);
      
      const writeStream = fsNode.createWriteStream(filePath);
      const reader = file.stream().getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          writeStream.write(value);
        }
      } finally {
        writeStream.end();
      }

      savedFiles.push({
        filename: originalName,
        generatedName: fileName,
        size: file.size,
        type: file.type.startsWith("image/") ? "image" : "video",
      });
    }
    
    if (linkUrl) {
      try {
        const urlObj = new URL(linkUrl);
        savedFiles.push({
          filename: urlObj.hostname,
          generatedName: linkUrl,
          size: 0,
          type: "link",
        });
      } catch (e) {
        return NextResponse.json({ error: "Invalid link URL" }, { status: 400 });
      }
    }

    // Define usersToNotify in the outer scope with an explicit type
    let usersToNotify: { id: number; email: string | null; name: string | null }[] = [];

    const taskLogData = {
      action: newStatus ? `DESIGN_${newStatus}` : `DESIGN_ASSET_UPLOADED`,
      oldStatus: post.status,
      newStatus: newStatus || post.status,
      oldValues: { status: post.status, assetCount: 0 },
      newValues: { status: newStatus || post.status, assetCount: files.length },
      feedback: feedback || null,
      ipAddress: request.headers.get("x-forwarded-for") || null,
      userAgent: request.headers.get("user-agent") || null,
      postId: params.id,
      userId: userId,
    };

    const activityType = newStatus === PostStatus.SUBMITTED ? "DESIGN_SUBMITTED" : newStatus === PostStatus.RESUBMITTED ? "DESIGN_RESUBMITTED" : "DESIGN_UPLOADED";
    const userActivityData = {
      activityType: activityType,
      entityType: "Post",
      entityId: params.id,
      description: `${session.user.name} ${newStatus === PostStatus.SUBMITTED ? "submitted" : newStatus === PostStatus.RESUBMITTED ? "resubmitted" : "uploaded"} design assets for post: ${post.title}`,
      metadata: {
        feedback: feedback || null,
        fileCount: files.length,
        oldStatus: post.status,
        newStatus: newStatus || post.status,
        workflowStage: newWorkflowStage,
      },
      ipAddress: request.headers.get("x-forwarded-for") || null,
      userAgent: request.headers.get("user-agent") || null,
      userId: userId,
      projectId: post.projectId,
    };

    const approvalFlowData = {
      flowType: "DESIGN",
      status: newStatus || "PENDING",
      submittedAt: currentTime,
      submissionCount: submissionCount,
      version: version,
      submittedById: userId,
      feedback: feedback || null,
      postId: params.id,
      assignedToId: null,
    };

    const approvalHistoryData = {
      action: newStatus || "UPLOADED",
      fromStatus: post.status,
      toStatus: newStatus || post.status,
      feedback: feedback || null,
      version: version,
      metadata: {
        fileCount: files.length,
        workflowStage: newWorkflowStage,
        uploadedBy: session.user.name,
      },
      createdAt: currentTime,
      approvalFlowId: "",
      performedById: userId,
    };

    const result = await prisma.$transaction(async (tx: any) => {
      // Allow appending designer assets instead of deleting previous ones
      // await tx.asset.deleteMany({ where: { postId: params.id, isReference: false } });
      const assetPromises = savedFiles.map((savedFile, index) =>
        tx.asset.create({
          data: {
            filename: savedFile.filename,
            url: savedFile.type === "link" ? savedFile.generatedName : `/api/uploads/${savedFile.generatedName}`,
            size: savedFile.size,
            type: savedFile.type,
            order: index,
            postId: params.id,
            uploadedById: userId,
          },
        })
      );
      const assets = await Promise.all(assetPromises);

      let updatedPost = null;
      if (newStatus) {
        updatedPost = await tx.post.update({
          where: { id: params.id },
          data: { status: newStatus },
        });
      }

      const taskLog = await tx.taskLog.create({ data: taskLogData });
      const userActivity = await tx.userActivity.create({ data: userActivityData });
      const approvalFlow = await tx.approvalFlow.create({ data: approvalFlowData });
      const approvalHistory = await tx.approvalHistory.create({
        data: { ...approvalHistoryData, approvalFlowId: approvalFlow.id },
      });

      const designerAssignment = await tx.postAssignment.findFirst({
        where: { postId: params.id, role: "DESIGNER" },
        orderBy: { assignedAt: "desc" },
      });

      if (designerAssignment) {
        await tx.postAssignment.update({
          where: { id: designerAssignment.id },
          data: { status: "ACTIVE", stage: newWorkflowStage },
        });
      } else {
        await tx.postAssignment.create({
          data: {
            postId: params.id,
            userId: userId,
            role: "DESIGNER",
            stage: newWorkflowStage,
            status: "ACTIVE",
            assignedAt: currentTime,
          },
        });
      }

      await tx.userActivity.create({
        data: {
          activityType: "ASSET_UPLOADED",
          entityType: "Post",
          entityId: params.id,
          description: `${files.length} asset(s) uploaded for post: ${post.title}`,
          metadata: { assetCount: files.length, assetTypes: savedFiles.map((f) => f.type) },
          ipAddress: request.headers.get("x-forwarded-for") || null,
          userAgent: request.headers.get("user-agent") || null,
          userId: userId,
          projectId: post.projectId,
        },
      });

      if (feedback && newStatus && newStatus === PostStatus.RESUBMITTED) {
        await tx.comment.create({
          data: {
            content: `Design Status ${newStatus}: ${feedback}`,
            type: "DESIGN",
            postId: params.id,
            userId: userId,
          },
        });

        await tx.userActivity.create({
          data: {
            activityType: "COMMENT_ADDED",
            entityType: "Post",
            entityId: params.id,
            description: `Comment added during design resubmission for post: ${post.title}`,
            metadata: { comment: feedback, status: newStatus },
            ipAddress: request.headers.get("x-forwarded-for") || null,
            userAgent: request.headers.get("user-agent") || null,
            userId: userId,
            projectId: post.projectId,
          },
        });
      }

      // const rolesToNotify = ["Social Media Manager"];
      // Populate usersToNotify inside the transaction
usersToNotify = [];

// 1️⃣ Check the user assigned to the post
if (post.assignedTo?.role?.name === "Social Media Manager") {
  usersToNotify.push(post.assignedTo);
}

// 2️⃣ Also check assigned project users who have "Social Media Manager" role
const socialMediaManagers = projectManager.assignedUsers.filter(
  (user: any) => user.role?.name === "Social Media Manager"
);

usersToNotify.push(...socialMediaManagers);

// 3️⃣ (Optional) Remove duplicates if any
usersToNotify = usersToNotify.filter(
  (user: any, index: number, self: any[]) => index === self.findIndex((u: any) => u.id === user.id)
);

console.log("Users to notify (Social Media Manager only):", usersToNotify);


      // if (post.project.managerId && !usersToNotify.some((user) => user.id === post.project.managerId)) {
      //   const manager = await tx.user.findUnique({
      //     where: { id: post.project.managerId },
      //     select: { id: true, email: true, name: true },
      //   });
      //   if (manager) usersToNotify.push(manager);
      // }

      if (usersToNotify.length > 0) {
        const notificationData = usersToNotify.map((user) => ({
          title: `Design ${newStatus === PostStatus.SUBMITTED ? "Submitted" : "Resubmitted"}: ${post.title}`,
          message: `${session.user.name} has ${newStatus === PostStatus.SUBMITTED ? "submitted" : "resubmitted"} design assets for "${post.title}". ${feedback ? `Feedback: ${feedback}` : ""}`,
          userId: user.id,
          isRead: false,
          createdAt: currentTime,
          link: `/dashboard/projects/posts/${post.id}`,
        }));
        await tx.notification.createMany({ data: notificationData });
      }

      return { assets, updatedPost, taskLog, userActivity, approvalFlow, approvalHistory };
    });
console.log("newStatus:", newStatus)
    // Send email notification for SUBMITTED or RESUBMITTED status
if (newStatus && (newStatus === PostStatus.SUBMITTED || newStatus === PostStatus.RESUBMITTED) && result.updatedPost) {
  // Run email sending asynchronously so it doesn't block the API response
  (async () => {
    try {
      if (!submissionEmailTemplate) {
        await loadEmailTemplates();
      }

      const smtpDetails = await prisma.smtpDetails.findUnique({
        where: { userId: userId },
        select: { host: true, port: true, username: true, password: true, encryption: true, isVerified: true },
      });

      const encryptionKey = process.env.SMTP_PASSWORD_ENCRYPTION_KEY;
      if (!encryptionKey) {
        console.error('SMTP password encryption key not found in environment variables');
        return;
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
        return;
      }

      if (!smtpDetails || !smtpDetails.isVerified) {
        console.error(`[Design Status API] SMTP not configured or verified for user ID: ${userId}`);
      } else {
        const transporter = nodemailer.createTransport({
          host: smtpDetails.host,
          port: smtpDetails.port,
          secure: smtpDetails.port === 465,
          auth: { user: smtpDetails.username, pass: decryptedPassword },
          tls: { minVersion: "TLSv1.2", rejectUnauthorized: true },
        });

        // Do not await transporter.verify() to prevent long hangs if SMTP is misconfigured
        // await transporter.verify();

        const postWithAssets = await prisma.post.findFirst({
          where: { id: params.id },
          select: {
            assets: {
              where: { isReference: false, isEdited: false },
              orderBy: { order: "asc" },
              select: { url: true },
              take: 1,
            },
          },
        });

        let assetUrl: string | null = null;
        if (postWithAssets?.assets && postWithAssets.assets.length > 0) {
          assetUrl = `${APP_BASE_URL}${postWithAssets.assets[0].url}`;
        }

        const statusVerb = newStatus === PostStatus.SUBMITTED ? "submitted" : "resubmitted";
        const dashboardUrl = `${APP_BASE_URL}/dashboard/projects/posts?projectId=${post.projectId}`;
        const currentYear = currentTime.getFullYear().toString();
        const formattedDate = currentTime.toLocaleString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "numeric",
          minute: "numeric",
          hour12: true,
        });

        // Send individual emails to each recipient
        for (const user of usersToNotify) {
          if (!user.email) continue;

          let emailHtml = submissionEmailTemplate!;
          const recipientName = user.name || "Team Member";
          
          emailHtml = emailHtml.replace(/\{\{ status \}\}/g, (newStatus as string) || "");
          emailHtml = emailHtml.replace(/\{\{ statusVerb \}\}/g, statusVerb);
          emailHtml = emailHtml.replace(/\{\{ recipientName \}\}/g, recipientName);
          emailHtml = emailHtml.replace(/\{\{ postTitle \}\}/g, post.title);
          emailHtml = emailHtml.replace(/\{\{ projectName \}\}/g, post.project.name);
          emailHtml = emailHtml.replace(/\{\{ submittedByName \}\}/g, session.user.name || "");
          emailHtml = emailHtml.replace(/\{\{ submittedAt \}\}/g, formattedDate);
          emailHtml = emailHtml.replace(/\{\{ dashboardUrl \}\}/g, dashboardUrl);
          emailHtml = emailHtml.replace(/\{\{ currentYear \}\}/g, currentYear);

          if (feedback) {
            emailHtml = emailHtml.replace(/\{\{ #feedback \}\}/g, "");
            emailHtml = emailHtml.replace(/\{\{ \/feedback \}\}/g, "");
            emailHtml = emailHtml.replace(/\{\{ feedback \}\}/g, feedback);
          } else {
            emailHtml = emailHtml.replace(/\{\{ #feedback \}\}[\s\S]*?\{\{ \/feedback \}\}/g, "");
          }

          if (assetUrl) {
            emailHtml = emailHtml.replace(/\{\{ #assetUrl \}\}/g, "");
            emailHtml = emailHtml.replace(/\{\{ \/assetUrl \}\}/g, "");
            emailHtml = emailHtml.replace(/\{\{ assetUrl \}\}/g, assetUrl);
          } else {
            emailHtml = emailHtml.replace(/\{\{ #assetUrl \}\}[\s\S]*?\{\{ \/assetUrl \}\}/g, "");
          }

          try {
            await transporter.sendMail({
              from: formatFrom(smtpDetails.username),
              to: user.email,
              subject: `Post ${newStatus}: ${post.title}`,
              html: emailHtml,
              // HTML-only mail is a heavy spam signal; this is the text/plain alternative.
              text: htmlToText(emailHtml),
            });
            console.log(`[Design Status API] ${newStatus} email sent successfully to ${user.email}`);
          } catch (sendError: any) {
            console.error(`[Design Status API] Error sending email to ${user.email}:`, sendError);
          }
        }
      }
    } catch (emailError: any) {
      console.error(`[Design Status API] Error sending ${newStatus} email:`, emailError);
    }
  })();
}

    return NextResponse.json({
      message: "Assets uploaded and status updated successfully",
      workflowStage: newWorkflowStage,
      ...result,
    });
  } catch (error) {
    console.error("Error uploading assets:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to upload assets";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

// PATCH endpoint for updating design status
const postStatusSchema = z.object({
  status: z.nativeEnum(PostStatus),
  feedback: z.string().optional(),
  approvedAt: z.string().datetime().optional(),
  rejectedAt: z.string().datetime().optional(),
  scheduledAt: z.string().datetime().optional(),
  postedAt: z.string().datetime().optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  console.log(`[Design Status API] Received PATCH request for post ID: ${id}`);

  try {
    if (!prisma) {
      console.error("[Design Status API] Prisma client not initialized");
      return NextResponse.json({ error: "Database not available" }, { status: 503 });
    }

    const session = await getServerSession(authOptions);
    if (!session || !(await can(session, "posts", "update"))) {
      console.warn(`[Design Status API] Unauthorized access: session=${!!session}, role=${session?.user.role}`);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!id) {
      console.warn("[Design Status API] Invalid post ID provided");
      return NextResponse.json({ error: "Invalid post ID" }, { status: 400 });
    }

    const body = await request.json();
    const parsedBody = postStatusSchema.safeParse(body);
    if (!parsedBody.success) {
      console.warn("[Design Status API] Invalid request body:", parsedBody.error.errors);
      return NextResponse.json({ error: "Invalid request body", details: parsedBody.error.errors }, { status: 400 });
    }

    const { status, feedback, approvedAt, rejectedAt, scheduledAt, postedAt } = parsedBody.data;

    if (!Object.values(PostStatus).includes(status)) {
      console.warn(`[Design Status API] Invalid status: ${status}`);
      return NextResponse.json({ error: `Status must be one of: ${Object.values(PostStatus).join(", ")}` }, { status: 400 });
    }

    const post = await prisma.post.findUnique({
      where: { id },
      include: { project: true, assignedTo: { select: { email: true, name: true, id: true } } },
    });

    if (!post) {
      console.warn(`[Design Status API] Post not found: ${id}`);
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    if (status === PostStatus.RESUBMITTED && post.status !== PostStatus.REJECTED) {
      console.warn(`[Design Status API] Cannot set RESUBMITTED status on post with status: ${post.status}`);
      return NextResponse.json({ error: "Can only resubmit a post that is in REJECTED status" }, { status: 400 });
    }

    if (status === PostStatus.REJECTED && !feedback) {
      console.warn("[Design Status API] Feedback is required for REJECTED status");
      return NextResponse.json({ error: "Feedback is required for rejected posts" }, { status: 400 });
    }

    const currentTime = new Date();
    const userId = parseInt(session.user.id, 10);
    const newWorkflowStage = determineWorkflowStage(status, post.contentStatus);

    const updateData: any = { status };
    if (status === PostStatus.APPROVED) {
      updateData.approvedAt = approvedAt ? new Date(approvedAt) : currentTime;
      updateData.designApprovedAt = currentTime;
      updateData.designApprovedById = userId;
    } else if (status === PostStatus.REJECTED) {
      updateData.rejectedAt = rejectedAt ? new Date(rejectedAt) : currentTime;
      updateData.designRejectedAt = currentTime;
      updateData.designRejectedById = userId;
    } else if (status === PostStatus.SCHEDULED) {
      updateData.scheduledAt = scheduledAt ? new Date(scheduledAt) : currentTime;
    } else if (status === PostStatus.POSTED) {
      updateData.postedAt = postedAt ? new Date(postedAt) : currentTime;
    }

    const taskLogData = {
      action: `DESIGN_${status}`,
      oldStatus: post.status,
      newStatus: status,
      oldValues: { status: post.status },
      newValues: { status },
      feedback: feedback || null,
      ipAddress: request.headers.get("x-forwarded-for") || null,
      userAgent: request.headers.get("user-agent") || null,
      postId: id,
      userId: userId,
    };

    const activityTypeMap: { [key in PostStatus]?: string } = {
      [PostStatus.SUBMITTED]: "DESIGN_SUBMITTED",
      [PostStatus.RESUBMITTED]: "DESIGN_RESUBMITTED",
      [PostStatus.APPROVED]: "DESIGN_APPROVED",
      [PostStatus.REJECTED]: "DESIGN_REJECTED",
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
      ipAddress: request.headers.get("x-forwarded-for") || null,
      userAgent: request.headers.get("user-agent") || null,
      createdAt: currentTime,
      userId: userId,
      projectId: post.projectId,
    };

    const existingApprovalFlow = await prisma.approvalFlow.findFirst({
      where: { postId: id, flowType: "DESIGN" },
      orderBy: { createdAt: "desc" },
    });

    const approvalFlowData = {
      flowType: "DESIGN",
      status: status,
      feedback: feedback || null,
      reviewedAt: (status === PostStatus.APPROVED || status === PostStatus.REJECTED) ? currentTime : null,
      reviewedById: (status === PostStatus.APPROVED || status === PostStatus.REJECTED) ? userId : null,
      submittedById: status === PostStatus.SUBMITTED || status === PostStatus.RESUBMITTED ? userId : existingApprovalFlow?.submittedById,
      submittedAt: status === PostStatus.SUBMITTED || status === PostStatus.RESUBMITTED ? currentTime : existingApprovalFlow?.submittedAt,
      submissionCount: existingApprovalFlow ? existingApprovalFlow.submissionCount + (status === PostStatus.RESUBMITTED ? 1 : 0) : 1,
      version: existingApprovalFlow ? existingApprovalFlow.version + 1 : 1,
      postId: id,
      assignedToId: status === PostStatus.REJECTED ? post.assignedToId : null,
      rejectionReason: status === PostStatus.REJECTED ? feedback : null,
    };

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

    let nextAssigneeId: number | null = null;
    let assignmentRole = "";
    let assignmentStage = newWorkflowStage;

    if (status === PostStatus.REJECTED) {
      nextAssigneeId = post.assignedToId;
      assignmentRole = "DESIGNER";
      assignmentStage = WorkflowStage.DESIGN_PENDING;
    }

    const result = await prisma.$transaction(async (tx: any) => {
      const updatedPost = await tx.post.update({
        where: { id },
        data: updateData,
        select: { id: true, title: true, status: true, contentStatus: true, approvedAt: true, rejectedAt: true, scheduledAt: true, postedAt: true },
      });

      const taskLog = await tx.taskLog.create({ data: taskLogData });
      const userActivity = await tx.userActivity.create({ data: userActivityData });
      const approvalFlow = await tx.approvalFlow.create({ data: approvalFlowData });
      const approvalHistory = await tx.approvalHistory.create({
        data: { ...approvalHistoryData, approvalFlowId: approvalFlow.id },
      });

      const designerAssignment = await tx.postAssignment.findFirst({
        where: { postId: id, role: "DESIGNER", status: "ACTIVE" },
      });

      if (designerAssignment) {
        await tx.postAssignment.update({
          where: { id: designerAssignment.id },
          data: {
            status: status === PostStatus.APPROVED ? "COMPLETED" : "ACTIVE",
            completedAt: status === PostStatus.APPROVED ? currentTime : null,
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

      if (status === PostStatus.REJECTED && feedback) {
        const pendingAttachments = await tx.approvalAttachment.findMany({
          where: { approvalFlowId: approvalFlow.id, type: "AUDIO" },
          orderBy: { uploadedAt: "desc" },
        });

        const commentContent = pendingAttachments.length > 0
          ? `Design Status ${status}: ${feedback}\n\n🎙️ Audio feedback attached (${pendingAttachments.length} file(s))`
          : `Design Status ${status}: ${feedback}`;

        await tx.comment.create({
          data: {
            content: commentContent,
            type: "DESIGN",
            postId: id,
            userId: userId,
          },
        });

        await tx.userActivity.create({
          data: {
            activityType: "COMMENT_ADDED",
            entityType: "Post",
            entityId: id,
            description: `Comment added for design status ${status} on post: ${post.title}`,
            metadata: {
              comment: feedback,
              status: status,
              hasAudioAttachment: pendingAttachments.length > 0,
              audioAttachments: pendingAttachments.map((a: any) => ({ id: a.id, url: a.url, filename: a.filename })),
            },
            ipAddress: request.headers.get("x-forwarded-for") || null,
            userAgent: request.headers.get("user-agent") || null,
            createdAt: currentTime,
            userId: userId,
            projectId: post.projectId,
          },
        });
      }

      const rolesToNotify = ["Social Media Manager", "Manager", "Admin"];
      const usersToNotify = await tx.user.findMany({
        where: { role: { name: { in: rolesToNotify } } },
        select: { id: true, email: true, name: true },
      });

      if (post.project.managerId && !usersToNotify.some((user: any) => user.id === post.project.managerId)) {
        const manager = await tx.user.findUnique({
          where: { id: post.project.managerId },
          select: { id: true, email: true, name: true },
        });
        if (manager) usersToNotify.push(manager);
      }

      if (status === PostStatus.REJECTED && post.assignedToId && !usersToNotify.some((user: any) => user.id === post.assignedToId)) {
        const designer = await tx.user.findUnique({
          where: { id: post.assignedToId },
          select: { id: true, email: true, name: true },
        });
        if (designer) usersToNotify.push(designer);
      }

      const notificationData = usersToNotify.map((user: any) => ({
        title: `Post: ${post.title}`,
        message: `The post "${post.title}" has been "${status}" by ${session.user.name}. ${feedback ? `Feedback: ${feedback}` : ""}`,
        userId: user.id,
        isRead: false,
        createdAt: currentTime,
        link: `/dashboard/projects/posts/${post.id}`,
      }));

      await tx.notification.createMany({ data: notificationData });

      return { updatedPost, taskLog, userActivity, approvalFlow, approvalHistory, usersToNotify };
    });

    // Send email notification for SUBMITTED, RESUBMITTED, or REJECTED status
    if ((status === PostStatus.SUBMITTED || status === PostStatus.RESUBMITTED || status === PostStatus.REJECTED) && post.assignedTo) {
      try {
        if (!submissionEmailTemplate || !rejectionEmailTemplate) {
          await loadEmailTemplates();
        }

        const smtpDetails = await prisma.smtpDetails.findUnique({
          where: { userId: userId },
          select: { host: true, port: true, username: true, password: true, encryption: true, isVerified: true },
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
          console.error(`[Design Status API] SMTP not configured or verified for user ID: ${userId}`);
        } else {
          const transporter = nodemailer.createTransport({
            host: smtpDetails.host,
            port: smtpDetails.port,
            secure: smtpDetails.port === 465,
            auth: { user: smtpDetails.username, pass: decryptedPassword },
            tls: { minVersion: "TLSv1.2", rejectUnauthorized: true },
          });

          await transporter.verify();

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

          let assetUrl: string | null = null;
          if (postWithAssets?.assets && postWithAssets.assets.length > 0) {
            assetUrl = `${APP_BASE_URL}${postWithAssets.assets[0].url}`;
          }

          let emailHtml: string;
          let subject: string;
          let recipients: string[];

if (status === PostStatus.REJECTED) {
  emailHtml = rejectionEmailTemplate!;
  subject = `Post Rejected: ${post.title}`;
  recipients = [post.assignedTo.email].filter(email => email) as string[];
  emailHtml = emailHtml.replace("{{ designerName }}", post.assignedTo.name || "Designer");
  emailHtml = emailHtml.replace("{{ postTitle }}", post.title);
  emailHtml = emailHtml.replace("{{ projectName }}", post.project.name);
  emailHtml = emailHtml.replace("{{ feedback }}", feedback || "No feedback provided");
  emailHtml = emailHtml.replace("{{ rejectedAt }}", currentTime.toLocaleString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    hour12: true,
  }));
} else {
  emailHtml = submissionEmailTemplate!;
  subject = `Post ${status}: ${post.title}`;
  recipients = result.usersToNotify.map((user: any) => user.email).filter((email: any) => email) as string[];
  const statusVerb = status === PostStatus.SUBMITTED ? "submitted" : "resubmitted";
  // Join recipient names, handling null values and multiple recipients
  const recipientNames = result.usersToNotify
    .map((user: any) => user.name || "Team Member")
    .join(", ");
  emailHtml = emailHtml.replace("{{ status }}", status);
  emailHtml = emailHtml.replace("{{ statusVerb }}", statusVerb);
  emailHtml = emailHtml.replace("{{ recipientName }}", recipientNames || "Team");
  emailHtml = emailHtml.replace("{{ postTitle }}", post.title);
  emailHtml = emailHtml.replace("{{ projectName }}", post.project.name);
  emailHtml = emailHtml.replace("{{ submittedByName }}", session.user.name || "");
  emailHtml = emailHtml.replace("{{ submittedAt }}", currentTime.toLocaleString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    hour12: true,
  }));
  if (feedback) {
    emailHtml = emailHtml.replace("{{ #feedback }}", "");
    emailHtml = emailHtml.replace("{{ /feedback }}", "");
    emailHtml = emailHtml.replace("{{ feedback }}", feedback);
  } else {
    emailHtml = emailHtml.replace(/{{ #feedback }}[\s\S]*?{{ \/feedback }}/g, "");
  }
}

          emailHtml = emailHtml.replace("{{ dashboardUrl }}", `${APP_BASE_URL}/dashboard/projects/posts?projectId=${post.projectId}`);
          emailHtml = emailHtml.replace("{{ currentYear }}", currentTime.getFullYear().toString());

          if (assetUrl) {
            emailHtml = emailHtml.replace("{{ #assetUrl }}", "");
            emailHtml = emailHtml.replace("{{ /assetUrl }}", "");
            emailHtml = emailHtml.replace("{{ assetUrl }}", assetUrl);
          } else {
            emailHtml = emailHtml.replace(/{{ #assetUrl }}[\s\S]*?{{ \/assetUrl }}/g, "");
          }

          if (recipients.length > 0) {
            await transporter.sendMail({
              from: formatFrom(smtpDetails.username),
              to: recipients.join(","),
              subject,
              html: emailHtml,
              // HTML-only mail is a heavy spam signal; this is the text/plain alternative.
              text: htmlToText(emailHtml),
            });
            console.log(`[Design Status API] ${status} email sent successfully to ${recipients.join(", ")}`);
          }
        }
      } catch (emailError: any) {
        console.error(`[Design Status API] Error sending ${status} email:`, emailError);
      }
    }

    console.log(`[Design Status API] Updated post ${id}: status=${status}, workflow stage=${newWorkflowStage}`);
    return NextResponse.json({
      message: "Design status updated successfully",
      workflowStage: newWorkflowStage,
      ...result,
    });
  } catch (error: any) {
    console.error("[Design Status API] Error updating post status:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
