import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCan, requireSession } from "@/lib/api-auth";
import { seedHrmsInitialData } from "@/lib/hrms/seed-data";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireCan("hrms", "read");
  if (!auth.ok) return auth.response;

  try {
    const letterheadCount = await prisma.hrmsLetterhead.count();
    if (letterheadCount === 0) {
      await seedHrmsInitialData();
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "ACTIVE"; // "ACTIVE" | "ARCHIVED" | "ALL"
    const search = searchParams.get("search")?.toLowerCase().trim();

    const where: any = {};
    if (status !== "ALL") where.status = status;
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { companyName: { contains: search } },
      ];
    }

    const letterheads = await prisma.hrmsLetterhead.findMany({
      where,
      orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
      include: {
        _count: { select: { templates: true, offers: true } },
      },
    });

    return NextResponse.json(letterheads);
  } catch (error: any) {
    console.error("Fetch letterheads error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch letterheads" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireCan("hrms", "create");
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const {
      name,
      companyName,
      logoUrl,
      address,
      city,
      state,
      country,
      postalCode,
      email,
      phone,
      website,
      headerHtml,
      footerHtml,
      primaryColor,
      secondaryColor,
      fontFamily,
      marginTop,
      marginBottom,
      marginLeft,
      marginRight,
      watermarkText,
      watermarkUrl,
      isDefault,
      status,
    } = body;

    if (!name || !companyName) {
      return NextResponse.json(
        { error: "Letterhead name and company name are required" },
        { status: 400 }
      );
    }

    // If setting as default, clear existing default
    if (isDefault) {
      await prisma.hrmsLetterhead.updateMany({
        data: { isDefault: false },
      });
    }

    const letterhead = await prisma.hrmsLetterhead.create({
      data: {
        name: name.trim(),
        companyName: companyName.trim(),
        logoUrl,
        address,
        city,
        state,
        country: country || "India",
        postalCode,
        email,
        phone,
        website,
        headerHtml,
        footerHtml,
        primaryColor: primaryColor || "#1e40af",
        secondaryColor: secondaryColor || "#64748b",
        fontFamily: fontFamily || "'Inter', sans-serif",
        marginTop: marginTop ? Number(marginTop) : 25,
        marginBottom: marginBottom ? Number(marginBottom) : 20,
        marginLeft: marginLeft ? Number(marginLeft) : 20,
        marginRight: marginRight ? Number(marginRight) : 20,
        watermarkText,
        watermarkUrl,
        isDefault: Boolean(isDefault),
        status: status || "ACTIVE",
      },
    });

    return NextResponse.json(letterhead, { status: 201 });
  } catch (error: any) {
    console.error("Create letterhead error:", error);
    return NextResponse.json({ error: error.message || "Failed to create letterhead" }, { status: 500 });
  }
}
