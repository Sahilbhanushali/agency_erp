import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateAnnotationSchema } from "@/lib/validation/approval";
import { requireCan } from "@/lib/api-auth";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string; annotationId: string }> }
) {
  try {
    const params = await context.params;
    const { id: postId, annotationId } = params;
    const auth = await requireCan("posts", "read");
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const body = await request.json();
    const parsed = updateAnnotationSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const existing = await prisma.proofAnnotation.findUnique({
      where: { id: annotationId },
    });

    if (!existing || existing.postId !== postId) {
      return NextResponse.json(
        { error: "Annotation not found" },
        { status: 404 }
      );
    }

    const { isResolved, comment } = parsed.data;

    const dataToUpdate: any = {};
    if (comment !== undefined) {
      dataToUpdate.comment = comment;
    }

    if (isResolved !== undefined) {
      dataToUpdate.isResolved = isResolved;
      if (isResolved) {
        dataToUpdate.resolvedAt = new Date();
        dataToUpdate.resolvedBy =
          session?.user?.name || "Reviewer";
      } else {
        dataToUpdate.resolvedAt = null;
        dataToUpdate.resolvedBy = null;
      }
    }

    const updated = await prisma.proofAnnotation.update({
      where: { id: annotationId },
      data: dataToUpdate,
      include: {
        user: { select: { id: true, name: true, role: true } },
        replies: {
          include: {
            user: { select: { id: true, name: true, role: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    return NextResponse.json({
      message: "Annotation updated",
      annotation: updated,
    });
  } catch (error: any) {
    console.error("Error updating annotation:", error);
    return NextResponse.json(
      { error: "Failed to update annotation", details: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string; annotationId: string }> }
) {
  try {
    const params = await context.params;
    const { id: postId, annotationId } = params;

    const existing = await prisma.proofAnnotation.findUnique({
      where: { id: annotationId },
    });

    if (!existing || existing.postId !== postId) {
      return NextResponse.json(
        { error: "Annotation not found" },
        { status: 404 }
      );
    }

    await prisma.proofAnnotation.delete({
      where: { id: annotationId },
    });

    return NextResponse.json({ message: "Annotation deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting annotation:", error);
    return NextResponse.json(
      { error: "Failed to delete annotation", details: error.message },
      { status: 500 }
    );
  }
}
