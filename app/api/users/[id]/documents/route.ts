import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import path from "path";
import fs from "fs/promises";
import { deleteLocalFile } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = parseInt(params.id, 10);
    if (isNaN(userId)) {
      return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
    }

    const documents = await prisma.userDocument.findMany({
      where: { userId },
      orderBy: { uploadedAt: "desc" },
    });

    return NextResponse.json(documents);
  } catch (error: any) {
    console.error("[users/documents GET] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !["ADMIN", "MANAGER", "Manager"].includes(session.user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = parseInt(params.id, 10);
    if (isNaN(userId)) {
      return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const title = (formData.get("title") as string) || "Untitled Document";
    const category = (formData.get("category") as string) || "OTHER";
    const notes = (formData.get("notes") as string) || null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Max 25MB for documents (PDF, images, docx)
    if (file.size > 25 * 1024 * 1024) {
      return NextResponse.json({ error: "File exceeds 25MB limit" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const uploadDir = path.join(process.cwd(), "public", "uploads", "users");
    await fs.mkdir(uploadDir, { recursive: true });

    const safeOriginal = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const filename = `doc-${userId}-${Date.now()}-${safeOriginal}`;
    const filePath = path.join(uploadDir, filename);
    await fs.writeFile(filePath, buffer);

    const publicUrl = `/uploads/users/${filename}`;

    const doc = await prisma.userDocument.create({
      data: {
        userId,
        title,
        category,
        fileUrl: publicUrl,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type || "application/octet-stream",
        notes,
      },
    });

    // If this is an offer letter, also link it directly to User.offerLetterUrl
    if (category === "OFFER_LETTER") {
      await prisma.user.update({
        where: { id: userId },
        data: { offerLetterUrl: publicUrl },
      });
    }

    return NextResponse.json(doc, { status: 201 });
  } catch (error: any) {
    console.error("[users/documents POST] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
