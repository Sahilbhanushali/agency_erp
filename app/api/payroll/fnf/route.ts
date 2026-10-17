import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PayrollService } from "@/lib/payroll/payroll-service";
import { hasPermission } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userIdParam = searchParams.get("userId") ? Number(searchParams.get("userId")) : undefined;
    const statusParam = searchParams.get("status") || undefined;

    const userRole = (session.user as any).role || "";
    const isPrivileged =
      ["ADMIN", "HR", "FINANCE"].includes(userRole) ||
      (await hasPermission(session, "View-payroll")) ||
      (await hasPermission(session, "Manage-fnf"));

    const currentUserId = Number(session.user.id);
    let queryUserId: number | undefined;

    if (!isPrivileged) {
      queryUserId = currentUserId;
    } else if (userIdParam) {
      queryUserId = userIdParam;
    }

    const settlements = await PayrollService.getFnFSettlements({
      userId: queryUserId,
      status: statusParam,
    });

    return NextResponse.json(settlements);
  } catch (error: any) {
    console.error("GET /api/payroll/fnf error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch settlements" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = (session.user as any).role || "";
    const canManageFnF =
      ["ADMIN", "HR", "FINANCE"].includes(userRole) ||
      (await hasPermission(session, "Manage-fnf"));

    if (!canManageFnF) {
      return NextResponse.json(
        { error: "Forbidden: Only HR, Admin, or Finance can process Full & Final Settlements" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      userId,
      resignationDate,
      lastWorkingDate,
      noticePeriodDays,
      servedNoticeDays,
      otherDeductions,
      notes,
      action,
      inMajorUnits,
    } = body;

    if (!userId || !resignationDate || !lastWorkingDate) {
      return NextResponse.json(
        { error: "Missing required fields: userId, resignationDate, and lastWorkingDate are mandatory" },
        { status: 400 }
      );
    }

    const deductionsPaise = otherDeductions
      ? inMajorUnits
        ? Math.round(Number(otherDeductions) * 100)
        : Math.round(Number(otherDeductions))
      : 0;

    const input = {
      userId: Number(userId),
      resignationDate: new Date(resignationDate),
      lastWorkingDate: new Date(lastWorkingDate),
      noticePeriodDays: noticePeriodDays !== undefined ? Number(noticePeriodDays) : 30,
      servedNoticeDays: servedNoticeDays !== undefined ? Number(servedNoticeDays) : 30,
      otherDeductions: deductionsPaise,
      notes,
    };

    if (action === "preview" || body.preview === true) {
      const breakdown = await PayrollService.calculateFnF(input);
      return NextResponse.json(breakdown);
    }

    const saved = await PayrollService.saveFnFSettlement(input);
    return NextResponse.json(saved, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/payroll/fnf error:", error);
    return NextResponse.json({ error: error.message || "Failed to process FnF settlement" }, { status: 500 });
  }
}
