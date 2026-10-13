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
    // Only Admin can void payroll runs
    if (userRole !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden: Super-Admin required to void payroll runs" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    if (!body.reason || !body.reason.trim()) {
      return NextResponse.json({ error: "Cancellation reason is mandatory" }, { status: 400 });
    }

    const result = await PayrollService.voidRun({
      payrollRunId: id,
      reason: body.reason,
      actorUserId: Number(session.user.id),
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("POST /api/payroll/runs/[id]/void error:", error);
    return NextResponse.json({ error: error.message || "Failed to void run" }, { status: 500 });
  }
}
