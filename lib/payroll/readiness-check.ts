import { prisma } from "@/lib/prisma";
import { getDaysInMonth } from "./calculation-engine";

export interface ReadinessIssue {
  type: "BLOCKER" | "WARNING" | "INFO";
  category: "ATTENDANCE" | "LEAVE" | "REGULARIZATION" | "BANK_DATA" | "STRUCTURE" | "STATUTORY";
  title: string;
  description: string;
  count?: number;
  affectedUsers?: Array<{ id: number; name: string; email?: string }>;
}

export interface PayrollReadinessReport {
  month: number;
  year: number;
  isReady: boolean;
  totalEmployees: number;
  blockers: ReadinessIssue[];
  warnings: ReadinessIssue[];
  metrics: {
    pendingRegularizations: number;
    pendingLeaves: number;
    missingAttendancePunches: number;
    missingBankDetails: number;
    missingStructures: number;
  };
}

export class PayrollReadinessService {
  /**
   * Pre-flight readiness audit before calculating payroll for a month.
   * Catches pending leaves, unresolved regularizations, attendance gaps, and missing bank/tax data.
   */
  static async evaluateReadiness(month: number, year: number): Promise<PayrollReadinessReport> {
    const calendarDays = getDaysInMonth(year, month);
    const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
    const endDate = new Date(Date.UTC(year, month - 1, calendarDays, 23, 59, 59));

    const blockers: ReadinessIssue[] = [];
    const warnings: ReadinessIssue[] = [];

    // 1. Fetch active users and structures
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        bankAccountNumber: true,
        bankIfsc: true,
        panNumber: true,
        joiningDate: true,
        salaryStructures: {
          where: { status: "ACTIVE" },
          take: 1,
        },
      },
    });

    const activeEmployees = users.filter((u) => u.salaryStructures.length > 0);
    const usersWithoutStructure = users.filter((u) => u.salaryStructures.length === 0);

    if (usersWithoutStructure.length > 0) {
      warnings.push({
        type: "WARNING",
        category: "STRUCTURE",
        title: "Employees Missing Salary Structure",
        description: `${usersWithoutStructure.length} user(s) have no active salary structure and will be excluded from this payroll run.`,
        count: usersWithoutStructure.length,
        affectedUsers: usersWithoutStructure.map((u) => ({ id: u.id, name: u.name, email: u.email })),
      });
    }

    if (activeEmployees.length === 0) {
      blockers.push({
        type: "BLOCKER",
        category: "STRUCTURE",
        title: "No Eligible Employees Found",
        description: "Zero employees have an active salary structure. Configure at least one employee salary to proceed.",
        count: 0,
      });
    }

    // 2. Check pending regularizations in this month
    const pendingRegularizations = await prisma.attendanceRegularization.findMany({
      where: {
        status: "PENDING",
        date: { gte: startDate, lte: endDate },
      },
      include: { user: { select: { id: true, name: true } } },
    });

    if (pendingRegularizations.length > 0) {
      blockers.push({
        type: "BLOCKER",
        category: "REGULARIZATION",
        title: "Unresolved Attendance Regularizations",
        description: `${pendingRegularizations.length} pending regularization request(s) must be reviewed by HR before calculating payroll.`,
        count: pendingRegularizations.length,
        affectedUsers: pendingRegularizations.map((r) => ({ id: r.user.id, name: r.user.name })),
      });
    }

    // 3. Check pending leave requests in this month
    const pendingLeaves = await prisma.leaveRequest.findMany({
      where: {
        status: "PENDING",
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
      include: { user: { select: { id: true, name: true } } },
    });

    if (pendingLeaves.length > 0) {
      blockers.push({
        type: "BLOCKER",
        category: "LEAVE",
        title: "Pending Leave Requests",
        description: `${pendingLeaves.length} leave application(s) are pending approval in this pay period.`,
        count: pendingLeaves.length,
        affectedUsers: pendingLeaves.map((l) => ({ id: l.user.id, name: l.user.name })),
      });
    }

    // 4. Check missing bank details for active employees
    const missingBankUsers = activeEmployees.filter((u) => !u.bankAccountNumber || !u.bankIfsc);
    if (missingBankUsers.length > 0) {
      warnings.push({
        type: "WARNING",
        category: "BANK_DATA",
        title: "Missing Bank Account Details",
        description: `${missingBankUsers.length} employee(s) are missing bank account or IFSC numbers. Bank transfer CSV generation will fail for them.`,
        count: missingBankUsers.length,
        affectedUsers: missingBankUsers.map((u) => ({ id: u.id, name: u.name, email: u.email })),
      });
    }

    // 5. Check attendance coverage (active employees with zero attendance records in period)
    const attendancesInMonth = await prisma.attendance.findMany({
      where: {
        date: { gte: startDate, lte: endDate },
        userId: { in: activeEmployees.map((e) => e.id) },
      },
      select: { userId: true },
    });

    const employeesWithPunches = new Set(attendancesInMonth.map((a) => a.userId));
    const employeesWithoutAnyAttendance = activeEmployees.filter((e) => !employeesWithPunches.has(e.id));

    if (employeesWithoutAnyAttendance.length > 0) {
      warnings.push({
        type: "WARNING",
        category: "ATTENDANCE",
        title: "Missing Attendance Records",
        description: `${employeesWithoutAnyAttendance.length} employee(s) have zero attendance punches recorded for ${month}/${year}. They may be computed as 100% absent unless synced.`,
        count: employeesWithoutAnyAttendance.length,
        affectedUsers: employeesWithoutAnyAttendance.map((e) => ({ id: e.id, name: e.name })),
      });
    }

    // 6. Check Statutory Configuration
    const statutoryConfig = await prisma.statutoryConfig.findFirst({
      where: {
        effectiveFrom: { lte: endDate },
      },
    });

    if (!statutoryConfig) {
      warnings.push({
        type: "WARNING",
        category: "STATUTORY",
        title: "Missing Statutory Configuration",
        description: "No statutory rules config found. Default system fallback rates will be applied.",
      });
    }

    return {
      month,
      year,
      isReady: blockers.length === 0,
      totalEmployees: activeEmployees.length,
      blockers,
      warnings,
      metrics: {
        pendingRegularizations: pendingRegularizations.length,
        pendingLeaves: pendingLeaves.length,
        missingAttendancePunches: employeesWithoutAnyAttendance.length,
        missingBankDetails: missingBankUsers.length,
        missingStructures: usersWithoutStructure.length,
      },
    };
  }
}
