import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAnnotationSchema } from "@/lib/validation/approval";
import { requireCan } from "@/lib/api-auth";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const postId = params.id;

    const annotations = await prisma.proofAnnotation.findMany({
      where: { postId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        replies: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                role: true,
              },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ annotations });
  } catch (error: any) {
    console.error("Error fetching annotations:", error);
    return NextResponse.json(
      { error: "Failed to load annotations" },
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
    const auth = await requireCan("posts", "read");
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const body = await request.json();
    const parsed = createAnnotationSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { assetId, x, y, color, comment, authorName, authorRole, version } = parsed.data;

    // Check post exists
    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: {
        project: { select: { name: true, clientId: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
      },
    });

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    const resolvedAuthorName =
      session?.user?.name || authorName || "Client Reviewer";
    const resolvedAuthorRole =
      session?.user?.role || authorRole || "Client";
    const resolvedUserId = session?.user?.id ? Number(session.user.id) : null;

    const annotation = await prisma.proofAnnotation.create({
      data: {
        postId,
        assetId: assetId || null,
        x,
        y,
        color: color || "#ef4444",
        comment,
        authorName: resolvedAuthorName,
        authorRole: resolvedAuthorRole,
        userId: resolvedUserId,
        version: version || 1,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
        replies: true,
      },
    });

    // Create Audit Log
    try {
      await prisma.auditLog.create({
        data: {
          action: "CREATE_PROOF_ANNOTATION",
          entityType: "Post",
          entityId: postId,
          newValues: JSON.stringify({
            annotationId: annotation.id,
            comment,
            x,
            y,
            authorName: resolvedAuthorName,
          }),
          userId: resolvedUserId,
        },
      });
    } catch (e) {
      console.warn("Could not create audit log:", e);
    }

    // Notify assigned team member
    if (post.assignedToId && post.assignedToId !== resolvedUserId) {
      try {
        await prisma.notification.create({
          data: {
            title: "New Pin Comment on Deliverable",
            message: `${resolvedAuthorName} added an annotation feedback on "${post.title}"`,
            userId: post.assignedToId,
            link: `/dashboard/projects/posts/${postId}`,
          },
        });
      } catch (e) {
        console.warn("Could not create notification:", e);
      }
    }

    return NextResponse.json({
      message: "Annotation added successfully",
      annotation,
    }, { status: 201 });
  } catch (error: any) {
    console.error("Error creating annotation:", error);
    return NextResponse.json(
      { error: "Failed to create annotation", details: error.message },
      { status: 500 }
    );
  }
}
