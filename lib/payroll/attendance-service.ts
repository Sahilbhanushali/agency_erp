import { prisma } from "@/lib/prisma";
import { AttendanceStatus, AttendanceSource, RegularizationStatus } from "@prisma/client";
import { getAttendanceProvider, AttendanceSyncResult, RawAttendanceRecord } from "./attendance-provider";
import { evaluateDayStatus } from "./daily-status-engine";
import { MonthlyAttendanceSummary, PayrollSettingsData } from "./types";
import { getDaysInMonth } from "./calculation-engine";

export class AttendanceService {
  /**
   * Syncs attendance records for all active users across a date range.
   * Uses configurable AttendanceProvider (Mock, Manual CSV, or Biometric API).
   * Employs DailyStatusEngine and writes a batch log to AttendanceSyncLog.
   */
  static async syncAttendanceRange(
    startDate: Date,
    endDate: Date,
    actorUserId?: number,
    providerType?: string
  ): Promise<AttendanceSyncResult> {
    const provider = getAttendanceProvider(providerType);
    const batchId = `sync_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const startIso = startDate.toISOString().split("T")[0];
    const endIso = endDate.toISOString().split("T")[0];

    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        shift: true,
        weeklyOffPattern: true,
      },
    });

    if (users.length === 0) {
      return {
        batchId,
        provider: provider.name,
        startDate: startIso,
        endDate: endIso,
        totalRecords: 0,
        syncedCount: 0,
        skippedCount: 0,
        errorCount: 0,
        errors: [],
      };
    }

    const errors: Array<{ employeeId?: number; date?: string; error: string }> = [];
    let rawRecords: RawAttendanceRecord[] = [];

    try {
      rawRecords = await provider.fetchRangeAttendance(
        startDate,
        endDate,
        users.map((u) => ({ id: u.id, email: u.email, name: u.name }))
      );
    } catch (err: any) {
      await prisma.attendanceSyncLog.create({
        data: {
          provider: provider.name,
          batchId,
          syncDateStart: startDate,
          syncDateEnd: endDate,
          status: "FAILED",
          totalRecords: 0,
          syncedCount: 0,
          errorCount: 1,
          errorMessage: err.message,
          triggeredById: actorUserId,
        },
      });
      throw err;
    }

    // Pre-fetch approved leaves in this range
    const approvedLeaves = await prisma.leaveRequest.findMany({
      where: {
        status: "APPROVED",
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
      include: { leaveType: true },
    });

    // Pre-fetch holidays in this range
    const holidays = await prisma.holiday.findMany({
      where: {
        date: { gte: startDate, lte: endDate },
      },
    });
    const holidayMap = new Map(holidays.map((h) => [h.date.toISOString().split("T")[0], h.name]));

    // Fetch active leave policy for sandwich rule
    const leavePolicy = await prisma.leavePolicy.findFirst({
      orderBy: { effectiveFrom: "desc" },
    });

    let syncedCount = 0;
    let skippedCount = 0;

    for (const record of rawRecords) {
      try {
        const recordDate = new Date(`${record.date}T00:00:00.000Z`);
        const user = users.find((u) => u.id === record.employeeId);
        if (!user) continue;

        // Check if date is a holiday
        const isHoliday = holidayMap.has(record.date);
        const holidayName = holidayMap.get(record.date);

        // Check weekly off pattern (Default: Sunday=0)
        let isWeeklyOff = recordDate.getUTCDay() === 0;
        if (user.weeklyOffPattern?.patternJson) {
          try {
            const pattern = JSON.parse(user.weeklyOffPattern.patternJson);
            const dayOfWeek = recordDate.getUTCDay().toString();
            if (pattern[dayOfWeek] === true) isWeeklyOff = true;
          } catch {}
        }

        // Check approved leave
        const leave = approvedLeaves.find(
          (l) =>
            l.userId === record.employeeId &&
            recordDate >= new Date(l.startDate.toISOString().split("T")[0] + "T00:00:00.000Z") &&
            recordDate <= new Date(l.endDate.toISOString().split("T")[0] + "T00:00:00.000Z")
        );

        // Check existing record to avoid overwriting manual HR corrections
        const existing = await prisma.attendance.findUnique({
          where: {
            userId_date: {
              userId: record.employeeId,
              date: recordDate,
            },
          },
        });

        // Conflict Resolution: HR Manual Correction or Approved Regularization beats incoming API punches
        const isManual = existing?.isCorrected ?? false;
        const isRegularized = !!existing?.regularizationApprovedById;

        const evaluated = evaluateDayStatus({
          date: recordDate,
          checkIn: record.checkIn,
          checkOut: record.checkOut,
          shift: user.shift
            ? {
                startTime: user.shift.startTime,
                endTime: user.shift.endTime,
                graceMinutes: user.shift.graceMinutes,
                halfDayMinutes: user.shift.halfDayMinutes,
                fullDayMinutes: user.shift.fullDayMinutes,
                isNightShift: user.shift.isNightShift,
              }
            : undefined,
          isWeeklyOff,
          isHoliday,
          holidayName,
          approvedLeave: leave
            ? {
                isPaid: leave.leaveType.isPaid,
                isHalfDay: leave.isHalfDay,
                halfDaySession: leave.halfDaySession,
                leaveTypeCode: leave.leaveType.code,
              }
            : null,
          sandwichRuleEnabled: leavePolicy?.sandwichRuleEnabled ?? false,
          isManualCorrection: isManual,
          manualStatus: isManual ? existing?.status : undefined,
          isApprovedRegularization: isRegularized,
          regularizationStatus: isRegularized ? existing?.status : undefined,
        });

        if (isManual || isRegularized) {
          skippedCount++;
          continue;
        }

        await prisma.attendance.upsert({
          where: {
            userId_date: {
              userId: record.employeeId,
              date: recordDate,
            },
          },
          create: {
            userId: record.employeeId,
            date: recordDate,
            checkIn: record.checkIn,
            checkOut: record.checkOut,
            totalHours: evaluated.totalHours,
            workedMinutes: evaluated.workedMinutes,
            status: evaluated.status,
            lateMinutes: evaluated.lateMinutes,
            earlyExitMinutes: evaluated.earlyExitMinutes,
            overtimeHours: evaluated.overtimeHours,
            source: record.source,
            externalRef: record.externalRef,
          },
          update: {
            checkIn: record.checkIn,
            checkOut: record.checkOut,
            totalHours: evaluated.totalHours,
            workedMinutes: evaluated.workedMinutes,
            status: evaluated.status,
            lateMinutes: evaluated.lateMinutes,
            earlyExitMinutes: evaluated.earlyExitMinutes,
            overtimeHours: evaluated.overtimeHours,
            source: record.source,
            externalRef: record.externalRef,
          },
        });

        syncedCount++;
      } catch (rowErr: any) {
        errors.push({
          employeeId: record.employeeId,
          date: record.date,
          error: rowErr.message,
        });
      }
    }

    const syncStatus = errors.length > 0 && syncedCount === 0 ? "FAILED" : errors.length > 0 ? "PARTIAL" : "SUCCESS";

    await prisma.attendanceSyncLog.create({
      data: {
        provider: provider.name,
        batchId,
        syncDateStart: startDate,
        syncDateEnd: endDate,
        status: syncStatus,
        totalRecords: rawRecords.length,
        syncedCount,
        errorCount: errors.length,
        errorMessage: errors.length > 0 ? `${errors.length} records encountered errors` : null,
        detailsJson: errors.length > 0 ? JSON.stringify(errors) : null,
        triggeredById: actorUserId,
      },
    });

    return {
      batchId,
      provider: provider.name,
      startDate: startIso,
      endDate: endIso,
      totalRecords: rawRecords.length,
      syncedCount,
      skippedCount,
      errorCount: errors.length,
      errors,
    };
  }

  /**
   * Compiles monthly attendance summary for an employee.
   */
  static async getMonthlySummary(
    userId: number,
    month: number, // 1-12
    year: number,
    settings: PayrollSettingsData
  ): Promise<MonthlyAttendanceSummary> {
    const calendarDays = getDaysInMonth(year, month);
    const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
    const endDate = new Date(Date.UTC(year, month - 1, calendarDays, 23, 59, 59));

    const [user, records, approvedLeaves] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        include: { weeklyOffPattern: true },
      }),
      prisma.attendance.findMany({
        where: {
          userId,
          date: { gte: startDate, lte: endDate },
        },
      }),
      prisma.leaveRequest.findMany({
        where: {
          userId,
          status: "APPROVED",
          startDate: { lte: endDate },
          endDate: { gte: startDate },
        },
        include: { leaveType: true },
      }),
    ]);

    let presentDays = 0;
    let absentDays = 0;
    let halfDays = 0;
    let paidLeaveDays = 0;
    let unpaidLeaveDays = 0;
    let weeklyOffDays = 0;
    let holidayDays = 0;
    let lateCount = 0;
    let totalLateMinutes = 0;
    let totalOvertimeHours = 0;

    const recordMap = new Map<string, (typeof records)[0]>();
    for (const r of records) {
      recordMap.set(r.date.toISOString().split("T")[0], r);
    }

    // Weekly off check
    let customPattern: Record<string, any> | null = null;
    if (user?.weeklyOffPattern?.patternJson) {
      try {
        customPattern = JSON.parse(user.weeklyOffPattern.patternJson);
      } catch {}
    }

    for (let day = 1; day <= calendarDays; day++) {
      const currentDate = new Date(Date.UTC(year, month - 1, day));
      const dateStr = currentDate.toISOString().split("T")[0];
      const dayOfWeek = currentDate.getUTCDay();

      const att = recordMap.get(dateStr);

      if (att) {
        if (att.status === "PRESENT") presentDays++;
        else if (att.status === "LATE") {
          presentDays++;
          lateCount++;
          totalLateMinutes += att.lateMinutes;
        } else if (att.status === "HALF_DAY") {
          halfDays++;
        } else if (att.status === "ABSENT") {
          absentDays++;
        } else if (att.status === "WEEKLY_OFF") {
          weeklyOffDays++;
        } else if (att.status === "HOLIDAY") {
          holidayDays++;
        } else if (att.status === "ON_LEAVE") {
          const leave = approvedLeaves.find(
            (l) =>
              currentDate >= new Date(l.startDate.toISOString().split("T")[0]) &&
              currentDate <= new Date(l.endDate.toISOString().split("T")[0])
          );
          if (leave && !leave.leaveType.isPaid) {
            unpaidLeaveDays++;
          } else {
            paidLeaveDays++;
          }
        }

        totalOvertimeHours += att.overtimeHours || 0;
      } else {
        // Fallback for dates without punches
        let isWeeklyOff = settings.weeklyOffDays.includes(dayOfWeek);
        if (customPattern && customPattern[dayOfWeek.toString()] === true) {
          isWeeklyOff = true;
        }

        if (isWeeklyOff) {
          weeklyOffDays++;
        } else {
          // Absent if in the past
          if (currentDate <= new Date()) {
            absentDays++;
          }
        }
      }
    }

    const standardWorkingDays = calendarDays - weeklyOffDays - holidayDays;

    return {
      userId,
      month,
      year,
      calendarDays,
      weeklyOffDays,
      holidayDays,
      standardWorkingDays,
      presentDays,
      absentDays,
      halfDays,
      paidLeaveDays,
      unpaidLeaveDays,
      lateCount,
      totalLateMinutes,
      totalOvertimeHours: parseFloat(totalOvertimeHours.toFixed(2)),
    };
  }

  /**
   * Direct manual correction by HR / Admin with audit trail.
   */
  static async correctAttendance({
    attendanceId,
    status,
    checkIn,
    checkOut,
    reason,
    actorUserId,
  }: {
    attendanceId: string;
    status: AttendanceStatus;
    checkIn?: Date | null;
    checkOut?: Date | null;
    reason: string;
    actorUserId: number;
  }) {
    let workedMinutes = 0;
    let totalHours = 0;
    if (checkIn && checkOut && new Date(checkOut) > new Date(checkIn)) {
      workedMinutes = Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 60000);
      totalHours = parseFloat((workedMinutes / 60).toFixed(2));
    }

    return prisma.attendance.update({
      where: { id: attendanceId },
      data: {
        status,
        checkIn: checkIn ? new Date(checkIn) : undefined,
        checkOut: checkOut ? new Date(checkOut) : undefined,
        workedMinutes: workedMinutes > 0 ? workedMinutes : undefined,
        totalHours: totalHours > 0 ? totalHours : undefined,
        isCorrected: true,
        correctionReason: reason,
        correctedById: actorUserId,
        correctedAt: new Date(),
        source: AttendanceSource.MANUAL,
      },
    });
  }

  /**
   * Request attendance regularization by employee.
   */
  static async requestRegularization({
    userId,
    attendanceId,
    date,
    requestedCheckIn,
    requestedCheckOut,
    requestedStatus = "PRESENT",
    reason,
  }: {
    userId: number;
    attendanceId?: string;
    date: Date;
    requestedCheckIn?: Date;
    requestedCheckOut?: Date;
    requestedStatus?: AttendanceStatus;
    reason: string;
  }) {
    return prisma.attendanceRegularization.create({
      data: {
        userId,
        attendanceId,
        date: new Date(date),
        requestedCheckIn: requestedCheckIn ? new Date(requestedCheckIn) : undefined,
        requestedCheckOut: requestedCheckOut ? new Date(requestedCheckOut) : undefined,
        requestedStatus,
        reason,
        status: RegularizationStatus.PENDING,
      },
    });
  }

  /**
   * HR review for regularization request.
   */
  static async reviewRegularization({
    regularizationId,
    status,
    remarks,
    reviewerId,
  }: {
    regularizationId: string;
    status: "APPROVED" | "REJECTED";
    remarks?: string;
    reviewerId: number;
  }) {
    const reg = await prisma.attendanceRegularization.findUnique({
      where: { id: regularizationId },
    });

    if (!reg) throw new Error("Regularization request not found");
    if (reg.userId === reviewerId) {
      throw new Error("Self-approval is not permitted. Regularization must be reviewed by another manager or HR administrator");
    }

    const updated = await prisma.attendanceRegularization.update({
      where: { id: regularizationId },
      data: {
        status,
        reviewerRemarks: remarks,
        reviewedById: reviewerId,
        reviewedAt: new Date(),
      },
    });

    if (status === "APPROVED") {
      const regDate = new Date(reg.date.toISOString().split("T")[0] + "T00:00:00.000Z");
      let workedMinutes = 480; // default 8 hours
      let totalHours = 8.0;

      if (reg.requestedCheckIn && reg.requestedCheckOut) {
        workedMinutes = Math.round(
          (new Date(reg.requestedCheckOut).getTime() - new Date(reg.requestedCheckIn).getTime()) / 60000
        );
        totalHours = parseFloat((workedMinutes / 60).toFixed(2));
      }

      await prisma.attendance.upsert({
        where: {
          userId_date: {
            userId: reg.userId,
            date: regDate,
          },
        },
        create: {
          userId: reg.userId,
          date: regDate,
          checkIn: reg.requestedCheckIn,
          checkOut: reg.requestedCheckOut,
          status: reg.requestedStatus,
          workedMinutes,
          totalHours,
          regularizationReason: `Regularization Approved: ${remarks || reg.reason}`,
          regularizationApprovedById: reviewerId,
          isCorrected: true,
          correctedById: reviewerId,
          correctedAt: new Date(),
          source: AttendanceSource.MANUAL,
        },
        update: {
          checkIn: reg.requestedCheckIn,
          checkOut: reg.requestedCheckOut,
          status: reg.requestedStatus,
          workedMinutes,
          totalHours,
          regularizationReason: `Regularization Approved: ${remarks || reg.reason}`,
          regularizationApprovedById: reviewerId,
          isCorrected: true,
          correctedById: reviewerId,
          correctedAt: new Date(),
          source: AttendanceSource.MANUAL,
        },
      });
    }

    return updated;
  }
}
