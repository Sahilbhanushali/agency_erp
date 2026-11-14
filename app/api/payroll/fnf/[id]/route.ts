import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PayrollService } from "@/lib/payroll/payroll-service";
import { can, requireCan } from "@/lib/api-auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireCan("payroll", "read");
    if (!auth.ok) return auth.response;
    const session = auth.session;
    const { id } = await params;
    const settlement = await PayrollService.getFnFSettlementById(id);

    const isPrivileged =
      (await can(session, "payroll", "read")) ||
      (await can(session, "payroll", "update"));

    const currentUserId = Number(session.user.id);
    if (!isPrivileged && settlement.userId !== currentUserId) {
      return NextResponse.json(
        { error: "Forbidden: You can only view your own Full and Final Settlement" },
        { status: 403 }
      );
    }

    return NextResponse.json(settlement);
  } catch (error: any) {
    console.error("GET /api/payroll/fnf/[id] error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch settlement" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireCan("payroll", "update");
    if (!auth.ok) return auth.response;
    const session = auth.session;
    const canApprove =
      (await can(session, "payroll", "approve")) ||
      (await can(session, "payroll", "update"));

    if (!canApprove) {
      return NextResponse.json(
        { error: "Forbidden: Only HR, Admin, or Finance can approve Full and Final Settlements" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();

    if (body.action === "approve") {
      const currentUserId = Number(session.user.id);
      const approved = await PayrollService.approveFnFSettlement(id, currentUserId);
      return NextResponse.json(approved);
    }

    return NextResponse.json({ error: "Unknown action specified" }, { status: 400 });
  } catch (error: any) {
    console.error("PATCH /api/payroll/fnf/[id] error:", error);
    return NextResponse.json({ error: error.message || "Failed to update settlement" }, { status: 500 });
  }
}
