import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { LeaveService } from "@/lib/payroll/leave-service";
import { can } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userIdParam = searchParams.get("userId");
    const yearParam = searchParams.get("year");

    const currentUserId = Number(session.user.id);
    // Permission-driven scoping. "HR" was never a role in this database, so the
    // old list silently limited this to ADMIN/MANAGER. Employees without
    // leaves:read still see their own rows, which is the point of the endpoint.
    const isStaffOrAdmin = await can(session, "leaves", "read");

    const targetUserId = isStaffOrAdmin && userIdParam ? Number(userIdParam) : currentUserId;
    const year = yearParam ? Number(yearParam) : new Date().getFullYear();

    const balances = await LeaveService.getUserBalances(targetUserId, year);
    return NextResponse.json(balances);
  } catch (error: any) {
    console.error("GET /api/leaves/balances error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch balances" }, { status: 500 });
  }
}
