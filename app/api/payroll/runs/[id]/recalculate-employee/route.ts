import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PayrollService } from "@/lib/payroll/payroll-service";
import { requireCan } from "@/lib/api-auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireCan("payroll", "update");
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const { id } = await params;
    const body = await request.json();
    if (!body.userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const result = await PayrollService.recalculateEmployeePayslip({
      payrollRunId: id,
      userId: Number(body.userId),
      actorUserId: Number(session.user.id),
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("POST /api/payroll/runs/[id]/recalculate-employee error:", error);
    return NextResponse.json({ error: error.message || "Failed to recalculate employee" }, { status: 500 });
  }
}
