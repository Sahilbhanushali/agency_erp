import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/api-auth";

export async function GET() {
  const auth = await requirePermission("View-calender");
  if (!auth.ok) return auth.response;

  try {
    const events = await prisma.shootEvent.findMany({
      orderBy: { date: "asc" },
    });
    return NextResponse.json(events);
  } catch (error) {
    console.error("Error fetching shoot events:", error);
    return NextResponse.json({ error: "Failed to fetch shoot events" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requirePermission("Manage-projects");
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const { name, location, date, time, completed } = body;

    if (!name || !date) {
      return NextResponse.json({ error: "Name and date are required" }, { status: 400 });
    }

    const event = await prisma.shootEvent.create({
      data: {
        name,
        location,
        date,
        time,
        completed: completed || false,
      },
    });

    return NextResponse.json(event, { status: 201 });
  } catch (error) {
    console.error("Error creating shoot event:", error);
    return NextResponse.json({ error: "Failed to create shoot event" }, { status: 500 });
  }
}
