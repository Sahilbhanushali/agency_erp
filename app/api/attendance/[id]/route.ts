import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { AttendanceService } from "@/lib/payroll/attendance-service";
import { AttendanceStatus } from "@prisma/client";

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

    if (!body.reason) {
      return NextResponse.json({ error: "Correction reason is required for audit trail" }, { status: 400 });
    }

    const updated = await AttendanceService.correctAttendance({
      attendanceId: id,
      status: body.status as AttendanceStatus,
      checkIn: body.checkIn ? new Date(body.checkIn) : null,
      checkOut: body.checkOut ? new Date(body.checkOut) : null,
      reason: body.reason,
      actorUserId: Number(session.user.id),
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("PATCH /api/attendance/[id] error:", error);
    return NextResponse.json({ error: error.message || "Failed to update attendance" }, { status: 500 });
  }
}
