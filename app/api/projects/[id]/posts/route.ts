import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireCan } from "@/lib/api-auth";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  try {
    const auth = await requireCan("posts", "read");
    if (!auth.ok) return auth.response;
    const session = auth.session;
    const posts = await prisma.post.findMany({
      where: { projectId: params.id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(posts);
  } catch (error) {
    console.error("Error fetching posts:", error);
    return NextResponse.json({ error: "Internal server error", details: error.message }, { status: 500 });
  }
}