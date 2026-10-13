import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PayrollReadinessService } from "@/lib/payroll/readiness-check";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = (session.user as any).role || "";
    if (!["ADMIN", "HR", "FINANCE"].includes(userRole)) {
      return NextResponse.json({ error: "Forbidden: HR/Admin/Finance required" }, { status: 403 });
    }

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
