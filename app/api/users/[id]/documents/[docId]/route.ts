import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteLocalFile } from "@/lib/storage";
import path from "path";
import fs from "fs/promises";
import { can } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string; docId: string }> }
) {
  const { id, docId } = await context.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const currentUserId = parseInt(session.user.id, 10);
    const isStaffOrAdmin = await can(session, "users", "update");
    const userId = parseInt(id, 10);

    const doc = await prisma.userDocument.findUnique({
      where: { id: docId },
    });

    if (!doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    if (doc.userId !== userId) {
      return NextResponse.json({ error: "Document does not belong to specified user" }, { status: 400 });
    }

    // Permission check
    if (!isStaffOrAdmin && currentUserId !== doc.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const contentType = request.headers.get("content-type") || "";
    let updateData: any = {};

    if (contentType.includes("multipart/form-data")) {
      // File replacement or form-data edit
      const formData = await request.formData();
      const replacementFile = formData.get("file") as File | null;
      const title = formData.get("title") as string | null;
      const category = formData.get("category") as string | null;
      const status = formData.get("status") as string | null;
      const notes = formData.get("notes") as string | null;
      const expiryDateStr = formData.get("expiryDate") as string | null;
      const rejectionReason = formData.get("rejectionReason") as string | null;

      if (title) updateData.title = title.trim();
      if (category) updateData.category = category;
      if (notes !== null) updateData.notes = notes;
      if (expiryDateStr !== null) {
        updateData.expiryDate = expiryDateStr ? new Date(expiryDateStr) : null;
      }

      if (status) {
        if (!isStaffOrAdmin && status !== doc.status) {
          return NextResponse.json({ error: "Only HR or Admin can change document verification status" }, { status: 403 });
        }
        updateData.status = status;
        if (status === "VERIFIED") {
          updateData.verifiedAt = new Date();
          updateData.verifiedById = currentUserId;
          updateData.rejectionReason = null;
        } else if (status === "REJECTED") {
          updateData.verifiedAt = null;
          updateData.verifiedById = null;
          updateData.rejectionReason = rejectionReason || "Document rejected by HR";
        } else if (status === "PENDING") {
          updateData.verifiedAt = null;
          updateData.verifiedById = null;
          updateData.rejectionReason = null;
        }
      }

      if (replacementFile) {
        if (replacementFile.size > 25 * 1024 * 1024) {
          return NextResponse.json({ error: "File exceeds 25MB limit" }, { status: 400 });
        }

        // Remove old physical file if exists
        if (doc.fileUrl) {
          await deleteLocalFile(doc.fileUrl);
        }

        const uploadDir = path.join(process.cwd(), "public", "uploads", "users");
        await fs.mkdir(uploadDir, { recursive: true });

        const buffer = Buffer.from(await replacementFile.arrayBuffer());
        const safeOriginal = replacementFile.name.replace(/[^a-zA-Z0-9.-]/g, "_");
        const filename = `doc-${userId}-${Date.now()}-${safeOriginal}`;
        const filePath = path.join(uploadDir, filename);
        await fs.writeFile(filePath, buffer);

        updateData.fileUrl = `/uploads/users/${filename}`;
        updateData.fileName = replacementFile.name;
        updateData.fileSize = replacementFile.size;
        updateData.fileType = replacementFile.type || "application/octet-stream";
        updateData.status = "PENDING"; // Re-verification required
        updateData.verifiedAt = null;
        updateData.verifiedById = null;
        updateData.uploadedAt = new Date();
      }
    } else {
      // JSON body
      const body = await request.json();
      const { status, rejectionReason, title, category, expiryDate, notes } = body;

      if (title) updateData.title = title.trim();
      if (category) updateData.category = category;
      if (notes !== undefined) updateData.notes = notes;
      if (expiryDate !== undefined) {
        updateData.expiryDate = expiryDate ? new Date(expiryDate) : null;
      }

      if (status) {
        if (!isStaffOrAdmin && status !== doc.status) {
          return NextResponse.json({ error: "Only HR or Admin can change document verification status" }, { status: 403 });
        }
        updateData.status = status;
        if (status === "VERIFIED") {
          updateData.verifiedAt = new Date();
          updateData.verifiedById = currentUserId;
          updateData.rejectionReason = null;
        } else if (status === "REJECTED") {
          updateData.verifiedAt = null;
          updateData.verifiedById = null;
          updateData.rejectionReason = rejectionReason || "Document rejected by HR";
        } else if (status === "PENDING") {
          updateData.verifiedAt = null;
          updateData.verifiedById = null;
          updateData.rejectionReason = null;
        }
      }
    }

    const updatedDoc = await prisma.userDocument.update({
      where: { id: docId },
      data: updateData,
      include: {
        uploadedBy: {
          select: { id: true, name: true, email: true },
        },
        verifiedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return NextResponse.json(updatedDoc);
  } catch (error: any) {
    console.error("[users/documents PATCH] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string; docId: string }> }
) {
  const { id, docId } = await context.params;
  const userId = parseInt(id, 10);
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const currentUserId = parseInt(session.user.id, 10);
    const isStaffOrAdmin = await can(session, "users", "update");
    const doc = await prisma.userDocument.findUnique({
      where: { id: docId },
    });

    if (!doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    if (doc.userId !== userId) {
      return NextResponse.json({ error: "Document does not belong to specified user" }, { status: 400 });
    }

    // Permission check
    if (!isStaffOrAdmin && currentUserId !== doc.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Physical deletion of local file from disk
    if (doc.fileUrl) {
      await deleteLocalFile(doc.fileUrl);
    }

    await prisma.userDocument.delete({
      where: { id: docId },
    });

    // If this was the user's offerLetterUrl, clear it
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { offerLetterUrl: true },
    });
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
