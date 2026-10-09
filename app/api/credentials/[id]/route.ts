import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/encryption";

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const id = params.id;
    const data = await request.json();

    const updatedCredential = await prisma.credential.update({
      where: { id },
      data: {
        platform: data.platform,
        userId: data.userId,
        password: data.password ? encrypt(data.password) : undefined,
        location: data.location,
      }
    });

    return NextResponse.json(updatedCredential);
  } catch (error: any) {
    console.error("Error updating credential:", error);
    return NextResponse.json({ error: "Internal server error", details: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const id = params.id;

    await prisma.credential.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Credential deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting credential:", error);
    return NextResponse.json({ error: "Internal server error", details: error.message }, { status: 500 });
  }
}
