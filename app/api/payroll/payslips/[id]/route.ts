import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PayrollService } from "@/lib/payroll/payroll-service";

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
    const currentUserId = Number(session.user.id);
    const userRole = (session.user as any).role || "";
    const isStaffOrAdmin = ["ADMIN", "MANAGER", "HR", "FINANCE"].includes(userRole);

    const payslip = await prisma.payslip.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            designation: true,
            department: true,
            avatar: true,
            joiningDate: true,
            panNumber: true,
            bankName: true,
            bankAccountNumber: true,
            bankIfsc: true,
          },
        },
        lines: { orderBy: { order: "asc" } },
        payrollRun: true,
      },
    });

    if (!payslip) {
      return NextResponse.json({ error: "Payslip not found" }, { status: 404 });
    }

    // Privacy guard: employees can only view their own payslip
    if (!isStaffOrAdmin && payslip.userId !== currentUserId) {
      return NextResponse.json({ error: "Forbidden: You cannot view another employee's payslip" }, { status: 403 });
    }

    let calculationBreakdown = null;
    try {
      calculationBreakdown = JSON.parse(payslip.breakdownJson);
    } catch {}

    const settings = await PayrollService.getSettings();

    return NextResponse.json({
      ...payslip,
      calculationBreakdown,
      agency: {
        companyName: settings.companyName,
        currency: settings.currency,
      },
    });
  } catch (error: any) {
    console.error("GET /api/payroll/payslips/[id] error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch payslip" }, { status: 500 });
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
    if (!["ADMIN", "HR", "FINANCE"].includes(userRole)) {
      return NextResponse.json({ error: "Forbidden: HR/Admin/Finance required" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const actorUserId = Number(session.user.id);

    if (body.action === "HOLD") {
      if (!body.reason || !body.reason.trim()) {
        return NextResponse.json({ error: "Hold reason is mandatory" }, { status: 400 });
      }
      const updated = await PayrollService.holdPayslip({
        payslipId: id,
        reason: body.reason,
        actorUserId,
      });
      return NextResponse.json(updated);
    }

    if (body.action === "RELEASE") {
      const updated = await PayrollService.releasePayslip({
        payslipId: id,
        actorUserId,
      });
      return NextResponse.json(updated);
    }

    return NextResponse.json({ error: "Invalid action. Supported: HOLD, RELEASE" }, { status: 400 });
  } catch (error: any) {
    console.error("PATCH /api/payroll/payslips/[id] error:", error);
    return NextResponse.json({ error: error.message || "Failed to update payslip" }, { status: 500 });
  }
}
