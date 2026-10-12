import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PayrollService } from "@/lib/payroll/payroll-service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { userId: userIdStr } = await params;
    const targetUserId = Number(userIdStr);
    const currentUserId = Number(session.user.id);
    const userRole = (session.user as any).role || "";
    const isStaffOrAdmin = ["ADMIN", "MANAGER", "HR", "FINANCE"].includes(userRole);

    // Permission check: employees can only see their own salary structure
    if (!isStaffOrAdmin && currentUserId !== targetUserId) {
      return NextResponse.json({ error: "Forbidden: You can only view your own salary" }, { status: 403 });
    }

    const active = await PayrollService.getActiveSalaryStructure(targetUserId);
    const history = await prisma.salaryStructure.findMany({
      where: { userId: targetUserId },
      orderBy: { effectiveFrom: "desc" },
    });

    return NextResponse.json({ active, history });
  } catch (error: any) {
    console.error("GET /api/payroll/salary/[userId] error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch salary structure" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = (session.user as any).role || "";
    if (!["ADMIN", "HR", "FINANCE"].includes(userRole)) {
      return NextResponse.json({ error: "Forbidden: Only HR/Admin/Finance can edit salary" }, { status: 403 });
    }

    const { userId: userIdStr } = await params;
    const targetUserId = Number(userIdStr);
    const body = await request.json();

    const created = await PayrollService.upsertSalaryStructure({
      userId: targetUserId,
      basicSalary: Math.round(Number(body.basicSalary || 0)),
      hra: Math.round(Number(body.hra || 0)),
      specialAllowance: Math.round(Number(body.specialAllowance || 0)),
      otherAllowances: Math.round(Number(body.otherAllowances || 0)),
      fixedBonus: Math.round(Number(body.fixedBonus || 0)),
      variablePay: Math.round(Number(body.variablePay || 0)),
      pfDeduction: body.pfDeduction ?? true,
      esiDeduction: body.esiDeduction ?? false,
      professionalTax: body.professionalTax ?? true,
      tdsMonthly: Math.round(Number(body.tdsMonthly || 0)),
      effectiveFrom: body.effectiveFrom ? new Date(body.effectiveFrom) : new Date(),
      actorUserId: Number(session.user.id),
    });

    return NextResponse.json(created);
  } catch (error: any) {
    console.error("POST /api/payroll/salary/[userId] error:", error);
    return NextResponse.json({ error: error.message || "Failed to update salary structure" }, { status: 500 });
  }
}
