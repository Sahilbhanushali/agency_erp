import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import path from "path";
import fs from "fs/promises";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized: No session found" }, { status: 401 });
    }

    const formData = await request.formData();
    const name = formData.get("name") as string;
    const email = formData.get("email") as string;
    const phone = formData.get("phone") as string | null;
    const company = formData.get("company") as string | null;
    const avatarFile = formData.get("avatar") as File | null;

    // if (!name || !email) {
    //   return NextResponse.json({ error: "Name and email are required" }, { status: 400 });
    // }

    let avatarUrl: string | null = null;
    if (avatarFile) {
      const buffer = Buffer.from(await avatarFile.arrayBuffer());
      const uploadDir = path.join(process.cwd(), "public", "uploads", "clients");
      await fs.mkdir(uploadDir, { recursive: true });

      const filename = `${Date.now()}-${avatarFile.name}`;
      const filePath = path.join(uploadDir, filename);
      await fs.writeFile(filePath, buffer);

      avatarUrl = `/uploads/clients/${filename}`; // stored path
    }

    const client = await prisma.client.create({
      data: {
        name,
        email,
        phone,
        company,
        avatar: avatarUrl,
      },
    });

    return NextResponse.json(client);
  } catch (error: any) {
    console.error("Error creating client:", error);
    return NextResponse.json({ error: "Internal server error", details: error.message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized: No session found" }, { status: 401 });
    }

    // Fetch the user's role from the database
    const user = await prisma.user.findUnique({
      where: { id: parseInt(session.user.id) },
      include: { role: true },
    });

    if (!user || !user.role) {
      return NextResponse.json({ error: "Unauthorized: No role assigned" }, { status: 401 });
    }

    // Optionally restrict access based on role
    const clients = await prisma.client.findMany({
      include: {
        projects: {
          where: { isActive: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(clients);
  } catch (error) {
    console.error("Error fetching clients:", error);
    return NextResponse.json({ error: "Internal server error", details: error.message }, { status: 500 });
  }
}