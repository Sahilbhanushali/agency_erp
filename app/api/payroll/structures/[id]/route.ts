import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const template = await prisma.salaryStructureTemplate.findUnique({
      where: { id },
      include: {
        assignedStructures: {
          where: { status: "ACTIVE" },
          include: {
            user: { select: { id: true, name: true, email: true, designation: true } },
          },
        },
      },
    });

    if (!template) {
      return NextResponse.json({ error: "Salary structure template not found" }, { status: 404 });
    }

    return NextResponse.json(template);
  } catch (error: any) {
    console.error("GET /api/payroll/structures/[id] error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch structure" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = (session.user as any).role || "";
    if (!["ADMIN", "HR", "FINANCE"].includes(userRole)) {
      return NextResponse.json({ error: "Forbidden: HR/Admin/Finance permission required" }, { status: 403 });
    }

    const { id } = await params;
    const existing = await prisma.salaryStructureTemplate.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Salary structure template not found" }, { status: 404 });
    }

    const body = await request.json();
    const data: any = {};

    if (body.name !== undefined) data.name = body.name.trim();
    if (body.code !== undefined) data.code = body.code.trim().toUpperCase();
    if (body.description !== undefined) data.description = body.description ? body.description.trim() : null;

    if (
      body.basicPercentage !== undefined ||
      body.hraPercentage !== undefined ||
      body.specialPercentage !== undefined ||
      body.otherPercentage !== undefined
    ) {
      const basic = body.basicPercentage !== undefined ? Number(body.basicPercentage) : existing.basicPercentage;
      const hra = body.hraPercentage !== undefined ? Number(body.hraPercentage) : existing.hraPercentage;
      const special = body.specialPercentage !== undefined ? Number(body.specialPercentage) : existing.specialPercentage;
      const other = body.otherPercentage !== undefined ? Number(body.otherPercentage) : existing.otherPercentage;

      const sum = basic + hra + special + other;
      if (Math.abs(sum - 100) > 0.01) {
        return NextResponse.json(
          { error: `Component percentages must sum up to exactly 100% (currently ${sum.toFixed(1)}%)` },
          { status: 400 }
        );
      }

      data.basicPercentage = basic;
      data.hraPercentage = hra;
      data.specialPercentage = special;
      data.otherPercentage = other;
    }

    if (body.pfApplicable !== undefined) data.pfApplicable = Boolean(body.pfApplicable);
    if (body.esiApplicable !== undefined) data.esiApplicable = Boolean(body.esiApplicable);
    if (body.professionalTax !== undefined) data.professionalTax = Boolean(body.professionalTax);
    if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);

    if (body.isDefault !== undefined) {
      data.isDefault = Boolean(body.isDefault);
      if (data.isDefault) {
        await prisma.salaryStructureTemplate.updateMany({
          where: { id: { not: id } },
          data: { isDefault: false },
        });
      }
    }

    const updated = await prisma.salaryStructureTemplate.update({
      where: { id },
      data,
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("PATCH /api/payroll/structures/[id] error:", error);
    if (error.code === "P2002") {
      return NextResponse.json({ error: "A structure with this name or code already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message || "Failed to update salary structure template" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = (session.user as any).role || "";
    if (!["ADMIN", "HR", "FINANCE"].includes(userRole)) {
      return NextResponse.json({ error: "Forbidden: HR/Admin/Finance permission required" }, { status: 403 });
    }

    const { id } = await params;
    const existing = await prisma.salaryStructureTemplate.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            assignedStructures: {
              where: { status: "ACTIVE" },
            },
          },
        },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Salary structure template not found" }, { status: 404 });
    }

    if (existing.isDefault) {
      return NextResponse.json({ error: "Cannot delete the active default salary structure" }, { status: 400 });
    }

    if (existing._count.assignedStructures > 0) {
      // Soft-deactivate if active employee structures reference it
      await prisma.salaryStructureTemplate.update({
        where: { id },
        data: { isActive: false },
      });
      return NextResponse.json({
        success: true,
        deactivated: true,
        message: `Deactivated structure because ${existing._count.assignedStructures} active employee(s) are assigned to it.`,
      });
    }

    await prisma.salaryStructureTemplate.delete({ where: { id } });
    return NextResponse.json({ success: true, deleted: true });
  } catch (error: any) {
    console.error("DELETE /api/payroll/structures/[id] error:", error);
    return NextResponse.json({ error: error.message || "Failed to delete salary structure" }, { status: 500 });
  }
}
