import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const lead = await prisma.lead.findUnique({
      where: { id },
      include: {
        assignedTo: { select: { id: true, name: true, email: true, avatar: true } },
        createdBy: { select: { id: true, name: true } },
        activities: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    return NextResponse.json(lead);
  } catch (error: any) {
    console.error("[leads/[id] GET] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const currentLead = await prisma.lead.findUnique({ where: { id } });
    if (!currentLead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
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
      lostReason,
      website,
      city,
      country,
      newActivityNote,
    } = body;

    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (name !== undefined) updateData.name = name;
    if (company !== undefined) updateData.company = company;
    if (email !== undefined) updateData.email = email;
    if (phone !== undefined) updateData.phone = phone;
    if (source !== undefined) updateData.source = source;
    if (estimatedValue !== undefined) {
      updateData.estimatedValue = estimatedValue !== "" && estimatedValue !== null && !isNaN(Number(estimatedValue)) ? Number(estimatedValue) : null;
    }
    if (currency !== undefined) updateData.currency = currency;
    if (assignedToId !== undefined) {
      updateData.assignedToId = assignedToId && !isNaN(parseInt(assignedToId, 10)) ? parseInt(assignedToId, 10) : null;
    }
    if (notes !== undefined) updateData.notes = notes;
    if (requirements !== undefined) updateData.requirements = requirements;
    if (nextFollowUp !== undefined) {
      updateData.nextFollowUp = nextFollowUp && !isNaN(new Date(nextFollowUp).getTime()) ? new Date(nextFollowUp) : null;
    }
    if (lostReason !== undefined) updateData.lostReason = lostReason;
    if (website !== undefined) updateData.website = website;
    if (city !== undefined) updateData.city = city;
    if (country !== undefined) updateData.country = country;

    const currentUserId = parseInt(session.user.id, 10);
    const activityCreations: any[] = [];

    // Track status change activity
    if (status && status !== currentLead.status) {
      updateData.status = status;
      activityCreations.push({
        userId: currentUserId,
        type: "STATUS_CHANGE",
        content: `Stage changed from ${currentLead.status} to ${status} by ${session.user.name || "User"}.`,
      });
    }

    // Add activity note if provided
    if (newActivityNote && typeof newActivityNote === "string" && newActivityNote.trim()) {
      activityCreations.push({
        userId: currentUserId,
        type: "NOTE",
        content: newActivityNote.trim(),
      });
    }

    if (activityCreations.length > 0) {
      updateData.activities = {
        create: activityCreations,
      };
    }

    const updated = await prisma.lead.update({
      where: { id },
      data: updateData,
      include: {
        assignedTo: { select: { id: true, name: true, email: true, avatar: true } },
        activities: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("[leads/[id] PATCH] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await prisma.lead.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: "Lead deleted" });
  } catch (error: any) {
    console.error("[leads/[id] DELETE] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
