import { type NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { can, requireCan } from "@/lib/api-auth";

// PATCH: Edit comment content
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ commentId: string }> }
) {
  try {
    const auth = await requireCan("posts", "read");
    if (!auth.ok) return auth.response;
    const session = auth.session as any;
    const resolvedParams = await params
    const commentId = resolvedParams.commentId
    const { content } = await request.json()

    if (!content || !content.trim()) {
      return NextResponse.json({ error: "Comment content cannot be empty" }, { status: 400 })
    }

    // Find the comment
    const existingComment = await prisma.comment.findUnique({
      where: { id: commentId },
      include: { user: true },
    })

    if (!existingComment) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 })
    }

    const userId = Number(session.user.id)
    // Authors edit their own comment; moderating someone else's needs posts:update.
    // This used to compare role names, so any role not literally called ADMIN or
    // Manager could never moderate — including every role created since.
    const isAuthor = existingComment.userId === userId

    if (!isAuthor && !(await can(session, "posts", "update"))) {
      return NextResponse.json({ error: "You are not authorized to edit this comment" }, { status: 403 })
    }

    const updatedComment = await prisma.comment.update({
      where: { id: commentId },
      data: {
        content: content.trim(),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
      },
    })

    return NextResponse.json(updatedComment)
  } catch (error) {
    console.error("Error editing comment:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE: Delete a comment
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ commentId: string }> }
) {
  try {
    const auth = await requireCan("posts", "read");
    if (!auth.ok) return auth.response;
    const session = auth.session as any;
    const resolvedParams = await params
    const commentId = resolvedParams.commentId

    // Find the comment
    const existingComment = await prisma.comment.findUnique({
      where: { id: commentId },
    })

    if (!existingComment) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 })
    }

    const userId = Number(session.user.id)
    const isAuthor = existingComment.userId === userId

    if (!isAuthor && !(await can(session, "posts", "delete"))) {
      return NextResponse.json({ error: "You are not authorized to delete this comment" }, { status: 403 })
    }

    await prisma.comment.delete({
      where: { id: commentId },
    })

    return NextResponse.json({ success: true, message: "Comment deleted successfully" })
  } catch (error) {
    console.error("Error deleting comment:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
