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
    const interview = await prisma.hrmsInterview.findUnique({
      where: { id },
      include: {
        candidate: true,
        jobOpening: true,
        interviewers: {
          include: {
            user: { select: { id: true, name: true, email: true, avatar: true } },
          },
        },
        createdBy: { select: { id: true, name: true } },
      },
    });

    if (!interview) {
      return NextResponse.json({ error: "Interview not found" }, { status: 404 });
    }

    return NextResponse.json(interview);
  } catch (error: any) {
    console.error("Get interview error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch interview" }, { status: 500 });
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

    const existing = await prisma.hrmsInterview.findUnique({
      where: { id },
      include: { candidate: true, application: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Interview not found" }, { status: 404 });
    }

    const {
      status,
      scheduledDate,
      startTime,
      endTime,
      meetingLink,
      location,
      instructions,
      feedback,
      rating,
      recommendation,
      cancellationReason,
      interviewerFeedback, // { interviewerUserId, feedback, rating }
    } = body;

    const data: any = {};
    if (status) data.status = status;
    if (scheduledDate) data.scheduledDate = new Date(scheduledDate);
    if (startTime) data.startTime = startTime;
    if (endTime) data.endTime = endTime;
    if (meetingLink !== undefined) data.meetingLink = meetingLink;
    if (location !== undefined) data.location = location;
    if (instructions !== undefined) data.instructions = instructions;
    if (feedback !== undefined) data.feedback = feedback;
    if (rating !== undefined) data.rating = rating ? Number(rating) : null;
    if (recommendation !== undefined) data.recommendation = recommendation;
    if (cancellationReason !== undefined) data.cancellationReason = cancellationReason;

    const updated = await prisma.hrmsInterview.update({
      where: { id },
      data,
    });

    // Update specific interviewer feedback if provided
    if (interviewerFeedback) {
      await prisma.hrmsInterviewInterviewer.updateMany({
        where: {
          interviewId: id,
          userId: Number(interviewerFeedback.interviewerUserId),
        },
        data: {
          feedback: interviewerFeedback.feedback,
          rating: interviewerFeedback.rating ? Number(interviewerFeedback.rating) : null,
        },
      });
    }

    // Log activity on status changes or feedback
    if (status === "COMPLETED" && existing.status !== "COMPLETED") {
      await prisma.hrmsCandidateActivity.create({
        data: {
          candidateId: existing.candidateId,
          applicationId: existing.applicationId,
          action: "INTERVIEW_COMPLETED",
          title: `Interview Completed: ${existing.title}`,
          notes: `Recommendation: ${recommendation || "N/A"}. Rating: ${rating || "N/A"}/5. Feedback: ${feedback || "None"}.`,
          performedById: auth.userId,
        },
      });

      // Update candidate rating if provided
      if (rating) {
        await prisma.hrmsCandidate.update({
          where: { id: existing.candidateId },
          data: { rating: Number(rating) },
        });
      }
    } else if (status === "CANCELLED" && existing.status !== "CANCELLED") {
      await prisma.hrmsCandidateActivity.create({
        data: {
          candidateId: existing.candidateId,
          applicationId: existing.applicationId,
          action: "INTERVIEW_CANCELLED",
          title: `Interview Cancelled: ${existing.title}`,
          notes: cancellationReason || "Interview cancelled.",
          performedById: auth.userId,
        },
      });
    }

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("Update interview error:", error);
    return NextResponse.json({ error: error.message || "Failed to update interview" }, { status: 500 });
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
    await prisma.hrmsInterview.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Delete interview error:", error);
    return NextResponse.json({ error: error.message || "Failed to delete interview" }, { status: 500 });
  }
}
