import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PayrollService } from "@/lib/payroll/payroll-service";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = Number((session.user as any).id);
    if (!userId || isNaN(userId)) {
      return NextResponse.json({ error: "Invalid session user ID" }, { status: 400 });
    }

    const data = await PayrollService.getSelfServiceData(userId);

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("GET /api/payroll/self-service error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to load employee self-service data" },
      { status: 500 }
    );
  }
}
