import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { ContentStatus, WorkflowStage } from "@prisma/client";
import nodemailer from "nodemailer";
import fs from "fs/promises";
import path from "path";
import CryptoJS from "crypto-js"; // Import crypto-js
import { requireSession } from "@/lib/api-auth";
import { assertPostAccess, workflowErrorResponse } from "@/lib/posts/workflow";
import { APP_BASE_URL } from "@/lib/utils"
import { formatFrom, htmlToText } from "@/lib/smtp"

// Load the email template
const emailTemplatePath = path.join(
  process.cwd(),
  "public/templates",
  "content-rejection-email-template.html"
);
let emailTemplate: string | null = null;

const fallbackEmailTemplate = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Content Status Update</title>
</head>
<body style="font-family: Arial, sans-serif; color: #333;">
  <h1 style="color: #111827;">Content {{ status }}</h1>
  <p>Dear {{ contentWriterName }},</p>
  <p>Your content for the post <strong>{{ postTitle }}</strong> in project <strong>{{ projectName }}</strong> has been marked as {{ status }}. Please review the feedback below and revise as needed.</p>
  <p><strong>Feedback:</strong> {{ feedback }}</p>
  <p><strong>Updated At:</strong> {{ updatedAt }}</p>
  <p><a href="{{ dashboardUrl }}" style="color: #111827;">View Post in Dashboard</a></p>
  <p>&copy; {{ currentYear }} itsmeDezino. All rights reserved.</p>
</body>
</html>
`;

async function loadEmailTemplate() {
  try {
    emailTemplate = await fs.readFile(emailTemplatePath, "utf-8");
    console.log("[Content Status API] Email template loaded successfully");
  } catch (error) {
    console.error("[Content Status API] Error loading email template:", error);
    emailTemplate = fallbackEmailTemplate;
    console.log("[Content Status API] Using fallback email template");
  }
}

const contentStatusSchema = z.object({
  contentStatus: z.nativeEnum(ContentStatus),
  feedback: z.string().optional(),
  contentApprovedAt: z.string().datetime().optional(),
  contentRejectedAt: z.string().datetime().optional(),
});

// Helper function to determine workflow stage based on content and design status
function determineWorkflowStage(
  contentStatus: ContentStatus,
  designStatus: string
): WorkflowStage {
  if (contentStatus === ContentStatus.PENDING_REVIEW) {
    return WorkflowStage.CONTENT_REVIEW;
  }
  
  if (contentStatus === ContentStatus.NEEDS_REVISION) {
    return WorkflowStage.CONTENT_REVIEW;
  }

  if (contentStatus === ContentStatus.NEEDS_MINOR_CHANGE) {
    return WorkflowStage.CONTENT_REVIEW;
  }
  
  if (contentStatus === ContentStatus.APPROVED || (contentStatus as any) === "C_APPROVED") {
    if (designStatus === "DRAFT" || designStatus === "SUBMITTED") {
      return WorkflowStage.DESIGN_PENDING;
    }
    if (designStatus === "APPROVED" || designStatus === "C_APPROVED") {
      return WorkflowStage.BOTH_APPROVED;
    }
  }
  
  if (contentStatus === ContentStatus.REJECTED) {
    return WorkflowStage.CONTENT_REVIEW;
  }
  
  return WorkflowStage.CONTENT_REVIEW;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
    // Permission depends on the requested change (decision vs. submission); checked
    // below once the body is parsed.
    const auth = await requireSession();
    if (!auth.ok) return auth.response;
    const session = auth.session;

  const { id: postId } = await params;

  if (!postId) {
    return NextResponse.json({ error: "Invalid post ID" }, { status: 400 });
  }

  try {
    const body = await req.json();
    const parsedBody = contentStatusSchema.parse(body);

    // Require feedback for REJECTED, NEEDS_REVISION or NEEDS_MINOR_CHANGE content status updates
    if (["REJECTED", "NEEDS_REVISION", "NEEDS_MINOR_CHANGE"].includes(parsedBody.contentStatus)) {
      if (!parsedBody.feedback || !parsedBody.feedback.trim()) {
        console.warn(`[Content Status API] Feedback/Comment is required for ${parsedBody.contentStatus} updates`);
        return NextResponse.json(
          { error: `Comment is required for content status ${parsedBody.contentStatus.toLowerCase()}` },
          { status: 400 }
        );
      }
    }

    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: {
        id: true,
        title: true,
        contentStatus: true,
        status: true,
        contentApprovedAt: true,
        contentRejectedAt: true,
        projectId: true,
        createdById: true,
        createdBy: { select: { email: true, name: true } },
        project: { select: { name: true } },
        assignedToId: true,
      },
    });

    // const contentWriter = await prisma.project.findUnique({
    //   where: { id: post.project.id },
    //   include: {
    //     assignedUsers: {
    //       include: {
    //         role: true, // 👈 include the role relation
    //       },
    //     },
    //   },
    // });

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    // Deciding on copy is an approval; submitting or revising it is editing. Before,
    // posts:update + posts:status was enough to approve, which is how anybody could.
    // Scope matters too: the caller must be able to see this post.
    const isDecision = (["APPROVED", "REJECTED", "NEEDS_REVISION", "NEEDS_MINOR_CHANGE"] as string[]).includes(
      parsedBody.contentStatus,
    );
    try {
      await assertPostAccess(session, Number(session.user.id), postId, isDecision ? "approve" : "update");
    } catch (error) {
      return workflowErrorResponse(error);
    }
    // Published and cancelled posts are frozen.
    if (post.status === "POSTED" || post.status === "CANCELLED") {
      return NextResponse.json({ error: "Published and cancelled posts cannot change." }, { status: 409 });
    }

    if (post.contentStatus === parsedBody.contentStatus) {
      return NextResponse.json(
        { error: "Content status is already set to the requested value" },
        { status: 400 }
      );
    }

    const currentTime = new Date();
    const userId = parseInt(session.user.id, 10);
    const newWorkflowStage = determineWorkflowStage(parsedBody.contentStatus, post.status);

    const updateData: any = {
      contentStatus: parsedBody.contentStatus,
    };

    if (parsedBody.contentStatus === ContentStatus.APPROVED) {
      updateData.contentApprovedAt = parsedBody.contentApprovedAt
        ? new Date(parsedBody.contentApprovedAt)
        : currentTime;
      updateData.contentApprovedById = userId;
    } else if (
      parsedBody.contentStatus === ContentStatus.REJECTED ||
      parsedBody.contentStatus === ContentStatus.NEEDS_REVISION ||
      parsedBody.contentStatus === ContentStatus.NEEDS_MINOR_CHANGE
    ) {
      updateData.contentRejectedAt = parsedBody.contentRejectedAt
        ? new Date(parsedBody.contentRejectedAt)
        : currentTime;
      updateData.contentRejectedById = userId;
    }

    const taskLogData = {
      action: `CONTENT_${parsedBody.contentStatus}`,
      oldStatus: post.status,
      newStatus: post.status,
      oldValues: { contentStatus: post.contentStatus },
      newValues: { contentStatus: parsedBody.contentStatus },
      feedback: parsedBody.feedback || null,
      ipAddress: req.headers.get("x-forwarded-for") || null,
      userAgent: req.headers.get("user-agent") || null,
      postId: postId,
      userId: userId,
    };

    const activityTypeMap: { [key in ContentStatus]?: string } = {
      [ContentStatus.APPROVED]: "CONTENT_APPROVED",
      [ContentStatus.REJECTED]: "CONTENT_REJECTED",
      [ContentStatus.NEEDS_REVISION]: "CONTENT_NEEDS_REVISION",
      [ContentStatus.NEEDS_MINOR_CHANGE]: "CONTENT_NEEDS_MINOR_CHANGE",
      [ContentStatus.PENDING_REVIEW]: "CONTENT_SUBMITTED",
      [ContentStatus.RESUBMITTED]: "CONTENT_RESUBMITTED",
      [ContentStatus.DRAFT]: "POST_CREATED",
    };

    const userActivityData = {
      activityType: activityTypeMap[parsedBody.contentStatus] || "CONTENT_SUBMITTED",
      entityType: "Post",
      entityId: postId,
      description: `Content status changed to ${parsedBody.contentStatus} for post: ${post.title}`,
      metadata: {
        oldStatus: post.contentStatus,
        newStatus: parsedBody.contentStatus,
        oldWorkflowStage: "CONTENT_REVIEW",
        newWorkflowStage: newWorkflowStage,
        feedback: parsedBody.feedback || null,
      },
      ipAddress: req.headers.get("x-forwarded-for") || null,
      userAgent: req.headers.get("user-agent") || null,
      createdAt: currentTime,
      userId: userId,
      projectId: post.projectId,
    };

    const existingApprovalFlow = await prisma.approvalFlow.findFirst({
      where: {
        postId,
        flowType: "CONTENT",
      },
      orderBy: { createdAt: "desc" },
    });

    const approvalFlowData = {
      flowType: "CONTENT",
      status: parsedBody.contentStatus,
      feedback: parsedBody.feedback || null,
      reviewedAt: ([
        ContentStatus.APPROVED,
        ContentStatus.REJECTED,
        ContentStatus.NEEDS_REVISION,
        ContentStatus.NEEDS_MINOR_CHANGE,
      ] as ContentStatus[]).includes(parsedBody.contentStatus)
        ? currentTime
        : null,
      reviewedById: ([
        ContentStatus.APPROVED,
        ContentStatus.REJECTED,
        ContentStatus.NEEDS_REVISION,
        ContentStatus.NEEDS_MINOR_CHANGE,
      ] as ContentStatus[]).includes(parsedBody.contentStatus)
        ? userId
        : null,
      submittedById:
        parsedBody.contentStatus === ContentStatus.PENDING_REVIEW ? userId : existingApprovalFlow?.submittedById,
      submittedAt:
        parsedBody.contentStatus === ContentStatus.PENDING_REVIEW
          ? currentTime
          : existingApprovalFlow?.submittedAt,
      submissionCount: existingApprovalFlow
        ? existingApprovalFlow.submissionCount + (parsedBody.contentStatus === ContentStatus.RESUBMITTED ? 1 : 0)
        : 1,
      version: existingApprovalFlow ? existingApprovalFlow.version + 1 : 1,
      postId,
      assignedToId:
        ([ContentStatus.NEEDS_REVISION, ContentStatus.NEEDS_MINOR_CHANGE] as ContentStatus[]).includes(parsedBody.contentStatus)
          ? post.createdById
          : null,
      rejectionReason:
        ([
          ContentStatus.REJECTED,
          ContentStatus.NEEDS_REVISION,
          ContentStatus.NEEDS_MINOR_CHANGE,
        ] as ContentStatus[]).includes(parsedBody.contentStatus)
          ? parsedBody.feedback
          : null,
    };

    const approvalHistoryData = {
      action: parsedBody.contentStatus,
      fromStatus: post.contentStatus,
      toStatus: parsedBody.contentStatus,
      feedback: parsedBody.feedback || null,
      version: approvalFlowData.version,
      metadata: {
        oldStatus: post.contentStatus,
        newStatus: parsedBody.contentStatus,
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

    if (parsedBody.contentStatus === ContentStatus.NEEDS_REVISION || parsedBody.contentStatus === ContentStatus.NEEDS_MINOR_CHANGE) {
      nextAssigneeId = post.createdById;
      assignmentRole = "CONTENT_WRITER";
      assignmentStage = WorkflowStage.CONTENT_REVIEW;
    } else if (parsedBody.contentStatus === ContentStatus.APPROVED) {
      assignmentRole = "DESIGNER";
      assignmentStage = WorkflowStage.DESIGN_PENDING;
    }

    const result = await prisma.$transaction(async (tx: any) => {
      const updatedPost = await tx.post.update({
        where: { id: postId },
        data: updateData,
        select: {
          id: true,
          title: true,
          contentStatus: true,
          status: true,
          contentApprovedAt: true,
          contentRejectedAt: true,
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

      const contentWriterAssignment = await tx.postAssignment.findFirst({
        where: {
          postId,
          role: "CONTENT_WRITER",
          status: "ACTIVE",
        },
      });

      if (contentWriterAssignment) {
        await tx.postAssignment.update({
          where: { id: contentWriterAssignment.id },
          data: {
            status:
              parsedBody.contentStatus === ContentStatus.APPROVED
                ? "COMPLETED"
                : "ACTIVE",
            completedAt:
              parsedBody.contentStatus === ContentStatus.APPROVED
                ? currentTime
                : null,
            stage: newWorkflowStage,
          },
        });
      }

      if (nextAssigneeId && assignmentRole) {
        await tx.postAssignment.create({
          data: {
            postId,
            userId: nextAssigneeId,
            role: assignmentRole,
            stage: assignmentStage,
            status: "ACTIVE",
            assignedAt: currentTime,
          },
        });
      }

      if (parsedBody.feedback) {
        await tx.comment.create({
          data: {
            content: `Content Status ${parsedBody.contentStatus}: ${parsedBody.feedback}`,
            type: "CONTENT",
            postId: postId,
            userId: userId,
          },
        });

        await tx.userActivity.create({
          data: {
            activityType: "COMMENT_ADDED",
            entityType: "Post",
            entityId: postId,
            description: `Comment added for content status ${parsedBody.contentStatus} on post: ${post.title}`,
            metadata: {
              comment: `Content Status ${parsedBody.contentStatus}: ${parsedBody.feedback}`,
              status: parsedBody.contentStatus,
            },
            ipAddress: req.headers.get("x-forwarded-for") || null,
            userAgent: req.headers.get("user-agent") || null,
            createdAt: currentTime,
            userId: userId,
            projectId: post.projectId,
          },
        });

        if (post.createdById) {
          let title = "Content Status Updated";
          if (parsedBody.contentStatus === ContentStatus.REJECTED) {
            title = "Content Rejected";
          } else if (parsedBody.contentStatus === ContentStatus.NEEDS_REVISION) {
            title = "Content Needs Revision";
          } else if (parsedBody.contentStatus === ContentStatus.NEEDS_MINOR_CHANGE) {
            title = "Content Needs Minor Change";
          } else if (parsedBody.contentStatus === ContentStatus.APPROVED) {
            title = "Content Approved";
          }
          await tx.notification.create({
            data: {
              title,
              message: `Your content for "${post.title}" has been marked as ${parsedBody.contentStatus.toLowerCase()}. ${parsedBody.feedback}`,
              userId: post.createdById,
              isRead: false,
              link: `/dashboard/projects/posts/${post.id}`,
            },
          });
        }
      } else if (parsedBody.contentStatus === ContentStatus.APPROVED) {
        if (post.createdById) {
          await tx.notification.create({
            data: {
              title: "Content Approved",
              message: `Your content for "${post.title}" has been approved and moved to design stage.`,
              userId: post.createdById,
              isRead: false,
              link: `/dashboard/projects/posts/${post.id}`,
            },
          });
        }
      }

      return {
        updatedPost,
        taskLog,
        userActivity,
        approvalFlow,
        approvalHistory,
      };
    });

    // Send email notification for REJECTED or NEEDS_REVISION status
    if (
      ([ContentStatus.REJECTED, ContentStatus.NEEDS_REVISION, ContentStatus.NEEDS_MINOR_CHANGE] as ContentStatus[]).includes(parsedBody.contentStatus) &&
      post.createdBy
    ) {
      try {
        if (!emailTemplate) {
          await loadEmailTemplate();
        }

        const smtpDetails = await prisma.smtpDetails.findUnique({
          where: { user: userId },
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
            `[Content Status API] SMTP not configured or verified for user ID: ${userId}`
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
  where: { id:postId },
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
            "{{ contentWriterName }}",
            post.createdBy?.name || "Content Writer"
          );
          emailHtml = emailHtml.replace("{{ postTitle }}", post.title);
          emailHtml = emailHtml.replace("{{ projectName }}", post.project.name);
          emailHtml = emailHtml.replace(
            "{{ feedback }}",
            parsedBody.feedback || "No feedback provided"
          );
          emailHtml = emailHtml.replace(
            "{{ updatedAt }}",
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
            `${APP_BASE_URL}/dashboard/projects/posts?projectId=${post.projectId}`
          );
          emailHtml = emailHtml.replace(
            "{{ currentYear }}",
            currentTime.getFullYear().toString()
          );
          let statusText = "Needs Revision";
          if (parsedBody.contentStatus === ContentStatus.REJECTED) {
            statusText = "Rejected";
          } else if (parsedBody.contentStatus === ContentStatus.NEEDS_MINOR_CHANGE) {
            statusText = "Needs Minor Change";
          }
          emailHtml = emailHtml.replace(
            "{{ status }}",
            statusText
          );

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

          let emailSubject = `Content Needs Revision: ${post.title}`;
          if (parsedBody.contentStatus === ContentStatus.REJECTED) {
            emailSubject = `Content Rejected: ${post.title}`;
          } else if (parsedBody.contentStatus === ContentStatus.NEEDS_MINOR_CHANGE) {
            emailSubject = `Content Needs Minor Change: ${post.title}`;
          }

          if (post.createdBy?.email) {
            await transporter.sendMail({
              from: formatFrom(smtpDetails.username),
              to: post.createdBy.email,
              subject: emailSubject,
              html: emailHtml,
              // HTML-only mail is a heavy spam signal; this is the text/plain alternative.
              text: htmlToText(emailHtml),
            });

            console.log(
              `[Content Status API] Email sent successfully to ${post.createdBy.email}`
            );
          }
        }
      } catch (emailError: any) {
        console.error(
          "[Content Status API] Error sending email:",
          emailError
        );
      }
    }

    return NextResponse.json({
      message: "Content status updated successfully",
      workflowStage: newWorkflowStage,
      ...result,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request body", details: error.errors },
        { status: 400 }
      );
    }
    console.error("[Content Status API] Error updating content status:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
