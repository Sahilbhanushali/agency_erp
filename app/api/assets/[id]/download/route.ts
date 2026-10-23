import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can, requireCan } from "@/lib/api-auth";
import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check authentication
    const auth = await requireCan("assets", "read");
    if (!auth.ok) return auth.response;
    const session = auth.session;

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
    // assets:read is what the Assets module itself checks, so a role granted it in
    // the matrix can download; a role name called "MANAGER" is no longer required.
    const isAdmin = await can(session, "assets", "read");
    const isManager = isAdmin;
    const isAssignedToProject = asset.post?.project?.assignedUsers?.length > 0;

    if (!isAdmin && !isManager && !isAssignedToProject) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Construct file path from filename or relative URL. asset.url can be user-supplied
    // (link assets), so the joined path must stay inside public/ — "../../.env" in a
    // stored URL would otherwise download the app's secrets.
    const publicRoot = path.resolve(process.cwd(), "public");
    const filename = path.basename(asset.url.split("?")[0]);
    const possiblePaths = [
      path.join(publicRoot, "uploads", filename),
      path.join(publicRoot, "Uploads", filename),
      path.resolve(publicRoot, "." + path.posix.normalize("/" + asset.url.split("?")[0])),
    ].filter((p) => p.startsWith(publicRoot + path.sep));

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