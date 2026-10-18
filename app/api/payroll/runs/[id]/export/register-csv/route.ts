import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PayrollService } from "@/lib/payroll/payroll-service";
import { requireCan } from "@/lib/api-auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireCan("payroll", "export");
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const { id } = await params;
    const csvContent = await PayrollService.generatePayrollRegisterCsv(id);

    return new Response(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="statutory_register_${id}.csv"`,
      },
    });
  } catch (error: any) {
    console.error("GET /api/payroll/runs/[id]/export/register-csv error:", error);
    return NextResponse.json({ error: error.message || "Failed to generate CSV" }, { status: 500 });
  }
}
