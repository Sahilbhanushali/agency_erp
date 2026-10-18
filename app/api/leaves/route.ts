import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LeaveService } from "@/lib/payroll/leave-service";
import { LeaveStatus } from "@prisma/client";
import { can } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userIdParam = searchParams.get("userId");
    const statusParam = searchParams.get("status");
    const yearParam = searchParams.get("year");

    const userRole = (session.user as any).role || "";
    // Permission-driven scoping. "HR" was never a role in this database, so the
    // old list silently limited this to ADMIN/MANAGER. Employees without
    // leaves:read still see their own rows, which is the point of the endpoint.
    const isStaffOrAdmin = await can(session, "leaves", "read");
    const currentUserId = Number(session.user.id);

    const where: any = {};
    if (!isStaffOrAdmin) {
      where.userId = currentUserId;
    } else if (userIdParam) {
      where.userId = Number(userIdParam);
    }

    if (statusParam && statusParam !== "ALL") {
      where.status = statusParam as LeaveStatus;
    }

    if (yearParam) {
      const year = Number(yearParam);
      const start = new Date(Date.UTC(year, 0, 1));
      const end = new Date(Date.UTC(year, 11, 31, 23, 59, 59));
      where.startDate = { gte: start, lte: end };
    }

    const leaves = await prisma.leaveRequest.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true, designation: true, avatar: true } },
        leaveType: true,
        approver: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(leaves);
  } catch (error: any) {
    console.error("GET /api/leaves error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch leaves" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const currentUserId = Number(session.user.id);
    const userRole = (session.user as any).role || "";
    // Permission-driven scoping. "HR" was never a role in this database, so the
    // old list silently limited this to ADMIN/MANAGER. Employees without
    // leaves:read still see their own rows, which is the point of the endpoint.
    const isStaffOrAdmin = await can(session, "leaves", "read");

    const targetUserId = isStaffOrAdmin && body.userId ? Number(body.userId) : currentUserId;

    if (!body.leaveTypeId || !body.startDate || !body.endDate || !body.reason) {
      return NextResponse.json(
        { error: "Leave type, start date, end date, and reason are required" },
        { status: 400 }
      );
    }

    const leave = await LeaveService.applyLeave({
      userId: targetUserId,
      leaveTypeId: body.leaveTypeId,
      startDate: new Date(body.startDate),
      endDate: new Date(body.endDate),
      isHalfDay: Boolean(body.isHalfDay),
      halfDaySession: body.halfDaySession,
      reason: body.reason,
      attachmentUrl: body.attachmentUrl,
    });

    return NextResponse.json(leave);
  } catch (error: any) {
    console.error("POST /api/leaves error:", error);
    return NextResponse.json({ error: error.message || "Failed to apply for leave" }, { status: 400 });
  }
}
