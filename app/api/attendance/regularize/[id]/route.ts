import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AttendanceService } from "@/lib/payroll/attendance-service";
import { requireCan } from "@/lib/api-auth";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireCan("attendance", "approve");
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const { id } = await params;
    const body = await request.json();
    const currentUserId = Number(session.user.id);

    const reg = await prisma.attendanceRegularization.findUnique({
      where: { id },
    });
    if (!reg) {
      return NextResponse.json({ error: "Regularization request not found" }, { status: 404 });
    }

    if (reg.userId === currentUserId) {
      return NextResponse.json(
        { error: "Forbidden: Self-approval is not permitted. Regularization must be reviewed by another manager or HR" },
        { status: 403 }
      );
    }

    if (!["APPROVED", "REJECTED"].includes(body.status)) {
      return NextResponse.json({ error: "Status must be APPROVED or REJECTED" }, { status: 400 });
    }

    const updated = await AttendanceService.reviewRegularization({
      regularizationId: id,
      status: body.status,
      remarks: body.remarks,
      reviewerId: currentUserId,
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("PATCH /api/attendance/regularize/[id] error:", error);
    return NextResponse.json({ error: error.message || "Failed to review regularization" }, { status: 500 });
  }
}
