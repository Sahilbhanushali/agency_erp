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
    const job = await prisma.hrmsJobOpening.findUnique({
      where: { id },
      include: {
        hiringManager: { select: { id: true, name: true, email: true, avatar: true } },
        recruiter: { select: { id: true, name: true, email: true, avatar: true } },
        applications: {
          include: {
            candidate: true,
          },
        },
        interviews: true,
        offers: true,
      },
    });

    if (!job) {
      return NextResponse.json({ error: "Job opening not found" }, { status: 404 });
    }

    return NextResponse.json(job);
  } catch (error: any) {
    console.error("Get job error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch job" }, { status: 500 });
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

    const data: any = { ...body };
    if (data.salaryMin !== undefined) data.salaryMin = data.salaryMin ? Number(data.salaryMin) : null;
    if (data.salaryMax !== undefined) data.salaryMax = data.salaryMax ? Number(data.salaryMax) : null;
    if (data.openingsCount !== undefined) data.openingsCount = Number(data.openingsCount);
    if (data.experienceMin !== undefined) data.experienceMin = Number(data.experienceMin);
    if (data.experienceMax !== undefined) data.experienceMax = data.experienceMax ? Number(data.experienceMax) : null;
    if (data.hiringManagerId !== undefined) data.hiringManagerId = data.hiringManagerId ? Number(data.hiringManagerId) : null;
    if (data.recruiterId !== undefined) data.recruiterId = data.recruiterId ? Number(data.recruiterId) : null;
    if (data.targetDate !== undefined) data.targetDate = data.targetDate ? new Date(data.targetDate) : null;

    const updatedJob = await prisma.hrmsJobOpening.update({
      where: { id },
      data,
    });

    return NextResponse.json(updatedJob);
  } catch (error: any) {
    console.error("Update job error:", error);
    return NextResponse.json({ error: error.message || "Failed to update job" }, { status: 500 });
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
    // Archive rather than hard deleting if applications exist
    const appCount = await prisma.hrmsApplication.count({ where: { jobOpeningId: id } });
    if (appCount > 0) {
      await prisma.hrmsJobOpening.update({
        where: { id },
        data: { status: "ARCHIVED" },
      });
      return NextResponse.json({ success: true, archived: true, message: "Job archived." });
    }

    await prisma.hrmsJobOpening.delete({ where: { id } });
    return NextResponse.json({ success: true, deleted: true });
  } catch (error: any) {
    console.error("Delete job error:", error);
    return NextResponse.json({ error: error.message || "Failed to delete job" }, { status: 500 });
  }
}
