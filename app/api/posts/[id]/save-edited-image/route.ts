// app/api/posts/[id]/save-edited-image/route.ts
import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { promises as fs } from "fs";
import path from "path";
import { requireCan } from "@/lib/api-auth";
import { deleteLocalFile } from "@/lib/storage";

export async function POST(
  request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  try {
    const auth = await requireCan("assets", "create");
    if (!auth.ok) return auth.response;
    const session = auth.session;
    const body = await request.json();
    const { imageData, originalAssetId, filename } = body;

    if (!imageData || !originalAssetId) {
      return NextResponse.json(
        { error: "Image data and original asset ID are required" },
        { status: 400 }
      );
    }

    // Verify the post exists
    const post = await prisma.post.findUnique({
      where: { id: params.id },
      include: {
        project: true,
        assets: {
          where: { id: originalAssetId }
        }
      },
    });

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    if (post.assets.length === 0) {
      return NextResponse.json(
        { error: "Original asset not found" },
        { status: 404 }
      );
    }

    const originalAsset = post.assets[0];

    // Check if there is already an edited version
    const existingEditedAsset = await prisma.asset.findFirst({
      where: {
        postId: params.id,
        isEdited: true,
        order: originalAsset.order,
      },
    });

    if (existingEditedAsset) {
      // Delete file from storage
      await deleteLocalFile(existingEditedAsset.url);

      // Delete asset record from DB
      await prisma.asset.delete({ where: { id: existingEditedAsset.id } });
    }

    // Extract base64 data (remove data:image/png;base64, prefix)
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");

    // Generate filename
    const timestamp = Date.now();
    const sanitizedFilename = (filename || originalAsset.filename)
      .replace(/\s+/g, "_")
      .replace(/[^\w.-]/g, "")
      .toLowerCase();
    const editedFilename = `edited_${timestamp}_${sanitizedFilename}`;

    // Ensure uploads directory exists
    const uploadDir = path.join(process.cwd(), "public", "uploads");
    await fs.mkdir(uploadDir, { recursive: true });

    // Save file
    const filePath = path.join(uploadDir, editedFilename);
    await fs.writeFile(filePath, buffer);

    // Get file size
    const stats = await fs.stat(filePath);

    // Create TaskLog data
    const taskLogData = {
      action: "DESIGN_IMAGE_EDITED",
      oldStatus: null,
      newStatus: null,
      oldValues: { originalAssetId },
      newValues: { editedAssetId: "pending" }, // Will be updated after asset creation
      feedback: `Image edited: ${sanitizedFilename}`,
      ipAddress: request.headers.get("x-forwarded-for") || null,
      userAgent: request.headers.get("user-agent") || null,
      postId: params.id,
      userId: parseInt(session.user.id, 10),
    };

    // Create new asset with isEdited: true
    const newAsset = await prisma.asset.create({
      data: {
        filename: sanitizedFilename,
        url: `/api/uploads/${editedFilename}`,
        size: stats.size,
        type: "image",
        postId: params.id,
        uploadedById: parseInt(session.user.id, 10),
        isEdited: true,
        isReference: false,
        order: originalAsset.order,
      },
    });

    // Create TaskLog
    await prisma.taskLog.create({
      data: {
        ...taskLogData,
        newValues: { originalAssetId, editedAssetId: newAsset.id },
      },
    });

    return NextResponse.json({
      message: "Edited image saved successfully",
      asset: newAsset,
    });
  } catch (error) {
    console.error("Error saving edited image:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Failed to save edited image";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
