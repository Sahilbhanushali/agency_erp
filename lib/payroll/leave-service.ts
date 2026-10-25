import { prisma } from "@/lib/prisma";
import { AttendanceStatus, AttendanceSource, Prisma } from "@prisma/client";

export const DEFAULT_LEAVE_TYPES = [
  { code: "CL", name: "Casual Leave", yearlyQuota: 12, isPaid: true, carryForwardLimit: 0, description: "Personal and casual reasons" },
  { code: "SL", name: "Sick Leave", yearlyQuota: 6, isPaid: true, carryForwardLimit: 0, description: "Medical emergencies and sickness" },
  { code: "PL", name: "Paid Privilege Leave", yearlyQuota: 15, isPaid: true, carryForwardLimit: 10, description: "Earned / Annual vacation leave" },
  { code: "UL", name: "Unpaid Leave (LWP)", yearlyQuota: 0, isPaid: false, carryForwardLimit: 0, description: "Leave without pay" },
  { code: "COMP", name: "Compensatory Off", yearlyQuota: 0, isPaid: true, carryForwardLimit: 0, description: "Comp-off for weekend work" },
];

export class LeaveService {
  /**
   * Initializes default agency leave types if none exist yet.
   */
  static async initDefaultLeaveTypes() {
    for (const lt of DEFAULT_LEAVE_TYPES) {
      await prisma.leaveType.upsert({
        where: { code: lt.code },
        update: {},
        create: lt,
      });
    }
  }

  /**
   * Retrieves active leave policy for the agency.
   */
  static async getActivePolicy() {
    let policy = await prisma.leavePolicy.findFirst({
      orderBy: { effectiveFrom: "desc" },
    });

    if (!policy) {
      policy = await prisma.leavePolicy.create({
        data: {
          id: "default-agency-leave-policy",
          name: "Standard Agency Leave Policy",
          effectiveFrom: new Date(Date.UTC(2025, 0, 1)),
          sandwichRuleEnabled: false,
          allowNegativeBalance: false,
          probationLeaveAllowed: true,
          encashmentAllowed: true,
          maxCarryForwardDays: 15,
          accrualFrequency: "YEARLY",
          prorateForNewJoiners: true,
        },
      });
    }
    return policy;
  }

  /**
   * Retrieves or initializes leave balances for an employee in a given year.
   */
  static async getUserBalances(userId: number, year: number) {
    await this.initDefaultLeaveTypes();

    const leaveTypes = await prisma.leaveType.findMany({
      where: { isActive: true },
    });

    const balances = [];

    for (const lt of leaveTypes) {
      let balance = await prisma.leaveBalance.findUnique({
        where: {
          userId_leaveTypeId_year: {
            userId,
            leaveTypeId: lt.id,
            year,
          },
        },
      });

      if (!balance) {
        balance = await prisma.leaveBalance.create({
          data: {
            userId,
            leaveTypeId: lt.id,
            year,
            totalQuota: lt.yearlyQuota,
            usedDays: 0,
            pendingDays: 0,
          },
        });

        // Initialize opening ledger entry
        if (lt.yearlyQuota > 0) {
          await prisma.leaveLedger.create({
            data: {
              userId,
              leaveTypeId: lt.id,
              entryType: "ACCRUAL",
              days: lt.yearlyQuota,
              balanceAfter: lt.yearlyQuota,
              notes: `Yearly quota initialized for ${year}`,
              effectiveDate: new Date(Date.UTC(year, 0, 1)),
            },
          });
        }
      }

      balances.push({
        ...balance,
        leaveType: lt,
        remainingDays: Math.max(0, balance.totalQuota - balance.usedDays),
      });
    }

    return balances;
  }

  /**
   * HR adds days to, or takes days from, an employee's leave balance for a year.
   *
   * Changes the entitlement (totalQuota), not usedDays: days granted or withdrawn by
   * HR are not leave taken. To record leave actually taken, file and approve a leave
   * request instead, which also marks attendance. Every change is a ledger ADJUSTMENT
   * with the reason, so the balance can always be explained.
   *
   * Refuses to take away more than remains, so a balance never goes below zero.
   */
  static async adjustBalance({
    userId,
    leaveTypeId,
    year,
    days,
    reason,
    actorId,
  }: {
    userId: number;
    leaveTypeId: string;
    year: number;
    days: number;
    reason: string;
    actorId: number;
  }) {
    const leaveType = await prisma.leaveType.findUnique({ where: { id: leaveTypeId } });
    if (!leaveType) throw new LeaveRuleError("Leave type not found", 404);

    // Creates this year's balance rows on first use, exactly as viewing them would.
    await this.getUserBalances(userId, year);

    return prisma.$transaction(
      async (tx) => {
        const balance = await tx.leaveBalance.findUnique({
          where: { userId_leaveTypeId_year: { userId, leaveTypeId, year } },
        });
        if (!balance) throw new LeaveRuleError("This leave type has no balance for that year", 404);

        const remaining = balance.totalQuota - balance.usedDays;
        if (days < 0 && remaining + days < 0) {
          throw new LeaveRuleError(
            `Only ${remaining} ${leaveType.name} day${remaining === 1 ? "" : "s"} left, so ${-days} cannot be taken away.`,
            409
          );
        }

        const updated = await tx.leaveBalance.update({
          where: { id: balance.id },
          data: { totalQuota: { increment: days } },
        });
        const balanceAfter = updated.totalQuota - updated.usedDays;

        await tx.leaveLedger.create({
          data: {
            userId,
            leaveTypeId,
            entryType: "ADJUSTMENT",
            days,
            balanceAfter,
            referenceId: `adjusted-by:${actorId}`,
            notes: reason,
            effectiveDate: new Date(),
          },
        });

        return { ...updated, leaveType, remainingDays: balanceAfter };
      },
      // Two HR people adjusting the same balance at once must both land.
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted }
    );
  }

  /**
   * Employee applies for a new leave request.
   * Handles policy checks, sandwich deduction check, and auto-conversion to unpaid LOP if balance is exhausted.
   */
  static async applyLeave({
    userId,
    leaveTypeId,
    startDate,
    endDate,
    isHalfDay = false,
    halfDaySession,
    reason,
    attachmentUrl,
  }: {
    userId: number;
    leaveTypeId: string;
    startDate: Date;
    endDate: Date;
    isHalfDay?: boolean;
    halfDaySession?: string;
    reason: string;
    attachmentUrl?: string;
  }) {
    const leaveType = await prisma.leaveType.findUnique({
      where: { id: leaveTypeId },
    });
    if (!leaveType) throw new Error("Leave type not found");

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end < start) throw new Error("End date cannot be earlier than start date");

    // Check for overlapping pending or approved leave requests
    const overlapping = await prisma.leaveRequest.findFirst({
      where: {
        userId,
        status: { in: ["PENDING", "APPROVED"] },
        startDate: { lte: end },
        endDate: { gte: start },
      },
    });
    if (overlapping) {
      throw new Error("An active or pending leave request already exists overlapping these dates");
    }

    const policy = await this.getActivePolicy();

    let totalDays = 0;
    if (isHalfDay) {
      totalDays = 0.5;
    } else {
      const diffMs = end.getTime() - start.getTime();
      totalDays = Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1;
    }

    // Check sandwich-leave condition (e.g. if Friday + Monday absent, weekend included)
    let isSandwich = false;
    if (policy.sandwichRuleEnabled && !isHalfDay) {
      const startDay = start.getDay();
      const endDay = end.getDay();
      if ((startDay === 5 && endDay === 1) || (startDay === 1 && endDay === 5)) {
        isSandwich = true;
      }
    }

    // Check balance for paid leaves
    let finalLeaveTypeId = leaveTypeId;
    if (leaveType.isPaid && leaveType.yearlyQuota > 0) {
      const year = start.getFullYear();
      const balances = await this.getUserBalances(userId, year);
      const userBalance = balances.find((b) => b.leaveTypeId === leaveTypeId);

      if (userBalance && userBalance.remainingDays < totalDays) {
        if (!policy.allowNegativeBalance) {
          // Find Unpaid Leave (UL) type to auto-convert
          const unpaidType = await prisma.leaveType.findUnique({ where: { code: "UL" } });
          if (unpaidType) {
            finalLeaveTypeId = unpaidType.id;
          } else {
            throw new Error(
              `Insufficient ${leaveType.name} balance. Available: ${userBalance.remainingDays} days, Requested: ${totalDays} days`
            );
          }
        }
      }
    }

    const leaveRequest = await prisma.leaveRequest.create({
      data: {
        userId,
        leaveTypeId: finalLeaveTypeId,
        startDate: start,
        endDate: end,
        totalDays,
        isHalfDay,
        halfDaySession,
        isSandwichDeduction: isSandwich,
        reason: isSandwich ? `${reason} (Sandwich rule applied)` : reason,
        attachmentUrl,
        status: "PENDING",
      },
      include: {
        leaveType: true,
      },
    });

    return leaveRequest;
  }

  /**
   * HR or Manager reviews (approves or rejects) a leave request.
   * On approval: executes in transaction, updates LeaveLedger, decrements balance, and syncs Attendance.
   */
  static async reviewLeave({
    leaveRequestId,
    status,
    approverId,
    remarks,
  }: {
    leaveRequestId: string;
    status: "APPROVED" | "REJECTED";
    approverId: number;
    remarks?: string;
  }) {
    const leave = await prisma.leaveRequest.findUnique({
      where: { id: leaveRequestId },
      include: { leaveType: true },
    });
    if (!leave) throw new Error("Leave request not found");
    if (leave.status !== "PENDING") {
      throw new Error(`Leave request has already been ${leave.status.toLowerCase()}`);
    }

    if (leave.userId === approverId) {
      throw new Error("Self-approval is not permitted. Leave requests must be reviewed by another manager or HR administrator");
    }

    const year = leave.startDate.getFullYear();

    return prisma.$transaction(async (tx) => {
      const updated = await tx.leaveRequest.update({
        where: { id: leaveRequestId },
        data: {
          status,
          approverId,
          approverRemarks: remarks,
          approvedAt: new Date(),
        },
        include: { leaveType: true },
      });

      if (status === "APPROVED") {
        // 1. Update Leave Balance
        const currentBalance = await tx.leaveBalance.upsert({
          where: {
            userId_leaveTypeId_year: {
              userId: leave.userId,
              leaveTypeId: leave.leaveTypeId,
              year,
            },
          },
          create: {
            userId: leave.userId,
            leaveTypeId: leave.leaveTypeId,
            year,
            totalQuota: leave.leaveType.yearlyQuota,
            usedDays: leave.totalDays,
          },
          update: {
            usedDays: { increment: leave.totalDays },
          },
        });

        // 2. Add immutable double-entry ledger record
        await tx.leaveLedger.create({
          data: {
            userId: leave.userId,
            leaveTypeId: leave.leaveTypeId,
            entryType: "USAGE",
            days: -leave.totalDays,
            balanceAfter: Math.max(0, currentBalance.totalQuota - currentBalance.usedDays),
            referenceId: leave.id,
            notes: `Approved leave: ${leave.reason}`,
            effectiveDate: leave.startDate,
          },
        });

        // 3. Automatically sync dates to Attendance table
        const current = new Date(leave.startDate);
        const end = new Date(leave.endDate);

        while (current <= end) {
          const attDate = new Date(current.toISOString().split("T")[0] + "T00:00:00.000Z");

          await tx.attendance.upsert({
            where: {
              userId_date: {
                userId: leave.userId,
                date: attDate,
              },
            },
            create: {
              userId: leave.userId,
              date: attDate,
              status: leave.isHalfDay ? AttendanceStatus.HALF_DAY : AttendanceStatus.ON_LEAVE,
              totalHours: leave.isHalfDay ? 4.0 : 0,
              workedMinutes: leave.isHalfDay ? 240 : 0,
              isCorrected: true,
              correctionReason: `Approved Leave: ${leave.leaveType.name}`,
              correctedById: approverId,
              correctedAt: new Date(),
              source: AttendanceSource.SYSTEM,
            },
            update: {
              status: leave.isHalfDay ? AttendanceStatus.HALF_DAY : AttendanceStatus.ON_LEAVE,
              totalHours: leave.isHalfDay ? 4.0 : 0,
              workedMinutes: leave.isHalfDay ? 240 : 0,
              isCorrected: true,
              correctionReason: `Approved Leave: ${leave.leaveType.name}`,
              correctedById: approverId,
              correctedAt: new Date(),
              source: AttendanceSource.SYSTEM,
            },
          });

          current.setDate(current.getDate() + 1);
        }
      }

      return updated;
    });
  }

  /**
   * Reverses or cancels a pending or approved leave request.
   * If approved: Restores balance, creates a REVERSAL ledger entry, and removes attendance override.
   * If pending: Cancels the request cleanly without ledger changes.
   */
  static async cancelLeave({
    leaveRequestId,
    actorUserId,
    reason,
  }: {
    leaveRequestId: string;
    actorUserId: number;
    reason: string;
  }) {
    const leave = await prisma.leaveRequest.findUnique({
      where: { id: leaveRequestId },
      include: { leaveType: true },
    });
    if (!leave) throw new Error("Leave request not found");
    if (!["PENDING", "APPROVED"].includes(leave.status)) {
      throw new Error(`Only pending or approved leave requests can be cancelled (current: ${leave.status})`);
    }

    const year = leave.startDate.getFullYear();

    return prisma.$transaction(async (tx) => {
      const updated = await tx.leaveRequest.update({
        where: { id: leaveRequestId },
        data: {
          status: "CANCELLED",
          approverRemarks: `Cancelled: ${reason}`,
        },
      });

      // If approved, rollback balance, ledger, and attendance records
      if (leave.status === "APPROVED") {
        // 1. Restore balance
        const updatedBalance = await tx.leaveBalance.update({
          where: {
            userId_leaveTypeId_year: {
              userId: leave.userId,
              leaveTypeId: leave.leaveTypeId,
              year,
            },
          },
          data: {
            usedDays: { decrement: leave.totalDays },
          },
        });

        // 2. Credit entry in ledger
        await tx.leaveLedger.create({
          data: {
            userId: leave.userId,
            leaveTypeId: leave.leaveTypeId,
            entryType: "REVERSAL",
            days: leave.totalDays,
            balanceAfter: Math.max(0, updatedBalance.totalQuota - updatedBalance.usedDays),
            referenceId: leave.id,
            notes: `Reversal of leave: ${reason}`,
            effectiveDate: new Date(),
          },
        });

        // 3. Revert attendance records from ON_LEAVE to standard
        const current = new Date(leave.startDate);
        const end = new Date(leave.endDate);
        while (current <= end) {
          const attDate = new Date(current.toISOString().split("T")[0] + "T00:00:00.000Z");
          await tx.attendance.deleteMany({
            where: {
              userId: leave.userId,
              date: attDate,
              isCorrected: true,
              correctionReason: { contains: "Approved Leave" },
            },
          });
          current.setDate(current.getDate() + 1);
        }
      }

      return updated;
    });
  }

  /**
   * Encashment of accumulated privilege leave days.
   */
  static async encashLeaves({
    userId,
    leaveTypeId,
    days,
    actorUserId,
    notes,
  }: {
    userId: number;
    leaveTypeId: string;
    days: number;
    actorUserId: number;
    notes?: string;
  }) {
    const year = new Date().getFullYear();
    const balance = await prisma.leaveBalance.findUnique({
      where: {
        userId_leaveTypeId_year: {
          userId,
          leaveTypeId,
          year,
        },
      },
    });

    if (!balance || balance.totalQuota - balance.usedDays < days) {
      throw new Error("Insufficient leave balance for encashment");
    }

    return prisma.$transaction(async (tx) => {
      const updatedBalance = await tx.leaveBalance.update({
        where: {
          userId_leaveTypeId_year: {
            userId,
            leaveTypeId,
            year,
          },
        },
        data: {
          usedDays: { increment: days },
        },
      });

      await tx.leaveLedger.create({
        data: {
          userId,
          leaveTypeId,
          entryType: "ENCASHMENT",
          days: -days,
          balanceAfter: Math.max(0, updatedBalance.totalQuota - updatedBalance.usedDays),
          notes: notes || `Encashment of ${days} leave days`,
          effectiveDate: new Date(),
        },
      });

      return updatedBalance;
    });
  }
}

/** A leave rule the caller broke, with the HTTP status that says so. */
export class LeaveRuleError extends Error {
  constructor(message: string, readonly status = 422) {
    super(message);
    this.name = "LeaveRuleError";
  }
}
