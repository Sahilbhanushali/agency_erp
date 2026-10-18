import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCan, requirePermission } from "@/lib/api-auth";

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireCan("festivals", "update");
  if (!auth.ok) return auth.response;

  const params = await context.params;
    try {
      const id = parseInt(params.id);
      if (isNaN(id)) {
        return NextResponse.json({ error: "Invalid festival ID" }, { status: 400 });
      }
  
      const body = await request.json();
      const { name, description, date, primaryType } = body;
  
      if (!name || !description || !date || !primaryType) {
        return NextResponse.json({ error: "All fields are required" }, { status: 400 });
      }
  
      const parsedDate = new Date(date);
      if (isNaN(parsedDate.getTime())) {
        return NextResponse.json({ error: "Invalid date format" }, { status: 400 });
      }
  
      const festival = await prisma.festival.update({
        where: { id },
        data: {
          name,
          description,
          date: parsedDate,
          primaryType,
        },
      });
  
      return NextResponse.json({
        id: festival.id,
        name: festival.name,
        description: festival.description,
        date: festival.date.toISOString(),
        primaryType: festival.primaryType,
      });
    } catch (error) {
      console.error("Error updating festival:", error);
      return NextResponse.json({ error: "Failed to update festival" }, { status: 500 });
    }
  }
  
  export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("Manage-festival");
  if (!auth.ok) return auth.response;

  const params = await context.params;
    try {
      const id = parseInt(params.id);
      if (isNaN(id)) {
        return NextResponse.json({ error: "Invalid festival ID" }, { status: 400 });
      }
  
      await prisma.festival.delete({
        where: { id },
      });
  
      return NextResponse.json({ message: "Festival deleted successfully" });
    } catch (error) {
      console.error("Error deleting festival:", error);
      return NextResponse.json({ error: "Failed to delete festival" }, { status: 500 });
    }
  }