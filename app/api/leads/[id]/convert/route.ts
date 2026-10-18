import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireCan } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  try {
    const auth = await requireCan("leads", "create");
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const { createProject, projectName } = body;

    const currentUserId = parseInt(session.user.id, 10);

    // 1. Create or find Client
    let client = null;
    if (lead.email) {
      client = await prisma.client.findFirst({
        where: { email: lead.email },
      });
    }

    if (!client) {
      client = await prisma.client.create({
        data: {
          name: lead.name,
          email: lead.email || `${lead.name.toLowerCase().replace(/[^a-z0-9]/g, "")}@example.com`,
          company: lead.company || lead.title,
          phone: lead.phone || null,
        },
      });
    }

    // 2. Optionally create Project for this Client
    let project = null;
    if (createProject) {
      const projTitle = projectName || `${lead.company || lead.name} - Retainer`;
      project = await prisma.project.create({
        data: {
          name: projTitle,
          clientId: client.id,
          startDate: new Date(),
          isActive: true,
          postTypes: { PHOTO: 8, REEL: 4, CAROUSEL: 2 } as any,
        },
      });
    }

    // 3. Mark Lead as WON and record conversion
    const updatedLead = await prisma.lead.update({
      where: { id },
      data: {
        status: "WON",
        convertedToClientId: client.id,
        convertedAt: new Date(),
        activities: {
          create: {
            userId: currentUserId,
            type: "CONVERTED",
            content: `Lead successfully converted to Client "${client.name}"${project ? ` and Project "${project.name}"` : ""} by ${session.user.name || "User"}.`,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      lead: updatedLead,
      client,
      project,
    });
  } catch (error: any) {
    console.error("[leads/convert] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
