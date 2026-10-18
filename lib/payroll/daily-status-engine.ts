import { AttendanceStatus } from "@prisma/client";

export interface ShiftConfig {
  startTime: string; // e.g. "09:30"
  endTime: string; // e.g. "18:30"
  graceMinutes: number; // e.g. 15
  halfDayMinutes: number; // e.g. 240
  fullDayMinutes: number; // e.g. 480
  isNightShift?: boolean;
}

export interface DayEvaluationInput {
  date: Date;
  checkIn: Date | null;
  checkOut: Date | null;
  shift?: ShiftConfig;
  isWeeklyOff: boolean;
  isHoliday: boolean;
  holidayName?: string;
  approvedLeave?: {
    isPaid: boolean;
    isHalfDay: boolean;
    halfDaySession?: string | null; // "FIRST_HALF" | "SECOND_HALF"
    leaveTypeCode: string;
  } | null;
  isSandwichCandidate?: boolean;
  sandwichRuleEnabled?: boolean;
  isManualCorrection?: boolean;
  manualStatus?: AttendanceStatus;
  isApprovedRegularization?: boolean;
  regularizationStatus?: AttendanceStatus;
  overtimeEnabled?: boolean;
  overtimeHourlyMultiplier?: number;
}

export interface DayEvaluationResult {
  status: AttendanceStatus;
  workedMinutes: number;
  totalHours: number;
  lateMinutes: number;
  earlyExitMinutes: number;
  overtimeHours: number;
  isSandwichDeduction: boolean;
  remarks: string;
}

/**
 * Parses "HH:mm" time string onto a reference Date.
 */
function timeStringToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
}

function getPunchMinutes(d: Date, refDate: Date): number {
  const isSameUtc =
    d.getUTCFullYear() === refDate.getUTCFullYear() &&
    d.getUTCMonth() === refDate.getUTCMonth() &&
    d.getUTCDate() === refDate.getUTCDate();

  if (isSameUtc) {
    return d.getUTCHours() * 60 + d.getUTCMinutes();
  }
  return d.getHours() * 60 + d.getMinutes();
}

/**
 * Deterministic Daily Status Engine.
 * Evaluates an employee's day status from punches, shifts, weekly-offs,
 * holidays, leaves, sandwich rules, and HR regularizations.
 */
export function evaluateDayStatus(input: DayEvaluationInput): DayEvaluationResult {
  const {
    date,
    checkIn,
    checkOut,
    shift = {
      startTime: "09:30",
      endTime: "18:30",
      graceMinutes: 15,
      halfDayMinutes: 240,
      fullDayMinutes: 480,
    },
    isWeeklyOff,
    isHoliday,
    holidayName,
    approvedLeave,
    isSandwichCandidate = false,
    sandwichRuleEnabled = false,
    isManualCorrection = false,
    manualStatus,
    isApprovedRegularization = false,
    regularizationStatus,
    overtimeEnabled = true,
  } = input;

  // 1. Manual HR correction has top priority
  if (isManualCorrection && manualStatus) {
    let workedMinutes = 0;
    if (checkIn && checkOut && checkOut > checkIn) {
      workedMinutes = Math.round((checkOut.getTime() - checkIn.getTime()) / 60000);
    }
    return {
      status: manualStatus,
      workedMinutes,
      totalHours: parseFloat((workedMinutes / 60).toFixed(2)),
      lateMinutes: 0,
      earlyExitMinutes: 0,
      overtimeHours: 0,
      isSandwichDeduction: false,
      remarks: "Manual HR correction applied",
    };
  }

  // 2. Approved regularization has second priority
  if (isApprovedRegularization && regularizationStatus) {
    let workedMinutes = shift.fullDayMinutes;
    if (checkIn && checkOut && checkOut > checkIn) {
      workedMinutes = Math.round((checkOut.getTime() - checkIn.getTime()) / 60000);
    }
    return {
      status: regularizationStatus,
      workedMinutes,
      totalHours: parseFloat((workedMinutes / 60).toFixed(2)),
      lateMinutes: 0,
      earlyExitMinutes: 0,
      overtimeHours: 0,
      isSandwichDeduction: false,
      remarks: "Approved employee attendance regularization",
    };
  }

  // 3. Approved Leave
  if (approvedLeave) {
    if (approvedLeave.isHalfDay) {
      return {
        status: AttendanceStatus.HALF_DAY,
        workedMinutes: shift.halfDayMinutes,
        totalHours: parseFloat((shift.halfDayMinutes / 60).toFixed(2)),
        lateMinutes: 0,
        earlyExitMinutes: 0,
        overtimeHours: 0,
        isSandwichDeduction: false,
        remarks: `Half-day approved leave (${approvedLeave.leaveTypeCode})`,
      };
    }
    return {
      status: AttendanceStatus.ON_LEAVE,
      workedMinutes: 0,
      totalHours: 0,
      lateMinutes: 0,
      earlyExitMinutes: 0,
      overtimeHours: 0,
      isSandwichDeduction: false,
      remarks: `Approved leave (${approvedLeave.leaveTypeCode})`,
    };
  }

  // 4. Holiday check
  if (isHoliday) {
    // If worked on holiday: eligible for Overtime / Comp-off
    if (checkIn && checkOut && checkOut > checkIn) {
      const workedMinutes = Math.round((checkOut.getTime() - checkIn.getTime()) / 60000);
      const totalHours = parseFloat((workedMinutes / 60).toFixed(2));
      return {
        status: AttendanceStatus.HOLIDAY,
        workedMinutes,
        totalHours,
        lateMinutes: 0,
        earlyExitMinutes: 0,
        overtimeHours: totalHours,
        isSandwichDeduction: false,
        remarks: `Holiday worked: ${holidayName || "Public Holiday"}`,
      };
    }
    return {
      status: AttendanceStatus.HOLIDAY,
      workedMinutes: 0,
      totalHours: 0,
      lateMinutes: 0,
      earlyExitMinutes: 0,
      overtimeHours: 0,
      isSandwichDeduction: false,
      remarks: holidayName || "Official Holiday",
    };
  }

  // 5. Weekly Off check
  if (isWeeklyOff) {
    // If sandwich rule is active and both adjacent working days are absent:
    if (sandwichRuleEnabled && isSandwichCandidate) {
      return {
        status: AttendanceStatus.ABSENT,
        workedMinutes: 0,
        totalHours: 0,
        lateMinutes: 0,
        earlyExitMinutes: 0,
        overtimeHours: 0,
        isSandwichDeduction: true,
        remarks: "Sandwich leave penalty: absent on adjacent working days",
      };
    }

    if (checkIn && checkOut && checkOut > checkIn) {
      const workedMinutes = Math.round((checkOut.getTime() - checkIn.getTime()) / 60000);
      const totalHours = parseFloat((workedMinutes / 60).toFixed(2));
      return {
        status: AttendanceStatus.WEEKLY_OFF,
        workedMinutes,
        totalHours,
        lateMinutes: 0,
        earlyExitMinutes: 0,
        overtimeHours: totalHours,
        isSandwichDeduction: false,
        remarks: "Weekly off worked",
      };
    }

    return {
      status: AttendanceStatus.WEEKLY_OFF,
      workedMinutes: 0,
      totalHours: 0,
      lateMinutes: 0,
      earlyExitMinutes: 0,
      overtimeHours: 0,
      isSandwichDeduction: false,
      remarks: "Weekly Off",
    };
  }

  // 6. Regular Working Day Punch Evaluation
  if (!checkIn || !checkOut || checkOut <= checkIn) {
    return {
      status: AttendanceStatus.ABSENT,
      workedMinutes: 0,
      totalHours: 0,
      lateMinutes: 0,
      earlyExitMinutes: 0,
      overtimeHours: 0,
      isSandwichDeduction: false,
      remarks: !checkIn && !checkOut ? "No punches recorded" : "Missing check-out punch",
    };
  }

  const workedMinutes = Math.round((checkOut.getTime() - checkIn.getTime()) / 60000);
  const totalHours = parseFloat((workedMinutes / 60).toFixed(2));

  // Shift start & end times in minutes from midnight
  const shiftStartMins = timeStringToMinutes(shift.startTime);
  const shiftEndMins = timeStringToMinutes(shift.endTime);
  const shiftGraceEndMins = shiftStartMins + shift.graceMinutes;

  const isOvernight = Boolean(shift.isNightShift || shiftStartMins > shiftEndMins);
  const effectiveShiftEndMins = isOvernight ? shiftEndMins + 1440 : shiftEndMins;

  const checkInMins = getPunchMinutes(checkIn, date);
  const checkOutMins = getPunchMinutes(checkOut, date);

  // Derive relative minutes from shift start day midnight
  const isCheckInNextDay = checkIn.getUTCDate() !== date.getUTCDate() || checkIn.getUTCMonth() !== date.getUTCMonth();
  const checkInRelMins = isCheckInNextDay ? checkInMins + 1440 : checkInMins;

  const isCheckOutNextDay = checkOut.getUTCDate() !== date.getUTCDate() || checkOut.getUTCMonth() !== date.getUTCMonth();
  const checkOutRelMins = isCheckOutNextDay ? checkOutMins + 1440 : checkOutMins;

  // Late calculation
  const lateMinutes = checkInRelMins > shiftGraceEndMins ? Math.max(0, checkInRelMins - shiftStartMins) : 0;

  // Early exit calculation
  const earlyExitMinutes = checkOutRelMins < effectiveShiftEndMins ? Math.max(0, effectiveShiftEndMins - checkOutRelMins) : 0;

  // Overtime: worked beyond shift fullDayMinutes
  let overtimeHours = 0;
  if (overtimeEnabled && workedMinutes > shift.fullDayMinutes) {
    overtimeHours = parseFloat(((workedMinutes - shift.fullDayMinutes) / 60).toFixed(2));
  }

  // Derive status based on worked minutes and late threshold
  let status: AttendanceStatus = AttendanceStatus.PRESENT;
  let remarks = "Present on shift";

  if (workedMinutes < shift.halfDayMinutes) {
    status = AttendanceStatus.ABSENT;
    remarks = `Worked only ${workedMinutes} mins (< ${shift.halfDayMinutes} mins half-day threshold)`;
  } else if (workedMinutes < shift.fullDayMinutes) {
    status = AttendanceStatus.HALF_DAY;
    remarks = `Worked ${workedMinutes} mins (< ${shift.fullDayMinutes} mins full-day threshold)`;
  } else if (lateMinutes > shift.graceMinutes) {
    status = AttendanceStatus.LATE;
    remarks = `Late arrival by ${lateMinutes} minutes`;
  }

  return {
    status,
    workedMinutes,
    totalHours,
    lateMinutes,
    earlyExitMinutes,
    overtimeHours,
    isSandwichDeduction: false,
    remarks,
  };
}
