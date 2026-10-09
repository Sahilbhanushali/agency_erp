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
    const altPhone = formData.get("altPhone") as string | null;
    const company = formData.get("company") as string | null;
    const website = formData.get("website") as string | null;
    const industry = formData.get("industry") as string | null;
    const status = (formData.get("status") as string) || "ACTIVE";
    const address = formData.get("address") as string | null;
    const city = formData.get("city") as string | null;
    const state = formData.get("state") as string | null;
    const country = (formData.get("country") as string) || "India";
    const postalCode = formData.get("postalCode") as string | null;
    const gstin = formData.get("gstin") as string | null;
    const panNumber = formData.get("panNumber") as string | null;
    const notes = formData.get("notes") as string | null;
    const avatarFile = formData.get("avatar") as File | null;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Client name is required" }, { status: 400 });
    }

    let avatarUrl: string | null = null;
    if (avatarFile && avatarFile.size > 0) {
      const buffer = Buffer.from(await avatarFile.arrayBuffer());
      const uploadDir = path.join(process.cwd(), "public", "uploads", "clients");
      await fs.mkdir(uploadDir, { recursive: true });

      const safeName = avatarFile.name.replace(/[^a-zA-Z0-9.-]/g, "_");
      const filename = `${Date.now()}-${safeName}`;
      const filePath = path.join(uploadDir, filename);
      await fs.writeFile(filePath, buffer);

      avatarUrl = `/uploads/clients/${filename}`;
    }

    const client = await prisma.client.create({
      data: {
        name: name.trim(),
        email: email?.trim() || "",
        phone: phone?.trim() || null,
        altPhone: altPhone?.trim() || null,
        company: company?.trim() || null,
        website: website?.trim() || null,
        industry: industry?.trim() || null,
        status: status || "ACTIVE",
        address: address?.trim() || null,
        city: city?.trim() || null,
        state: state?.trim() || null,
        country: country?.trim() || "India",
        postalCode: postalCode?.trim() || null,
        gstin: gstin?.trim() || null,
        panNumber: panNumber?.trim() || null,
        notes: notes?.trim() || null,
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