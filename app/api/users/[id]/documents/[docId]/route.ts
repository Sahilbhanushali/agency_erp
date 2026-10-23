import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { can, requireSession } from "@/lib/api-auth";
import { logAuditAction } from "@/lib/audit";
import { AttachmentRuleError } from "@/lib/chat/file-rules";
import { documentFileUrl, removeDocumentFile, saveDocumentFile, validateDocument } from "@/lib/hr-documents";

const STATUSES = new Set(["PENDING", "VERIFIED", "REJECTED"]);

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string; docId: string }> }
) {
  const { id, docId } = await context.params;
  try {
    // requireSession, not getServerSession: it also turns away a deactivated account.
    const auth = await requireSession();
    if (!auth.ok) return auth.response;
    const session = auth.session;

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
      const replacementFile = formData.get("file");
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
        if (!STATUSES.has(status)) {
          return NextResponse.json({ error: "Invalid status" }, { status: 400 });
        }
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

      if (replacementFile instanceof File) {
        const { mime } = await validateDocument(replacementFile);

        // A row from before private storage keeps its old file until now; drop it.
        // Otherwise the new bytes overwrite the old under the same id.
        if (doc.fileUrl.startsWith("/uploads/")) await removeDocumentFile(doc);
        await saveDocumentFile(doc.id, replacementFile);

        updateData.fileUrl = documentFileUrl(doc.userId, doc.id);
        updateData.fileName = replacementFile.name;
        updateData.fileSize = replacementFile.size;
        updateData.fileType = mime;
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
        if (!STATUSES.has(status)) {
          return NextResponse.json({ error: "Invalid status" }, { status: 400 });
        }
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

    if (updateData.status && updateData.status !== doc.status) {
      await logAuditAction({
        userId: String(currentUserId),
        action: `DOCUMENT_${updateData.status}`,
        entityType: "UserDocument",
        entityId: doc.id,
        oldValues: JSON.stringify({ status: doc.status }),
        newValues: JSON.stringify({ status: updateData.status, rejectionReason: updateData.rejectionReason ?? null }),
      });
    }

    return NextResponse.json({ ...updatedDoc, fileUrl: documentFileUrl(doc.userId, doc.id, updatedDoc.uploadedAt) });
  } catch (error) {
    if (error instanceof AttachmentRuleError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[users/documents PATCH] error:", error);
    return NextResponse.json({ error: "Could not update the document" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string; docId: string }> }
) {
  const { id, docId } = await context.params;
  const userId = parseInt(id, 10);
  try {
    // requireSession, not getServerSession: it also turns away a deactivated account.
    const auth = await requireSession();
    if (!auth.ok) return auth.response;
    const session = auth.session;

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

    await logAuditAction({
      userId: String(currentUserId),
      action: "DOCUMENT_DELETED",
      entityType: "UserDocument",
      entityId: doc.id,
      oldValues: JSON.stringify({ userId: doc.userId, title: doc.title, fileName: doc.fileName, status: doc.status }),
    });

    await prisma.userDocument.delete({
      where: { id: docId },
    });
    // After the row: a failed delete must not leave a record pointing at nothing.
    await removeDocumentFile(doc);

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
  } catch (error) {
    console.error("[users/documents DELETE] error:", error);
    return NextResponse.json({ error: "Could not delete the document" }, { status: 500 });
  }
}
