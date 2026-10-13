import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get("date");
    const startTime = searchParams.get("startTime"); // e.g. "14:00"
    const endTime = searchParams.get("endTime"); // e.g. "15:00"
    const interviewerIdsStr = searchParams.get("interviewerIds"); // comma separated
    const excludeInterviewId = searchParams.get("excludeId");

    if (!dateStr || !startTime || !endTime || !interviewerIdsStr) {
      return NextResponse.json({ conflicts: [] });
    }

    const interviewerIds = interviewerIdsStr
      .split(",")
      .map((id) => Number(id.trim()))
      .filter((id) => Number.isFinite(id) && id > 0);

    if (interviewerIds.length === 0) {
      return NextResponse.json({ conflicts: [] });
    }

    const targetDate = new Date(dateStr);
    const dayStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0);
    const dayEnd = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59);

    // Find any interviews for these interviewers on the same day that overlap in time
    const potentialOverlaps = await prisma.hrmsInterview.findMany({
      where: {
        id: excludeInterviewId ? { not: excludeInterviewId } : undefined,
        status: { in: ["SCHEDULED", "RESCHEDULED"] },
        scheduledDate: {
          gte: dayStart,
          lte: dayEnd,
        },
        interviewers: {
          some: {
            userId: { in: interviewerIds },
          },
        },
      },
      include: {
        candidate: { select: { name: true } },
        jobOpening: { select: { title: true } },
        interviewers: {
          include: {
            user: { select: { id: true, name: true } },
          },
        },
      },
    });

    const conflicts: any[] = [];

    // Helper: convert "HH:mm" to minutes from midnight
    const toMinutes = (timeStr: string) => {
      const [h, m] = timeStr.split(":").map(Number);
      return (h || 0) * 60 + (m || 0);
    };

    const newStartMins = toMinutes(startTime);
    const newEndMins = toMinutes(endTime);

    for (const interview of potentialOverlaps) {
      const existStartMins = toMinutes(interview.startTime);
      const existEndMins = toMinutes(interview.endTime);

      // Overlap condition: max(start1, start2) < min(end1, end2)
      if (Math.max(newStartMins, existStartMins) < Math.min(newEndMins, existEndMins)) {
        // Conflicting interviewers
        const conflictingUsers = interview.interviewers
          .filter((i) => interviewerIds.includes(i.userId))
          .map((i) => i.user.name);

        conflicts.push({
          interviewId: interview.id,
          title: interview.title,
          candidateName: interview.candidate.name,
          jobTitle: interview.jobOpening.title,
          time: `${interview.startTime} - ${interview.endTime}`,
          conflictingInterviewers: conflictingUsers,
        });
      }
    }

    return NextResponse.json({
      hasConflict: conflicts.length > 0,
      conflicts,
    });
  } catch (error: any) {
    console.error("Conflict check error:", error);
    return NextResponse.json({ error: error.message || "Failed to check conflicts" }, { status: 500 });
  }
}
