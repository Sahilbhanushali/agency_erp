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
      userIds,
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

    /**
     * One structure, any number of employees.
     *
     * `userIds` assigns the same structure to several people in one go — the usual case
     * when a band or grade applies to a whole team. `userId` is still accepted so the
     * single-employee form keeps working unchanged. The amounts are computed once below
     * and applied to everyone, which is what "the same structure" has to mean.
     */
    const rawIds: unknown[] = Array.isArray(userIds)
      ? userIds
      : userId !== undefined && userId !== null
        ? [userId]
        : [];

    const targetUserIds = Array.from(
      new Set(rawIds.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0)),
    );

    if (targetUserIds.length === 0) {
      return NextResponse.json(
        { error: "Select at least one employee to assign this structure to" },
        { status: 400 },
      );
    }

    const targetUsers = await prisma.user.findMany({
      where: { id: { in: targetUserIds } },
      select: { id: true, name: true, email: true },
    });

    if (targetUsers.length !== targetUserIds.length) {
      const found = new Set(targetUsers.map((u) => u.id));
      return NextResponse.json(
        { error: `Employee not found: ${targetUserIds.filter((id) => !found.has(id)).join(", ")}` },
        { status: 404 },
      );
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

    /**
     * Each employee is assigned in turn rather than in one transaction: a structure is
     * per-person history, so one failure must not roll back the people it already
     * worked for. Failures are reported per employee instead of as a single 500.
     */
    const assigned: { userId: number; name: string | null; structureId: string }[] = [];
    const failed: { userId: number; name: string | null; error: string }[] = [];

    for (const target of targetUsers) {
      try {
        const result = await PayrollService.upsertSalaryStructure({
          userId: target.id,
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
          revisionReason:
            revisionReason ||
            (template ? `Assigned structure: ${template.name}` : "Salary structure assignment"),
          actorUserId: Number(session.user.id),
        });
        assigned.push({ userId: target.id, name: target.name, structureId: (result as any)?.id });
      } catch (error: any) {
        console.error(`[structures/assign] user ${target.id} failed:`, error);
        failed.push({
          userId: target.id,
          name: target.name,
          error: error?.message || "Could not assign",
        });
      }
    }

    const templateName = template?.name || "Custom Structure";

    // Nothing landed at all — that is a failure, not a partial success.
    if (assigned.length === 0) {
      return NextResponse.json(
        { error: failed[0]?.error || "Could not assign the structure", failed },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      assigned,
      failed,
      count: assigned.length,
      templateName,
      // Kept so the existing single-employee form reads the same fields as before.
      structure: assigned.length === 1 ? assigned[0] : undefined,
      employeeName: assigned.length === 1 ? assigned[0].name : undefined,
      message:
        assigned.length === 1
          ? `${templateName} assigned to ${assigned[0].name ?? "the employee"}`
          : `${templateName} assigned to ${assigned.length} employees`,
    }, { status: failed.length > 0 ? 207 : 200 });
  } catch (error: any) {
    console.error("POST /api/payroll/structures/assign error:", error);
    return NextResponse.json({ error: error.message || "Failed to assign salary structure" }, { status: 500 });
  }
}
