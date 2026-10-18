import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireCan } from "@/lib/api-auth";
import { promises as fs } from "fs";
import path from "path";

// Helper function to delete file from filesystem
async function deleteFileFromDisk(fileUrl: string): Promise<void> {
  try {
    const filename = fileUrl.replace('/api/uploads/', '').replace('/uploads/', '').replace('/Uploads/', '');
    const filePath = path.join(process.cwd(), "public", "uploads", filename)
    
    try {
      await fs.access(filePath)
      await fs.unlink(filePath)
      console.log(`Successfully deleted file: ${filePath}`)
    } catch (fileError) {
      console.warn(`File not found or already deleted: ${filePath}`)
    }
  } catch (error) {
    console.error(`Failed to delete file: ${fileUrl}`, error)
  }
}

// DELETE single asset
export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  try {
    const auth = await requireCan("assets", "delete");
    if (!auth.ok) return auth.response;
    const session = auth.session;

    // Check if user is admin (adjust this condition based on your auth system)
    // You might want to check session.user.role === 'admin' or similar
    const isAdmin = true; // Replace with your actual admin check
    // if (!isAdmin) {
    //   return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    // }

    const asset = await prisma.asset.findUnique({
      where: { id: params.id },
      select: { id: true, url: true, filename: true }
    });

    if (!asset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    // Delete file from filesystem
    await deleteFileFromDisk(asset.url);

    // Delete from database
    await prisma.asset.delete({
      where: { id: params.id }
    });

    return NextResponse.json({
      success: true,
      message: `Asset ${asset.filename} deleted successfully`
    });

  } catch (error) {
    console.error("Error deleting asset:", error);
    return NextResponse.json({ 
      error: "Failed to delete asset",
      details: process.env.NODE_ENV === 'development' ? error : undefined
    }, { status: 500 });
  }
}

// POST bulk delete assets
export async function POST(request: NextRequest) {
  try {
    const auth = await requireCan("assets", "create");
    if (!auth.ok) return auth.response;
    const session = auth.session;

    // Check if user is admin
    const isAdmin = true; // Replace with your actual admin check
    if (!isAdmin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { assetIds } = await request.json();

    if (!assetIds || !Array.isArray(assetIds) || assetIds.length === 0) {
      return NextResponse.json({ error: "Asset IDs array is required" }, { status: 400 });
    }

    // Get all assets to delete
    const assets = await prisma.asset.findMany({
      where: { 
        id: { in: assetIds }
      },
      select: { id: true, url: true, filename: true }
    });

    if (assets.length === 0) {
      return NextResponse.json({ error: "No assets found" }, { status: 404 });
    }

    // Delete files from filesystem (continue even if some fail)
    const deleteFilePromises = assets.map((asset: { url: string }) => deleteFileFromDisk(asset.url));
    await Promise.allSettled(deleteFilePromises);

    // Delete from database
    const deleteResult = await prisma.asset.deleteMany({
      where: { 
        id: { in: assetIds }
      }
    });

    return NextResponse.json({
      success: true,
      message: `Successfully deleted ${deleteResult.count} assets`,
      deletedCount: deleteResult.count,
      requestedCount: assetIds.length
    });

    } catch (error) {
    console.error("Error bulk deleting assets:", error);
    return NextResponse.json({ 
      error: "Failed to delete assets",
      details: process.env.NODE_ENV === 'development' ? error : undefined
    }, { status: 500 });
  }
}

// PUT replace single asset
export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  try {
    const auth = await requireCan("assets", "update");
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const maxFileSize = 500 * 1024 * 1024; // 100MB
    if (file.size > maxFileSize) {
      return NextResponse.json({ error: `File exceeds 100MB limit` }, { status: 400 });
    }

    const asset = await prisma.asset.findUnique({
      where: { id: params.id },
      select: { id: true, url: true, filename: true }
    });

    if (!asset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    // Delete old file
    await deleteFileFromDisk(asset.url);

    // Save new file
    const uploadDir = path.join(process.cwd(), "public", "uploads");
    await fs.mkdir(uploadDir, { recursive: true });

    const originalName = file.name;
    const sanitizedBaseName = originalName.replace(/\s+/g, "_").replace(/[^\w.-]/g, "").toLowerCase();
    const fileName = `${Date.now()}-${sanitizedBaseName}`;
    const filePath = path.join(uploadDir, fileName);
    
    const fsNode = await import('fs');
    const writeStream = fsNode.createWriteStream(filePath);
    const reader = file.stream().getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        writeStream.write(value);
      }
    } finally {
      writeStream.end();
    }

    const url = `/api/uploads/${fileName}`;
    const contentType = file.type.startsWith("image/") ? "image" : (file.type.startsWith("video/") ? "video" : "unknown");

    // Update in database
    const updatedAsset = await prisma.asset.update({
      where: { id: params.id },
      data: {
        filename: originalName,
        url: url,
        size: file.size,
        type: contentType,
      }
    });

    return NextResponse.json({
      success: true,
      message: `Asset replaced successfully`,
      asset: updatedAsset
    });

  } catch (error) {
    console.error("Error replacing asset:", error);
    return NextResponse.json({ 
      error: "Failed to replace asset",
      details: process.env.NODE_ENV === 'development' ? error : undefined
    }, { status: 500 });
  }
}