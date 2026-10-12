import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PayrollService } from "@/lib/payroll/payroll-service";
import { PayrollPdfGenerator } from "@/lib/payroll/pdf-generator";

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
    const currentUserId = Number((session.user as any).id);
    const userRole = (session.user as any).role || "";

    const payslipData = await PayrollService.getPayslipForPdf(id, currentUserId, userRole);
    const pdfBuffer = PayrollPdfGenerator.generatePayslipPdf(payslipData);

    const safeName = (payslipData.user.name || "Employee").replace(/[^a-zA-Z0-9_-]/g, "_");
    const filename = `Payslip_${safeName}_${payslipData.month}_${payslipData.year}.pdf`;

    return new Response(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
      },
    });
  } catch (error: any) {
    console.error("GET /api/payroll/payslips/[id]/pdf error:", error);
    const status = error.message?.includes("Access denied") ? 403 : 500;
    return NextResponse.json(
      { error: error.message || "Failed to generate payslip PDF" },
      { status }
    );
  }
}
