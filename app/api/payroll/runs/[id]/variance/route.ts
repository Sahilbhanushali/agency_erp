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
    const auth = await requireCan("payroll", "read");
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const { id } = await params;
    const variance = await PayrollService.getRunVariance(id);
    return NextResponse.json(variance);
  } catch (error: any) {
    console.error("GET /api/payroll/runs/[id]/variance error:", error);
    return NextResponse.json({ error: error.message || "Failed to calculate variance" }, { status: 500 });
  }
}
