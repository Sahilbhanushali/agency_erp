import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCan, requireSession } from "@/lib/api-auth";
import { DEFAULT_ONBOARDING_CHECKLIST } from "@/lib/hrms/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireCan("hrms", "read");
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    const where: any = {};
    if (status && status !== "ALL") where.status = status;

    const records = await prisma.hrmsOnboarding.findMany({
      where,
      orderBy: { joiningDate: "asc" },
      include: {
        candidate: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            currentTitle: true,
            city: true,
            address: true,
          },
        },
        jobOpening: {
          select: { id: true, title: true, department: true },
        },
        offer: {
          select: {
            id: true,
            offerNumber: true,
            jobTitle: true,
            department: true,
            annualCtc: true,
            monthlyGross: true,
            status: true,
          },
        },
        assignedBuddy: {
          select: { id: true, name: true, email: true, avatar: true },
        },
        convertedUser: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });

    return NextResponse.json(records);
  } catch (error: any) {
    console.error("Fetch onboarding error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch onboarding" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireCan("hrms", "create");
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const { candidateId, offerId, jobOpeningId, joiningDate, assignedBuddyId, notes } = body;

    if (!candidateId || !joiningDate) {
      return NextResponse.json(
        { error: "Candidate ID and joining date are required" },
        { status: 400 }
      );
    }

    const onboarding = await prisma.hrmsOnboarding.create({
      data: {
        candidateId,
        offerId,
        jobOpeningId,
        joiningDate: new Date(joiningDate),
        assignedBuddyId: assignedBuddyId ? Number(assignedBuddyId) : null,
        status: "PENDING",
        checklistJson: JSON.stringify(DEFAULT_ONBOARDING_CHECKLIST),
        notes,
      },
      include: {
        candidate: true,
        jobOpening: true,
        offer: true,
      },
    });

    return NextResponse.json(onboarding, { status: 201 });
  } catch (error: any) {
    console.error("Create onboarding error:", error);
    return NextResponse.json({ error: error.message || "Failed to initiate onboarding" }, { status: 500 });
  }
}
