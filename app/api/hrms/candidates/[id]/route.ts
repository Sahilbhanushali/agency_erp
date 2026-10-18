import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCan, requireSession } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireCan("hrms", "read");
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const candidate = await prisma.hrmsCandidate.findUnique({
      where: { id },
      include: {
        applications: {
          include: {
            jobOpening: true,
            interviews: {
              include: {
                interviewers: {
                  include: {
                    user: { select: { id: true, name: true, avatar: true } },
                  },
                },
              },
              orderBy: { scheduledDate: "desc" },
            },
            offers: {
              include: {
                template: { select: { name: true } },
                letterhead: { select: { name: true } },
              },
              orderBy: { createdAt: "desc" },
            },
          },
        },
        activities: {
          include: {
            performedBy: { select: { id: true, name: true, avatar: true } },
          },
          orderBy: { createdAt: "desc" },
        },
        onboardingRecords: true,
      },
    });

    if (!candidate) {
      return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
    }

    return NextResponse.json(candidate);
  } catch (error: any) {
    console.error("Get candidate error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch candidate" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireCan("hrms", "update");
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const body = await request.json();

    const data: any = { ...body };
    if (data.experienceYears !== undefined)
      data.experienceYears = data.experienceYears ? Number(data.experienceYears) : null;
    if (data.currentSalary !== undefined)
      data.currentSalary = data.currentSalary ? Number(data.currentSalary) : null;
    if (data.expectedSalary !== undefined)
      data.expectedSalary = data.expectedSalary ? Number(data.expectedSalary) : null;
    if (data.noticePeriodDays !== undefined)
      data.noticePeriodDays = data.noticePeriodDays ? Number(data.noticePeriodDays) : null;
    if (data.rating !== undefined) data.rating = Number(data.rating);

    const updated = await prisma.hrmsCandidate.update({
      where: { id },
      data,
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("Update candidate error:", error);
    return NextResponse.json({ error: error.message || "Failed to update candidate" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireCan("hrms", "delete");
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    await prisma.hrmsCandidate.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Delete candidate error:", error);
    return NextResponse.json({ error: error.message || "Failed to delete candidate" }, { status: 500 });
  }
}
