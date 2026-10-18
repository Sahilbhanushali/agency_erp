import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AttendanceStatus, AttendanceSource } from "@prisma/client";
import { can } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userIdParam = searchParams.get("userId");
    const dateParam = searchParams.get("date"); // YYYY-MM-DD
    const monthParam = searchParams.get("month"); // 1-12
    const yearParam = searchParams.get("year");
    const statusParam = searchParams.get("status");

    // Permission-driven scoping. "HR" was never a role in this database, so the
    // old list silently limited this to ADMIN/MANAGER. Employees without
    // attendance:read still see their own rows, which is the point of the endpoint.
    const isStaffOrAdmin = await can(session, "attendance", "read");
    const currentUserId = Number(session.user.id);

    const where: any = {};

    // Non-admins can only see their own attendance
    if (!isStaffOrAdmin) {
      where.userId = currentUserId;
    } else if (userIdParam) {
      where.userId = Number(userIdParam);
    }

    if (dateParam) {
      const targetDate = new Date(`${dateParam}T00:00:00.000Z`);
      where.date = targetDate;
    } else if (monthParam && yearParam) {
      const month = Number(monthParam);
      const year = Number(yearParam);
      const startDate = new Date(Date.UTC(year, month - 1, 1));
      const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59));
      where.date = { gte: startDate, lte: endDate };
    }

    if (statusParam && statusParam !== "ALL") {
      where.status = statusParam as AttendanceStatus;
    }

    const attendances = await prisma.attendance.findMany({
      where,
      include: {
        user: {
          select: { id: true, name: true, email: true, designation: true, avatar: true },
        },
        correctedBy: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: [{ date: "desc" }, { userId: "asc" }],
      take: 200,
    });

    return NextResponse.json(attendances);
  } catch (error: any) {
    console.error("GET /api/attendance error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch attendance" }, { status: 500 });
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
    // Permission-driven scoping. "HR" was never a role in this database, so the
    // old list silently limited this to ADMIN/MANAGER. Employees without
    // attendance:read still see their own rows, which is the point of the endpoint.
    const isStaffOrAdmin = await can(session, "attendance", "read");

    const targetUserId = isStaffOrAdmin && body.userId ? Number(body.userId) : currentUserId;
    const dateStr = body.date || new Date().toISOString().split("T")[0];
    const recordDate = new Date(`${dateStr}T00:00:00.000Z`);

    const checkIn = body.checkIn ? new Date(body.checkIn) : null;
    const checkOut = body.checkOut ? new Date(body.checkOut) : null;

    let totalHours = body.totalHours || 0;
    if (checkIn && checkOut && totalHours === 0) {
      totalHours = parseFloat(
        ((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60)).toFixed(2)
      );
    }

    const attendance = await prisma.attendance.upsert({
      where: {
        userId_date: {
          userId: targetUserId,
          date: recordDate,
        },
      },
      create: {
        userId: targetUserId,
        date: recordDate,
        checkIn,
        checkOut,
        totalHours,
        status: (body.status as AttendanceStatus) || AttendanceStatus.PRESENT,
        lateMinutes: body.lateMinutes || 0,
        earlyExitMinutes: body.earlyExitMinutes || 0,
        overtimeHours: body.overtimeHours || 0,
        source: isStaffOrAdmin ? AttendanceSource.MANUAL : AttendanceSource.API,
        isCorrected: isStaffOrAdmin,
        correctionReason: body.reason || (isStaffOrAdmin ? "Manual punch by admin" : undefined),
        correctedById: isStaffOrAdmin ? currentUserId : undefined,
        correctedAt: isStaffOrAdmin ? new Date() : undefined,
      },
      update: {
        checkIn: checkIn || undefined,
        checkOut: checkOut || undefined,
        totalHours: totalHours > 0 ? totalHours : undefined,
        status: (body.status as AttendanceStatus) || undefined,
        lateMinutes: body.lateMinutes ?? undefined,
        earlyExitMinutes: body.earlyExitMinutes ?? undefined,
        overtimeHours: body.overtimeHours ?? undefined,
        isCorrected: isStaffOrAdmin,
        correctionReason: body.reason || (isStaffOrAdmin ? "Manual punch by admin" : undefined),
        correctedById: isStaffOrAdmin ? currentUserId : undefined,
        correctedAt: isStaffOrAdmin ? new Date() : undefined,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json(attendance);
  } catch (error: any) {
    console.error("POST /api/attendance error:", error);
    return NextResponse.json({ error: error.message || "Failed to record attendance" }, { status: 500 });
  }
}
