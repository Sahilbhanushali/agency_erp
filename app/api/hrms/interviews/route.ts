import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCan, requireSession } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireCan("hrms", "read");
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const candidateId = searchParams.get("candidateId");
    const jobOpeningId = searchParams.get("jobOpeningId");
    const status = searchParams.get("status");
    const interviewerId = searchParams.get("interviewerId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const where: any = {};
    if (candidateId) where.candidateId = candidateId;
    if (jobOpeningId && jobOpeningId !== "ALL") where.jobOpeningId = jobOpeningId;
    if (status && status !== "ALL") where.status = status;
    if (interviewerId && interviewerId !== "ALL") {
      where.interviewers = {
        some: { userId: Number(interviewerId) },
      };
    }
    if (startDate || endDate) {
      where.scheduledDate = {};
      if (startDate) where.scheduledDate.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.scheduledDate.lte = end;
      }
    }

    const interviews = await prisma.hrmsInterview.findMany({
      where,
      orderBy: { scheduledDate: "asc" },
      include: {
        candidate: {
          select: { id: true, name: true, email: true, phone: true, currentTitle: true },
        },
        jobOpening: {
          select: { id: true, title: true, department: true, code: true },
        },
        interviewers: {
          include: {
            user: { select: { id: true, name: true, email: true, avatar: true } },
          },
        },
        createdBy: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json(interviews);
  } catch (error: any) {
    console.error("Fetch interviews error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch interviews" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireCan("hrms", "create");
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const {
      candidateId,
      jobOpeningId,
      applicationId,
      title,
      roundNumber,
      type,
      scheduledDate,
      startTime,
      endTime,
      timeZone,
      meetingLink,
      location,
      instructions,
      interviewerIds, // number[]
    } = body;

    if (!candidateId || !jobOpeningId || !title || !scheduledDate || !startTime || !endTime) {
      return NextResponse.json(
        { error: "Candidate, job, title, date, start time, and end time are required" },
        { status: 400 }
      );
    }

    // Find or create application
    let app = null;
    if (applicationId) {
      app = await prisma.hrmsApplication.findUnique({ where: { id: applicationId } });
    }
    if (!app) {
      app = await prisma.hrmsApplication.findFirst({
        where: { candidateId, jobOpeningId },
      });
    }
    if (!app) {
      app = await prisma.hrmsApplication.create({
        data: {
          candidateId,
          jobOpeningId,
          stage: "Interview Scheduled",
          status: "IN_PROGRESS",
        },
      });
    } else if (app.stage === "Applied" || app.stage === "Resume Screening" || app.stage === "Shortlisted") {
      // Advance to Interview Scheduled
      await prisma.hrmsApplication.update({
        where: { id: app.id },
        data: {
          stage: "Interview Scheduled",
          stageUpdatedAt: new Date(),
        },
      });
    }

    const interview = await prisma.hrmsInterview.create({
      data: {
        applicationId: app.id,
        candidateId,
        jobOpeningId,
        title: title.trim(),
        roundNumber: roundNumber ? Number(roundNumber) : 1,
        type: type || "ONLINE",
        status: "SCHEDULED",
        scheduledDate: new Date(scheduledDate),
        startTime,
        endTime,
        timeZone: timeZone || "Asia/Kolkata",
        meetingLink,
        location,
        instructions,
        createdById: auth.userId,
        interviewers: {
          create: (interviewerIds || []).map((uid: number, idx: number) => ({
            userId: Number(uid),
            isLead: idx === 0,
          })),
        },
      },
      include: {
        candidate: true,
        jobOpening: true,
        interviewers: {
          include: {
            user: { select: { id: true, name: true, avatar: true } },
          },
        },
      },
    });

    // Record activity log
    await prisma.hrmsCandidateActivity.create({
      data: {
        candidateId,
        applicationId: app.id,
        action: "INTERVIEW_SCHEDULED",
        fromStage: app.stage,
        toStage: "Interview Scheduled",
        title: `Interview Scheduled: ${title}`,
        notes: `Round ${roundNumber || 1} (${type || "ONLINE"}) scheduled for ${new Date(scheduledDate).toLocaleDateString()} at ${startTime} - ${endTime}.`,
        performedById: auth.userId,
      },
    });

    return NextResponse.json(interview, { status: 201 });
  } catch (error: any) {
    console.error("Create interview error:", error);
    return NextResponse.json({ error: error.message || "Failed to schedule interview" }, { status: 500 });
  }
}
