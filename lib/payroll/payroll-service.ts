import { prisma } from "@/lib/prisma";
import { PayrollRunStatus, ExpenseCategory, ExpenseStatus, PaymentMethod } from "@prisma/client";
import {
  PayrollSettingsData,
  StatutoryConfigData,
  EmployeeSalaryInput,
  MonthlyAdjustmentItem,
  LoanRecoveryItem,
} from "./types";
import {
  calculateEmployeePayroll,
  getDaysInMonth,
  DEFAULT_PT_SLABS,
  DEFAULT_STATUTORY_CONFIG,
} from "./calculation-engine";
import { AttendanceService } from "./attendance-service";
import { BankFormatExporter, BankExportFormat, BankTransferEmployeeRecord } from "./bank-formats";
import { StatutoryReportsGenerator, StatutoryEmployeeRecord } from "./statutory-reports";
import { AccountingJournalExporter, AccountingRunData } from "./accounting-export";
import { PayrollPdfGenerator, PayslipPdfData } from "./pdf-generator";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export function maskPan(pan?: string | null): string | null {
  if (!pan) return null;
  const clean = pan.trim().toUpperCase();
  if (clean.length < 5) return clean;
  return clean.slice(0, 5) + "****" + clean.slice(-1);
}

export function maskBankAccount(acc?: string | null): string | null {
  if (!acc) return null;
  const clean = acc.trim();
  if (clean.length <= 4) return clean;
  return "*".repeat(clean.length - 4) + clean.slice(-4);
}

export class PayrollService {
  /**
   * Retrieves active statutory configuration.
   */
  static async getStatutoryConfig(country = "IN", state = "ALL"): Promise<StatutoryConfigData> {
    const record = await prisma.statutoryConfig.findFirst({
      where: { country, state, effectiveTo: null },
      orderBy: { effectiveFrom: "desc" },
    });

    if (!record) {
      return DEFAULT_STATUTORY_CONFIG;
    }

    let ptSlabs = DEFAULT_PT_SLABS;
    try {
      ptSlabs = JSON.parse(record.ptSlabsJson);
    } catch {}

    return {
      id: record.id,
      country: record.country,
      state: record.state,
      version: record.version,
      pfEmployeeRate: record.pfEmployeeRate,
      pfEmployerEpfRate: record.pfEmployerEpfRate,
      pfEmployerEpsRate: record.pfEmployerEpsRate,
      pfEmployerEdliRate: record.pfEmployerEdliRate,
      pfAdminChargesRate: record.pfAdminChargesRate,
      pfWageCeiling: record.pfWageCeiling,
      esiEmployeeRate: record.esiEmployeeRate,
      esiEmployerRate: record.esiEmployerRate,
      esiWageCeiling: record.esiWageCeiling,
      ptSlabs,
    };
  }

  /**
   * Retrieves or initializes agency-wide payroll settings.
   */
  static async getSettings(): Promise<PayrollSettingsData> {
    let settings = await prisma.payrollSettings.findUnique({
      where: { id: "default" },
    });

    if (!settings) {
      settings = await prisma.payrollSettings.create({
        data: {
          id: "default",
          companyName: "Agency",
          currency: "INR",
          payPeriodType: "CALENDAR_DAYS",
          weeklyOffDays: JSON.stringify([0]), // Sunday
          standardWorkHours: 8.0,
          enableOvertime: true,
          overtimeHourlyRateMultiplier: 1.5,
          lateMarkGraceMinutes: 15,
          lateMarksForHalfDayPenalty: 3,
          pfEmployeeRate: 12.0,
          pfEmployerRate: 12.0,
          pfWageCeiling: 1500000, // ₹15,000 in paise
          esiEmployeeRate: 0.75,
          esiEmployerRate: 3.25,
          esiWageCeiling: 2100000, // ₹21,000 in paise
          ptRulesJson: JSON.stringify(DEFAULT_PT_SLABS),
        },
      });
    }

    let weeklyOffDays = [0];
    try {
      weeklyOffDays = JSON.parse(settings.weeklyOffDays);
    } catch {}

    let ptSlabs = DEFAULT_PT_SLABS;
    try {
      ptSlabs = JSON.parse(settings.ptRulesJson);
    } catch {}

    return {
      id: settings.id,
      companyName: settings.companyName,
      currency: settings.currency,
      payPeriodType: settings.payPeriodType,
      weeklyOffDays,
      standardWorkHours: settings.standardWorkHours,
      enableOvertime: settings.enableOvertime,
      overtimeHourlyRateMultiplier: settings.overtimeHourlyRateMultiplier,
      lateMarkGraceMinutes: settings.lateMarkGraceMinutes,
      lateMarksForHalfDayPenalty: settings.lateMarksForHalfDayPenalty,
      pfEmployeeRate: settings.pfEmployeeRate,
      pfEmployerRate: settings.pfEmployerRate,
      pfWageCeiling: settings.pfWageCeiling,
      esiEmployeeRate: settings.esiEmployeeRate,
      esiEmployerRate: settings.esiEmployerRate,
      esiWageCeiling: settings.esiWageCeiling,
      ptSlabs,
    };
  }

  /**
   * Updates agency payroll settings.
   */
  static async updateSettings(data: Partial<PayrollSettingsData>) {
    const existing = await this.getSettings();

    return prisma.payrollSettings.upsert({
      where: { id: "default" },
      create: {
        id: "default",
        companyName: data.companyName || existing.companyName,
        currency: data.currency || existing.currency,
        payPeriodType: data.payPeriodType || existing.payPeriodType,
        weeklyOffDays: JSON.stringify(data.weeklyOffDays || existing.weeklyOffDays),
        standardWorkHours: data.standardWorkHours ?? existing.standardWorkHours,
        enableOvertime: data.enableOvertime ?? existing.enableOvertime,
        overtimeHourlyRateMultiplier:
          data.overtimeHourlyRateMultiplier ?? existing.overtimeHourlyRateMultiplier,
        lateMarkGraceMinutes: data.lateMarkGraceMinutes ?? existing.lateMarkGraceMinutes,
        lateMarksForHalfDayPenalty:
          data.lateMarksForHalfDayPenalty ?? existing.lateMarksForHalfDayPenalty,
        pfEmployeeRate: data.pfEmployeeRate ?? existing.pfEmployeeRate,
        pfEmployerRate: data.pfEmployerRate ?? existing.pfEmployerRate,
        pfWageCeiling: data.pfWageCeiling ?? existing.pfWageCeiling,
        esiEmployeeRate: data.esiEmployeeRate ?? existing.esiEmployeeRate,
        esiEmployerRate: data.esiEmployerRate ?? existing.esiEmployerRate,
        esiWageCeiling: data.esiWageCeiling ?? existing.esiWageCeiling,
        ptRulesJson: JSON.stringify(data.ptSlabs || existing.ptSlabs),
      },
      update: {
        companyName: data.companyName,
        currency: data.currency,
        payPeriodType: data.payPeriodType,
        weeklyOffDays: data.weeklyOffDays ? JSON.stringify(data.weeklyOffDays) : undefined,
        standardWorkHours: data.standardWorkHours,
        enableOvertime: data.enableOvertime,
        overtimeHourlyRateMultiplier: data.overtimeHourlyRateMultiplier,
        lateMarkGraceMinutes: data.lateMarkGraceMinutes,
        lateMarksForHalfDayPenalty: data.lateMarksForHalfDayPenalty,
        pfEmployeeRate: data.pfEmployeeRate,
        pfEmployerRate: data.pfEmployerRate,
        pfWageCeiling: data.pfWageCeiling,
        esiEmployeeRate: data.esiEmployeeRate,
        esiEmployerRate: data.esiEmployerRate,
        esiWageCeiling: data.esiWageCeiling,
        ptRulesJson: data.ptSlabs ? JSON.stringify(data.ptSlabs) : undefined,
      },
    });
  }

  /**
   * Retrieves or preserves history of salary structures.
   */
  static async getActiveSalaryStructure(userId: number) {
    return prisma.salaryStructure.findFirst({
      where: {
        userId,
        status: "ACTIVE",
      },
      orderBy: { effectiveFrom: "desc" },
    });
  }

  /**
   * Sets or updates salary structure for an employee while preserving full version history.
   */
  static async upsertSalaryStructure({
    userId,
    basicSalary,
    hra,
    specialAllowance,
    otherAllowances = 0,
    fixedBonus = 0,
    variablePay = 0,
    pfDeduction = true,
    esiDeduction = false,
    professionalTax = true,
    tdsMonthly = 0,
    effectiveFrom = new Date(),
    actorUserId,
  }: {
    userId: number;
    basicSalary: number;
    hra: number;
    specialAllowance: number;
    otherAllowances?: number;
    fixedBonus?: number;
    variablePay?: number;
    pfDeduction?: boolean;
    esiDeduction?: boolean;
    professionalTax?: boolean;
    tdsMonthly?: number;
    effectiveFrom?: Date;
    actorUserId?: number;
  }) {
    const monthlyGross = basicSalary + hra + specialAllowance + otherAllowances;
    const ctcMonthly = monthlyGross + fixedBonus;

    // Archive current active structure
    const currentActive = await this.getActiveSalaryStructure(userId);
    if (currentActive) {
      await prisma.salaryStructure.update({
        where: { id: currentActive.id },
        data: {
          status: "SUPERSEDED",
          effectiveTo: effectiveFrom,
        },
      });
    }

    const newStructure = await prisma.salaryStructure.create({
      data: {
        userId,
        basicSalary,
        hra,
        specialAllowance,
        otherAllowances,
        fixedBonus,
        variablePay,
        monthlyGross,
        ctcMonthly,
        pfDeduction,
        esiDeduction,
        professionalTax,
        tdsMonthly,
        effectiveFrom,
        status: "ACTIVE",
      },
    });

    // Update currentSalary on User model for quick reference
    await prisma.user.update({
      where: { id: userId },
      data: {
        currentSalary: monthlyGross / 100, // stored as major units on User
      },
    });

    if (actorUserId) {
      await prisma.payrollAuditLog.create({
        data: {
          userId: actorUserId,
          action: "SALARY_UPDATE",
          details: `Updated salary structure for User #${userId}. New Monthly Gross: ₹${(monthlyGross / 100).toFixed(2)}`,
          previousState: currentActive ? JSON.stringify(currentActive) : undefined,
          newState: JSON.stringify(newStructure),
        },
      });
    }

    return newStructure;
  }

  /**
   * Runs payroll calculation for a month across all active users.
   */
  static async createPayrollRun({
    month,
    year,
    runType = "REGULAR",
    notes,
    actorUserId,
  }: {
    month: number;
    year: number;
    runType?: string;
    notes?: string;
    actorUserId: number;
  }) {
    // Check if run already exists
    const existingRun = await prisma.payrollRun.findUnique({
      where: {
        month_year_runType: { month, year, runType },
      },
    });

    if (existingRun && ["LOCKED", "PAID"].includes(existingRun.status)) {
      throw new Error(`Payroll run for ${month}/${year} (${runType}) is locked/paid. Any retroactive modifications must be processed as Arrears adjustments in the next cycle.`);
    }

    const settings = await this.getSettings();
    const statutoryConfig = await this.getStatutoryConfig();
    const calendarDays = getDaysInMonth(year, month);
    const payPeriodStart = new Date(Date.UTC(year, month - 1, 1));
    const payPeriodEnd = new Date(Date.UTC(year, month - 1, calendarDays));

    // Get all users who have an active salary structure
    const users = await prisma.user.findMany({
      include: {
        salaryStructures: {
          where: { status: "ACTIVE" },
          take: 1,
        },
      },
    });

    const activeEmployees = users.filter((u) => u.salaryStructures.length > 0);
    if (activeEmployees.length === 0) {
      throw new Error("No employees with configured salary structures found to calculate payroll.");
    }

    // Get adjustments for this month
    const adjustments = await prisma.salaryAdjustment.findMany({
      where: { month, year, isApproved: true },
    });

    // Upsert PayrollRun with snapshots
    const payrollRun = await prisma.payrollRun.upsert({
      where: {
        month_year_runType: { month, year, runType },
      },
      create: {
        month,
        year,
        runType,
        payPeriodStart,
        payPeriodEnd,
        status: PayrollRunStatus.CALCULATED,
        currency: settings.currency,
        notes,
        settingsSnapshot: JSON.stringify(settings),
        statutorySnapshot: JSON.stringify(statutoryConfig),
      },
      update: {
        status: PayrollRunStatus.CALCULATED,
        notes,
        settingsSnapshot: JSON.stringify(settings),
        statutorySnapshot: JSON.stringify(statutoryConfig),
      },
    });

    let totalHeadcount = 0;
    let totalGross = 0;
    let totalDeductions = 0;
    let totalNetPay = 0;
    let totalEmployerCost = 0;

    // Delete existing payslips for this run before recalculating
    await prisma.payslip.deleteMany({
      where: { payrollRunId: payrollRun.id },
    });

    for (const emp of activeEmployees) {
      const salaryStruct = emp.salaryStructures[0];
      const attendanceSummary = await AttendanceService.getMonthlySummary(
        emp.id,
        month,
        year,
        settings
      );

      const empAdjustments: MonthlyAdjustmentItem[] = adjustments
        .filter((a) => a.userId === emp.id)
        .map((a) => ({
          id: a.id,
          userId: a.userId,
          type: a.type as any,
          title: a.title,
          amount: a.amount,
          notes: a.notes,
        }));

      // Check for active loan advance
      const activeLoan = await prisma.loanAdvance.findFirst({
        where: { userId: emp.id, status: "ACTIVE", balanceAmount: { gt: 0 } },
      });
      const loanRecoveryItem: LoanRecoveryItem | undefined = activeLoan
        ? {
            loanAdvanceId: activeLoan.id,
            installmentEmi: Math.min(activeLoan.installmentEmi, activeLoan.balanceAmount),
            balanceRemaining: activeLoan.balanceAmount,
          }
        : undefined;

      const employeeInput: EmployeeSalaryInput = {
        userId: emp.id,
        userName: emp.name,
        userEmail: emp.email,
        designation: emp.designation,
        department: emp.department,
        bankAccountNumber: emp.bankAccountNumber,
        bankIfsc: emp.bankIfsc,
        bankName: emp.bankName,
        panNumber: emp.panNumber,
        joiningDate: emp.joiningDate,
        salaryStructure: {
          basicSalary: salaryStruct.basicSalary,
          hra: salaryStruct.hra,
          specialAllowance: salaryStruct.specialAllowance,
          otherAllowances: salaryStruct.otherAllowances,
          fixedBonus: salaryStruct.fixedBonus,
          variablePay: salaryStruct.variablePay,
          monthlyGross: salaryStruct.monthlyGross,
          ctcMonthly: salaryStruct.ctcMonthly,
          pfDeduction: salaryStruct.pfDeduction,
          esiDeduction: salaryStruct.esiDeduction,
          professionalTax: salaryStruct.professionalTax,
          tdsMonthly: salaryStruct.tdsMonthly,
        },
      };

      const calc = calculateEmployeePayroll({
        employee: employeeInput,
        attendance: attendanceSummary,
        settings,
        statutoryConfig,
        adjustments: empAdjustments,
        loanRecovery: loanRecoveryItem,
      });

      await prisma.payslip.create({
        data: {
          payrollRunId: payrollRun.id,
          userId: emp.id,
          month,
          year,
          calendarDays: calc.calendarDays,
          workingDays: calc.workingDays,
          payableDays: calc.payableDays,
          lopDays: calc.lopDays,
          paidLeaveDays: calc.paidLeaveDays,
          absentDays: calc.absentDays,
          holidayDays: calc.holidayDays,
          weeklyOffDays: calc.weeklyOffDays,
          overtimeHours: calc.overtimeHours,
          lateDeductionDays: calc.latePenaltyDays,
          grossSalary: calc.earnedGross,
          totalEarnings: calc.totalEarnings,
          netSalary: calc.netSalary,
          totalDeductions: calc.totalEmployeeDeductions,
          employerCost: calc.totalEmployerCost,
          employeeName: emp.name,
          designation: emp.designation,
          department: emp.department,
          panNumberMasked: maskPan(emp.panNumber),
          bankAccountMasked: maskBankAccount(emp.bankAccountNumber),
          bankIfsc: emp.bankIfsc,
          bankName: emp.bankName,
          breakdownJson: JSON.stringify(calc),
          isPublished: false,
          paymentStatus: "PENDING",
          lines: {
            create: calc.lines.map((l) => ({
              code: l.code,
              name: l.name,
              type: l.type,
              rate: l.rate,
              earnedAmount: l.earnedAmount,
              calculationNote: l.calculationNote,
              order: l.order,
            })),
          },
        },
      });

      totalHeadcount++;
      totalGross += calc.earnedGross;
      totalDeductions += calc.totalEmployeeDeductions;
      totalNetPay += calc.netSalary;
      totalEmployerCost += calc.totalEmployerCost;
    }

    const updatedRun = await prisma.payrollRun.update({
      where: { id: payrollRun.id },
      data: {
        totalHeadcount,
        totalGross,
        totalDeductions,
        totalNetPay,
        totalEmployerCost,
      },
      include: {
        payslips: {
          include: { user: { select: { id: true, name: true, email: true, designation: true } } },
        },
      },
    });

    await prisma.payrollAuditLog.create({
      data: {
        payrollRunId: payrollRun.id,
        userId: actorUserId,
        action: "CALCULATE",
        details: `Calculated payroll run for ${month}/${year}. Headcount: ${totalHeadcount}, Payout: ₹${(totalNetPay / 100).toFixed(2)}`,
      },
    });

    return updatedRun;
  }

  /**
   * Status Transition Workflow:
   * DRAFT -> CALCULATED -> UNDER_REVIEW -> APPROVED -> LOCKED -> PAID
   * On APPROVED: automatically creates a linked Expense entry in Finance.
   */
  static async updateRunStatus({
    payrollRunId,
    newStatus,
    actorUserId,
    notes,
  }: {
    payrollRunId: string;
    newStatus: PayrollRunStatus;
    actorUserId: number;
    notes?: string;
  }) {
    const run = await prisma.payrollRun.findUnique({
      where: { id: payrollRunId },
      include: { payslips: true },
    });

    if (!run) throw new Error("Payroll run not found");
    if (run.status === "LOCKED" && newStatus !== "PAID") {
      throw new Error("Locked payroll runs cannot be modified.");
    }

    const updateData: any = {
      status: newStatus,
      notes: notes ? notes : run.notes,
    };

    if (newStatus === "APPROVED") {
      updateData.approvedById = actorUserId;
      updateData.approvedAt = new Date();

      // Tie approved payroll run into Expenses / Finance module as a verified expense
      const expenseAmount = parseFloat((run.totalNetPay / 100).toFixed(2));
      const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
      ];
      const monthLabel = `${monthNames[run.month - 1]} ${run.year}`;

      await prisma.expense.create({
        data: {
          title: `Payroll Payout - ${monthLabel} (${run.totalHeadcount} Employees)`,
          category: ExpenseCategory.PAYROLL_SALARY,
          amount: expenseAmount,
          currency: run.currency || "INR",
          date: new Date(),
          status: ExpenseStatus.APPROVED,
          paymentMethod: PaymentMethod.BANK_TRANSFER,
          notes: `System-generated expense from approved payroll run #${run.id}. Total net pay: ₹${expenseAmount.toLocaleString('en-IN')}`,
          recordedById: actorUserId,
          payrollRunId: run.id,
        },
      });
    }

    if (newStatus === "LOCKED") {
      updateData.lockedAt = new Date();
    }

    if (newStatus === "PAID") {
      updateData.paidAt = new Date();
      // Mark all payslips as published & paid
      await prisma.payslip.updateMany({
        where: { payrollRunId: run.id },
        data: {
          isPublished: true,
          paymentStatus: "PAID",
        },
      });

      // Recover and reduce balances for active employee loans
      for (const slip of run.payslips) {
        try {
          const calc = JSON.parse(slip.breakdownJson);
          if (calc.loanAdvanceRecovery > 0) {
            const loan = await prisma.loanAdvance.findFirst({
              where: { userId: slip.userId, status: "ACTIVE" },
            });
            if (loan) {
              const newRepaid = loan.totalRepaid + calc.loanAdvanceRecovery;
              const newBalance = Math.max(0, loan.principalAmount - newRepaid);
              await prisma.loanAdvance.update({
                where: { id: loan.id },
                data: {
                  totalRepaid: newRepaid,
                  balanceAmount: newBalance,
                  status: newBalance === 0 ? "COMPLETED" : "ACTIVE",
                },
              });

              await prisma.loanInstallment.create({
                data: {
                  loanAdvanceId: loan.id,
                  month: run.month,
                  year: run.year,
                  expectedEmi: loan.installmentEmi,
                  deductedEmi: calc.loanAdvanceRecovery,
                  status: calc.loanShortfall > 0 ? "PARTIAL" : "RECOVERED",
                  recoveredAt: new Date(),
                },
              });
            }
          }
        } catch {}
      }
    }

    const updated = await prisma.payrollRun.update({
      where: { id: payrollRunId },
      data: updateData,
    });

    await prisma.payrollAuditLog.create({
      data: {
        payrollRunId: run.id,
        userId: actorUserId,
        action: newStatus,
        details: `Payroll run status updated to ${newStatus}`,
        previousState: run.status,
        newState: newStatus,
      },
    });

    return updated;
  }

  /**
   * Generates Bank Transfer CSV for bulk salary disbursement.
   */
  static async generateBankTransferCsv(payrollRunId: string): Promise<string> {
    const run = await prisma.payrollRun.findUnique({
      where: { id: payrollRunId },
      include: {
        payslips: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                bankName: true,
                bankAccountNumber: true,
                bankIfsc: true,
              },
            },
          },
        },
      },
    });

    if (!run) throw new Error("Payroll run not found");

    const headers = [
      "Beneficiary Name",
      "Account Number",
      "IFSC Code",
      "Bank Name",
      "Amount (INR)",
      "Remarks / Narration",
      "Employee Email",
    ];

    const rows = run.payslips.map((p) => {
      const amountRupees = (p.netSalary / 100).toFixed(2);
      const narration = `Salary ${run.month}/${run.year}`;
      return [
        `"${p.user.name.replace(/"/g, '""')}"`,
        `"${p.user.bankAccountNumber || "N/A"}"`,
        `"${p.user.bankIfsc || "N/A"}"`,
        `"${p.user.bankName || "N/A"}"`,
        amountRupees,
        `"${narration}"`,
        `"${p.user.email}"`,
      ].join(",");
    });

    return [headers.join(","), ...rows].join("\n");
  }

  /**
   * Generates Statutory Payroll Register CSV (PF, ESI, PT, TDS Breakdown).
   */
  static async generatePayrollRegisterCsv(payrollRunId: string): Promise<string> {
    const run = await prisma.payrollRun.findUnique({
      where: { id: payrollRunId },
      include: {
        payslips: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                designation: true,
                panNumber: true,
              },
            },
          },
        },
      },
    });

    if (!run) throw new Error("Payroll run not found");

    const headers = [
      "Emp ID",
      "Employee Name",
      "Designation",
      "PAN",
      "Payable Days",
      "Earned Basic (INR)",
      "Earned Gross (INR)",
      "PF Employee (INR)",
      "PF Employer (INR)",
      "ESI Employee (INR)",
      "ESI Employer (INR)",
      "Prof. Tax (INR)",
      "TDS (INR)",
      "Total Deductions (INR)",
      "Net Take-Home (INR)",
      "Employer CTC (INR)",
    ];

    const rows = run.payslips.map((p) => {
      let calc: any = {};
      try {
        calc = JSON.parse(p.breakdownJson);
      } catch {}

      const toInr = (minor?: number) => ((minor || 0) / 100).toFixed(2);

      return [
        p.user.id,
        `"${p.user.name.replace(/"/g, '""')}"`,
        `"${p.user.designation || "N/A"}"`,
        `"${p.user.panNumber || "N/A"}"`,
        p.payableDays,
        toInr(calc.earnedBasic),
        toInr(p.grossSalary),
        toInr(calc.pfEmployee),
        toInr(calc.pfEmployer),
        toInr(calc.esiEmployee),
        toInr(calc.esiEmployer),
        toInr(calc.professionalTax),
        toInr(calc.tds),
        toInr(p.totalDeductions),
        toInr(p.netSalary),
        toInr(p.employerCost),
      ].join(",");
    });

    return [headers.join(","), ...rows].join("\n");
  }

  /**
   * Computes Month-Over-Month Variance Analysis.
   * Compares headcount, gross, net, employer cost against previous regular cycle.
   * Flags employees with >= 10% variance with transparent operational reasons.
   */
  static async getRunVariance(payrollRunId: string) {
    const run = await prisma.payrollRun.findUnique({
      where: { id: payrollRunId },
      include: {
        payslips: {
          include: {
            user: { select: { id: true, name: true, email: true, designation: true, department: true } },
          },
        },
      },
    });

    if (!run) throw new Error("Payroll run not found");

    // Identify previous regular pay period
    let prevMonth = run.month - 1;
    let prevYear = run.year;
    if (prevMonth === 0) {
      prevMonth = 12;
      prevYear = run.year - 1;
    }

    const prevRun = await prisma.payrollRun.findFirst({
      where: {
        month: prevMonth,
        year: prevYear,
        runType: "REGULAR",
      },
      include: {
        payslips: true,
      },
    });

    const prevSlipsMap = new Map<number, any>();
    if (prevRun) {
      for (const p of prevRun.payslips) {
        prevSlipsMap.set(p.userId, p);
      }
    }

    const employeeVariances: Array<{
      userId: number;
      userName: string;
      designation?: string | null;
      department?: string | null;
      currentGross: number;
      currentNet: number;
      previousGross: number | null;
      previousNet: number | null;
      grossDelta: number;
      netDelta: number;
      percentDelta: number;
      isFlagged: boolean;
      status: string;
      holdReason?: string | null;
      reasons: string[];
    }> = [];

    let flaggedCount = 0;

    for (const slip of run.payslips) {
      const prevSlip = prevSlipsMap.get(slip.userId);
      const prevGross = prevSlip ? prevSlip.grossSalary : null;
      const prevNet = prevSlip ? prevSlip.netSalary : null;

      const grossDelta = slip.grossSalary - (prevGross ?? 0);
      const netDelta = slip.netSalary - (prevNet ?? 0);

      let percentDelta = 0;
      if (prevGross !== null && prevGross > 0) {
        percentDelta = parseFloat(((grossDelta / prevGross) * 100).toFixed(1));
      } else if (prevGross === null) {
        percentDelta = 100; // New employee this cycle
      }

      const reasons: string[] = [];
      let isFlagged = false;

      let calc: any = {};
      try {
        calc = JSON.parse(slip.breakdownJson);
      } catch {}

      if (prevGross === null) {
        isFlagged = true;
        reasons.push("New joiner (no prior cycle)");
      } else if (Math.abs(percentDelta) >= 10) {
        isFlagged = true;
      }

      if (calc.isMidMonthJoiner) reasons.push("Joined mid-month");
      if (calc.isMidMonthLeaver) reasons.push("Exited mid-month");
      if (slip.lopDays > 0) reasons.push(`${slip.lopDays} LOP unpaid day(s)`);
      if (slip.overtimeHours > 0) reasons.push(`${slip.overtimeHours} hrs overtime`);
      if (calc.bonus > 0) reasons.push(`Bonus ₹${(calc.bonus / 100).toFixed(0)}`);
      if (calc.arrears > 0) reasons.push("Salary arrears");
      if (calc.reimbursements > 0) reasons.push("Expense reimbursement");
      if (calc.loanShortfall > 0) reasons.push("Loan EMI cap shortfall");
      if (slip.status === "ON_HOLD") reasons.push(`ON HOLD: ${slip.holdReason || "Pending clearance"}`);

      if (reasons.length === 0 && Math.abs(percentDelta) >= 10) {
        reasons.push(`${percentDelta > 0 ? "+" : ""}${percentDelta}% variance vs last month`);
      }

      if (isFlagged) flaggedCount++;

      employeeVariances.push({
        userId: slip.userId,
        userName: slip.user?.name || slip.employeeName || `User #${slip.userId}`,
        designation: slip.user?.designation || slip.designation,
        department: slip.user?.department || slip.department,
        currentGross: slip.grossSalary,
        currentNet: slip.netSalary,
        previousGross: prevGross,
        previousNet: prevNet,
        grossDelta,
        netDelta,
        percentDelta,
        isFlagged,
        status: slip.status,
        holdReason: slip.holdReason,
        reasons,
      });
    }

    const prevHeadcount = prevRun ? prevRun.totalHeadcount : 0;
    const prevGross = prevRun ? prevRun.totalGross : 0;
    const prevNet = prevRun ? prevRun.totalNetPay : 0;
    const prevCost = prevRun ? prevRun.totalEmployerCost : 0;

    return {
      hasPreviousRun: !!prevRun,
      previousPeriod: prevRun ? { month: prevRun.month, year: prevRun.year } : null,
      summary: {
        headcount: {
          current: run.totalHeadcount,
          previous: prevHeadcount,
          delta: run.totalHeadcount - prevHeadcount,
        },
        gross: {
          current: run.totalGross,
          previous: prevGross,
          delta: run.totalGross - prevGross,
          percent: prevGross > 0 ? parseFloat((((run.totalGross - prevGross) / prevGross) * 100).toFixed(1)) : 0,
        },
        net: {
          current: run.totalNetPay,
          previous: prevNet,
          delta: run.totalNetPay - prevNet,
          percent: prevNet > 0 ? parseFloat((((run.totalNetPay - prevNet) / prevNet) * 100).toFixed(1)) : 0,
        },
        employerCost: {
          current: run.totalEmployerCost,
          previous: prevCost,
          delta: run.totalEmployerCost - prevCost,
          percent: prevCost > 0 ? parseFloat((((run.totalEmployerCost - prevCost) / prevCost) * 100).toFixed(1)) : 0,
        },
      },
      flaggedCount,
      employeeVariances,
    };
  }

  /**
   * Recalculates payslip for a single employee without wiping the whole run.
   */
  static async recalculateEmployeePayslip({
    payrollRunId,
    userId,
    actorUserId,
  }: {
    payrollRunId: string;
    userId: number;
    actorUserId: number;
  }) {
    const run = await prisma.payrollRun.findUnique({
      where: { id: payrollRunId },
      include: { payslips: true },
    });

    if (!run) throw new Error("Payroll run not found");
    if (["LOCKED", "PAID"].includes(run.status)) {
      throw new Error("Locked or paid runs cannot be modified.");
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        salaryStructures: {
          where: { status: "ACTIVE" },
          take: 1,
        },
      },
    });

    if (!user || user.salaryStructures.length === 0) {
      throw new Error("Active salary structure not found for user.");
    }

    const salaryStruct = user.salaryStructures[0];
    const settings = run.settingsSnapshot
      ? JSON.parse(run.settingsSnapshot)
      : await this.getSettings();
    const statutoryConfig = run.statutorySnapshot
      ? JSON.parse(run.statutorySnapshot)
      : await this.getStatutoryConfig();

    const attendanceSummary = await AttendanceService.getMonthlySummary(
      userId,
      run.month,
      run.year,
      settings
    );

    const adjustments = await prisma.salaryAdjustment.findMany({
      where: { userId, month: run.month, year: run.year, isApproved: true },
    });

    const activeLoan = await prisma.loanAdvance.findFirst({
      where: { userId, status: "ACTIVE", balanceAmount: { gt: 0 } },
    });

    const loanRecoveryItem: LoanRecoveryItem | undefined = activeLoan
      ? {
          loanAdvanceId: activeLoan.id,
          installmentEmi: Math.min(activeLoan.installmentEmi, activeLoan.balanceAmount),
          balanceRemaining: activeLoan.balanceAmount,
        }
      : undefined;

    const employeeInput: EmployeeSalaryInput = {
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      designation: user.designation,
      department: user.department,
      bankAccountNumber: user.bankAccountNumber,
      bankIfsc: user.bankIfsc,
      bankName: user.bankName,
      panNumber: user.panNumber,
      joiningDate: user.joiningDate,
      salaryStructure: {
        basicSalary: salaryStruct.basicSalary,
        hra: salaryStruct.hra,
        specialAllowance: salaryStruct.specialAllowance,
        otherAllowances: salaryStruct.otherAllowances,
        fixedBonus: salaryStruct.fixedBonus,
        variablePay: salaryStruct.variablePay,
        monthlyGross: salaryStruct.monthlyGross,
        ctcMonthly: salaryStruct.ctcMonthly,
        pfDeduction: salaryStruct.pfDeduction,
        esiDeduction: salaryStruct.esiDeduction,
        professionalTax: salaryStruct.professionalTax,
        tdsMonthly: salaryStruct.tdsMonthly,
      },
    };

    const calc = calculateEmployeePayroll({
      employee: employeeInput,
      attendance: attendanceSummary,
      settings,
      statutoryConfig,
      adjustments: adjustments.map((a) => ({
        id: a.id,
        userId: a.userId,
        type: a.type as any,
        title: a.title,
        amount: a.amount,
        notes: a.notes,
      })),
      loanRecovery: loanRecoveryItem,
    });

    // Replace payslip in database (cascading old lines)
    await prisma.payslip.deleteMany({
      where: { payrollRunId: run.id, userId },
    });

    const newPayslip = await prisma.payslip.create({
      data: {
        payrollRunId: run.id,
        userId,
        month: run.month,
        year: run.year,
        calendarDays: calc.calendarDays,
        workingDays: calc.workingDays,
        payableDays: calc.payableDays,
        lopDays: calc.lopDays,
        paidLeaveDays: calc.paidLeaveDays,
        absentDays: calc.absentDays,
        holidayDays: calc.holidayDays,
        weeklyOffDays: calc.weeklyOffDays,
        overtimeHours: calc.overtimeHours,
        lateDeductionDays: calc.latePenaltyDays,
        grossSalary: calc.earnedGross,
        totalEarnings: calc.totalEarnings,
        netSalary: calc.netSalary,
        totalDeductions: calc.totalEmployeeDeductions,
        employerCost: calc.totalEmployerCost,
        employeeName: user.name,
        designation: user.designation,
        department: user.department,
        panNumberMasked: maskPan(user.panNumber),
        bankAccountMasked: maskBankAccount(user.bankAccountNumber),
        bankIfsc: user.bankIfsc,
        bankName: user.bankName,
        breakdownJson: JSON.stringify(calc),
        isPublished: false,
        paymentStatus: "PENDING",
        lines: {
          create: calc.lines.map((l) => ({
            code: l.code,
            name: l.name,
            type: l.type,
            rate: l.rate,
            earnedAmount: l.earnedAmount,
            calculationNote: l.calculationNote,
            order: l.order,
          })),
        },
      },
      include: {
        lines: { orderBy: { order: "asc" } },
        user: { select: { id: true, name: true, email: true, designation: true } },
      },
    });

    // Recompute PayrollRun totals
    const allSlips = await prisma.payslip.findMany({
      where: { payrollRunId: run.id },
    });

    const totalHeadcount = allSlips.length;
    const totalGross = allSlips.reduce((s, p) => s + p.grossSalary, 0);
    const totalDeductions = allSlips.reduce((s, p) => s + p.totalDeductions, 0);
    const totalNetPay = allSlips.reduce((s, p) => s + p.netSalary, 0);
    const totalEmployerCost = allSlips.reduce((s, p) => s + p.employerCost, 0);

    const updatedRun = await prisma.payrollRun.update({
      where: { id: run.id },
      data: {
        totalHeadcount,
        totalGross,
        totalDeductions,
        totalNetPay,
        totalEmployerCost,
      },
    });

    await prisma.payrollAuditLog.create({
      data: {
        payrollRunId: run.id,
        userId: actorUserId,
        action: "RECALCULATE_EMPLOYEE",
        details: `Recalculated payslip for employee #${userId} (${user.name}). Net Pay: ₹${(calc.netSalary / 100).toFixed(2)}`,
      },
    });

    return { payslip: newPayslip, run: updatedRun };
  }

  /**
   * Holds an individual employee's salary with mandatory reason.
   */
  static async holdPayslip({
    payslipId,
    reason,
    actorUserId,
  }: {
    payslipId: string;
    reason: string;
    actorUserId: number;
  }) {
    if (!reason || !reason.trim()) {
      throw new Error("A reason is mandatory to place a salary on hold.");
    }

    const payslip = await prisma.payslip.findUnique({
      where: { id: payslipId },
      include: { payrollRun: true, user: true },
    });
    if (!payslip) throw new Error("Payslip not found");
    if (payslip.payrollRun.status === "PAID") {
      throw new Error("Cannot place a paid salary on hold.");
    }

    const updated = await prisma.payslip.update({
      where: { id: payslipId },
      data: {
        status: "ON_HOLD",
        holdReason: reason.trim(),
      },
    });

    await prisma.payrollAuditLog.create({
      data: {
        payrollRunId: payslip.payrollRunId,
        userId: actorUserId,
        action: "SALARY_HOLD",
        details: `Placed salary on hold for ${payslip.user.name}: "${reason.trim()}"`,
      },
    });

    return updated;
  }

  /**
   * Releases an employee's salary from hold.
   */
  static async releasePayslip({
    payslipId,
    actorUserId,
  }: {
    payslipId: string;
    actorUserId: number;
  }) {
    const payslip = await prisma.payslip.findUnique({
      where: { id: payslipId },
      include: { payrollRun: true, user: true },
    });
    if (!payslip) throw new Error("Payslip not found");

    const updated = await prisma.payslip.update({
      where: { id: payslipId },
      data: {
        status: "CALCULATED",
        holdReason: null,
      },
    });

    await prisma.payrollAuditLog.create({
      data: {
        payrollRunId: payslip.payrollRunId,
        userId: actorUserId,
        action: "SALARY_RELEASE",
        details: `Released hold on salary for ${payslip.user.name}`,
      },
    });

    return updated;
  }

  /**
   * Rejects a payroll run during review with mandatory reason.
   */
  static async rejectRun({
    payrollRunId,
    reason,
    actorUserId,
  }: {
    payrollRunId: string;
    reason: string;
    actorUserId: number;
  }) {
    if (!reason || !reason.trim()) {
      throw new Error("A rejection reason is mandatory.");
    }

    const run = await prisma.payrollRun.findUnique({ where: { id: payrollRunId } });
    if (!run) throw new Error("Payroll run not found");
    if (["PAID"].includes(run.status)) {
      throw new Error("Paid runs cannot be rejected.");
    }

    const updated = await prisma.payrollRun.update({
      where: { id: payrollRunId },
      data: {
        status: PayrollRunStatus.CALCULATED,
        notes: `[REJECTED: ${reason.trim()}] ${run.notes || ""}`,
      },
    });

    await prisma.payrollAuditLog.create({
      data: {
        payrollRunId,
        userId: actorUserId,
        action: "REJECT",
        details: `Payroll run rejected back to CALCULATED: "${reason.trim()}"`,
      },
    });

    return updated;
  }

  /**
   * Voids/cancels a payroll run (Super-Admin only).
   */
  static async voidRun({
    payrollRunId,
    reason,
    actorUserId,
  }: {
    payrollRunId: string;
    reason: string;
    actorUserId: number;
  }) {
    if (!reason || !reason.trim()) {
      throw new Error("A reason is mandatory to void a run.");
    }

    const run = await prisma.payrollRun.findUnique({
      where: { id: payrollRunId },
      include: { expenses: true },
    });
    if (!run) throw new Error("Payroll run not found");
    if (run.status === "PAID") {
      throw new Error("Paid runs cannot be voided directly without reversal accounting entries.");
    }

    // Void any linked expenses
    for (const exp of run.expenses) {
      await prisma.expense.update({
        where: { id: exp.id },
        data: {
          status: ExpenseStatus.REJECTED,
          notes: `[VOIDED with Payroll Run: ${reason.trim()}] ${exp.notes || ""}`,
        },
      });
    }

    const updated = await prisma.payrollRun.update({
      where: { id: payrollRunId },
      data: {
        status: PayrollRunStatus.DRAFT,
        notes: `[VOIDED: ${reason.trim()}] ${run.notes || ""}`,
      },
    });

    await prisma.payrollAuditLog.create({
      data: {
        payrollRunId,
        userId: actorUserId,
        action: "VOID_RUN",
        details: `Payroll run voided: "${reason.trim()}"`,
      },
    });

    return updated;
  }

  /**
   * Generates formatted bank transfer file supporting HDFC, ICICI, SBI, and Generic.
   */
  static async generateMultiBankFile(
    payrollRunId: string,
    format: BankExportFormat = "GENERIC",
    options?: { debitAccountNumber?: string; valueDate?: Date }
  ): Promise<{ filename: string; content: string }> {
    const run = await prisma.payrollRun.findUnique({
      where: { id: payrollRunId },
      include: {
        payslips: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                bankName: true,
                bankAccountNumber: true,
                bankIfsc: true,
              },
            },
          },
        },
      },
    });

    if (!run) throw new Error("Payroll run not found");

    const records: BankTransferEmployeeRecord[] = run.payslips.map((p) => ({
      id: p.user.id,
      name: p.user.name,
      email: p.user.email,
      bankName: p.user.bankName,
      bankAccountNumber: p.user.bankAccountNumber,
      bankIfsc: p.user.bankIfsc,
      netSalary: p.netSalary,
      month: run.month,
      year: run.year,
      runId: run.id,
    }));

    return BankFormatExporter.export(records, format, options);
  }

  /**
   * Generates statutory reports (PF ECR, ESI Return, PT Summary, TDS 24Q, Dept CTC).
   */
  static async generateStatutoryReport(
    payrollRunId: string,
    type: "pf-ecr" | "esi-return" | "pt-summary" | "tds-24q" | "ctc-dept"
  ): Promise<{ filename: string; content: string }> {
    const run = await prisma.payrollRun.findUnique({
      where: { id: payrollRunId },
      include: {
        payslips: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                panNumber: true,
                designation: true,
                department: true,
              },
            },
          },
        },
      },
    });

    if (!run) throw new Error("Payroll run not found");

    const records: StatutoryEmployeeRecord[] = run.payslips.map((p) => {
      let calc: any = {};
      try {
        calc = JSON.parse(p.breakdownJson);
      } catch {}

      return {
        id: p.user.id,
        name: p.user.name,
        pan: p.user.panNumber,
        designation: p.user.designation,
        department: p.user.department,
        payableDays: p.payableDays,
        calendarDays: p.calendarDays,
        grossSalary: p.grossSalary,
        netSalary: p.netSalary,
        employerCost: p.employerCost,
        breakdown: {
          earnedBasic: calc.earnedBasic || 0,
          fixedBasic: calc.fixedBasic || 0,
          earnedGross: p.grossSalary || 0,
          pfEmployee: calc.pfEmployee || 0,
          pfEmployer: calc.pfEmployer || 0,
          esiEmployee: calc.esiEmployee || 0,
          esiEmployer: calc.esiEmployer || 0,
          professionalTax: calc.professionalTax || 0,
          tds: calc.tds || 0,
        },
      };
    });

    switch (type) {
      case "pf-ecr":
        return StatutoryReportsGenerator.generatePfEcr(records, run.month, run.year);
      case "esi-return":
        return StatutoryReportsGenerator.generateEsiReturn(records, run.month, run.year);
      case "pt-summary":
        return StatutoryReportsGenerator.generatePtSummary(records, run.month, run.year);
      case "tds-24q":
        return StatutoryReportsGenerator.generateTdsSummary(records, run.month, run.year);
      case "ctc-dept":
        return StatutoryReportsGenerator.generateDepartmentCtcBreakdown(records, run.month, run.year);
      default:
        throw new Error(`Unsupported statutory report type: ${type}`);
    }
  }

  /**
   * Generates double-entry accounting journal entries for Standard CSV, Tally XML or Zoho Books.
   */
  static async generateAccountingExport(
    payrollRunId: string,
    format: "standard" | "tally" | "zoho" = "standard"
  ): Promise<{ filename: string; content: string }> {
    const run = await prisma.payrollRun.findUnique({
      where: { id: payrollRunId },
      include: { payslips: true },
    });

    if (!run) throw new Error("Payroll run not found");

    let totalPfEe = 0;
    let totalPfEr = 0;
    let totalEsiEe = 0;
    let totalEsiEr = 0;
    let totalPt = 0;
    let totalTds = 0;
    let totalLoan = 0;

    for (const p of run.payslips) {
      let calc: any = {};
      try {
        calc = JSON.parse(p.breakdownJson);
      } catch {}
      totalPfEe += calc.pfEmployee || 0;
      totalPfEr += calc.pfEmployer || 0;
      totalEsiEe += calc.esiEmployee || 0;
      totalEsiEr += calc.esiEmployer || 0;
      totalPt += calc.professionalTax || 0;
      totalTds += calc.tds || 0;
      totalLoan += calc.loanRecovery || 0;
    }

    const accountingData: AccountingRunData = {
      runId: run.id,
      month: run.month,
      year: run.year,
      totalGross: run.totalGross,
      totalNetPay: run.totalNetPay,
      totalDeductions: run.totalDeductions,
      totalEmployerCost: run.totalEmployerCost,
      totalPfEmployee: totalPfEe,
      totalPfEmployer: totalPfEr,
      totalEsiEmployee: totalEsiEe,
      totalEsiEmployer: totalEsiEr,
      totalPt,
      totalTds,
      totalLoanRecovery: totalLoan,
    };

    switch (format) {
      case "tally":
        return AccountingJournalExporter.exportTallyXml(accountingData);
      case "zoho":
        return AccountingJournalExporter.exportZohoBooksCsv(accountingData);
      case "standard":
      default:
        return AccountingJournalExporter.exportStandardCsv(accountingData);
    }
  }

  /**
   * Publishes payroll run and its payslips to employees, sending notifications.
   */
  static async publishRun(payrollRunId: string, actorUserId?: number) {
    const run = await prisma.payrollRun.findUnique({
      where: { id: payrollRunId },
      include: {
        payslips: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });

    if (!run) throw new Error("Payroll run not found");
    if (run.status === "DRAFT") {
      throw new Error("Cannot publish draft run. Run must be calculated and approved first.");
    }

    // 1. Mark all payslips as published and PAID
    await prisma.payslip.updateMany({
      where: { payrollRunId },
      data: {
        isPublished: true,
        paymentStatus: "PAID",
      },
    });

    // 2. Mark run status as PAID
    const updatedRun = await prisma.payrollRun.update({
      where: { id: payrollRunId },
      data: {
        status: PayrollRunStatus.PAID,
        paidAt: new Date(),
      },
    });

    // 3. Dispatch in-app notifications
    const monthLabel = `${MONTH_NAMES[run.month - 1]} ${run.year}`;
    const notifications = run.payslips.map((p) => ({
      userId: p.user.id,
      title: `Payslip Published — ${monthLabel}`,
      message: `Your salary payslip for ${monthLabel} has been published and is ready for download.`,
      link: `/dashboard/payroll`,
    }));

    if (notifications.length > 0) {
      await prisma.notification.createMany({
        data: notifications,
      });
    }

    // 4. Log Audit
    await prisma.payrollAuditLog.create({
      data: {
        payrollRunId,
        userId: actorUserId,
        action: "PUBLISH_PAYSLIPS",
        details: `Published payslips for ${run.payslips.length} employees for ${monthLabel}.`,
      },
    });

    return updatedRun;
  }

  /**
   * Retrieves Employee Self-Service (ESS) data scoped strictly to a single employee.
   */
  static async getSelfServiceData(userId: number) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        designation: true,
        department: true,
        joiningDate: true,
        panNumber: true,
        bankName: true,
        bankAccountNumber: true,
        bankIfsc: true,
      },
    });

    if (!user) throw new Error("User not found");

    // Fetch published payslips
    const payslips = await prisma.payslip.findMany({
      where: {
        userId,
        isPublished: true,
      },
      include: {
        payrollRun: {
          select: {
            month: true,
            year: true,
            status: true,
          },
        },
      },
      orderBy: [{ year: "desc" }, { month: "desc" }],
    });

    // Calculate YTD figures (April to March Financial Year)
    const now = new Date();
    const currentFyYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;

    let ytdGross = 0;
    let ytdTax = 0;
    let ytdPf = 0;
    let ytdNet = 0;

    for (const p of payslips) {
      const isCurrentFy =
        (p.year === currentFyYear && p.month >= 4) ||
        (p.year === currentFyYear + 1 && p.month <= 3);

      if (isCurrentFy) {
        ytdGross += p.grossSalary;
        ytdNet += p.netSalary;
        try {
          const calc = JSON.parse(p.breakdownJson);
          ytdTax += calc.tds || 0;
          ytdPf += calc.pfEmployee || 0;
        } catch {}
      }
    }

    // Leave balances
    const leaveBalances = await prisma.leaveBalance.findMany({
      where: {
        userId,
        year: now.getFullYear(),
      },
      include: {
        leaveType: true,
      },
    });

    // Recent attendance summary for current month
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const attendances = await prisma.attendance.findMany({
      where: {
        userId,
        date: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
    });

    const presentDays = attendances.filter((a: any) => a.status === "PRESENT").length;
    const halfDays = attendances.filter((a: any) => a.status === "HALF_DAY").length;
    const absentDays = attendances.filter((a: any) => a.status === "ABSENT").length;
    const onLeaveDays = attendances.filter((a: any) => a.status === "LEAVE").length;

    return {
      user,
      payslips,
      ytd: {
        gross: ytdGross,
        net: ytdNet,
        tax: ytdTax,
        pf: ytdPf,
        financialYear: `FY ${currentFyYear}-${currentFyYear + 1}`,
      },
      leaveBalances,
      attendanceSummary: {
        month: now.getMonth() + 1,
        year: now.getFullYear(),
        presentDays: presentDays + halfDays * 0.5,
        halfDays,
        absentDays,
        onLeaveDays,
        totalLoggedDays: attendances.length,
      },
    };
  }

  /**
   * Retrieves full payslip data formatted for branded PDF generation.
   */
  static async getPayslipForPdf(
    payslipId: string,
    currentUserId?: number,
    userRole?: string
  ): Promise<PayslipPdfData> {
    const payslip = await prisma.payslip.findUnique({
      where: { id: payslipId },
      include: {
        payrollRun: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            designation: true,
            department: true,
            panNumber: true,
            bankName: true,
            bankAccountNumber: true,
            bankIfsc: true,
            joiningDate: true,
          },
        },
      },
    });

    if (!payslip) throw new Error("Payslip not found");

    const isPrivileged = ["ADMIN", "MANAGER", "HR", "FINANCE"].includes(userRole || "");
    if (!isPrivileged && payslip.userId !== currentUserId) {
      throw new Error("Access denied: You can only access your own payslip");
    }

    if (!isPrivileged && !payslip.isPublished) {
      throw new Error("Payslip has not been published yet");
    }

    const settings = await this.getSettings();

    return {
      id: payslip.id,
      month: payslip.month,
      year: payslip.year,
      calendarDays: payslip.calendarDays,
      workingDays: payslip.workingDays,
      payableDays: payslip.payableDays,
      lopDays: payslip.lopDays,
      paidLeaveDays: payslip.paidLeaveDays,
      absentDays: payslip.absentDays,
      holidayDays: payslip.holidayDays,
      weeklyOffDays: payslip.weeklyOffDays,
      overtimeHours: payslip.overtimeHours,
      grossSalary: payslip.grossSalary,
      netSalary: payslip.netSalary,
      totalDeductions: payslip.totalDeductions,
      employerCost: payslip.employerCost,
      paymentStatus: payslip.paymentStatus,
      breakdownJson: payslip.breakdownJson,
      agencyName: settings.companyName,
      user: payslip.user,
    };
  }
}
