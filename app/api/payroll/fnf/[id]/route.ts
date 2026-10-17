import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PayrollService } from "@/lib/payroll/payroll-service";
import { hasPermission } from "@/lib/api-auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const settlement = await PayrollService.getFnFSettlementById(id);

    const userRole = (session.user as any).role || "";
    const isPrivileged =
      ["ADMIN", "HR", "FINANCE"].includes(userRole) ||
      (await hasPermission(session, "View-payroll")) ||
      (await hasPermission(session, "Manage-fnf"));

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
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = (session.user as any).role || "";
    const canApprove =
      ["ADMIN", "HR", "FINANCE"].includes(userRole) ||
      (await hasPermission(session, "Approve-payroll")) ||
      (await hasPermission(session, "Manage-fnf"));

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
