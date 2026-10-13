import { type NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { transitionApplicationStage } from "@/lib/hrms/hrms-service";
import { HrmsStage, HRMS_STAGES } from "@/lib/hrms/types";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const body = await request.json();
    const { toStage, notes, rejectionReason, withdrawalReason } = body;

    if (!toStage || !HRMS_STAGES.includes(toStage as HrmsStage)) {
      return NextResponse.json(
        { error: `Invalid target stage: ${toStage}` },
        { status: 400 }
      );
    }

    const updatedApp = await transitionApplicationStage({
      applicationId: id,
      toStage: toStage as HrmsStage,
      performedById: auth.userId,
      notes,
      rejectionReason,
      withdrawalReason,
    });

    return NextResponse.json({
      success: true,
      application: updatedApp,
      message: `Candidate successfully moved to ${toStage}.`,
    });
  } catch (error: any) {
    console.error("Transition stage error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update application stage" },
      { status: 500 }
    );
  }
}
