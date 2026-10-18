import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import path from "path";
import fs from "fs/promises";
import { deleteLocalFile } from "@/lib/storage";
import { requireCan } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireCan("companies", "update");
    if (!auth.ok) return auth.response;
    const session = auth.session as any;
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const type = (formData.get("type") as string) || "letterhead"; // 'letterhead' | 'signature' | 'logo'
    const oldUrl = formData.get("oldUrl") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate mime type
    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/svg+xml", "image/gif"];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file format. Please upload PNG, JPG, WEBP, or SVG." },
        { status: 400 }
      );
    }

    // Validate size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File size too large. Maximum allowed size is 5MB." },
        { status: 400 }
      );
    }

    // If an old file is being replaced, clean it up from disk
    if (oldUrl) {
      await deleteLocalFile(oldUrl);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const uploadDir = path.join(process.cwd(), "public", "uploads", "finance");
    await fs.mkdir(uploadDir, { recursive: true });

    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const filename = `${type}-${Date.now()}-${safeName}`;
    const filePath = path.join(uploadDir, filename);
    await fs.writeFile(filePath, buffer);

    const publicUrl = `/uploads/finance/${filename}`;

    return NextResponse.json({
      url: publicUrl,
      filename,
      type,
    });
  } catch (error: any) {
    console.error("[companies/upload] error:", error);
    return NextResponse.json(
      { error: "Failed to upload image", details: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireCan("companies", "update");
    if (!auth.ok) return auth.response;
    const session = auth.session as any;
    const { url } = await request.json();
    if (url) {
      await deleteLocalFile(url);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[companies/upload DELETE] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
