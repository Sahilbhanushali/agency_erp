import { type NextRequest, NextResponse } from "next/server";
import { requireCan, requireSession } from "@/lib/api-auth";
import { getHrmsDashboardStats } from "@/lib/hrms/hrms-service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireCan("hrms", "read");
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const jobOpeningId = searchParams.get("jobOpeningId");
    const department = searchParams.get("department");
    const recruiterId = searchParams.get("recruiterId");
    const stage = searchParams.get("stage");

    const stats = await getHrmsDashboardStats({
      startDate,
      endDate,
      jobOpeningId,
      department,
      recruiterId,
      stage,
    });

    return NextResponse.json(stats);
  } catch (error: any) {
    console.error("HRMS stats error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch HRMS dashboard statistics" },
      { status: 500 }
    );
  }
}
