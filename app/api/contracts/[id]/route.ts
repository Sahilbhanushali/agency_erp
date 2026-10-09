import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/api-auth";
import { logAuditAction } from "@/lib/audit";
import { contractUpdateSchema } from "@/lib/validation/contract";
import { deleteLocalFile } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission("View-clients");
  if (!auth.ok) return auth.response;

  try {
    const { id } = await context.params;
    const contract = await prisma.contract.findUnique({
      where: { id },
      include: {
        client: true,
        project: {
          select: { id: true, name: true, _count: { select: { posts: true } } },
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!contract) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }

    return NextResponse.json({ contract });
  } catch (error) {
    console.error("[contracts] GET by ID failed:", error);
    return NextResponse.json({ error: "Failed to load contract" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission("Manage-clients");
  if (!auth.ok) return auth.response;

  try {
    const { id } = await context.params;
    const json = await request.json();
    const parsed = contractUpdateSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 422 }
      );
    }

    const existing = await prisma.contract.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }

    const data = parsed.data;

    // Clean up replaced document file
    if (
      data.documentUrl !== undefined &&
      data.documentUrl !== existing.documentUrl &&
      existing.documentUrl
    ) {
      await deleteLocalFile(existing.documentUrl);
    }

    const updated = await prisma.contract.update({
      where: { id },
      data: {
        ...data,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
        renewalDate: data.renewalDate ? new Date(data.renewalDate) : undefined,
        signedAt: data.signedAt ? new Date(data.signedAt) : undefined,
      },
      include: {
        client: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
      },
    });

    await logAuditAction({
      userId: String(auth.userId),
      action: "UPDATE",
      entityType: "Contract",
      entityId: id,
      oldValues: JSON.stringify({
        status: existing.status,
        value: existing.value,
        renewalDate: existing.renewalDate,
      }),
      newValues: JSON.stringify({
        status: updated.status,
        value: updated.value,
        renewalDate: updated.renewalDate,
      }),
      ipAddress: request.headers.get("x-forwarded-for") || "unknown",
      userAgent: request.headers.get("user-agent") || "unknown",
    });

    return NextResponse.json({ contract: updated });
  } catch (error) {
    console.error("[contracts] PATCH failed:", error);
    return NextResponse.json({ error: "Failed to update contract" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission("Manage-clients");
  if (!auth.ok) return auth.response;

  try {
    const { id } = await context.params;
    const existing = await prisma.contract.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }

    if (existing.documentUrl) {
      await deleteLocalFile(existing.documentUrl);
    }

    await prisma.contract.delete({ where: { id } });

    await logAuditAction({
      userId: String(auth.userId),
      action: "DELETE",
      entityType: "Contract",
      entityId: id,
      oldValues: JSON.stringify({ title: existing.title, client: existing.clientId }),
      ipAddress: request.headers.get("x-forwarded-for") || "unknown",
      userAgent: request.headers.get("user-agent") || "unknown",
    });

    return NextResponse.json({ success: true, message: "Contract removed successfully" });
  } catch (error) {
    console.error("[contracts] DELETE failed:", error);
    return NextResponse.json({ error: "Failed to delete contract" }, { status: 500 });
  }
}
