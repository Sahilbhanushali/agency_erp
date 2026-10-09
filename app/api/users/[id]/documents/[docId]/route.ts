import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteLocalFile } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string; docId: string }> }
) {
  const { id, docId } = await context.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !["ADMIN", "MANAGER", "Manager"].includes(session.user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = parseInt(id, 10);
    const doc = await prisma.userDocument.findUnique({
      where: { id: docId },
    });

    if (!doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    // Physical deletion of local file from disk
    if (doc.fileUrl) {
      await deleteLocalFile(doc.fileUrl);
    }

    await prisma.userDocument.delete({
      where: { id: docId },
    });

    // If this was the user's offerLetterUrl, clear it
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { offerLetterUrl: true } });
    if (user?.offerLetterUrl === doc.fileUrl) {
      await prisma.user.update({
        where: { id: userId },
        data: { offerLetterUrl: null },
      });
    }

    return NextResponse.json({ success: true, message: "Document deleted" });
  } catch (error: any) {
    console.error("[users/documents DELETE] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
