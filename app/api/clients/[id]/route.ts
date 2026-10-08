import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeFile } from "fs/promises";
import path from "path";

// GET: Fetch client details
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized: No session found" }, { status: 401 });
    }

    const client = await prisma.client.findUnique({
      where: { id: params.id },
      include: {
        projects: {
          where: { isActive: true },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    return NextResponse.json(client);
  } catch (error: any) {
    console.error("Error fetching client:", error);
    return NextResponse.json({ error: "Internal server error", details: error.message }, { status: 500 });
  }
}

// PUT: Update client details

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const name = formData.get("name") as string;
    const email = formData.get("email") as string;
    const phone = formData.get("phone") as string | null;
    const company = formData.get("company") as string | null;
    const avatarFile = formData.get("avatar") as File | null;
    const removeAvatar = formData.get("removeAvatar") as string | null;

    if (!name ) {
      return NextResponse.json({ error: "Name and email required" }, { status: 400 });
    }

    const dataToUpdate: any = {
      name,
      email,
      phone,
      company,
    };

    if (avatarFile && avatarFile.size > 0) {
      const bytes = await avatarFile.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const fileName = `${Date.now()}-${avatarFile.name}`;
      const filePath = path.join(process.cwd(), "public", "uploads", fileName);

      await writeFile(filePath, buffer);
      dataToUpdate.avatar = `/uploads/${fileName}`; // ✅ serve from public/uploads
    } else if (removeAvatar === "true") {
      dataToUpdate.avatar = null;
    }

    const updatedClient = await prisma.client.update({
      where: { id: params.id },
      data: dataToUpdate,
    });

    return NextResponse.json(updatedClient);
  } catch (error: any) {
    console.error("Error updating client:", error);
    return NextResponse.json({ error: "Internal server error", details: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
    try {
      const session = await getServerSession(authOptions);
      if (!session || !session.user) {
        return NextResponse.json({ error: "Unauthorized: No session found" }, { status: 401 });
      }
  
      // Check user permissions
      const user = await prisma.user.findUnique({
        where: { id: parseInt(session.user.id) },
        include: {
          role: {
            include: {
              permissions: {
                select: { permission: { select: { name: true } } },
              },
            },
          },
        },
      });
  
      if (!user || !user.role || !user.role.permissions.some((rp: any) => rp.permission.name === "Manage-clients")) {
        return NextResponse.json({ error: "Unauthorized: Insufficient permissions" }, { status: 403 });
      }
  
      // Check if client exists
      const client = await prisma.client.findUnique({
        where: { id: params.id },
      });
  
      if (!client) {
        return NextResponse.json({ error: "Client not found" }, { status: 404 });
      }
  
      // Delete the client
      await prisma.client.delete({
        where: { id: params.id },
      });
  
      return NextResponse.json({ message: "Client deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting client:", error);
      return NextResponse.json({ error: "Internal server error", details: error.message }, { status: 500 });
    }
  }