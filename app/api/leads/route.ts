import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LeadStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");
    const status = searchParams.get("status") as LeadStatus | null;
    const assignedToId = searchParams.get("assignedToId");

    const where: any = {};

    if (status && Object.values(LeadStatus).includes(status)) {
      where.status = status;
    }

    if (assignedToId && assignedToId !== "ALL") {
      where.assignedToId = parseInt(assignedToId, 10);
    }

    if (search) {
      const q = search.trim();
      where.OR = [
        { title: { contains: q } },
        { name: { contains: q } },
        { company: { contains: q } },
        { email: { contains: q } },
        { phone: { contains: q } },
      ];
    }

    const [leads, allLeadsForMetrics] = await Promise.all([
      prisma.lead.findMany({
        where,
        include: {
          assignedTo: { select: { id: true, name: true, email: true, avatar: true } },
          createdBy: { select: { id: true, name: true } },
          activities: {
            orderBy: { createdAt: "desc" },
            take: 3,
          },
        },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.lead.findMany({
        select: {
          id: true,
          status: true,
          estimatedValue: true,
        },
      }),
    ]);

    // Compute pipeline metrics
    const totalLeads = allLeadsForMetrics.length;
    let pipelineValue = 0;
    let wonValue = 0;
    let wonCount = 0;

    allLeadsForMetrics.forEach((l) => {
      const val = Number(l.estimatedValue || 0);
      if (l.status !== "LOST") {
        pipelineValue += val;
      }
      if (l.status === "WON") {
        wonValue += val;
        wonCount += 1;
      }
    });

    const winRate = totalLeads > 0 ? Math.round((wonCount / totalLeads) * 100) : 0;

    return NextResponse.json({
      leads,
      metrics: {
        totalLeads,
        pipelineValue,
        wonValue,
        wonCount,
        winRate,
      },
    });
  } catch (error: any) {
    console.error("[leads GET] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      title,
      name,
      company,
      email,
      phone,
      source,
      status,
      estimatedValue,
      currency,
      assignedToId,
      notes,
      requirements,
      nextFollowUp,
      website,
      city,
      country,
    } = body;

    if (!title || !name) {
      return NextResponse.json(
        { error: "Lead title and contact name are required" },
        { status: 400 }
      );
    }

    const currentUserId = parseInt(session.user.id, 10);

    const parsedAssignedId = assignedToId && !isNaN(parseInt(assignedToId, 10)) ? parseInt(assignedToId, 10) : null;
    const parsedEstimatedValue = estimatedValue !== undefined && estimatedValue !== "" && !isNaN(Number(estimatedValue)) ? Number(estimatedValue) : null;
    const parsedFollowUp = nextFollowUp && !isNaN(new Date(nextFollowUp).getTime()) ? new Date(nextFollowUp) : null;

    const lead = await prisma.lead.create({
      data: {
        title,
        name,
        company: company || null,
        email: email || null,
        phone: phone || null,
        source: source || "INBOUND",
        status: status || "NEW",
        estimatedValue: parsedEstimatedValue,
        currency: currency || "INR",
        assignedToId: parsedAssignedId,
        createdById: currentUserId,
        notes: notes || null,
        requirements: requirements || null,
        nextFollowUp: parsedFollowUp,
        website: website || null,
        city: city || null,
        country: country || null,
        activities: {
          create: {
            userId: currentUserId,
            type: "CREATED",
            content: `Lead created by ${session.user.name || "User"}.`,
          },
        },
      },
      include: {
        assignedTo: { select: { id: true, name: true, email: true, avatar: true } },
        activities: true,
      },
    });

    return NextResponse.json(lead, { status: 201 });
  } catch (error: any) {
    console.error("[leads POST] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
