import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { PayrollService } from "@/lib/payroll/payroll-service";
import { requireCan } from "@/lib/api-auth";
import { monthlyGrossFromProfile, profileSalaryProblem } from "@/lib/payroll/salary-basis";

export const dynamic = "force-dynamic";

/**
 * Employees with the salary from their HR profile and the structure they are on: what
 * the assign screen needs to show each person's split before saving. `/api/users` does
 * not carry salary, which is why that screen used to show "Not Set" for everyone and
 * ask for the amount again.
 */
export async function GET() {
  const auth = await requireCan("salary", "read");
  if (!auth.ok) return auth.response;

  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      email: true,
      avatar: true,
      designation: true,
      department: true,
      currentSalary: true,
      salaryFrequency: true,
      bankName: true,
      bankAccountNumber: true,
      salaryStructures: {
        where: { status: "ACTIVE" },
        orderBy: { effectiveFrom: "desc" },
        take: 1,
        select: { monthlyGross: true, template: { select: { id: true, name: true } } },
      },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(
    users.map(({ salaryStructures, currentSalary, bankAccountNumber, ...u }) => ({
      ...u,
      // The last four digits are enough to see an account is on file.
      bankLast4: bankAccountNumber ? bankAccountNumber.slice(-4) : null,
      id: String(u.id),
      currentSalary: currentSalary == null ? null : Number(currentSalary),
      monthlyGross: monthlyGrossFromProfile(currentSalary, u.salaryFrequency),
      salaryProblem: profileSalaryProblem(currentSalary, u.salaryFrequency),
      structure: salaryStructures[0]
        ? { monthlyGross: salaryStructures[0].monthlyGross / 100, template: salaryStructures[0].template }
        : null,
    })),
  );
}

const AssignBody = z.object({
  userIds: z.array(z.coerce.number().int().positive()).min(1, "Select at least one employee").max(500).optional(),
  userId: z.coerce.number().int().positive().optional(),
  templateId: z.string().min(1, "Choose a salary structure template").max(64),
  effectiveFrom: z.string().date().optional(),
  revisionReason: z.string().trim().max(200).optional(),
});

/**
 * Assigns a template to one or more employees. Each one's components come from their
 * own HR-profile salary; the request carries no amounts, so a team assigned together no
 * longer all receive the first person's salary.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireCan("salary", "update");
    if (!auth.ok) return auth.response;

    const parsed = AssignBody.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 422 });
    }
    const { userIds, userId, templateId, effectiveFrom, revisionReason } = parsed.data;
    const targetUserIds = [...new Set(userIds ?? (userId ? [userId] : []))];
    if (targetUserIds.length === 0) {
      return NextResponse.json({ error: "Select at least one employee to assign this structure to" }, { status: 422 });
    }

    const template = await prisma.salaryStructureTemplate.findFirst({ where: { id: templateId, isActive: true } });
    if (!template) {
      return NextResponse.json({ error: "Selected salary structure template not found" }, { status: 404 });
    }

    const targetUsers = await prisma.user.findMany({
      where: { id: { in: targetUserIds } },
      select: { id: true, name: true },
    });
    if (targetUsers.length !== targetUserIds.length) {
      const found = new Set(targetUsers.map((u) => u.id));
      return NextResponse.json(
        { error: `Employee not found: ${targetUserIds.filter((id) => !found.has(id)).join(", ")}` },
        { status: 404 },
      );
    }

    /**
     * Each employee is assigned in turn rather than in one transaction: a structure is
     * per-person history, so one failure must not roll back the people it already
     * worked for. Failures are reported per employee instead of as a single 500.
     */
    const assigned: { userId: number; name: string | null; structureId: string; monthlyGross: number }[] = [];
    const failed: { userId: number; name: string | null; error: string }[] = [];

    for (const target of targetUsers) {
      try {
        const result = await PayrollService.assignStructureFromProfile({
          userId: target.id,
          templateId: template.id,
          effectiveFrom: effectiveFrom ? new Date(effectiveFrom) : new Date(),
          revisionReason: revisionReason || `Assigned structure: ${template.name}`,
          actorUserId: auth.userId,
        });
        assigned.push({ userId: target.id, name: target.name, structureId: result.id, monthlyGross: result.monthlyGross / 100 });
      } catch (error: any) {
        failed.push({ userId: target.id, name: target.name, error: error?.message || "Could not assign" });
      }
    }

    if (assigned.length === 0) {
      return NextResponse.json({ error: failed[0]?.error || "Could not assign the structure", failed }, { status: 422 });
    }

    return NextResponse.json(
      {
        success: true,
        assigned,
        failed,
        count: assigned.length,
        templateName: template.name,
        message:
          assigned.length === 1
            ? `${template.name} assigned to ${assigned[0].name ?? "the employee"}`
            : `${template.name} assigned to ${assigned.length} employees`,
      },
      { status: failed.length > 0 ? 207 : 200 },
    );
  } catch (error) {
    console.error("POST /api/payroll/structures/assign error:", error);
    return NextResponse.json({ error: "Failed to assign salary structure" }, { status: 500 });
  }
}
