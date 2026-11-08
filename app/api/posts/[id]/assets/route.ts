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
import { can, requireCan, requireSession } from "@/lib/api-auth";
import { transitionPost, workflowErrorResponse } from "@/lib/posts/workflow";
import { decide, editInvalidatesApproval, isEditable, type WorkflowAction, type WorkflowStatus } from "@/lib/posts/workflow-rules";
import { isPresentationFile } from "@/lib/posts/content-types";
import { deleteLocalFile } from "@/lib/storage";
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
      if (!file.type.startsWith("image/") && !file.type.startsWith("video/") && !isPresentationFile(file)) {
        return NextResponse.json({ error: `File ${file.name} must be an image, a video or a presentation (.ppt, .pptx)` }, { status: 400 });
      }
    }

    const currentTime = new Date();
    const userId = parseInt(session.user.id, 10);

    // Uploading a design is a submission. The status change goes through the workflow
    // engine; it used to be computed here, which (among other things) left an approved
    // or scheduled post approved after its creative was replaced.
    const uploadAction: WorkflowAction =
      post.status === PostStatus.DRAFT || post.status === PostStatus.REJECTED || post.status === PostStatus.NEEDS_MINOR_CHANGE
        ? "SUBMIT"
        : "EDIT_INVALIDATE";
    const workflowState = { status: post.status as WorkflowStatus, requiresClientApproval: post.requiresClientApproval };
    if (!isEditable(workflowState)) {
      return NextResponse.json({ error: "Published and cancelled posts cannot receive new designs." }, { status: 409 });
    }
    if (editInvalidatesApproval(workflowState) && formData.get("confirmReapproval") !== "true") {
      return NextResponse.json(
        {
          error: "This post is already approved. Uploading a new design sends it back for approval.",
          code: "REAPPROVAL_REQUIRED",
        },
        { status: 409 },
      );
    }
    // What the engine will do, so the task log / approval flow written below describe
    // the real transition. The engine still decides authoritatively further down.
    const predicted = decide({ post: workflowState, action: uploadAction, actorType: "USER", reason: "upload" });
    let newStatus: PostStatus | undefined = predicted.ok ? (predicted.to as PostStatus) : undefined;

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

    try {
      const transition = await transitionPost({
        postId: params.id,
        action: uploadAction,
        actor: { type: "USER", session, userId },
        authorizedBy: { module: "assets", action: "create" },
        reason: feedback?.trim() || (uploadAction === "SUBMIT" ? "Design uploaded" : "New design uploaded"),
        metadata: { fileCount: savedFiles.length },
      });
      newStatus = transition.post.status;
    } catch (error) {
      // Nothing was attached; do not leave the uploaded files behind.
      await Promise.all(
        savedFiles
          .filter((f) => f.type !== "link")
          .map((f) => deleteLocalFile(`/api/uploads/${f.generatedName}`).catch(() => undefined)),
      );
      return workflowErrorResponse(error);
    }

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

      // Status already moved by the workflow engine before this transaction.
      const updatedPost = null;

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

// PATCH: legacy "set design status" endpoint. No screen calls it any more, but it stays
// working for any external caller — now as a thin wrapper over the workflow engine, so
// it can no longer jump a post to APPROVED/SCHEDULED/POSTED with only posts:update.
const postStatusSchema = z.object({
  status: z.nativeEnum(PostStatus),
  feedback: z.string().optional(),
  scheduledAt: z.string().datetime().optional(),
  expectedVersion: z.coerce.number().int().positive().optional(),
});

const LEGACY_STATUS_ACTION: Partial<Record<PostStatus, WorkflowAction>> = {
  SUBMITTED: "SUBMIT",
  RESUBMITTED: "SUBMIT",
  APPROVED: "APPROVE",
  REJECTED: "REJECT",
  NEEDS_MINOR_CHANGE: "REQUEST_CHANGES",
  SCHEDULED: "SCHEDULE",
  POSTED: "PUBLISH",
};

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  const parsed = postStatusSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body", details: parsed.error.errors }, { status: 400 });
  }
  const action = LEGACY_STATUS_ACTION[parsed.data.status];
  if (!action) {
    return NextResponse.json({ error: `A post cannot be moved to ${parsed.data.status} directly.` }, { status: 409 });
  }
  try {
    const result = await transitionPost({
      postId: id,
      action,
      actor: { type: "USER", session: auth.session, userId: auth.userId },
      reason: parsed.data.feedback ?? null,
      expectedVersion: parsed.data.expectedVersion,
      scheduledAt: parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : undefined,
    });
    return NextResponse.json({ post: result.post });
  } catch (error) {
    return workflowErrorResponse(error);
  }
}
