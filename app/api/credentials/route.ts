import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/encryption";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const credentials = await prisma.credential.findMany({
      include: {
        client: { select: { name: true, phone: true } },
        project: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const decryptedCredentials = credentials.map((cred: any) => ({
      ...cred,
      password: decrypt(cred.password),
    }));

    return NextResponse.json(decryptedCredentials);
  } catch (error: any) {
    console.error("Error fetching credentials:", error);
    return NextResponse.json({ error: "Internal server error", details: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await request.json();
    
    // The client sends: clientId, projectId, location, phone, platforms array
    if (!data.clientId || !data.projectId || !data.platforms || !Array.isArray(data.platforms)) {
      return NextResponse.json({ error: "Invalid data" }, { status: 400 });
    }

    // Save each platform credential
    const createdCredentials = [];
    for (const p of data.platforms) {
      if (p.platform && p.userId && p.password) {
        const cred = await prisma.credential.create({
          data: {
            clientId: data.clientId,
            projectId: data.projectId,
            location: data.location || "",
            platform: p.platform,
            userId: p.userId,
            password: encrypt(p.password),
          }
        });
        createdCredentials.push(cred);
      }
    }

    return NextResponse.json(createdCredentials, { status: 201 });
  } catch (error: any) {
    console.error("Error creating credentials:", error);
    return NextResponse.json({ error: "Internal server error", details: error.message }, { status: 500 });
  }
}
