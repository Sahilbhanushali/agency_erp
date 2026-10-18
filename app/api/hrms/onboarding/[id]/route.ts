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
    const record = await prisma.hrmsOnboarding.findUnique({
      where: { id },
      include: {
        candidate: true,
        jobOpening: true,
        offer: true,
        assignedBuddy: { select: { id: true, name: true, email: true, avatar: true } },
        convertedUser: { select: { id: true, name: true, email: true } },
      },
    });

    if (!record) {
      return NextResponse.json({ error: "Onboarding record not found" }, { status: 404 });
    }

    return NextResponse.json(record);
  } catch (error: any) {
    console.error("Get onboarding error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch onboarding" }, { status: 500 });
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
    const { status, checklistJson, assignedBuddyId, notes, joiningDate } = body;

    const data: any = {};
    if (status) data.status = status;
    if (checklistJson) data.checklistJson = checklistJson;
    if (assignedBuddyId !== undefined)
      data.assignedBuddyId = assignedBuddyId ? Number(assignedBuddyId) : null;
    if (notes !== undefined) data.notes = notes;
    if (joiningDate) data.joiningDate = new Date(joiningDate);

    const updated = await prisma.hrmsOnboarding.update({
      where: { id },
      data,
      include: {
        candidate: true,
        assignedBuddy: { select: { id: true, name: true } },
        convertedUser: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("Update onboarding error:", error);
    return NextResponse.json({ error: error.message || "Failed to update onboarding" }, { status: 500 });
  }
}
