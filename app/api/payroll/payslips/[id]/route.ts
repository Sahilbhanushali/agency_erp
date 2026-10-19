import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PayrollService, maskPan, maskBankAccount } from "@/lib/payroll/payroll-service";
import { can, hasPermission, requireCan } from "@/lib/api-auth";
import { logAuditAction } from "@/lib/audit";
import { z } from "zod";

/** One line on a payslip. Amounts are minor units (paise), like the rest of payroll. */
const PayslipLineEdit = z.object({
  code: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(120),
  type: z.enum(["EARNING", "DEDUCTION", "EMPLOYER_CONTRIBUTION", "REIMBURSEMENT"]),
  earnedAmount: z.number().int().min(0),
  rate: z.number().int().min(0).optional(),
  calculationNote: z.string().trim().max(500).nullable().optional(),
  order: z.number().int().min(0).optional(),
});

const PayslipEdit = z.object({
  action: z.literal("UPDATE"),
  employeeName: z.string().trim().max(120).nullable().optional(),
  designation: z.string().trim().max(120).nullable().optional(),
  department: z.string().trim().max(120).nullable().optional(),
  bankName: z.string().trim().max(120).nullable().optional(),
  bankIfsc: z.string().trim().max(40).nullable().optional(),
  calendarDays: z.number().int().min(1).max(31).optional(),
  workingDays: z.number().int().min(0).max(31).optional(),
  payableDays: z.number().min(0).max(31).optional(),
  lopDays: z.number().min(0).max(31).optional(),
  paidLeaveDays: z.number().min(0).max(31).optional(),
  absentDays: z.number().min(0).max(31).optional(),
  paymentStatus: z.enum(["PENDING", "PAID"]).optional(),
  paymentRef: z.string().trim().max(120).nullable().optional(),
  /** Replaces every line when present; omit to leave the breakdown alone. */
  lines: z.array(PayslipLineEdit).max(60).optional(),
  reason: z.string().trim().max(500).optional(),
  /** Permits editing a payslip already marked paid. */
  force: z.boolean().optional(),
});

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
    const isPrivileged = (await can(session, "payroll", "read"));

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
    if (!isPrivileged && payslip.userId !== currentUserId) {
      return NextResponse.json({ error: "Forbidden: You cannot view another employee's payslip" }, { status: 403 });
    }

    let calculationBreakdown = null;
    try {
      calculationBreakdown = JSON.parse(payslip.breakdownJson);
    } catch {}

    const settings = await PayrollService.getSettings();

    // Sanitized user representation with masked sensitive identifiers
    const sanitizedUser = {
      ...payslip.user,
      panNumber: payslip.panNumberMasked || maskPan(payslip.user.panNumber),
      bankAccountNumber: payslip.bankAccountMasked || maskBankAccount(payslip.user.bankAccountNumber),
    };

    return NextResponse.json({
      ...payslip,
      user: sanitizedUser,
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
    const auth = await requireCan("payroll", "update");
    if (!auth.ok) return auth.response;
    const session = auth.session;

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

    /**
     * Full edit of a payslip.
     *
     * A calculated payslip is a starting point, not gospel: a missed allowance, a wrong
     * LOP count or a one-off deduction all need correcting without re-running payroll
     * for everyone. Previously the only supported actions were HOLD and RELEASE, so a
     * wrong figure could be hidden but never fixed.
     *
     * Totals are always recomputed from the lines rather than taken from the caller —
     * a payslip whose net pay disagrees with its own breakdown is worse than a wrong
     * one, because it cannot be checked.
     */
    if (body.action === "UPDATE") {
      const parsed = PayslipEdit.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.issues[0]?.message ?? "Invalid input" },
          { status: 422 }
        );
      }
      const edit = parsed.data;

      const existing = await prisma.payslip.findUnique({
        where: { id },
        select: { id: true, paymentStatus: true, status: true, netSalary: true },
      });
      if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

      // A paid payslip has already moved money. Editing it would make the record
      // disagree with the bank, so it has to be reversed first.
      if (existing.paymentStatus === "PAID" && !edit.force) {
        return NextResponse.json(
          {
            error:
              "This payslip is already marked paid. Editing it would no longer match what was paid — reverse the payment first.",
          },
          { status: 409 }
        );
      }

      const updated = await prisma.$transaction(async (tx) => {
        let totals: { earnings: number; deductions: number; employer: number } | null = null;

        if (edit.lines) {
          await tx.payslipLine.deleteMany({ where: { payslipId: id } });
          if (edit.lines.length > 0) {
            await tx.payslipLine.createMany({
              data: edit.lines.map((line, index) => ({
                payslipId: id,
                code: line.code,
                name: line.name,
                type: line.type,
                rate: line.rate ?? line.earnedAmount,
                earnedAmount: line.earnedAmount,
                calculationNote: line.calculationNote ?? null,
                order: line.order ?? index,
              })),
            });
          }

          const sum = (type: string) =>
            edit.lines!
              .filter((l) => l.type === type)
              .reduce((total, l) => total + l.earnedAmount, 0);

          totals = {
            earnings: sum("EARNING") + sum("REIMBURSEMENT"),
            deductions: sum("DEDUCTION"),
            employer: sum("EMPLOYER_CONTRIBUTION"),
          };
        }

        return tx.payslip.update({
          where: { id },
          data: {
            ...(edit.employeeName !== undefined ? { employeeName: edit.employeeName } : {}),
            ...(edit.designation !== undefined ? { designation: edit.designation } : {}),
            ...(edit.department !== undefined ? { department: edit.department } : {}),
            ...(edit.bankName !== undefined ? { bankName: edit.bankName } : {}),
            ...(edit.bankIfsc !== undefined ? { bankIfsc: edit.bankIfsc } : {}),
            ...(edit.calendarDays !== undefined ? { calendarDays: edit.calendarDays } : {}),
            ...(edit.workingDays !== undefined ? { workingDays: edit.workingDays } : {}),
            ...(edit.payableDays !== undefined ? { payableDays: edit.payableDays } : {}),
            ...(edit.lopDays !== undefined ? { lopDays: edit.lopDays } : {}),
            ...(edit.paidLeaveDays !== undefined ? { paidLeaveDays: edit.paidLeaveDays } : {}),
            ...(edit.absentDays !== undefined ? { absentDays: edit.absentDays } : {}),
            ...(edit.paymentStatus !== undefined ? { paymentStatus: edit.paymentStatus } : {}),
            ...(edit.paymentRef !== undefined ? { paymentRef: edit.paymentRef } : {}),
            ...(totals
              ? {
                  totalEarnings: totals.earnings,
                  grossSalary: totals.earnings,
                  totalDeductions: totals.deductions,
                  netSalary: totals.earnings - totals.deductions,
                  employerCost: totals.earnings + totals.employer,
                }
              : {}),
          },
          include: { lines: { orderBy: { order: "asc" } } },
        });
      });

      await logAuditAction({
        userId: String(actorUserId),
        action: "UPDATE",
        entityType: "Payslip",
        entityId: id,
        oldValues: JSON.stringify({ netSalary: existing.netSalary }),
        newValues: JSON.stringify({
          netSalary: updated.netSalary,
          lines: edit.lines?.length ?? "unchanged",
          reason: edit.reason ?? null,
        }),
        ipAddress: request.headers.get("x-forwarded-for") || "unknown",
        userAgent: request.headers.get("user-agent") || "unknown",
      });

      return NextResponse.json({ payslip: updated });
    }

    return NextResponse.json(
      { error: "Invalid action. Supported: HOLD, RELEASE, UPDATE" },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("PATCH /api/payroll/payslips/[id] error:", error);
    return NextResponse.json({ error: error.message || "Failed to update payslip" }, { status: 500 });
  }
}

/**
 * Delete one payslip.
 *
 * Deletes are real in this codebase, and `PayslipLine` cascades from the payslip, so
 * the breakdown goes with it. A paid payslip is refused: it is the record of money that
 * left the account, and removing it would leave the payroll run unaccountable.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireCan("payroll", "delete");
  if (!auth.ok) return auth.response;

  const { id } = await params;

  try {
    const payslip = await prisma.payslip.findUnique({
      where: { id },
      select: {
        id: true,
        month: true,
        year: true,
        netSalary: true,
        paymentStatus: true,
        user: { select: { id: true, name: true } },
      },
    });
    if (!payslip) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (payslip.paymentStatus === "PAID") {
      return NextResponse.json(
        {
          error:
            "This payslip is marked paid and cannot be deleted — it is the record of a payment that was made. Reverse the payment first.",
        },
        { status: 409 }
      );
    }

    await prisma.payslip.delete({ where: { id } });

    await logAuditAction({
      userId: String(auth.userId),
      action: "DELETE",
      entityType: "Payslip",
      entityId: id,
      oldValues: JSON.stringify({
        employee: payslip.user.name,
        period: `${payslip.month}/${payslip.year}`,
        netSalary: payslip.netSalary,
      }),
      ipAddress: request.headers.get("x-forwarded-for") || "unknown",
      userAgent: request.headers.get("user-agent") || "unknown",
    });

    return NextResponse.json({ deleted: true });
  } catch (error: any) {
    console.error("DELETE /api/payroll/payslips/[id] error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete payslip" },
      { status: 500 }
    );
  }
}
