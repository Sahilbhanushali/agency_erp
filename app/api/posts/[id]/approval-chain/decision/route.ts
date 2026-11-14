import { type NextRequest, NextResponse } from "next/server";
import { ApprovalStepStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { stageDecisionSchema } from "@/lib/validation/approval";
import { requireSession } from "@/lib/api-auth";
import { WorkflowError, assertPostAccess, transitionPost, workflowErrorResponse } from "@/lib/posts/workflow";

/**
 * Decide one internal stage of the approval chain.
 *
 * Fixed here:
 *   - only the CURRENT stage can be decided (stages used to be decidable in any order);
 *   - each stage is decided once — a conditional update on a PENDING step, so a double
 *     click or two reviewers at once cannot both "approve";
 *   - the CLIENT stage cannot be decided by staff (it is the client's, via share link);
 *   - the post's status changes through the workflow engine, so a stage decision can no
 *     longer jump a post to "client approved" or approve something already scheduled.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;
  const { id: postId } = await context.params;

  const parsed = stageDecisionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.format() }, { status: 422 });
  }
  const { stage, decision } = parsed.data;
  const feedback = parsed.data.feedback?.trim() || null;

  try {
    if (stage === "CLIENT") {
      throw new WorkflowError(403, "FORBIDDEN_ACTOR", "The client stage is decided by the client through their share link.");
    }
    await assertPostAccess(auth.session, auth.userId, postId, "approve");
    if (decision !== "APPROVED" && !feedback) {
      throw new WorkflowError(422, "REASON_REQUIRED", "Explain what needs to change.");
    }

    const chain = await prisma.approvalChain.findFirst({
      where: { postId, isCompleted: false },
      include: { steps: { orderBy: { order: "asc" } } },
      orderBy: { createdAt: "desc" },
    });
    if (!chain) throw new WorkflowError(409, "NO_CHAIN", "There is no open approval round for this post.");

    const step = chain.steps.find((s) => s.stage === stage);
    if (!step) throw new WorkflowError(422, "NO_STAGE", `This post has no ${stage} stage.`);
    if (step.order !== chain.currentStageIndex) {
      throw new WorkflowError(409, "OUT_OF_ORDER", "That stage is not the one currently waiting for a decision.");
    }

    const next = chain.steps.find((s) => s.order === step.order + 1) ?? null;
    const lastInternal = !next || next.stage === "CLIENT";
    const userId = auth.userId;
    const name = auth.session.user?.name ?? null;

    // Post status first: the engine re-checks permission, legality and staleness, and
    // records the timeline. Only an approval of the LAST internal stage approves the
    // post; earlier internal approvals keep it pending review.
    if (decision === "APPROVED" && lastInternal) {
      await transitionPost({ postId, action: "APPROVE", actor: { type: "USER", session: auth.session, userId }, reason: feedback });
    } else if (decision !== "APPROVED") {
      await transitionPost({
        postId,
        action: decision === "REJECTED" ? "REJECT" : "REQUEST_CHANGES",
        actor: { type: "USER", session: auth.session, userId },
        reason: feedback,
      });
    }

    const updatedChain = await prisma.$transaction(async (tx) => {
      const { count } = await tx.approvalStep.updateMany({
        where: { id: step.id, status: ApprovalStepStatus.PENDING },
        data: {
          status:
            decision === "APPROVED"
              ? ApprovalStepStatus.APPROVED
              : decision === "REJECTED"
                ? ApprovalStepStatus.REJECTED
                : ApprovalStepStatus.CHANGES_REQUESTED,
          decisionAt: new Date(),
          decisionById: userId,
          decisionByName: name,
          feedback,
        },
      });
      if (count === 0) throw new WorkflowError(409, "ALREADY_DECIDED", "This stage has already been decided.");

      await tx.approvalChain.update({
        where: { id: chain.id },
        data:
          decision !== "APPROVED"
            ? { finalStatus: decision === "REJECTED" ? "REJECTED" : "CHANGES_REQUESTED", isCompleted: true }
            : next
              ? { currentStageIndex: next.order }
              : { isCompleted: true, finalStatus: "APPROVED" },
      });

      return tx.approvalChain.findUnique({
        where: { id: chain.id },
        include: {
          steps: { include: { decisionBy: { select: { id: true, name: true } } }, orderBy: { order: "asc" } },
        },
      });
    });

    return NextResponse.json({ message: `Stage ${stage} marked as ${decision}`, chain: updatedChain });
  } catch (error) {
    return workflowErrorResponse(error);
  }
}
