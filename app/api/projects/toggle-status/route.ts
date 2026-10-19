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
    /**
     * requireCan("projects", "update") above is the authorization check. A second gate
     * demanding the legacy name "Manage-projects" used to follow it, so a role granted
     * projects:update in the permission matrix could not activate or deactivate a
     * project — it got 401 despite holding the permission.
     */

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