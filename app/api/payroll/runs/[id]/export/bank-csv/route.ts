import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PayrollService } from "@/lib/payroll/payroll-service";
import { BankExportFormat } from "@/lib/payroll/bank-formats";
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
    const { searchParams } = new URL(request.url);
    const format = (searchParams.get("format") || "GENERIC").toUpperCase() as BankExportFormat;
    const debitAccount = searchParams.get("debitAccount") || undefined;

    const { filename, content } = await PayrollService.generateMultiBankFile(id, format, {
      debitAccountNumber: debitAccount,
    });

    return new Response(content, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-cache",
      },
    });
  } catch (error: any) {
    console.error("GET /api/payroll/runs/[id]/export/bank-csv error:", error);
    return NextResponse.json({ error: error.message || "Failed to generate bank file" }, { status: 500 });
  }
}
