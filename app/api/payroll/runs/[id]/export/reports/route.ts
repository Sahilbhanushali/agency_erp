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
    const { searchParams } = new URL(request.url);
    const type = (searchParams.get("type") || "pf-ecr") as
      | "pf-ecr"
      | "esi-return"
      | "pt-summary"
      | "tds-24q"
      | "ctc-dept";

    const { filename, content } = await PayrollService.generateStatutoryReport(id, type);

    return new Response(content, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-cache",
      },
    });
  } catch (error: any) {
    console.error("GET /api/payroll/runs/[id]/export/reports error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate statutory report" },
      { status: 500 }
    );
  }
}
