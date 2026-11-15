import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PayrollService } from "@/lib/payroll/payroll-service";
import { PayrollRunStatus } from "@prisma/client";
import { requireCan } from "@/lib/api-auth";
import { logAuditAction } from "@/lib/audit";
import { clientIp } from "@/lib/rate-limit"

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

    /**
     * Attach a payslip template to this run.
     *
     * Every payslip in the run then renders with it, downloaded or emailed, without
     * having to pick a template each time. Sent on its own — no status change — so
     * choosing a template never moves the run through its workflow by accident.
     */
    if (body.payslipTemplateId !== undefined) {
      const templateId: string | null = body.payslipTemplateId || null;

      if (templateId) {
        const exists = await prisma.payslipTemplate.findUnique({
          where: { id: templateId },
          select: { id: true },
        });
        if (!exists) {
          return NextResponse.json({ error: "That payslip template no longer exists" }, { status: 404 });
        }
      }

      const run = await prisma.payrollRun.update({
        where: { id },
        data: { payslipTemplateId: templateId },
        select: {
          id: true,
          payslipTemplateId: true,
          payslipTemplate: { select: { id: true, name: true } },
        },
      });

      await logAuditAction({
        userId: String(auth.userId),
        action: "UPDATE",
        entityType: "PayrollRun",
        entityId: id,
        newValues: JSON.stringify({ payslipTemplate: run.payslipTemplate?.name ?? null }),
        ipAddress: clientIp(request.headers) || "unknown",
        userAgent: request.headers.get("user-agent") || "unknown",
      });

      return NextResponse.json(run);
    }

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

/**
 * Deletes a payroll run that has not been paid.
 *
 * Paid and locked runs are permanent: by then loans were recovered against them and
 * employees hold the payslips. Anything earlier — a draft, a run calculated with the
 * wrong inputs, one approved by mistake — can go, and a new run recalculates it.
 * Payslips, their lines, payments and the run's own history cascade with it; the
 * payout expense that approval created is removed too, since the payout never happened.
 */
const DELETABLE: PayrollRunStatus[] = ["DRAFT", "CALCULATED", "UNDER_REVIEW", "APPROVED"];

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireCan("payroll", "delete");
  if (!auth.ok) return auth.response;
  const { id } = await params;

  try {
    const run = await prisma.payrollRun.findUnique({
      where: { id },
      select: { id: true, month: true, year: true, status: true, totalHeadcount: true, totalNetPay: true },
    });
    if (!run) return NextResponse.json({ error: "Payroll run not found" }, { status: 404 });
    if (!DELETABLE.includes(run.status)) {
      return NextResponse.json(
        { error: `A ${run.status.toLowerCase()} run cannot be deleted: it is the record of salaries actually paid.` },
        { status: 409 }
      );
    }

    const removed = await prisma.$transaction(async (tx) => {
      const expenses = await tx.expense.deleteMany({ where: { payrollRunId: id } });
      await tx.payrollRun.delete({ where: { id } });
      return { expenses: expenses.count };
    });

    await logAuditAction({
      userId: String(auth.userId),
      action: "PAYROLL_RUN_DELETED",
      entityType: "PayrollRun",
      entityId: id,
      oldValues: JSON.stringify({ ...run, linkedExpensesDeleted: removed.expenses }),
      ipAddress: clientIp(request.headers) || "unknown",
      userAgent: request.headers.get("user-agent") || "unknown",
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/payroll/runs/[id] error:", error);
    return NextResponse.json({ error: "Could not delete the payroll run" }, { status: 500 });
  }
}
