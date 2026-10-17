import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const DEFAULT_TEMPLATES = [
  {
    name: "Standard Corporate Structure",
    code: "STD_CORP",
    description: "Industry standard Indian compensation model with 50% Basic, 25% HRA, 15% Special, and 10% Other Allowance. PF & PT enabled.",
    basicPercentage: 50.0,
    hraPercentage: 25.0,
    specialPercentage: 15.0,
    otherPercentage: 10.0,
    pfApplicable: true,
    esiApplicable: false,
    professionalTax: true,
    isDefault: true,
    isActive: true,
  },
  {
    name: "Tech & Software Engineering Structure",
    code: "TECH_ENG",
    description: "High-earning technical profile structure: 50% Basic, 30% HRA, 20% Flexible Special Allowance. PF & PT enabled.",
    basicPercentage: 50.0,
    hraPercentage: 30.0,
    specialPercentage: 20.0,
    otherPercentage: 0.0,
    pfApplicable: true,
    esiApplicable: false,
    professionalTax: true,
    isDefault: false,
    isActive: true,
  },
  {
    name: "Operations & Support (ESI Applicable)",
    code: "OPS_SUPPORT",
    description: "Designed for operations, facilities, and support staff where statutory ESI coverage applies alongside PF and PT.",
    basicPercentage: 50.0,
    hraPercentage: 30.0,
    specialPercentage: 10.0,
    otherPercentage: 10.0,
    pfApplicable: true,
    esiApplicable: true,
    professionalTax: true,
    isDefault: false,
    isActive: true,
  },
  {
    name: "Internship & Trainee Stipend",
    code: "INTERN_STIPEND",
    description: "Fixed monthly stipend for trainees and interns. Excluded from statutory retirement and insurance deductions.",
    basicPercentage: 100.0,
    hraPercentage: 0.0,
    specialPercentage: 0.0,
    otherPercentage: 0.0,
    pfApplicable: false,
    esiApplicable: false,
    professionalTax: false,
    isDefault: false,
    isActive: true,
  },
];

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Auto-seed defaults if table is empty
    const count = await prisma.salaryStructureTemplate.count();
    if (count === 0) {
      for (const t of DEFAULT_TEMPLATES) {
        await prisma.salaryStructureTemplate.create({ data: t });
      }
    }

    const templates = await prisma.salaryStructureTemplate.findMany({
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
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

    return NextResponse.json(templates);
  } catch (error: any) {
    console.error("GET /api/payroll/structures error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch salary structure templates" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = (session.user as any).role || "";
    if (!["ADMIN", "HR", "FINANCE"].includes(userRole)) {
      return NextResponse.json({ error: "Forbidden: HR/Admin/Finance permission required" }, { status: 403 });
    }

    const body = await request.json();
    const {
      name,
      code,
      description,
      basicPercentage = 50,
      hraPercentage = 25,
      specialPercentage = 15,
      otherPercentage = 10,
      pfApplicable = true,
      esiApplicable = false,
      professionalTax = true,
      isDefault = false,
      isActive = true,
    } = body;

    if (!name || !code) {
      return NextResponse.json({ error: "Structure name and unique code are required" }, { status: 400 });
    }

    const sum = Number(basicPercentage) + Number(hraPercentage) + Number(specialPercentage) + Number(otherPercentage);
    if (Math.abs(sum - 100) > 0.01) {
      return NextResponse.json(
        { error: `Component percentages must sum up to exactly 100% (currently ${sum.toFixed(1)}%)` },
        { status: 400 }
      );
    }

    // If setting as default, clear existing default
    if (isDefault) {
      await prisma.salaryStructureTemplate.updateMany({
        data: { isDefault: false },
      });
    }

    const created = await prisma.salaryStructureTemplate.create({
      data: {
        name: name.trim(),
        code: code.trim().toUpperCase(),
        description: description?.trim() || null,
        basicPercentage: Number(basicPercentage),
        hraPercentage: Number(hraPercentage),
        specialPercentage: Number(specialPercentage),
        otherPercentage: Number(otherPercentage),
        pfApplicable: Boolean(pfApplicable),
        esiApplicable: Boolean(esiApplicable),
        professionalTax: Boolean(professionalTax),
        isDefault: Boolean(isDefault),
        isActive: Boolean(isActive),
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/payroll/structures error:", error);
    if (error.code === "P2002") {
      return NextResponse.json({ error: "A structure with this name or code already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message || "Failed to create salary structure template" }, { status: 500 });
  }
}
