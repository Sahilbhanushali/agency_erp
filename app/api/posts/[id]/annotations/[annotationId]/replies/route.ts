import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAnnotationReplySchema } from "@/lib/validation/approval";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string; annotationId: string }> }
) {
  try {
    const params = await context.params;
    const { id: postId, annotationId } = params;
    const session = await getServerSession(authOptions);

    const body = await request.json();
    const parsed = createAnnotationReplySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const annotation = await prisma.proofAnnotation.findUnique({
      where: { id: annotationId },
      include: { post: true },
    });

    if (!annotation || annotation.postId !== postId) {
      return NextResponse.json(
        { error: "Annotation not found" },
        { status: 404 }
      );
    }

    const resolvedAuthorName =
      session?.user?.name || parsed.data.authorName || "Reviewer";
    const resolvedAuthorRole =
      session?.user?.role || parsed.data.authorRole || "Team";
    const resolvedUserId = session?.user?.id ? Number(session.user.id) : null;

    const reply = await prisma.proofAnnotationReply.create({
      data: {
        annotationId,
        content: parsed.data.content,
        authorName: resolvedAuthorName,
        authorRole: resolvedAuthorRole,
        userId: resolvedUserId,
      },
      include: {
        user: { select: { id: true, name: true, role: true } },
      },
    });

    return NextResponse.json({
      message: "Reply added successfully",
      reply,
    }, { status: 201 });
  } catch (error: any) {
    console.error("Error creating annotation reply:", error);
    return NextResponse.json(
      { error: "Failed to add reply", details: error.message },
      { status: 500 }
    );
  }
}
