import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ApprovalStageType, ApprovalStepStatus } from "@prisma/client";
import { requireCan } from "@/lib/api-auth";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const postId = params.id;

    // Check if post exists
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: {
        id: true,
        title: true,
        status: true,
        designerHeadApproval: true,
        contentStatus: true,
        project: {
          select: {
            id: true,
            name: true,
            client: { select: { id: true, name: true, company: true } },
          },
        },
      },
    });

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    // Find existing chain
    let chain = await prisma.approvalChain.findFirst({
      where: { postId },
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
      orderBy: { createdAt: "desc" },
    });

    // If no chain exists, create default 3-stage chain
    if (!chain) {
      chain = await prisma.approvalChain.create({
        data: {
          postId,
          currentStageIndex: 0,
          isCompleted: false,
          finalStatus: "IN_REVIEW",
          steps: {
            create: [
              {
                stage: ApprovalStageType.INTERNAL_LEAD,
                order: 0,
                status: ApprovalStepStatus.PENDING,
              },
              {
                stage: ApprovalStageType.ACCOUNT_MANAGER,
                order: 1,
                status: ApprovalStepStatus.PENDING,
              },
              {
                stage: ApprovalStageType.CLIENT,
                order: 2,
                status: ApprovalStepStatus.PENDING,
              },
            ],
          },
        },
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
    }

    return NextResponse.json({ chain, post });
  } catch (error: any) {
    console.error("Error loading approval chain:", error);
    return NextResponse.json(
      { error: "Failed to load approval chain", details: error.message },
      { status: 500 }
    );
  }
}

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

    // Reset or re-create chain for resubmission
    const existing = await prisma.approvalChain.findFirst({
      where: { postId },
      orderBy: { createdAt: "desc" },
    });

    if (existing) {
      // Reset existing steps to PENDING
      await prisma.approvalStep.updateMany({
        where: { chainId: existing.id },
        data: {
          status: ApprovalStepStatus.PENDING,
          decisionAt: null,
          decisionById: null,
          decisionByName: null,
          feedback: null,
        },
      });

      const updated = await prisma.approvalChain.update({
        where: { id: existing.id },
        data: {
          currentStageIndex: 0,
          isCompleted: false,
          finalStatus: "IN_REVIEW",
        },
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
        message: "Approval chain reset for resubmission",
        chain: updated,
      });
    }

    return NextResponse.json({ error: "Chain not found" }, { status: 404 });
  } catch (error: any) {
    console.error("Error resetting approval chain:", error);
    return NextResponse.json(
      { error: "Failed to reset chain", details: error.message },
      { status: 500 }
    );
  }
}
