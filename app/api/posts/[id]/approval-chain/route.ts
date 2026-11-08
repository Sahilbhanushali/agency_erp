import { type NextRequest, NextResponse } from "next/server";
import { ApprovalStageType, ApprovalStepStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";
import { assertPostAccess, workflowErrorResponse } from "@/lib/posts/workflow";

const chainInclude = {
  steps: {
    include: { decisionBy: { select: { id: true, name: true } } },
    orderBy: { order: "asc" as const },
  },
};

/**
 * The staged review for one post: Team lead → Account manager → (Client, only when the
 * post requires client approval). Internal stages are decided here; the client stage is
 * decided by the client through their share link.
 *
 * GET used to be unauthenticated and always created a chain with a client stage.
 */
export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;
  const { id: postId } = await context.params;

  try {
    await assertPostAccess(auth.session, auth.userId, postId, "read");

    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: {
        id: true,
        title: true,
        status: true,
        version: true,
        requiresClientApproval: true,
        contentStatus: true,
        project: { select: { id: true, name: true, client: { select: { id: true, name: true, company: true } } } },
      },
    });
    if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });

    let chain = await prisma.approvalChain.findFirst({
      where: { postId },
      include: chainInclude,
      orderBy: { createdAt: "desc" },
    });

    // Created lazily on first view, but only for someone allowed to see the post.
    if (!chain) {
      const stages: ApprovalStageType[] = [ApprovalStageType.INTERNAL_LEAD, ApprovalStageType.ACCOUNT_MANAGER];
      if (post.requiresClientApproval) stages.push(ApprovalStageType.CLIENT);
      chain = await prisma.approvalChain.create({
        data: {
          postId,
          steps: { create: stages.map((stage, order) => ({ stage, order, status: ApprovalStepStatus.PENDING })) },
        },
        include: chainInclude,
      });
    }

    return NextResponse.json({ chain, post });
  } catch (error) {
    return workflowErrorResponse(error);
  }
}

/** Reset the chain for a new round of review (e.g. after the post was edited and resubmitted). */
export async function POST(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;
  const { id: postId } = await context.params;

  try {
    await assertPostAccess(auth.session, auth.userId, postId, "approve");

    const [existing, post] = await Promise.all([
      prisma.approvalChain.findFirst({ where: { postId }, orderBy: { createdAt: "desc" }, select: { id: true } }),
      prisma.post.findUnique({ where: { id: postId }, select: { requiresClientApproval: true } }),
    ]);
    if (!existing || !post) return NextResponse.json({ error: "Chain not found" }, { status: 404 });

    // A fresh chain rather than wiping the old one, so earlier decisions stay on record.
    const stages: ApprovalStageType[] = [ApprovalStageType.INTERNAL_LEAD, ApprovalStageType.ACCOUNT_MANAGER];
    if (post.requiresClientApproval) stages.push(ApprovalStageType.CLIENT);
    const chain = await prisma.$transaction(async (tx) => {
      await tx.approvalChain.update({ where: { id: existing.id }, data: { finalStatus: "SUPERSEDED", isCompleted: true } });
      return tx.approvalChain.create({
        data: {
          postId,
          steps: { create: stages.map((stage, order) => ({ stage, order, status: ApprovalStepStatus.PENDING })) },
        },
        include: chainInclude,
      });
    });

    return NextResponse.json({ message: "Approval chain reset for resubmission", chain });
  } catch (error) {
    return workflowErrorResponse(error);
  }
}
