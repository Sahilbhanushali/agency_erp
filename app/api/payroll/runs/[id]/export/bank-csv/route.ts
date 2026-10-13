import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PayrollService } from "@/lib/payroll/payroll-service";
import { BankExportFormat } from "@/lib/payroll/bank-formats";

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
