import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { AttendanceService } from "@/lib/payroll/attendance-service";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = (session.user as any).role || "";
    if (!["ADMIN", "MANAGER", "HR"].includes(userRole)) {
      return NextResponse.json({ error: "Forbidden: HR or Admin access required" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();

    if (!["APPROVED", "REJECTED"].includes(body.status)) {
      return NextResponse.json({ error: "Status must be APPROVED or REJECTED" }, { status: 400 });
    }

    const updated = await AttendanceService.reviewRegularization({
      regularizationId: id,
      status: body.status,
      remarks: body.remarks,
      reviewerId: Number(session.user.id),
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("PATCH /api/attendance/regularize/[id] error:", error);
    return NextResponse.json({ error: error.message || "Failed to review regularization" }, { status: 500 });
  }
}
