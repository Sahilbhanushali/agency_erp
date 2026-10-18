import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { AttendanceService } from "@/lib/payroll/attendance-service";
import { requireCan } from "@/lib/api-auth";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireCan("attendance", "update");
    if (!auth.ok) return auth.response;
    const session = auth.session;

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
