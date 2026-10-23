import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCan } from "@/lib/api-auth";
export async function PUT(req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireCan("projects", "update");
  if (!auth.ok) return auth.response;

  try {
    const { id } = await context.params;
    const body = await req.json();
    const { name, location, date, time, completed } = body;

    const event = await prisma.shootEvent.update({
      where: { id },
      data: {
        name,
        location,
        date,
        time,
        completed,
      },
    });

    return NextResponse.json(event);
  } catch (error) {
    console.error("Error updating shoot event:", error);
    return NextResponse.json({ error: "Failed to update shoot event" }, { status: 500 });
  }
}

export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireCan("projects", "delete");
  if (!auth.ok) return auth.response;

  try {
    const { id } = await context.params;
    await prisma.shootEvent.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting shoot event:", error);
    return NextResponse.json({ error: "Failed to delete shoot event" }, { status: 500 });
  }
}
