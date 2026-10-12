import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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
    if (!["ADMIN", "HR", "FINANCE"].includes(userRole)) {
      return NextResponse.json({ error: "Forbidden: HR/Admin/Finance required" }, { status: 403 });
    }

    const { id } = await params;
    const run = await prisma.payrollRun.findUnique({ where: { id } });
    if (!run) return NextResponse.json({ error: "Payroll run not found" }, { status: 404 });

    const updated = await PayrollService.createPayrollRun({
      month: run.month,
      year: run.year,
      notes: run.notes || undefined,
      actorUserId: Number(session.user.id),
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("POST /api/payroll/runs/[id]/recalculate error:", error);
    return NextResponse.json({ error: error.message || "Failed to recalculate run" }, { status: 500 });
  }
}
