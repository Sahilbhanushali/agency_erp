import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LeaveService } from "@/lib/payroll/leave-service";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await LeaveService.initDefaultLeaveTypes();

    const types = await prisma.leaveType.findMany({
      orderBy: { name: "asc" },
    });

    return NextResponse.json(types);
  } catch (error: any) {
    console.error("GET /api/leaves/types error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch leave types" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = (session.user as any).role || "";
    if (!["ADMIN", "MANAGER", "HR"].includes(userRole)) {
      return NextResponse.json({ error: "Forbidden: Admin or HR access required" }, { status: 403 });
    }

    const body = await request.json();
    if (!body.name || !body.code) {
      return NextResponse.json({ error: "Name and code are required" }, { status: 400 });
    }

    const created = await prisma.leaveType.create({
      data: {
        name: body.name,
        code: body.code.toUpperCase(),
        yearlyQuota: parseFloat(body.yearlyQuota || 0),
        isPaid: body.isPaid ?? true,
        carryForwardLimit: parseFloat(body.carryForwardLimit || 0),
        description: body.description,
      },
    });

    return NextResponse.json(created);
  } catch (error: any) {
    console.error("POST /api/leaves/types error:", error);
    return NextResponse.json({ error: error.message || "Failed to create leave type" }, { status: 500 });
  }
}
