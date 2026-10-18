import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCan } from "@/lib/api-auth";

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireCan("projects", "update");
    if (!auth.ok) return auth.response;
    const session = auth.session;
    // Fetch user permissions
    const user = await prisma.user.findUnique({
      where: { id: parseInt(session.user.id) },
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });

    const permissions = user?.role?.permissions.map((rp) => rp.permission.name) || [];
    if (!permissions.includes("Manage-projects")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, isActive } = await request.json();

    if (!id || typeof isActive !== "boolean") {
      return NextResponse.json({ error: "Project ID and isActive are required" }, { status: 400 });
    }

    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Update only the isActive field
    const updatedProject = await prisma.project.update({
      where: { id },
      data: {
        isActive,
      },
    });

    return NextResponse.json(updatedProject);
  } catch (error) {
    console.error("Failed to toggle project status:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}