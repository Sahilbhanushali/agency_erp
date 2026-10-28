// app/api/assets/route.ts
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireCan } from "@/lib/api-auth";
import { NextResponse } from "next/server";

export async function GET() {
    const auth = await requireCan("assets", "read");
    if (!auth.ok) return auth.response;
    const session = auth.session;

  try {
    const assets = await prisma.asset.findMany({
      include: {
        post: {
          include: {
            project: {
              include: {
                client: true,
                clientCompany: { select: { name: true, logo: true } },
              },
            },
          },
        },
        uploadedBy: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(assets, { status: 200 });
  } catch (error) {
    console.error("Error fetching assets:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}