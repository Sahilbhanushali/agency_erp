import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireCan } from "@/lib/api-auth";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { deleteLocalFile } from "@/lib/storage";

// GET: Fetch client details
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  try {
    const auth = await requireCan("clients", "read");
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const client = await prisma.client.findUnique({
      where: { id: params.id },
      include: {
        projects: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            name: true,
            description: true,
            isActive: true,
            startDate: true,
            endDate: true,
            createdAt: true,
            _count: { select: { posts: true } },
          },
        },
        quotations: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        invoices: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        credentials: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            location: true,
            platform: true,
            userId: true,
            createdAt: true,
          },
        },
        contracts: {
          orderBy: { createdAt: "desc" },
          include: {
            project: { select: { id: true, name: true } },
          },
        },
        expenses: {
          orderBy: { date: "desc" },
          include: {
            project: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const formattedClient = {
      ...client,
      credentials: client.credentials.map((cred) => ({
        id: cred.id,
        title: cred.platform || cred.location || "Login Credential",
        username: cred.userId,
        location: cred.location,
        platform: cred.platform,
        createdAt: cred.createdAt,
      })),
    };

    return NextResponse.json(formattedClient);
  } catch (error: any) {
    console.error("Error fetching client:", error);
    return NextResponse.json({ error: "Internal server error", details: error.message }, { status: 500 });
  }
}

// PUT: Update client details

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  try {
    const auth = await requireCan("clients", "update");
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const existingClient = await prisma.client.findUnique({
      where: { id: params.id },
    });

    if (!existingClient) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const formData = await request.formData();
    const name = formData.get("name") as string;
    const email = formData.get("email") as string;
    const phone = formData.get("phone") as string | null;
    const altPhone = formData.get("altPhone") as string | null;
    const company = formData.get("company") as string | null;
    const website = formData.get("website") as string | null;
    const industry = formData.get("industry") as string | null;
    const status = formData.get("status") as string | null;
    const address = formData.get("address") as string | null;
    const city = formData.get("city") as string | null;
    const state = formData.get("state") as string | null;
    const country = formData.get("country") as string | null;
    const postalCode = formData.get("postalCode") as string | null;
    const gstin = formData.get("gstin") as string | null;
    const panNumber = formData.get("panNumber") as string | null;
    const notes = formData.get("notes") as string | null;
    const avatarFile = formData.get("avatar") as File | null;
    const removeAvatar = formData.get("removeAvatar") as string | null;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const dataToUpdate: any = {
      name: name.trim(),
      email: email?.trim() || "",
      phone: phone?.trim() || null,
      altPhone: altPhone?.trim() || null,
      company: company?.trim() || null,
      website: website?.trim() || null,
      industry: industry?.trim() || null,
      address: address?.trim() || null,
      city: city?.trim() || null,
      state: state?.trim() || null,
      country: country?.trim() || "India",
      postalCode: postalCode?.trim() || null,
      gstin: gstin?.trim() || null,
      panNumber: panNumber?.trim() || null,
      notes: notes?.trim() || null,
    };

    if (status) {
      dataToUpdate.status = status;
    }

    if (avatarFile && avatarFile.size > 0) {
      if (existingClient.avatar) {
        await deleteLocalFile(existingClient.avatar);
      }
      const bytes = await avatarFile.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const safeName = avatarFile.name.replace(/[^a-zA-Z0-9.-]/g, "_");
      const fileName = `${Date.now()}-${safeName}`;
      const uploadDir = path.join(process.cwd(), "public", "uploads", "clients");
      await mkdir(uploadDir, { recursive: true });
      const filePath = path.join(uploadDir, fileName);

      await writeFile(filePath, buffer);
      dataToUpdate.avatar = `/uploads/clients/${fileName}`;
    } else if (removeAvatar === "true") {
      if (existingClient.avatar) {
        await deleteLocalFile(existingClient.avatar);
      }
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
    const auth = await requireCan("clients", "delete");
    if (!auth.ok) return auth.response;
    const session = auth.session;

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

    if (client.avatar) {
      await deleteLocalFile(client.avatar);
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