import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireCan } from "@/lib/api-auth";
import { logAuditAction } from "@/lib/audit";
import { LeaveRuleError, LeaveService } from "@/lib/payroll/leave-service";
import { clientIp } from "@/lib/rate-limit"

export const dynamic = "force-dynamic";

const yearSchema = z.coerce.number().int().min(2000).max(2100);

/** An employee's leave history for a year: grants, adjustments, leave taken, reversals. */
export async function GET(request: NextRequest) {
  const auth = await requireCan("leaves", "read");
  if (!auth.ok) return auth.response;

  const sp = request.nextUrl.searchParams;
  const userId = z.coerce.number().int().positive().safeParse(sp.get("userId"));
  const year = yearSchema.safeParse(sp.get("year") ?? new Date().getFullYear());
  if (!userId.success || !year.success) {
    return NextResponse.json({ error: "Choose an employee and a year" }, { status: 400 });
  }

  const entries = await prisma.leaveLedger.findMany({
    where: {
      userId: userId.data,
      effectiveDate: { gte: new Date(Date.UTC(year.data, 0, 1)), lt: new Date(Date.UTC(year.data + 1, 0, 1)) },
    },
    select: {
      id: true,
      entryType: true,
      days: true,
      balanceAfter: true,
      notes: true,
      referenceId: true,
      effectiveDate: true,
      createdAt: true,
      leaveType: { select: { name: true, code: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  // Who made each manual adjustment, resolved in one query.
  const actorIds = [
    ...new Set(
      entries
        .map((e) => (e.referenceId?.startsWith("adjusted-by:") ? Number(e.referenceId.slice(12)) : NaN))
        .filter((n) => Number.isInteger(n))
    ),
  ];
  const actors = actorIds.length
    ? await prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true } })
    : [];
  const nameOf = new Map(actors.map((a) => [a.id, a.name]));

  return NextResponse.json({
    entries: entries.map(({ referenceId, ...e }) => ({
      ...e,
      by: referenceId?.startsWith("adjusted-by:") ? (nameOf.get(Number(referenceId.slice(12))) ?? null) : null,
    })),
  });
}

const adjustSchema = z.object({
  userId: z.coerce.number().int().positive(),
  leaveTypeId: z.string().min(1).max(64),
  year: yearSchema,
  // Half days allowed; zero is not a change.
  days: z
    .number()
    .refine((d) => d !== 0, "Enter how many days to add or take away")
    .refine((d) => Math.abs(d) <= 365, "That is more than a year of leave")
    .refine((d) => Number.isInteger(d * 2), "Use whole or half days"),
  reason: z.string().trim().min(3, "Give a reason — it is kept in the leave history").max(500),
});

/** Add days to, or take days from, an employee's leave balance. */
export async function POST(request: NextRequest) {
  const auth = await requireCan("leaves", "update");
  if (!auth.ok) return auth.response;

  const parsed = adjustSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid adjustment" }, { status: 422 });
  }
  const input = parsed.data;

  const employee = await prisma.user.findUnique({ where: { id: input.userId }, select: { id: true, name: true } });
  if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

  try {
    const balance = await LeaveService.adjustBalance({ ...input, actorId: auth.userId });

    await logAuditAction({
      userId: String(auth.userId),
      action: input.days > 0 ? "LEAVE_DAYS_GRANTED" : "LEAVE_DAYS_DEDUCTED",
      entityType: "LeaveBalance",
      entityId: balance.id,
      newValues: JSON.stringify({ employee: employee.name, leaveType: balance.leaveType.name, year: input.year, days: input.days, reason: input.reason, remaining: balance.remainingDays }),
      ipAddress: clientIp(request.headers) || "unknown",
      userAgent: request.headers.get("user-agent") || "unknown",
    });

    if (employee.id !== auth.userId) {
      const n = Math.abs(input.days);
      await prisma.notification
        .create({
          data: {
            userId: employee.id,
            title: input.days > 0 ? "Leave added to your balance" : "Leave removed from your balance",
            message: `${n} ${balance.leaveType.name} day${n === 1 ? "" : "s"} ${input.days > 0 ? "added" : "taken away"}: ${input.reason}. You now have ${balance.remainingDays}.`,
            link: "/dashboard/attendance",
          },
        })
        .catch((error) => console.error("[leaves/adjustments] notify failed", error));
    }

    return NextResponse.json(balance);
  } catch (error) {
    if (error instanceof LeaveRuleError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("POST /api/leaves/adjustments error:", error);
    return NextResponse.json({ error: "Could not adjust the leave balance" }, { status: 500 });
  }
}
