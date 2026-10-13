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
    const variance = await PayrollService.getRunVariance(id);
    return NextResponse.json(variance);
  } catch (error: any) {
    console.error("GET /api/payroll/runs/[id]/variance error:", error);
    return NextResponse.json({ error: error.message || "Failed to calculate variance" }, { status: 500 });
  }
}
