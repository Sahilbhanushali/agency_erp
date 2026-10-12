import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { AttendanceService } from "@/lib/payroll/attendance-service";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = (session.user as any).role || "";
    if (!["ADMIN", "MANAGER", "HR"].includes(userRole)) {
      return NextResponse.json({ error: "Forbidden: HR or Admin access required" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const today = new Date();
    const startDate = body.startDate ? new Date(body.startDate) : new Date(today.getFullYear(), today.getMonth(), 1);
    const endDate = body.endDate ? new Date(body.endDate) : today;
    const providerType = body.providerType || "MOCK";

    const result = await AttendanceService.syncAttendanceRange(
      startDate,
      endDate,
      Number(session.user.id),
      providerType
    );

    return NextResponse.json({
      success: true,
      message: `Successfully synchronized ${result.syncedCount} attendance records from ${result.provider} (Batch ${result.batchId}).`,
      ...result,
    });
  } catch (error: any) {
    console.error("POST /api/attendance/sync error:", error);
    return NextResponse.json({ error: error.message || "Failed to sync attendance" }, { status: 500 });
  }
}
