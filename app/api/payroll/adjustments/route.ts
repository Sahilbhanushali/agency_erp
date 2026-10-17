import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month") ? Number(searchParams.get("month")) : undefined;
    const year = searchParams.get("year") ? Number(searchParams.get("year")) : undefined;
    const userIdParam = searchParams.get("userId") ? Number(searchParams.get("userId")) : undefined;

    const userRole = (session.user as any).role || "";
    const isStaffOrAdmin = ["ADMIN", "MANAGER", "HR", "FINANCE"].includes(userRole);
    const currentUserId = Number(session.user.id);

    const where: any = {};
    if (!isStaffOrAdmin) {
      where.userId = currentUserId;
    } else if (userIdParam) {
      where.userId = userIdParam;
    }

    if (month) where.month = month;
    if (year) where.year = year;

    const adjustments = await prisma.salaryAdjustment.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true, designation: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(adjustments);
  } catch (error: any) {
    console.error("GET /api/payroll/adjustments error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch adjustments" }, { status: 500 });
  }
}

import { PayrollService } from "@/lib/payroll/payroll-service";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = (session.user as any).role || "";
    if (!["ADMIN", "HR", "FINANCE"].includes(userRole)) {
      return NextResponse.json({ error: "Forbidden: HR/Admin/Finance required" }, { status: 403 });
    }

    const body = await request.json();
    if (!body.userId || !body.month || !body.year || !body.type || !body.title || !body.amount) {
      return NextResponse.json({ error: "All required fields must be provided" }, { status: 400 });
    }

    const adjustment = await prisma.salaryAdjustment.create({
      data: {
        userId: Number(body.userId),
        month: Number(body.month),
        year: Number(body.year),
        type: body.type,
        title: body.title,
        amount: Math.round(Number(body.amount)), // minor units
        notes: body.notes,
        isApproved: true,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    let recalculated = null;
    if (body.payrollRunId) {
      try {
        recalculated = await PayrollService.recalculateEmployeePayslip({
          payrollRunId: body.payrollRunId,
          userId: Number(body.userId),
          actorUserId: Number(session.user.id),
        });
      } catch (err: any) {
        console.warn("Adjustment saved but single employee recalculate skipped:", err.message);
      }
    }

    return NextResponse.json({ ...adjustment, recalculated });
  } catch (error: any) {
    console.error("POST /api/payroll/adjustments error:", error);
    return NextResponse.json({ error: error.message || "Failed to create adjustment" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = (session.user as any).role || "";
    if (!["ADMIN", "HR", "FINANCE"].includes(userRole)) {
      return NextResponse.json({ error: "Forbidden: HR/Admin/Finance required" }, { status: 403 });
    }

    const body = await request.json();
    const { id, title, type, amount, month, year, notes, isApproved } = body;

    if (!id) {
      return NextResponse.json({ error: "Adjustment ID is required" }, { status: 400 });
    }

    const existing = await prisma.salaryAdjustment.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Adjustment not found" }, { status: 404 });
    }

    const data: any = {};
    if (title !== undefined) data.title = title.trim();
    if (type !== undefined) data.type = type;
    if (amount !== undefined) data.amount = Math.round(Number(amount));
    if (month !== undefined) data.month = Number(month);
    if (year !== undefined) data.year = Number(year);
    if (notes !== undefined) data.notes = notes ? notes.trim() : null;
    if (isApproved !== undefined) data.isApproved = Boolean(isApproved);

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
    console.error("PATCH /api/payroll/adjustments error:", error);
    return NextResponse.json({ error: error.message || "Failed to update adjustment" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = (session.user as any).role || "";
    if (!["ADMIN", "HR", "FINANCE"].includes(userRole)) {
      return NextResponse.json({ error: "Forbidden: HR/Admin/Finance required" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    let id = searchParams.get("id");
    if (!id) {
      try {
        const body = await request.json();
        id = body.id;
      } catch {
        // body might be empty
      }
    }
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

    const existing = await prisma.salaryAdjustment.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Adjustment not found" }, { status: 404 });
    }

    await prisma.salaryAdjustment.delete({ where: { id } });
    return NextResponse.json({ success: true, deleted: true });
  } catch (error: any) {
    console.error("DELETE /api/payroll/adjustments error:", error);
    return NextResponse.json({ error: error.message || "Failed to delete adjustment" }, { status: 500 });
  }
}
