import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const template = await prisma.hrmsOfferTemplate.findUnique({
      where: { id },
      include: {
        letterhead: true,
        createdBy: { select: { id: true, name: true } },
      },
    });

    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    return NextResponse.json(template);
  } catch (error: any) {
    console.error("Get template error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch template" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await prisma.hrmsOfferTemplate.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Template not found" }, { status: 404 });

    // Handle DUPLICATE action
    if (body.action === "DUPLICATE") {
      const duplicated = await prisma.hrmsOfferTemplate.create({
        data: {
          name: `${existing.name} (Copy)`,
          description: existing.description,
          category: existing.category,
          department: existing.department,
          employmentType: existing.employmentType,
          status: "DRAFT",
          version: 1,
          contentHtml: existing.contentHtml,
          letterheadId: existing.letterheadId,
          createdById: auth.userId,
        },
      });
      return NextResponse.json(duplicated, { status: 201 });
    }

    const data: any = { ...body };
    delete data.action;

    // Increment version if content is modified
    if (data.contentHtml && data.contentHtml !== existing.contentHtml) {
      data.version = existing.version + 1;
    }

    const updated = await prisma.hrmsOfferTemplate.update({
      where: { id },
      data,
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("Update template error:", error);
    return NextResponse.json({ error: error.message || "Failed to update template" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const existing = await prisma.hrmsOfferTemplate.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Template not found" }, { status: 404 });

    // Archiving is standard rather than deleting to preserve past offer audits
    await prisma.hrmsOfferTemplate.update({
      where: { id },
      data: { status: "ARCHIVED" },
    });

    return NextResponse.json({ success: true, archived: true });
  } catch (error: any) {
    console.error("Delete template error:", error);
    return NextResponse.json({ error: error.message || "Failed to archive template" }, { status: 500 });
  }
}
