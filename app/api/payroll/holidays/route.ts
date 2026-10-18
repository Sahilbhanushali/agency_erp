import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireCan } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireCan("payroll", "read");
    if (!auth.ok) return auth.response;
    const session = auth.session;
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
    const auth = await requireCan("payroll", "create");
    if (!auth.ok) return auth.response;
    const session = auth.session;

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
    const auth = await requireCan("payroll", "delete");
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Holiday ID required" }, { status: 400 });

    await prisma.holiday.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to delete holiday" }, { status: 500 });
  }
}
