import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const department = searchParams.get("department");
    const status = searchParams.get("status");
    const search = searchParams.get("search")?.toLowerCase().trim();

    const where: any = {};
    if (department && department !== "ALL") where.department = department;
    if (status && status !== "ALL") where.status = status;
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { code: { contains: search } },
        { department: { contains: search } },
      ];
    }

    const jobs = await prisma.hrmsJobOpening.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        hiringManager: { select: { id: true, name: true, email: true, avatar: true } },
        recruiter: { select: { id: true, name: true, email: true, avatar: true } },
        _count: {
          select: {
            applications: true,
            interviews: true,
            offers: true,
          },
        },
      },
    });

    return NextResponse.json(jobs);
  } catch (error: any) {
    console.error("Fetch jobs error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch jobs" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const {
      title,
      code,
      department,
      location,
      employmentType,
      openingsCount,
      experienceMin,
      experienceMax,
      salaryMin,
      salaryMax,
      currency,
      description,
      requirements,
      benefits,
      hiringManagerId,
      recruiterId,
      targetDate,
      status,
    } = body;

    if (!title || !department || !location) {
      return NextResponse.json(
        { error: "Title, department, and location are required" },
        { status: 400 }
      );
    }

    // Generate unique code if not provided
    const finalCode =
      code?.trim() ||
      `JOB-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;

    const job = await prisma.hrmsJobOpening.create({
      data: {
        title: title.trim(),
        code: finalCode,
        department: department.trim(),
        location: location.trim(),
        employmentType: employmentType || "FULL_TIME",
        status: status || "ACTIVE",
        openingsCount: openingsCount ? Number(openingsCount) : 1,
        experienceMin: experienceMin ? Number(experienceMin) : 0,
        experienceMax: experienceMax ? Number(experienceMax) : null,
        salaryMin: salaryMin ? Number(salaryMin) : null,
        salaryMax: salaryMax ? Number(salaryMax) : null,
        currency: currency || "INR",
        description,
        requirements,
        benefits,
        hiringManagerId: hiringManagerId ? Number(hiringManagerId) : null,
        recruiterId: recruiterId ? Number(recruiterId) : null,
        targetDate: targetDate ? new Date(targetDate) : null,
      },
    });

    return NextResponse.json(job, { status: 201 });
  } catch (error: any) {
    console.error("Create job error:", error);
    return NextResponse.json({ error: error.message || "Failed to create job" }, { status: 500 });
  }
}
