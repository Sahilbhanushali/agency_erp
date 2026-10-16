import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";
import { seedHrmsInitialData } from "@/lib/hrms/seed-data";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  try {
    const templateCount = await prisma.hrmsOfferTemplate.count();
    if (templateCount === 0) {
      await seedHrmsInitialData();
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const department = searchParams.get("department");
    const status = searchParams.get("status") || "ACTIVE"; // "ACTIVE" | "ARCHIVED" | "ALL"
    const search = searchParams.get("search")?.toLowerCase().trim();

    const where: any = {};
    if (category && category !== "ALL") where.category = category;
    if (department && department !== "ALL") where.department = department;
    if (status !== "ALL") where.status = status;
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { description: { contains: search } },
      ];
    }

    const templates = await prisma.hrmsOfferTemplate.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      include: {
        letterhead: { select: { id: true, name: true, companyName: true } },
        createdBy: { select: { id: true, name: true } },
        _count: { select: { offers: true } },
      },
    });

    return NextResponse.json(templates);
  } catch (error: any) {
    console.error("Fetch templates error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch templates" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const {
      name,
      description,
      category,
      department,
      employmentType,
      status,
      contentHtml,
      letterheadId,
    } = body;

    if (!name || !contentHtml) {
      return NextResponse.json(
        { error: "Template name and content HTML are required" },
        { status: 400 }
      );
    }

    const template = await prisma.hrmsOfferTemplate.create({
      data: {
        name: name.trim(),
        description,
        category: category || "STANDARD",
        department,
        employmentType: employmentType || "FULL_TIME",
        status: status || "ACTIVE",
        contentHtml,
        letterheadId,
        createdById: auth.userId,
      },
    });

    return NextResponse.json(template, { status: 201 });
  } catch (error: any) {
    console.error("Create template error:", error);
    return NextResponse.json({ error: error.message || "Failed to create template" }, { status: 500 });
  }
}
