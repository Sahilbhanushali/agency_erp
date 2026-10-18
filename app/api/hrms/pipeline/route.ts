import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCan, requireSession } from "@/lib/api-auth";
import { HRMS_STAGES } from "@/lib/hrms/types";
import { seedHrmsInitialData } from "@/lib/hrms/seed-data";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireCan("hrms", "read");
  if (!auth.ok) return auth.response;

  try {
    const candidateCount = await prisma.hrmsCandidate.count();
    if (candidateCount === 0) {
      await seedHrmsInitialData();
    }

    const { searchParams } = new URL(request.url);
    const jobOpeningId = searchParams.get("jobOpeningId");
    const department = searchParams.get("department");
    const search = searchParams.get("search")?.toLowerCase().trim();

    const where: any = {};
    if (jobOpeningId && jobOpeningId !== "ALL") where.jobOpeningId = jobOpeningId;
    if (department && department !== "ALL") {
      where.jobOpening = { department };
    }
    if (search) {
      where.candidate = {
        OR: [
          { name: { contains: search } },
          { email: { contains: search } },
          { currentCompany: { contains: search } },
          { tags: { contains: search } },
        ],
      };
    }

    const applications = await prisma.hrmsApplication.findMany({
      where,
      orderBy: { stageUpdatedAt: "desc" },
      include: {
        candidate: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            currentCompany: true,
            currentTitle: true,
            experienceYears: true,
            currentSalary: true,
            expectedSalary: true,
            noticePeriodDays: true,
            resumeUrl: true,
            rating: true,
            tags: true,
            city: true,
            source: true,
          },
        },
        jobOpening: {
          select: {
            id: true,
            title: true,
            code: true,
            department: true,
          },
        },
        interviews: {
          where: { status: "SCHEDULED" },
          orderBy: { scheduledDate: "asc" },
          take: 1,
          select: {
            id: true,
            title: true,
            scheduledDate: true,
            startTime: true,
            type: true,
          },
        },
        offers: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            offerNumber: true,
            status: true,
            annualCtc: true,
          },
        },
      },
    });

    // Group by stages preserving all 15 stages in order
    const columns: Record<string, typeof applications> = {};
    for (const stage of HRMS_STAGES) {
      columns[stage] = [];
    }

    for (const app of applications) {
      if (columns[app.stage]) {
        columns[app.stage].push(app);
      } else {
        // Fallback for unknown stage
        columns["Applied"].push(app);
      }
    }

    return NextResponse.json({
      stages: HRMS_STAGES,
      columns,
      totalApplications: applications.length,
    });
  } catch (error: any) {
    console.error("Pipeline fetch error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch pipeline" }, { status: 500 });
  }
}
