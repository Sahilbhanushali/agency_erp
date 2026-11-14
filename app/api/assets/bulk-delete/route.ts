import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireCan } from "@/lib/api-auth";
import { deleteLocalFile } from "@/lib/storage";
import { promises as fs } from "fs";
import path from "path";

// Helper function to delete file from filesystem
async function deleteFileFromDisk(fileUrl: string): Promise<void> {
  await deleteLocalFile(fileUrl);
}

// POST bulk delete assets
export async function POST(request: NextRequest) {
  try {
    const auth = await requireCan("assets", "delete");
    if (!auth.ok) return auth.response;

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