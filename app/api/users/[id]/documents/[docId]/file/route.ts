import { type NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { prisma } from "@/lib/prisma";
import { can, requireSession } from "@/lib/api-auth";
import { safeDisplayName } from "@/lib/chat/file-rules";
import { documentDiskPath } from "@/lib/hr-documents";

export const dynamic = "force-dynamic";

/** The bytes of one employee document, for its owner or someone who may read users. */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string; docId: string }> }
) {
  const { id, docId } = await context.params;
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  const userId = parseInt(id, 10);
  if (isNaN(userId)) return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
  if (auth.userId !== userId && !(await can(auth.session, "users", "read"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const doc = await prisma.userDocument.findUnique({
    where: { id: docId },
    select: { id: true, userId: true, fileUrl: true, fileName: true, fileType: true },
  });
  // Same answer for "not yours" and "missing": the id alone must not confirm a document exists.
  const file = doc && doc.userId === userId ? documentDiskPath(doc) : null;
  if (!doc || !file) return NextResponse.json({ error: "Document not found" }, { status: 404 });

  let data: Buffer;
  try {
    data = await readFile(file);
  } catch (error) {
    if ((error as { code?: string }).code !== "ENOENT") console.error("[documents/file] read failed:", error);
    return NextResponse.json({ error: "The file for this document is missing" }, { status: 404 });
  }

  const name = safeDisplayName(doc.fileName);
  const download = request.nextUrl.searchParams.get("download") === "1";
  return new NextResponse(data as unknown as BodyInit, {
    headers: {
      "Content-Type": doc.fileType || "application/octet-stream",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${name.replace(/[^\x20-\x7e]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      // Inline PDFs and images only; nothing in here runs script on the app's origin.
      "Content-Security-Policy": "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; object-src 'self'; frame-ancestors 'self'",
    },
  });
}
