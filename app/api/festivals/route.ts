// pages/api/festivals.js
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCan } from "@/lib/api-auth";

export async function GET() {
  const auth = await requireCan("festivals", "read");
  if (!auth.ok) return auth.response;

  try {
    // Fetch festivals from the database
    const festivals = await prisma.festival.findMany({
      orderBy: { date: "asc" },
      select: {
        id: true,
        name: true,
        description: true,
        date: true,
        primaryType: true,
      },
    });

    // Map festivals to match the expected format
    const formattedFestivals = festivals.map((festival) => ({
      id: festival.id,
      name: festival.name,
      description: festival.description,
      date: festival.date.toISOString(),
      primaryType: festival.primaryType,
    }));

    return NextResponse.json(formattedFestivals);
  } catch (error) {
    console.error("Error fetching festivals:", error);
    return NextResponse.json({ error: "Failed to fetch festivals" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireCan("festivals", "create");
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const { name, description, date, primaryType } = body;

    // Validate input
    if (!name || !description || !date || !primaryType) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 });
    }

    // Validate date format
    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) {
      return NextResponse.json({ error: "Invalid date format" }, { status: 400 });
    }

    // Create new festival in the database
    const festival = await prisma.festival.create({
      data: {
        name,
        description,
        date: parsedDate,
        primaryType,
      },
    });

    // Return the created festival in the expected format
    return NextResponse.json({
      id: festival.id,
      name: festival.name,
      description: festival.description,
      date: festival.date.toISOString(),
      primaryType: festival.primaryType,
    }, { status: 201 });
  } catch (error) {
    console.error("Error creating festival:", error);
    return NextResponse.json({ error: "Failed to create festival" }, { status: 500 });
  }
}