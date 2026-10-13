import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const yearParam = searchParams.get("year");
    const year = yearParam ? Number(yearParam) : new Date().getFullYear();

    const holidays = await prisma.holiday.findMany({
      where: { year },
      orderBy: { date: "asc" },
    });

    return NextResponse.json(holidays);
  } catch (error: any) {
    console.error("GET /api/payroll/holidays error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch holidays" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = (session.user as any).role || "";
    if (!["ADMIN", "HR"].includes(userRole)) {
      return NextResponse.json({ error: "Forbidden: HR or Admin access required" }, { status: 403 });
    }

    const body = await request.json();
    if (!body.name || !body.date) {
      return NextResponse.json({ error: "Holiday name and date are required" }, { status: 400 });
    }

    const date = new Date(body.date);
    const year = date.getFullYear();

    const holiday = await prisma.holiday.upsert({
      where: { date },
      create: {
        name: body.name,
        date,
        year,
        isOptional: Boolean(body.isOptional),
      },
      update: {
        name: body.name,
        isOptional: Boolean(body.isOptional),
      },
    });

    return NextResponse.json(holiday);
  } catch (error: any) {
    console.error("POST /api/payroll/holidays error:", error);
    return NextResponse.json({ error: error.message || "Failed to save holiday" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = (session.user as any).role || "";
    if (!["ADMIN", "HR"].includes(userRole)) {
      return NextResponse.json({ error: "Forbidden: HR or Admin access required" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Holiday ID required" }, { status: 400 });

    await prisma.holiday.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to delete holiday" }, { status: 500 });
  }
}
