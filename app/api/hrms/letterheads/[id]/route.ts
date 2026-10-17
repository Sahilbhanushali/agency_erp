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
    const letterhead = await prisma.hrmsLetterhead.findUnique({
      where: { id },
      include: {
        templates: true,
      },
    });

    if (!letterhead) {
      return NextResponse.json({ error: "Letterhead not found" }, { status: 404 });
    }

    return NextResponse.json(letterhead);
  } catch (error: any) {
    console.error("Get letterhead error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch letterhead" }, { status: 500 });
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

    const existing = await prisma.hrmsLetterhead.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Letterhead not found" }, { status: 404 });

    // Handle DUPLICATE
    if (body.action === "DUPLICATE") {
      const duplicated = await prisma.hrmsLetterhead.create({
        data: {
          name: `${existing.name} (Copy)`,
          companyName: existing.companyName,
          logoUrl: existing.logoUrl,
          address: existing.address,
          city: existing.city,
          state: existing.state,
          country: existing.country,
          postalCode: existing.postalCode,
          email: existing.email,
          phone: existing.phone,
          website: existing.website,
          headerHtml: existing.headerHtml,
          footerHtml: existing.footerHtml,
          primaryColor: existing.primaryColor,
          secondaryColor: existing.secondaryColor,
          fontFamily: existing.fontFamily,
          marginTop: existing.marginTop,
          marginBottom: existing.marginBottom,
          marginLeft: existing.marginLeft,
          marginRight: existing.marginRight,
          watermarkText: existing.watermarkText,
          watermarkUrl: existing.watermarkUrl,
          isDefault: false,
          status: "DRAFT",
        },
      });
      return NextResponse.json(duplicated, { status: 201 });
    }

    const data: any = { ...body };
    delete data.action;

    if (data.isDefault) {
      await prisma.hrmsLetterhead.updateMany({
        where: { id: { not: id } },
        data: { isDefault: false },
      });
    }

    const updated = await prisma.hrmsLetterhead.update({
      where: { id },
      data,
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("Update letterhead error:", error);
    return NextResponse.json({ error: error.message || "Failed to update letterhead" }, { status: 500 });
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
    const { searchParams } = new URL(request.url);
    const permanent = searchParams.get("permanent") === "true";

    const existing = await prisma.hrmsLetterhead.findUnique({
      where: { id },
      include: {
        _count: { select: { templates: true, offers: true } },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Letterhead not found" }, { status: 404 });
    }

    if (existing.isDefault) {
      return NextResponse.json({ error: "Cannot delete or archive the active default letterhead" }, { status: 400 });
    }

    // If permanent delete is requested or already archived and has no dependencies
    if (permanent || existing.status === "ARCHIVED") {
      if (existing._count.templates > 0 || existing._count.offers > 0) {
        return NextResponse.json(
          {
            error: `Cannot permanently delete: referenced by ${existing._count.templates} template(s) and ${existing._count.offers} offer(s). Keep it archived instead.`,
          },
          { status: 400 }
        );
      }

      await prisma.hrmsLetterhead.delete({ where: { id } });
      return NextResponse.json({ success: true, deleted: true });
    }

    // Default: Soft delete / archive
    await prisma.hrmsLetterhead.update({
      where: { id },
      data: { status: "ARCHIVED" },
    });
    return NextResponse.json({ success: true, archived: true });
  } catch (error: any) {
    console.error("Delete letterhead error:", error);
    return NextResponse.json({ error: error.message || "Failed to delete letterhead" }, { status: 500 });
  }
}
