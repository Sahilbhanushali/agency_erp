import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PayrollService } from "@/lib/payroll/payroll-service";
import { PayrollPdfGenerator, PayslipPdfData } from "@/lib/payroll/pdf-generator";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = (session.user as any).role || "";
    if (!["ADMIN", "MANAGER", "HR", "FINANCE"].includes(userRole)) {
      return NextResponse.json({ error: "Forbidden: HR/Admin/Finance required" }, { status: 403 });
    }

    const { id } = await params;
    const run = await prisma.payrollRun.findUnique({
      where: { id },
      include: {
        payslips: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                designation: true,
                department: true,
                panNumber: true,
                bankName: true,
                bankAccountNumber: true,
                bankIfsc: true,
                joiningDate: true,
              },
            },
          },
        },
      },
    });

    if (!run) {
      return NextResponse.json({ error: "Payroll run not found" }, { status: 404 });
    }

    const settings = await PayrollService.getSettings();

    const payslipsData: PayslipPdfData[] = run.payslips.map((p) => ({
      id: p.id,
      month: p.month,
      year: p.year,
      calendarDays: p.calendarDays,
      workingDays: p.workingDays,
      payableDays: p.payableDays,
      lopDays: p.lopDays,
      paidLeaveDays: p.paidLeaveDays,
      absentDays: p.absentDays,
      holidayDays: p.holidayDays,
      weeklyOffDays: p.weeklyOffDays,
      overtimeHours: p.overtimeHours,
      grossSalary: p.grossSalary,
      netSalary: p.netSalary,
      totalDeductions: p.totalDeductions,
      employerCost: p.employerCost,
      paymentStatus: p.paymentStatus,
      breakdownJson: p.breakdownJson,
      agencyName: settings.companyName,
      user: p.user,
    }));

    const periodLabel = `${run.month}_${run.year}`;
    const zipBuffer = await PayrollPdfGenerator.generatePayslipsZip(payslipsData, periodLabel);

    const filename = `Payslips_Batch_${periodLabel}.zip`;

    return new Response(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
      },
    });
  } catch (error: any) {
    console.error("GET /api/payroll/runs/[id]/export/payslips-zip error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate payslips ZIP" },
      { status: 500 }
    );
  }
}
