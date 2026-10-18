import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { existsSync } from "fs";
import { requireCan } from "@/lib/api-auth";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireCan("posts", "read");
    if (!auth.ok) return auth.response;
    const session = auth.session as any;
    const formData = await request.formData();
    const audioFile = formData.get("audio") as File | null;
    const postId = formData.get("postId") as string | null;

    if (!audioFile) {
      return NextResponse.json(
        { error: "Missing required fields: audio is required" },
        { status: 400 }
      );
    }

    if (!audioFile.type || !audioFile.type.startsWith("audio/")) {
      return NextResponse.json(
        { error: "Only audio files are allowed" },
        { status: 400 }
      );
    }

    const uploadsDir = path.join(process.cwd(), "public", "uploads", "audio");
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true });
    }

    const timestamp = Date.now();
    const extension = audioFile.name.split(".").pop() || "webm";
    const filename = `comment-${postId || "general"}-${timestamp}.${extension}`;
    const filepath = path.join(uploadsDir, filename);

    const bytes = await audioFile.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filepath, buffer);

    return NextResponse.json({
      success: true,
      url: `/api/uploads/audio/${filename}`,
      filename: audioFile.name,
    });
  } catch (error: any) {
    console.error("Error uploading comment audio:", error);
    return NextResponse.json(
      { error: "Failed to upload audio" },
      { status: 500 }
    );
  }
}
