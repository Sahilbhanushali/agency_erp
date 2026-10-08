import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Await params to get the id
    const { id } = await params;

    // Validate the id is a non-empty string
    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "Invalid asset ID" }, { status: 400 });
    }

    // Convert session.user.id to integer if User.id is Int
    const userId = parseInt(session.user.id, 10);
    if (isNaN(userId)) {
      return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
    }

    // Get asset from database
    const asset = await prisma.asset.findUnique({
      where: { id: id }, // Asset.id is a string (CUID)
      include: {
        post: {
          include: {
            project: {
              include: {
                assignedUsers: {
                  where: {
                    id: userId, // User.id is an Int
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!asset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    // Check if user has access to this asset
    const isAdmin = session.user.role === "ADMIN";
    const isManager = session.user.role === "MANAGER";
    const isAssignedToProject = asset.post?.project?.assignedUsers?.length > 0;

    if (!isAdmin && !isManager && !isAssignedToProject) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Construct file path from filename or relative URL
    const filename = path.basename(asset.url.split("?")[0]);
    const possiblePaths = [
      path.join(process.cwd(), "public", "uploads", filename),
      path.join(process.cwd(), "public", "Uploads", filename),
      path.join(process.cwd(), "public", asset.url),
    ];

    let fileBuffer: Buffer | null = null;
    for (const p of possiblePaths) {
      try {
        fileBuffer = await fs.readFile(p);
        break;
      } catch {
        continue;
      }
    }

    if (!fileBuffer) {
      console.error("File not found for asset:", asset.url);
      return NextResponse.json({ error: "Failed to read asset file" }, { status: 404 });
    }

    // Determine the content type based on asset type
    const upperType = (asset.type || "").toUpperCase();
    const contentType = upperType === "IMAGE" ? "image/jpeg" : upperType === "VIDEO" ? "video/mp4" : "application/octet-stream";

    // Return the file with proper headers
    return new NextResponse(fileBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": fileBuffer.length.toString(),
        "Content-Disposition": `attachment; filename="${asset.filename}"`,
      },
    });
  } catch (error) {
    console.error("Asset download error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}