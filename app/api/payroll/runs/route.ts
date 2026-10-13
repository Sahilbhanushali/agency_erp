import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PayrollService } from "@/lib/payroll/payroll-service";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = (session.user as any).role || "";
    if (!["ADMIN", "MANAGER", "HR", "FINANCE"].includes(userRole)) {
      return NextResponse.json({ error: "Forbidden: HR/Admin/Finance required" }, { status: 403 });
    }

    const runs = await prisma.payrollRun.findMany({
      include: {
        approvedBy: { select: { id: true, name: true, email: true } },
        _count: { select: { payslips: true } },
      },
      orderBy: [{ year: "desc" }, { month: "desc" }],
    });

    return NextResponse.json(runs);
  } catch (error: any) {
    console.error("GET /api/payroll/runs error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch runs" }, { status: 500 });
  }
}

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
    if (!body.month || !body.year) {
      return NextResponse.json({ error: "Month and year are required" }, { status: 400 });
    }

    const run = await PayrollService.createPayrollRun({
      month: Number(body.month),
      year: Number(body.year),
      runType: body.runType || "REGULAR",
      notes: body.notes,
      actorUserId: Number(session.user.id),
    });

    return NextResponse.json(run);
  } catch (error: any) {
    console.error("POST /api/payroll/runs error:", error);
    return NextResponse.json({ error: error.message || "Failed to create payroll run" }, { status: 400 });
  }
}
