import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasPermission, requireCan, requireSession } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireCan("hrms", "read");
  if (!auth.ok) return auth.response;

  const canAccess =
    (await hasPermission(auth.session, "View-hrms")) ||
    (await hasPermission(auth.session, "Manage-hrms"));
  if (!canAccess) {
    return NextResponse.json({ error: "Forbidden: HR or Manager access required" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.toLowerCase().trim();
    const source = searchParams.get("source");
    const jobOpeningId = searchParams.get("jobOpeningId");
    const stage = searchParams.get("stage");

    const where: any = {};
    if (source && source !== "ALL") where.source = source;
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
        { currentCompany: { contains: search } },
        { currentTitle: { contains: search } },
        { tags: { contains: search } },
      ];
    }
    if (jobOpeningId || stage) {
      where.applications = {
        some: {
          ...(jobOpeningId && jobOpeningId !== "ALL" ? { jobOpeningId } : {}),
          ...(stage && stage !== "ALL" ? { stage } : {}),
        },
      };
    }

    const candidates = await prisma.hrmsCandidate.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        applications: {
          include: {
            jobOpening: {
              select: { id: true, title: true, code: true, department: true },
            },
          },
        },
        interviews: {
          orderBy: { scheduledDate: "desc" },
          take: 3,
        },
        offers: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    return NextResponse.json(candidates);
  } catch (error: any) {
    console.error("Fetch candidates error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch candidates" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireCan("hrms", "create");
  if (!auth.ok) return auth.response;

  const canManage =
    (await hasPermission(auth.session, "Manage-hrms"));
  if (!canManage) {
    return NextResponse.json(
      { error: "Forbidden: HR, Manager, or Admin access required to create candidates" },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const {
      name,
      email,
      phone,
      currentCompany,
      currentTitle,
      experienceYears,
      currentSalary,
      expectedSalary,
      noticePeriodDays,
      resumeUrl,
      resumeFileName,
      portfolioUrl,
      linkedinUrl,
      source,
      address,
      city,
      state,
      country,
      notes,
      tags,
      rating,
      jobOpeningId,
      initialStage,
    } = body;

    if (!name || !email) {
      return NextResponse.json({ error: "Candidate name and email are required" }, { status: 400 });
    }

    // Check if candidate with this email exists
    let candidate = await prisma.hrmsCandidate.findFirst({
      where: { email: email.trim() },
    });

    if (!candidate) {
      candidate = await prisma.hrmsCandidate.create({
        data: {
          name: name.trim(),
          email: email.trim(),
          phone: phone?.trim(),
          currentCompany: currentCompany?.trim(),
          currentTitle: currentTitle?.trim(),
          experienceYears: experienceYears ? Number(experienceYears) : null,
          currentSalary: currentSalary ? Number(currentSalary) : null,
          expectedSalary: expectedSalary ? Number(expectedSalary) : null,
          noticePeriodDays: noticePeriodDays ? Number(noticePeriodDays) : null,
          resumeUrl,
          resumeFileName,
          portfolioUrl,
          linkedinUrl,
          source: source || "DIRECT",
          address,
          city,
          state,
          country: country || "India",
          notes,
          tags,
          rating: rating ? Number(rating) : 0,
        },
      });
    }

    // Link application if jobOpeningId is provided
    let application = null;
    if (jobOpeningId) {
      const stage = initialStage || "Applied";
      application = await prisma.hrmsApplication.upsert({
        where: {
          candidateId_jobOpeningId: {
            candidateId: candidate.id,
            jobOpeningId,
          },
        },
        update: {
          stage,
          notes: notes || undefined,
        },
        create: {
          candidateId: candidate.id,
          jobOpeningId,
          stage,
          status: "IN_PROGRESS",
          notes,
        },
      });

      // Log activity
      await prisma.hrmsCandidateActivity.create({
        data: {
          candidateId: candidate.id,
          applicationId: application.id,
          action: "APPLICATION_CREATED",
          toStage: stage,
          title: `Application Submitted`,
          notes: `Candidate applied for job opening.`,
          performedById: auth.userId,
        },
      });
    }

    return NextResponse.json({ candidate, application }, { status: 201 });
  } catch (error: any) {
    console.error("Create candidate error:", error);
    return NextResponse.json({ error: error.message || "Failed to create candidate" }, { status: 500 });
  }
}
