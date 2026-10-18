import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stageDecisionSchema } from "@/lib/validation/approval";
import { ApprovalStepStatus, PostStatus } from "@prisma/client";
import { requireCan } from "@/lib/api-auth";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const postId = params.id;
    const auth = await requireCan("posts", "approve");
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const body = await request.json();
    const parsed = stageDecisionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { stage, decision, feedback, authorName } = parsed.data;

    // Load post with current chain
    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: {
        project: {
          include: {
            manager: { select: { id: true, name: true, email: true } },
            client: true,
          },
        },
        assignedTo: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    // Get current chain
    let chain = await prisma.approvalChain.findFirst({
      where: { postId },
      include: {
        steps: { orderBy: { order: "asc" } },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!chain || chain.steps.length === 0) {
      return NextResponse.json(
        { error: "Approval chain not initialized for this post" },
        { status: 400 }
      );
    }

    // Find the step corresponding to this stage
    const currentStep = chain.steps.find((s) => s.stage === stage);
    if (!currentStep) {
      return NextResponse.json(
        { error: `Stage ${stage} not found in this approval chain` },
        { status: 400 }
      );
    }

    const deciderName = session?.user?.name || authorName || (stage === "CLIENT" ? "Client" : "Reviewer");
    const deciderId = session?.user?.id ? Number(session.user.id) : null;

    const newStepStatus =
      decision === "APPROVED"
        ? ApprovalStepStatus.APPROVED
        : decision === "CHANGES_REQUESTED"
        ? ApprovalStepStatus.CHANGES_REQUESTED
        : ApprovalStepStatus.REJECTED;

    // Update current step
    await prisma.approvalStep.update({
      where: { id: currentStep.id },
      data: {
        status: newStepStatus,
        decisionAt: new Date(),
        decisionById: deciderId,
        decisionByName: deciderName,
        feedback: feedback || null,
      },
    });

    let isLastStage = currentStep.order === chain.steps.length - 1;
    let nextIndex = chain.currentStageIndex;

    if (decision === "APPROVED") {
      if (isLastStage) {
        // All stages approved!
        await prisma.approvalChain.update({
          where: { id: chain.id },
          data: {
            isCompleted: true,
            finalStatus: "APPROVED",
          },
        });

        // Mark Post as Approved / C_APPROVED
        await prisma.post.update({
          where: { id: postId },
          data: {
            status: PostStatus.C_APPROVED,
            designerHeadApproval: PostStatus.APPROVED,
            approvedAt: new Date(),
          },
        });
      } else {
        // Advance to next stage
        nextIndex = currentStep.order + 1;
        await prisma.approvalChain.update({
          where: { id: chain.id },
          data: {
            currentStageIndex: nextIndex,
          },
        });

        // Update post intermediate status
        if (stage === "INTERNAL_LEAD") {
          await prisma.post.update({
            where: { id: postId },
            data: {
              designerHeadApproval: PostStatus.APPROVED,
              status: PostStatus.SUBMITTED,
            },
          });
        }
      }
    } else {
      // Changes requested or rejected
      await prisma.approvalChain.update({
        where: { id: chain.id },
        data: {
          finalStatus: "CHANGES_REQUESTED",
        },
      });

      await prisma.post.update({
        where: { id: postId },
        data: {
          status: PostStatus.REJECTED,
          designerHeadApproval: PostStatus.NEEDS_MINOR_CHANGE,
          rejectedAt: new Date(),
        },
      });
    }

    // Create Audit Log
    try {
      await prisma.auditLog.create({
        data: {
          action: `APPROVAL_DECISION_${stage}_${decision}`,
          entityType: "Post",
          entityId: postId,
          newValues: JSON.stringify({
            stage,
            decision,
            feedback,
            deciderName,
          }),
          userId: deciderId,
        },
      });
    } catch (e) {
      console.warn("Could not create audit log:", e);
    }

    // Notify assigned designer/writer
    const notifyUserIds = [post.assignedToId, post.createdById].filter(
      (id): id is number => !!id && id !== deciderId
    );

    for (const uid of notifyUserIds) {
      try {
        await prisma.notification.create({
          data: {
            title: `Approval Update: ${stage.replace("_", " ")}`,
            message: `${deciderName} marked "${post.title}" as ${decision.replace("_", " ")}${
              feedback ? `: "${feedback}"` : ""
            }`,
            userId: uid,
            link: `/dashboard/projects/posts/${postId}`,
          },
        });
      } catch (e) {
        console.warn("Could not create notification:", e);
      }
    }

    // Return updated chain
    const updatedChain = await prisma.approvalChain.findUnique({
      where: { id: chain.id },
      include: {
        steps: {
          include: {
            decisionBy: {
              select: { id: true, name: true, email: true, role: true },
            },
          },
          orderBy: { order: "asc" },
        },
      },
    });

    return NextResponse.json({
      message: `Stage ${stage} marked as ${decision}`,
      chain: updatedChain,
    });
  } catch (error: any) {
    console.error("Error submitting stage decision:", error);
    return NextResponse.json(
      { error: "Failed to record approval decision", details: error.message },
      { status: 500 }
    );
  }
}
