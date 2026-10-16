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
    const activities = await prisma.hrmsCandidateActivity.findMany({
      where: { candidateId: id },
      orderBy: { createdAt: "desc" },
      include: {
        performedBy: { select: { id: true, name: true, email: true, avatar: true } },
        application: {
          select: {
            id: true,
            jobOpening: { select: { id: true, title: true, code: true } },
          },
        },
      },
    });

    const interviews = await prisma.hrmsInterview.findMany({
      where: { candidateId: id },
      orderBy: { scheduledDate: "desc" },
      include: {
        jobOpening: { select: { id: true, title: true } },
        interviewers: {
          include: {
            user: { select: { id: true, name: true, avatar: true } },
          },
        },
      },
    });

    const offers = await prisma.hrmsOffer.findMany({
      where: { candidateId: id },
      orderBy: { createdAt: "desc" },
      include: {
        jobOpening: { select: { id: true, title: true } },
        revisions: true,
      },
    });

    return NextResponse.json({
      activities,
      interviews,
      offers,
    });
  } catch (error: any) {
    console.error("Candidate timeline error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch candidate timeline" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const body = await request.json();
    const { title, notes, action = "NOTE_ADDED" } = body;

    if (!notes && !title) {
      return NextResponse.json({ error: "Title or note content is required" }, { status: 400 });
    }

    const activity = await prisma.hrmsCandidateActivity.create({
      data: {
        candidateId: id,
        action: action || "NOTE_ADDED",
        title: title || "Recruiter Activity Note",
        notes: notes || "",
        performedById: auth.userId,
      },
      include: {
        performedBy: { select: { id: true, name: true, email: true, avatar: true } },
      },
    });

    return NextResponse.json(activity, { status: 201 });
  } catch (error: any) {
    console.error("Add candidate activity error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to add activity note" },
      { status: 500 }
    );
  }
}

