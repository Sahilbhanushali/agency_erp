import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PayrollService } from "@/lib/payroll/payroll-service";
import { requireCan } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireCan("payroll", "read");
    if (!auth.ok) return auth.response;
    const session = auth.session;
    const { id } = await params;
    const adjustment = await prisma.salaryAdjustment.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true, designation: true, department: true } },
      },
    });

    if (!adjustment) {
      return NextResponse.json({ error: "Adjustment not found" }, { status: 404 });
    }

    return NextResponse.json(adjustment);
  } catch (error: any) {
    console.error("GET /api/payroll/adjustments/[id] error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch adjustment" }, { status: 500 });
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
    const existing = await prisma.salaryAdjustment.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Adjustment not found" }, { status: 404 });
    }

    const body = await request.json();
    const data: any = {};
    if (body.title !== undefined) data.title = body.title.trim();
    if (body.type !== undefined) data.type = body.type;
    if (body.amount !== undefined) data.amount = Math.round(Number(body.amount));
    if (body.month !== undefined) data.month = Number(body.month);
    if (body.year !== undefined) data.year = Number(body.year);
    if (body.notes !== undefined) data.notes = body.notes ? body.notes.trim() : null;
    if (body.isApproved !== undefined) data.isApproved = Boolean(body.isApproved);

    const updated = await prisma.salaryAdjustment.update({
      where: { id },
      data,
      include: {
        user: { select: { id: true, name: true, email: true, designation: true } },
      },
    });

    let recalculated = null;
    if (body.payrollRunId) {
      try {
        recalculated = await PayrollService.recalculateEmployeePayslip({
          payrollRunId: body.payrollRunId,
          userId: existing.userId,
          actorUserId: Number(session.user.id),
        });
      } catch (err: any) {
        console.warn("Adjustment updated but payslip recalculate skipped:", err.message);
      }
    }

    return NextResponse.json({ success: true, adjustment: updated, recalculated });
  } catch (error: any) {
    console.error("PATCH /api/payroll/adjustments/[id] error:", error);
    return NextResponse.json({ error: error.message || "Failed to update adjustment" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireCan("payroll", "delete");
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const { id } = await params;
    const existing = await prisma.salaryAdjustment.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Adjustment not found" }, { status: 404 });
    }

    await prisma.salaryAdjustment.delete({ where: { id } });
    return NextResponse.json({ success: true, deleted: true });
  } catch (error: any) {
    console.error("DELETE /api/payroll/adjustments/[id] error:", error);
    return NextResponse.json({ error: error.message || "Failed to delete adjustment" }, { status: 500 });
  }
}
