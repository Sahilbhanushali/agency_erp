import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireCan } from "@/lib/api-auth";
import { logAuditAction } from "@/lib/audit";
import { LeaveService } from "@/lib/payroll/leave-service";
import { clientIp } from "@/lib/rate-limit"

export const dynamic = "force-dynamic";

const schema = z
  .object({
    userId: z.coerce.number().int().positive(),
    leaveTypeId: z.string().min(1).max(64),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    isHalfDay: z.boolean().default(false),
    halfDaySession: z.enum(["FIRST_HALF", "SECOND_HALF"]).optional(),
    reason: z.string().trim().min(3, "Give a reason").max(1000),
  })
  .refine((v) => v.endDate >= v.startDate, { message: "The end date is before the start date" })
  .refine((v) => !v.isHalfDay || v.startDate === v.endDate, { message: "A half day is a single date" });

/**
 * Records leave an employee took, on their behalf — they were off and never applied,
 * or HR is entering it for them. Goes through the same path as an approved request:
 * the balance is charged, the ledger written and attendance marked ON_LEAVE, so
 * payroll sees it exactly as it would a request the employee filed.
 *
 * If the balance is short, the request becomes Unpaid Leave, as it would for them.
 */
export async function POST(request: NextRequest) {
  const auth = await requireCan("leaves", "approve");
  if (!auth.ok) return auth.response;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid leave" }, { status: 422 });
  }
  const input = parsed.data;
  if (input.userId === auth.userId) {
    return NextResponse.json({ error: "Record your own leave by applying for it; someone else approves it." }, { status: 403 });
  }

  const employee = await prisma.user.findUnique({ where: { id: input.userId }, select: { id: true, name: true } });
  if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

  let requestId: string | null = null;
  try {
    const filed = await LeaveService.applyLeave({
      userId: input.userId,
      leaveTypeId: input.leaveTypeId,
      startDate: new Date(`${input.startDate}T00:00:00.000Z`),
      endDate: new Date(`${input.endDate}T00:00:00.000Z`),
      isHalfDay: input.isHalfDay,
      halfDaySession: input.isHalfDay ? input.halfDaySession ?? "FIRST_HALF" : undefined,
      reason: `${input.reason} (recorded by HR)`,
    });
    requestId = filed.id;
    const approved = await LeaveService.reviewLeave({
      leaveRequestId: filed.id,
      status: "APPROVED",
      approverId: auth.userId,
      remarks: "Recorded by HR on the employee's behalf",
    });

    await logAuditAction({
      userId: String(auth.userId),
      action: "LEAVE_RECORDED_FOR_EMPLOYEE",
      entityType: "LeaveRequest",
      entityId: approved.id,
      newValues: JSON.stringify({ employee: employee.name, leaveType: approved.leaveType.name, ...input }),
      ipAddress: clientIp(request.headers) || "unknown",
      userAgent: request.headers.get("user-agent") || "unknown",
    });

    await prisma.notification
      .create({
        data: {
          userId: employee.id,
          title: "Leave recorded for you",
          message: `${approved.totalDays} day${approved.totalDays === 1 ? "" : "s"} of ${approved.leaveType.name} from ${input.startDate}${input.endDate !== input.startDate ? ` to ${input.endDate}` : ""}: ${input.reason}.`,
          link: "/dashboard/attendance",
        },
      })
      .catch((error) => console.error("[leaves/record] notify failed", error));

    return NextResponse.json(
      {
        ...approved,
        // Tell HR when the balance ran short and it was booked as unpaid.
        convertedToUnpaid: approved.leaveTypeId !== input.leaveTypeId,
      },
      { status: 201 }
    );
  } catch (error) {
    // Filed but not approved: do not leave a pending request behind.
    if (requestId) await prisma.leaveRequest.delete({ where: { id: requestId } }).catch(() => {});
    const message = error instanceof Error ? error.message : "";
    // applyLeave/reviewLeave throw plain Errors for rule breaks (overlap, dates).
    if (/overlap|earlier than|not found|Insufficient/i.test(message)) {
      return NextResponse.json({ error: message }, { status: 409 });
    }
    console.error("POST /api/leaves/record error:", error);
    return NextResponse.json({ error: "Could not record the leave" }, { status: 500 });
  }
}
