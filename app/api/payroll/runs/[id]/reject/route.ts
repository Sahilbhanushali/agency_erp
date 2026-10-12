import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PayrollService } from "@/lib/payroll/payroll-service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = (session.user as any).role || "";
    if (!["ADMIN", "HR", "FINANCE", "MANAGER"].includes(userRole)) {
      return NextResponse.json({ error: "Forbidden: Approver permissions required" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    if (!body.reason || !body.reason.trim()) {
      return NextResponse.json({ error: "Rejection reason is mandatory" }, { status: 400 });
    }

    const result = await PayrollService.rejectRun({
      payrollRunId: id,
      reason: body.reason,
      actorUserId: Number(session.user.id),
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("POST /api/payroll/runs/[id]/reject error:", error);
    return NextResponse.json({ error: error.message || "Failed to reject run" }, { status: 500 });
  }
}
