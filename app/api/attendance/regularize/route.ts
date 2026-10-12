import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AttendanceService } from "@/lib/payroll/attendance-service";
import { AttendanceStatus } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const userRole = (session.user as any).role || "";
    const isStaffOrAdmin = ["ADMIN", "MANAGER", "HR"].includes(userRole);
    const currentUserId = Number(session.user.id);

    const where: any = {};
    if (!isStaffOrAdmin) {
      where.userId = currentUserId;
    }

    if (status && status !== "ALL") {
      where.status = status;
    }

    const regularizations = await prisma.attendanceRegularization.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true, designation: true } },
        reviewedBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(regularizations);
  } catch (error: any) {
    console.error("GET /api/attendance/regularize error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch regularizations" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    if (!body.date || !body.reason) {
      return NextResponse.json({ error: "Date and reason are required" }, { status: 400 });
    }

    const currentUserId = Number(session.user.id);

    const reg = await AttendanceService.requestRegularization({
      userId: currentUserId,
      attendanceId: body.attendanceId,
      date: new Date(body.date),
      requestedCheckIn: body.requestedCheckIn ? new Date(body.requestedCheckIn) : undefined,
      requestedCheckOut: body.requestedCheckOut ? new Date(body.requestedCheckOut) : undefined,
      requestedStatus: body.requestedStatus as AttendanceStatus,
      reason: body.reason,
    });

    return NextResponse.json(reg);
  } catch (error: any) {
    console.error("POST /api/attendance/regularize error:", error);
    return NextResponse.json({ error: error.message || "Failed to submit regularization" }, { status: 500 });
  }
}
