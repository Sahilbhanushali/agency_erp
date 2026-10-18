import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PayrollService } from "@/lib/payroll/payroll-service";
import { requireCan } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireCan("salary", "update");
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const body = await request.json();
    const {
      userId,
      templateId,
      monthlyGross, // in rupees or paise
      annualCtc,    // in rupees or paise
      effectiveFrom,
      revisionReason,
      // optional custom overrides
      basicSalary,
      hra,
      specialAllowance,
      otherAllowances,
      pfDeduction,
      esiDeduction,
      professionalTax,
      tdsMonthly,
    } = body;

    const targetUserId = Number(userId);
    if (!targetUserId) {
      return NextResponse.json({ error: "Employee userId is required" }, { status: 400 });
    }

    const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!targetUser) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    let template = null;
    if (templateId) {
      template = await prisma.salaryStructureTemplate.findUnique({ where: { id: templateId } });
      if (!template) {
        return NextResponse.json({ error: "Selected salary structure template not found" }, { status: 404 });
      }
    }

    // Determine monthly gross in paise
    let finalGrossPaise = 0;
    if (monthlyGross !== undefined && monthlyGross !== null) {
      // If <= 100,000, likely in rupees; if large, might be paise.
      // Let's adopt standard: if client passes in rupees (e.g. 50000), multiply by 100
      finalGrossPaise = Math.round(Number(monthlyGross) > 1000000 ? Number(monthlyGross) : Number(monthlyGross) * 100);
    } else if (annualCtc !== undefined && annualCtc !== null) {
      const ctcPaise = Math.round(Number(annualCtc) > 10000000 ? Number(annualCtc) : Number(annualCtc) * 100);
      finalGrossPaise = Math.round(ctcPaise / 12);
    } else if (basicSalary !== undefined) {
      const b = Number(basicSalary) * (Number(basicSalary) < 1000000 ? 100 : 1);
      const h = Number(hra || 0) * (Number(hra || 0) < 1000000 ? 100 : 1);
      const s = Number(specialAllowance || 0) * (Number(specialAllowance || 0) < 1000000 ? 100 : 1);
      const o = Number(otherAllowances || 0) * (Number(otherAllowances || 0) < 1000000 ? 100 : 1);
      finalGrossPaise = b + h + s + o;
    }

    if (finalGrossPaise <= 0) {
      return NextResponse.json({ error: "A valid positive salary amount (CTC or Monthly Gross) is required" }, { status: 400 });
    }

    // Compute components from template or overrides
    let compBasic = 0;
    let compHra = 0;
    let compSpecial = 0;
    let compOther = 0;
    let compPf = template ? template.pfApplicable : true;
    let compEsi = template ? template.esiApplicable : false;
    let compPt = template ? template.professionalTax : true;

    if (template && basicSalary === undefined) {
      compBasic = Math.round(finalGrossPaise * (template.basicPercentage / 100));
      compHra = Math.round(finalGrossPaise * (template.hraPercentage / 100));
      compSpecial = Math.round(finalGrossPaise * (template.specialPercentage / 100));
      compOther = Math.max(0, finalGrossPaise - (compBasic + compHra + compSpecial));
    } else {
      compBasic = Math.round(Number(basicSalary || 0) * (Number(basicSalary || 0) < 1000000 ? 100 : 1));
      compHra = Math.round(Number(hra || 0) * (Number(hra || 0) < 1000000 ? 100 : 1));
      compSpecial = Math.round(Number(specialAllowance || 0) * (Number(specialAllowance || 0) < 1000000 ? 100 : 1));
      compOther = Math.round(Number(otherAllowances || 0) * (Number(otherAllowances || 0) < 1000000 ? 100 : 1));
    }

    if (pfDeduction !== undefined) compPf = Boolean(pfDeduction);
    if (esiDeduction !== undefined) compEsi = Boolean(esiDeduction);
    if (professionalTax !== undefined) compPt = Boolean(professionalTax);

    const compTds = Math.round(Number(tdsMonthly || 0) * (Number(tdsMonthly || 0) < 1000000 ? 100 : 1));

    const result = await PayrollService.upsertSalaryStructure({
      userId: targetUserId,
      templateId: template?.id,
      basicSalary: compBasic,
      hra: compHra,
      specialAllowance: compSpecial,
      otherAllowances: compOther,
      pfDeduction: compPf,
      esiDeduction: compEsi,
      professionalTax: compPt,
      tdsMonthly: compTds,
      effectiveFrom: effectiveFrom ? new Date(effectiveFrom) : new Date(),
      revisionReason: revisionReason || (template ? `Assigned structure: ${template.name}` : "Salary structure assignment"),
      actorUserId: Number(session.user.id),
    });

    return NextResponse.json({
      success: true,
      structure: result,
      employeeName: targetUser.name,
      templateName: template?.name || "Custom Structure",
    }, { status: 200 });
  } catch (error: any) {
    console.error("POST /api/payroll/structures/assign error:", error);
    return NextResponse.json({ error: error.message || "Failed to assign salary structure" }, { status: 500 });
  }
}
