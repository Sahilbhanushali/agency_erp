import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PayrollService } from "@/lib/payroll/payroll-service";

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
    const format = (searchParams.get("format") || "standard") as "standard" | "tally" | "zoho";

    const { filename, content } = await PayrollService.generateAccountingExport(id, format);

    const contentType = format === "tally" ? "application/xml; charset=utf-8" : "text/csv; charset=utf-8";

    return new Response(content, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-cache",
      },
    });
  } catch (error: any) {
    console.error("GET /api/payroll/runs/[id]/export/journal-entry error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate accounting journal export" },
      { status: 500 }
    );
  }
}
