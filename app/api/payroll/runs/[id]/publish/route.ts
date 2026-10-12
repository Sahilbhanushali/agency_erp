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
    if (!["ADMIN", "MANAGER", "HR", "FINANCE"].includes(userRole)) {
      return NextResponse.json({ error: "Forbidden: HR/Admin/Finance required" }, { status: 403 });
    }

    const { id } = await params;
    const actorUserId = Number((session.user as any).id);

    const updatedRun = await PayrollService.publishRun(id, actorUserId);

    return NextResponse.json({
      success: true,
      message: "Payroll run marked as paid and payslips published to employees.",
      run: updatedRun,
    });
  } catch (error: any) {
    console.error("POST /api/payroll/runs/[id]/publish error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to publish payroll run" },
      { status: 500 }
    );
  }
}
