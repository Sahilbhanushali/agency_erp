import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PayrollReadinessService } from "@/lib/payroll/readiness-check";
import { requireCan } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireCan("payroll", "read");
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const { searchParams } = new URL(request.url);
    const month = parseInt(searchParams.get("month") || String(new Date().getMonth() + 1), 10);
    const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()), 10);

    const report = await PayrollReadinessService.evaluateReadiness(month, year);

    return NextResponse.json(report);
  } catch (error: any) {
    console.error("GET /api/payroll/readiness error:", error);
    return NextResponse.json({ error: error.message || "Failed to check payroll readiness" }, { status: 500 });
  }
}
