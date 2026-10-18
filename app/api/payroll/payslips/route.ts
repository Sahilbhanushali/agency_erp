import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userIdParam = searchParams.get("userId");
    const monthParam = searchParams.get("month");
    const yearParam = searchParams.get("year");
    const runIdParam = searchParams.get("runId");

    const currentUserId = Number(session.user.id);
    // Permission-driven, not role-name driven: "HR" and "FINANCE" are not roles
    // in this install, so the old list silently denied anyone outside
    // ADMIN/MANAGER. Employees without payroll:read still see their own rows.
    const isStaffOrAdmin = await can(session, "payroll", "read");

    const where: any = {};

    // Strict privacy: regular employees can ONLY see their own published payslips
    if (!isStaffOrAdmin) {
      where.userId = currentUserId;
      where.isPublished = true;
    } else if (userIdParam) {
      where.userId = Number(userIdParam);
    }

    if (monthParam) where.month = Number(monthParam);
    if (yearParam) where.year = Number(yearParam);
    if (runIdParam) where.payrollRunId = runIdParam;

    const payslips = await prisma.payslip.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            designation: true,
            department: true,
            avatar: true,
            panNumber: true,
            bankName: true,
            bankAccountNumber: true,
            bankIfsc: true,
          },
        },
        payrollRun: {
          select: {
            id: true,
            status: true,
            month: true,
            year: true,
          },
        },
      },
      orderBy: [{ year: "desc" }, { month: "desc" }, { userId: "asc" }],
    });

    return NextResponse.json(payslips);
  } catch (error: any) {
    console.error("GET /api/payroll/payslips error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch payslips" }, { status: 500 });
  }
}
