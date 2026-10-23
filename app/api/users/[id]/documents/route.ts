import { type NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { can, requireSession } from "@/lib/api-auth";
import { AttachmentRuleError } from "@/lib/chat/file-rules";
import { documentFileUrl, removeDocumentFile, saveDocumentFile, validateDocument } from "@/lib/hr-documents";

export const dynamic = "force-dynamic";

// Map legacy category strings to current clean categories
const normalizeCategory = (cat: string): string => {
  const c = cat.toUpperCase();
  if (["ID_PROOF", "IDENTITY"].includes(c)) return "IDENTITY";
  if (["EDUCATION", "DEGREE", "CERTIFICATE"].includes(c)) return "EDUCATION";
  if (["OFFER_LETTER", "EMPLOYMENT", "EXPERIENCE", "RESUME"].includes(c)) return "EMPLOYMENT";
  if (["SALARY_SLIP", "BANK_TAX", "TAX", "BANK"].includes(c)) return "BANK_TAX";
  if (["CONTRACT", "CONTRACTS", "NDA"].includes(c)) return "CONTRACTS";
  return "OTHER";
};

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  try {
    // requireSession, not getServerSession: it also turns away a deactivated account.
    const auth = await requireSession();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const userId = parseInt(params.id, 10);
    if (isNaN(userId)) {
      return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
    }

    const currentUserId = parseInt(session.user.id, 10);
    const isHrOrAdmin = await can(session, "users", "read");

    if (!isHrOrAdmin && currentUserId !== userId) {
      return NextResponse.json({ error: "Forbidden: You can only view your own documents" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const categoryParam = searchParams.get("category");
    const statusParam = searchParams.get("status");

    const where: any = { userId };
    if (categoryParam && categoryParam !== "ALL") {
      where.category = categoryParam;
    }
    if (statusParam && statusParam !== "ALL") {
      where.status = statusParam;
    }

    const rawDocuments = await prisma.userDocument.findMany({
      where,
      include: {
        uploadedBy: {
          select: { id: true, name: true, email: true },
        },
        verifiedBy: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { uploadedAt: "desc" },
    });

    const now = new Date();
    // Dynamically check expired status
    const documents = rawDocuments.map((doc) => {
      let status = doc.status || "PENDING";
      if (doc.expiryDate && new Date(doc.expiryDate) < now && status !== "REJECTED") {
        status = "EXPIRED";
      }
      return {
        ...doc,
        // Always the authorized route, also for rows whose fileUrl predates it.
        fileUrl: documentFileUrl(userId, doc.id, doc.uploadedAt),
        status,
        normalizedCategory: normalizeCategory(doc.category),
      };
    });

    return NextResponse.json(documents);
  } catch (error) {
    console.error("[users/documents GET] error:", error);
    return NextResponse.json({ error: "Could not load documents" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  try {
    // requireSession, not getServerSession: it also turns away a deactivated account.
    const auth = await requireSession();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const userId = parseInt(params.id, 10);
    if (isNaN(userId)) {
      return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
    }

    // Role check: Only ADMIN, Manager, or the user themselves can upload
    const currentUserId = parseInt(session.user.id, 10);
    // Employees may upload their own documents; this decides whether they may also
    // upload against someone else’s record.
    const isStaffOrAdmin = await can(session, "users", "update");
    if (!isStaffOrAdmin && currentUserId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const formData = await request.formData();
    const isFile = (v: FormDataEntryValue | null): v is File => v instanceof File;
    const files = formData.getAll("files").filter(isFile);
    const singleFile = formData.get("file");
    const allFiles = files.length > 0 ? files : isFile(singleFile) ? [singleFile] : [];

    const title = (formData.get("title") as string) || "";
    const rawCategory = (formData.get("category") as string) || "OTHER";
    const category = normalizeCategory(rawCategory);
    const notes = (formData.get("notes") as string) || null;
    const expiryDateStr = (formData.get("expiryDate") as string) || null;
    const expiryDate = expiryDateStr ? new Date(expiryDateStr) : null;

    if (allFiles.length === 0) {
      return NextResponse.json({ error: "No file(s) provided" }, { status: 400 });
    }

    // Check every file before writing any, so a bad third file does not leave two behind.
    const mimes: string[] = [];
    for (const file of allFiles) mimes.push((await validateDocument(file)).mime);

    const createdDocs = [];

    for (let i = 0; i < allFiles.length; i++) {
      const file = allFiles[i];
      const id = randomUUID();
      await saveDocumentFile(id, file);
      const fileUrl = documentFileUrl(userId, id);

      // If user provided a specific title and there's 1 file, use that. Otherwise use filename
      const docTitle = allFiles.length === 1 && title.trim()
        ? title.trim()
        : file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");

      const doc = await prisma.userDocument.create({
        data: {
          id,
          userId,
          title: docTitle,
          category,
          status: "PENDING",
          fileUrl: fileUrl,
          fileName: file.name,
          fileSize: file.size,
          fileType: mimes[i],
          expiryDate,
          uploadedById: currentUserId || null,
          notes,
        },
        include: {
          uploadedBy: {
            select: { id: true, name: true, email: true },
          },
        },
      }).catch(async (error) => {
        await removeDocumentFile({ id, fileUrl: fileUrl });
        throw error;
      });

      // If this is an offer letter, also link directly to User.offerLetterUrl
      if (category === "EMPLOYMENT" && docTitle.toLowerCase().includes("offer")) {
        await prisma.user.update({
          where: { id: userId },
          data: { offerLetterUrl: fileUrl },
        });
      }

      createdDocs.push(doc);
    }

    return NextResponse.json(
      createdDocs.length === 1 ? createdDocs[0] : { count: createdDocs.length, documents: createdDocs },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof AttachmentRuleError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[users/documents POST] error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
