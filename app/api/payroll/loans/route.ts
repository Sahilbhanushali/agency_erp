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
      (await hasPermission(session, "Manage-loans"));

    const currentUserId = Number(session.user.id);

    let queryUserId: number | undefined;
    if (!isPrivileged) {
      // Standard employee can only see their own loans
      queryUserId = currentUserId;
    } else if (userIdParam) {
      queryUserId = userIdParam;
    }

    const loans = await PayrollService.getLoanAdvances({
      userId: queryUserId,
      status: statusParam,
    });

    return NextResponse.json(loans);
  } catch (error: any) {
    console.error("GET /api/payroll/loans error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch loans" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = (session.user as any).role || "";
    const canCreate =
      ["ADMIN", "HR", "FINANCE"].includes(userRole) ||
      (await hasPermission(session, "Manage-loans"));

    if (!canCreate) {
      return NextResponse.json(
        { error: "Forbidden: Only HR, Admin, or Finance can create employee loans" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { userId, principalAmount, totalTenure, installmentEmi, reason, disbursedAt } = body;

    if (!userId || !principalAmount || !totalTenure) {
      return NextResponse.json(
        { error: "Missing required fields: userId, principalAmount, and totalTenure are mandatory" },
        { status: 400 }
      );
    }

    // principalAmount may be in rupees from UI, convert if needed or expect minor units (paise)
    // By convention in API: if isMajorUnit is specified or if value is a plain amount, handle appropriately.
    // Here we accept minor units (paise) directly or major units if explicitly flagged.
    const principalPaise = body.inMajorUnits
      ? Math.round(Number(principalAmount) * 100)
      : Math.round(Number(principalAmount));

    const emiPaise = installmentEmi
      ? body.inMajorUnits
        ? Math.round(Number(installmentEmi) * 100)
        : Math.round(Number(installmentEmi))
      : undefined;

    const loan = await PayrollService.createLoanAdvance({
      userId: Number(userId),
      principalAmount: principalPaise,
      totalTenure: Number(totalTenure),
      installmentEmi: emiPaise,
      reason: reason || "Salary Advance / Loan",
      disbursedAt: disbursedAt ? new Date(disbursedAt) : undefined,
    });

    return NextResponse.json(loan, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/payroll/loans error:", error);
    return NextResponse.json({ error: error.message || "Failed to create loan" }, { status: 500 });
  }
}
