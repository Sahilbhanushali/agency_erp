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
    const loan = await PayrollService.getLoanAdvanceById(id);

    const userRole = (session.user as any).role || "";
    const isPrivileged =
      ["ADMIN", "HR", "FINANCE"].includes(userRole) ||
      (await hasPermission(session, "View-payroll")) ||
      (await hasPermission(session, "Manage-loans"));

    const currentUserId = Number(session.user.id);
    if (!isPrivileged && loan.userId !== currentUserId) {
      return NextResponse.json({ error: "Forbidden: You can only view your own loan" }, { status: 403 });
    }

    return NextResponse.json(loan);
  } catch (error: any) {
    console.error("GET /api/payroll/loans/[id] error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch loan" }, { status: 500 });
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
    const canManage =
      ["ADMIN", "HR", "FINANCE"].includes(userRole) ||
      (await hasPermission(session, "Manage-loans"));

    if (!canManage) {
      return NextResponse.json(
        { error: "Forbidden: Only HR, Admin, or Finance can modify employee loans" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();

    if (body.action === "repayment") {
      const amountPaise = body.inMajorUnits
        ? Math.round(Number(body.amount) * 100)
        : Math.round(Number(body.amount));

      const updated = await PayrollService.recordManualLoanRepayment(id, amountPaise, body.notes);
      return NextResponse.json(updated);
    }

    if (body.status) {
      if (!["ACTIVE", "PAUSED", "COMPLETED"].includes(body.status)) {
        return NextResponse.json(
          { error: "Invalid status: Allowed statuses are ACTIVE, PAUSED, COMPLETED" },
          { status: 400 }
        );
      }
      const updated = await PayrollService.updateLoanStatus(id, body.status);
      return NextResponse.json(updated);
    }

    return NextResponse.json({ error: "No valid action or status specified" }, { status: 400 });
  } catch (error: any) {
    console.error("PATCH /api/payroll/loans/[id] error:", error);
    return NextResponse.json({ error: error.message || "Failed to update loan" }, { status: 500 });
  }
}
