import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PayrollService } from "@/lib/payroll/payroll-service";
import { PayrollRunStatus } from "@prisma/client";
import { requireCan } from "@/lib/api-auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireCan("payroll", "read");
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const { id } = await params;
    const run = await prisma.payrollRun.findUnique({
      where: { id },
      include: {
        approvedBy: { select: { id: true, name: true, email: true } },
        payslips: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                designation: true,
                department: true,
                bankName: true,
                bankAccountNumber: true,
                bankIfsc: true,
                panNumber: true,
              },
            },
            lines: { orderBy: { order: "asc" } },
          },
          orderBy: { grossSalary: "desc" },
        },
        auditLogs: {
          include: { user: { select: { id: true, name: true, email: true } } },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!run) return NextResponse.json({ error: "Payroll run not found" }, { status: 404 });
    return NextResponse.json(run);
  } catch (error: any) {
    console.error("GET /api/payroll/runs/[id] error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch run" }, { status: 500 });
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

    const { id } = await params;
    const body = await request.json();

    const updated = await PayrollService.updateRunStatus({
      payrollRunId: id,
      newStatus: body.status as PayrollRunStatus,
      notes: body.notes,
      actorUserId: Number(session.user.id),
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("PATCH /api/payroll/runs/[id] error:", error);
    return NextResponse.json({ error: error.message || "Failed to update run status" }, { status: 500 });
  }
}
