import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireCan } from "@/lib/api-auth";
import { documentFileUrl } from "@/lib/hr-documents";

export const dynamic = "force-dynamic";

const Query = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

/**
 * Every employee document waiting for verification, oldest first, for Admin, Manager,
 * HR — whoever holds users:approve. One place to work through the queue instead of
 * opening each employee's vault in turn.
 */
export async function GET(request: NextRequest) {
  const auth = await requireCan("users", "approve");
  if (!auth.ok) return auth.response;

  const parsed = Query.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Invalid page" }, { status: 400 });
  const { page, pageSize } = parsed.data;

  try {
    const where = { status: "PENDING" };
    const [total, rows] = await Promise.all([
      prisma.userDocument.count({ where }),
      prisma.userDocument.findMany({
        where,
        orderBy: { uploadedAt: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          userId: true,
          title: true,
          category: true,
          fileName: true,
          fileType: true,
          fileSize: true,
          expiryDate: true,
          uploadedAt: true,
          notes: true,
          user: { select: { id: true, name: true, email: true, avatar: true } },
          uploadedBy: { select: { id: true, name: true } },
        },
      }),
    ]);

    return NextResponse.json({
      documents: rows.map((d) => ({ ...d, fileUrl: documentFileUrl(d.userId, d.id, d.uploadedAt) })),
      total,
      page,
      pageSize,
    });
  } catch (error) {
    console.error("[documents/pending] failed:", error);
    return NextResponse.json({ error: "Could not load pending documents" }, { status: 500 });
  }
}
