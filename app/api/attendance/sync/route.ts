import { NextRequest, NextResponse } from "next/server";
import { AttendanceService } from "@/lib/payroll/attendance-service";
import { AttendanceNotConfiguredError } from "@/lib/payroll/attendance-provider";
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
    const providerType = typeof body.providerType === "string" ? body.providerType : undefined;

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
  } catch (error) {
    if (error instanceof AttendanceNotConfiguredError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    console.error("POST /api/attendance/sync error:", error);
    return NextResponse.json({ error: "Attendance sync failed. Check the server log for the device API's response." }, { status: 502 });
  }
}
