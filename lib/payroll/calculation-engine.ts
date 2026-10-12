import { ComponentType, CalculationType } from "@prisma/client";
import {
  PayrollSettingsData,
  StatutoryConfigData,
  EmployeeSalaryInput,
  MonthlyAttendanceSummary,
  MonthlyAdjustmentItem,
  LoanRecoveryItem,
  EmployeePayrollCalculation,
  ComponentBreakdown,
  PayslipLineItem,
} from "./types";

export const ENGINE_VERSION = "2.5.0-PROD";

export const DEFAULT_PT_SLABS = [
  { min: 0, max: 750000, amount: 0 },
  { min: 750001, max: 1000000, amount: 17500 }, // ₹175
  { min: 1000001, max: 999999999, amount: 20000, febAmount: 30000 }, // ₹200 (Feb ₹300)
];

/**
 * Default statutory config fallback (India).
 */
export const DEFAULT_STATUTORY_CONFIG: StatutoryConfigData = {
  country: "IN",
  state: "ALL",
  version: 1,
  pfEmployeeRate: 12.0,
  pfEmployerEpfRate: 3.67,
  pfEmployerEpsRate: 8.33,
  pfEmployerEdliRate: 0.50,
  pfAdminChargesRate: 0.50,
  pfWageCeiling: 1500000, // ₹15,000 in minor units (paise)
  esiEmployeeRate: 0.75,
  esiEmployerRate: 3.25,
  esiWageCeiling: 2100000, // ₹21,000 in minor units (paise)
  ptSlabs: DEFAULT_PT_SLABS,
};

/**
 * Returns number of calendar days in a given month and year.
 */
export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * Pure, deterministic calculation engine for monthly compensation.
 * Free of database dependencies and side effects.
 */
export function calculateEmployeePayroll({
  employee,
  attendance,
  settings,
  statutoryConfig = DEFAULT_STATUTORY_CONFIG,
  adjustments = [],
  loanRecovery,
}: {
  employee: EmployeeSalaryInput;
  attendance: MonthlyAttendanceSummary;
  settings: PayrollSettingsData;
  statutoryConfig?: StatutoryConfigData;
  adjustments?: MonthlyAdjustmentItem[];
  loanRecovery?: LoanRecoveryItem | null;
}): EmployeePayrollCalculation {
  const calendarDays = attendance.calendarDays || getDaysInMonth(attendance.year, attendance.month);
  const month = attendance.month;
  const year = attendance.year;

  // 1. Identify Mid-Month Joining & Exit Dates
  let activeEmploymentDaysInMonth = calendarDays;
  let isMidMonthJoiner = false;
  let isMidMonthLeaver = false;

  if (employee.joiningDate) {
    const jDate = new Date(employee.joiningDate);
    if (jDate.getUTCFullYear() === year && jDate.getUTCMonth() + 1 === month) {
      const joinDay = jDate.getUTCDate();
      if (joinDay > 1) {
        isMidMonthJoiner = true;
        // Non-employed days before joining are excluded
        activeEmploymentDaysInMonth -= (joinDay - 1);
      }
    }
  }

  if (employee.exitDate) {
    const eDate = new Date(employee.exitDate);
    if (eDate.getUTCFullYear() === year && eDate.getUTCMonth() + 1 === month) {
      const exitDay = eDate.getUTCDate();
      if (exitDay < calendarDays) {
        isMidMonthLeaver = true;
        // Non-employed days after exit are excluded
        activeEmploymentDaysInMonth = Math.min(activeEmploymentDaysInMonth, exitDay);
      }
    }
  }

  // 2. Pay Period Divisor
  let divisorDays = calendarDays;
  if (settings.payPeriodType === "FIXED_30") {
    divisorDays = 30;
  } else if (settings.payPeriodType === "FIXED_26") {
    divisorDays = 26;
  } else if (settings.payPeriodType === "WORKING_DAYS") {
    divisorDays = Math.max(1, calendarDays - attendance.weeklyOffDays - attendance.holidayDays);
  }

  // 3. Late Mark Penalties (e.g. 3 late marks = 0.5 day penalty)
  let latePenaltyDays = 0;
  if (settings.lateMarksForHalfDayPenalty > 0 && attendance.lateCount > 0) {
    const penaltyHalfDays = Math.floor(attendance.lateCount / settings.lateMarksForHalfDayPenalty);
    latePenaltyDays = penaltyHalfDays * 0.5;
  }

  // 4. Compute Derived Payable Days
  // Payable Days = Present + Weekly Offs + Holidays + Paid Leaves - (Half Days * 0.5) - Late Penalties
  const rawPayableDays =
    attendance.presentDays +
    attendance.weeklyOffDays +
    attendance.holidayDays +
    attendance.paidLeaveDays -
    attendance.halfDays * 0.5 -
    latePenaltyDays;

  // Cap payable days by both active employment window and divisor
  const payableDays = Math.max(
    0,
    Math.min(rawPayableDays, activeEmploymentDaysInMonth, divisorDays)
  );

  const lopDays = Math.max(0, activeEmploymentDaysInMonth - payableDays);
  const prorationRatio = divisorDays > 0 ? payableDays / divisorDays : 0;

  // 5. Fixed Base Monthly Components
  const { salaryStructure } = employee;
  const fixedBasic = salaryStructure.basicSalary;
  const fixedHra = salaryStructure.hra;
  const fixedSpecialAllowance = salaryStructure.specialAllowance;
  const fixedOtherAllowances = salaryStructure.otherAllowances || 0;
  const fixedMonthlyGross =
    fixedBasic + fixedHra + fixedSpecialAllowance + fixedOtherAllowances;

  // 6. Earned Earnings Proration
  // Prorated components scale with prorationRatio
  const earnedBasic = Math.round(fixedBasic * prorationRatio);
  const earnedHra = Math.round(fixedHra * prorationRatio);
  const earnedSpecialAllowance = Math.round(fixedSpecialAllowance * prorationRatio);
  const earnedOtherAllowances = Math.round(fixedOtherAllowances * prorationRatio);
  const earnedGross =
    earnedBasic + earnedHra + earnedSpecialAllowance + earnedOtherAllowances;

  // 7. Overtime Calculation
  const perDaySalary = divisorDays > 0 ? Math.round(fixedMonthlyGross / divisorDays) : 0;
  const standardHours = settings.standardWorkHours || 8.0;
  const perHourSalary = Math.round(perDaySalary / standardHours);
  const overtimeHourlyRate = Math.round(
    perHourSalary * (settings.overtimeHourlyRateMultiplier || 1.5)
  );

  let overtimePay = 0;
  if (settings.enableOvertime && attendance.totalOvertimeHours > 0) {
    overtimePay = Math.round(attendance.totalOvertimeHours * overtimeHourlyRate);
  }

  // 8. Monthly Variable Adjustments (Bonuses, Reimbursements, Arrears)
  let bonus = salaryStructure.fixedBonus || 0;
  let reimbursements = 0;
  let oneTimeEarnings = 0;
  let arrears = 0;
  let leaveEncashment = 0;
  let otherDeductions = 0;

  let loanFromAdjustments = 0;

  for (const adj of adjustments) {
    if (adj.type === "BONUS" || adj.type === "INCENTIVE") {
      bonus += adj.amount;
    } else if (adj.type === "REIMBURSEMENT") {
      reimbursements += adj.amount;
    } else if (adj.type === "ONE_TIME_EARNING") {
      oneTimeEarnings += adj.amount;
    } else if (adj.type === "ARREARS") {
      arrears += adj.amount;
    } else if (adj.type === "LEAVE_ENCASHMENT") {
      leaveEncashment += adj.amount;
    } else if (adj.type === "DEDUCTION" || adj.type === "RECOVERY") {
      otherDeductions += adj.amount;
    } else if (adj.type === "LOAN_ADVANCE") {
      loanFromAdjustments += adj.amount;
    }
  }

  const totalAdditions =
    overtimePay + bonus + reimbursements + oneTimeEarnings + arrears + leaveEncashment;
  const totalEarnings = earnedGross + totalAdditions;

  // 9. Statutory Deductions
  // 9.1 Provident Fund (PF) with EPS / EPF / EDLI / Admin Split
  let pfEmployee = 0;
  let pfEmployerEpf = 0;
  let pfEmployerEps = 0;
  let pfEmployerEdli = 0;
  let pfAdminCharges = 0;
  let pfEmployerTotal = 0;

  if (salaryStructure.pfDeduction) {
    const pfCeiling = statutoryConfig.pfWageCeiling || 1500000; // ₹15,000 in paise
    const pfWageBase = Math.min(earnedBasic, pfCeiling);

    pfEmployee = Math.round((pfWageBase * (statutoryConfig.pfEmployeeRate || 12.0)) / 100);
    pfEmployerEpf = Math.round((pfWageBase * (statutoryConfig.pfEmployerEpfRate || 3.67)) / 100);

    // EPS capped at ₹1,250 / 125000 paise (8.33% of ₹15,000)
    pfEmployerEps = Math.min(125000, Math.round((pfWageBase * (statutoryConfig.pfEmployerEpsRate || 8.33)) / 100));

    // EDLI capped at ₹75 / 7500 paise (0.50% of ₹15,000)
    pfEmployerEdli = Math.min(7500, Math.round((pfWageBase * (statutoryConfig.pfEmployerEdliRate || 0.50)) / 100));

    // Admin charges (0.50%)
    pfAdminCharges = Math.round((pfWageBase * (statutoryConfig.pfAdminChargesRate || 0.50)) / 100);

    pfEmployerTotal = pfEmployerEpf + pfEmployerEps + pfEmployerEdli + pfAdminCharges;
  }

  // 9.2 Employee State Insurance (ESI)
  let esiEmployee = 0;
  let esiEmployer = 0;

  if (salaryStructure.esiDeduction) {
    const esiCeiling = statutoryConfig.esiWageCeiling || 2100000; // ₹21,000 in paise
    // ESI applies ONLY if fixed monthly gross is within the threshold
    if (fixedMonthlyGross <= esiCeiling) {
      esiEmployee = Math.round((earnedGross * (statutoryConfig.esiEmployeeRate || 0.75)) / 100);
      esiEmployer = Math.round((earnedGross * (statutoryConfig.esiEmployerRate || 3.25)) / 100);
    }
  }

  // 9.3 Professional Tax (PT)
  let professionalTax = 0;
  if (salaryStructure.professionalTax) {
    const ptSlabs = statutoryConfig.ptSlabs || DEFAULT_STATUTORY_CONFIG.ptSlabs;
    const isFebruary = month === 2;

    for (const slab of ptSlabs) {
      if (earnedGross >= slab.min && earnedGross <= slab.max) {
        professionalTax = isFebruary && slab.febAmount !== undefined ? slab.febAmount : slab.amount;
        break;
      }
    }
  }

  // 9.4 Tax Deducted at Source (TDS)
  const tds = salaryStructure.tdsMonthly || 0;

  // 10. Loan Advance Recovery with Negative Net Pay Protection
  let loanAdvanceRecovery = 0;
  let loanShortfall = 0;
  const scheduledLoanEmi =
    (loanRecovery?.installmentEmi ?? loanRecovery?.scheduledEmi ?? 0) + loanFromAdjustments;

  const mandatoryDeductions =
    pfEmployee + esiEmployee + professionalTax + tds + otherDeductions;

  if (scheduledLoanEmi > 0) {
    // Net salary cannot be negative
    const maxAvailableForLoan = Math.max(0, totalEarnings - mandatoryDeductions);
    loanAdvanceRecovery = Math.min(scheduledLoanEmi, maxAvailableForLoan);
    loanShortfall = scheduledLoanEmi - loanAdvanceRecovery;
  }

  // Total Employee Deductions & Total Employer Contributions
  const totalEmployeeDeductions = mandatoryDeductions + loanAdvanceRecovery;
  const totalEmployerContributions = pfEmployerTotal + esiEmployer;

  // 11. Final Reconciled Totals
  const netSalary = Math.max(0, totalEarnings - totalEmployeeDeductions);
  const totalEmployerCost = totalEarnings + totalEmployerContributions;

  // 12. Normalized Lines for PayslipLine Table (Immutable Audit Records)
  const lines: PayslipLineItem[] = [];

  // Earning lines
  lines.push({
    code: "BASIC",
    name: "Basic Salary",
    type: ComponentType.EARNING,
    rate: fixedBasic,
    earnedAmount: earnedBasic,
    calculationNote: `Prorated: (₹${(fixedBasic / 100).toFixed(0)} × ${payableDays}/${divisorDays} days)`,
    order: 1,
  });

  lines.push({
    code: "HRA",
    name: "House Rent Allowance (HRA)",
    type: ComponentType.EARNING,
    rate: fixedHra,
    earnedAmount: earnedHra,
    calculationNote: `Prorated: (₹${(fixedHra / 100).toFixed(0)} × ${payableDays}/${divisorDays} days)`,
    order: 2,
  });

  lines.push({
    code: "SPECIAL_ALLOWANCE",
    name: "Special Allowance",
    type: ComponentType.EARNING,
    rate: fixedSpecialAllowance,
    earnedAmount: earnedSpecialAllowance,
    calculationNote: `Prorated: (₹${(fixedSpecialAllowance / 100).toFixed(0)} × ${payableDays}/${divisorDays} days)`,
    order: 3,
  });

  if (fixedOtherAllowances > 0) {
    lines.push({
      code: "OTHER_ALLOWANCES",
      name: "Other Allowances",
      type: ComponentType.EARNING,
      rate: fixedOtherAllowances,
      earnedAmount: earnedOtherAllowances,
      calculationNote: `Prorated: (₹${(fixedOtherAllowances / 100).toFixed(0)} × ${payableDays}/${divisorDays} days)`,
      order: 4,
    });
  }

  if (overtimePay > 0) {
    lines.push({
      code: "OVERTIME",
      name: "Overtime Pay",
      type: ComponentType.EARNING,
      rate: overtimeHourlyRate,
      earnedAmount: overtimePay,
      calculationNote: `${attendance.totalOvertimeHours} hrs @ ₹${(overtimeHourlyRate / 100).toFixed(2)}/hr (${settings.overtimeHourlyRateMultiplier || 1.5}x)`,
      order: 5,
    });
  }

  if (bonus > 0) {
    lines.push({
      code: "BONUS",
      name: "Performance Bonus / Incentive",
      type: ComponentType.EARNING,
      rate: bonus,
      earnedAmount: bonus,
      calculationNote: "Monthly variable bonus award",
      order: 6,
    });
  }

  if (reimbursements > 0) {
    lines.push({
      code: "REIMBURSEMENT",
      name: "Reimbursements (Non-Taxable)",
      type: ComponentType.REIMBURSEMENT,
      rate: reimbursements,
      earnedAmount: reimbursements,
      calculationNote: "Approved internet / travel expense claims",
      order: 7,
    });
  }

  if (arrears > 0) {
    lines.push({
      code: "ARREARS",
      name: "Salary Arrears",
      type: ComponentType.EARNING,
      rate: arrears,
      earnedAmount: arrears,
      calculationNote: "Retroactive revision arrears payout",
      order: 8,
    });
  }

  if (leaveEncashment > 0) {
    lines.push({
      code: "LEAVE_ENCASHMENT",
      name: "Leave Encashment",
      type: ComponentType.EARNING,
      rate: leaveEncashment,
      earnedAmount: leaveEncashment,
      calculationNote: "Encashment of accumulated privilege leaves",
      order: 9,
    });
  }

  if (oneTimeEarnings > 0) {
    lines.push({
      code: "ONE_TIME_EARNING",
      name: "One-Time Earnings",
      type: ComponentType.EARNING,
      rate: oneTimeEarnings,
      earnedAmount: oneTimeEarnings,
      calculationNote: "Special cycle addition",
      order: 10,
    });
  }

  // Deduction lines
  if (pfEmployee > 0) {
    lines.push({
      code: "PF_EE",
      name: "Provident Fund (Employee 12%)",
      type: ComponentType.DEDUCTION,
      rate: pfEmployee,
      earnedAmount: pfEmployee,
      calculationNote: `12% of Basic capped at ₹15,000 wage ceiling (Wage Base: ₹${(Math.min(earnedBasic, statutoryConfig.pfWageCeiling || 1500000) / 100).toFixed(0)})`,
      order: 20,
    });
  }

  if (esiEmployee > 0) {
    lines.push({
      code: "ESI_EE",
      name: "ESI (Employee 0.75%)",
      type: ComponentType.DEDUCTION,
      rate: esiEmployee,
      earnedAmount: esiEmployee,
      calculationNote: "0.75% of earned gross salary",
      order: 21,
    });
  }

  if (professionalTax > 0) {
    lines.push({
      code: "PT",
      name: "Professional Tax",
      type: ComponentType.DEDUCTION,
      rate: professionalTax,
      earnedAmount: professionalTax,
      calculationNote: `State PT slab deduction${month === 2 ? " (Feb ₹300 schedule)" : ""}`,
      order: 22,
    });
  }

  if (tds > 0) {
    lines.push({
      code: "TDS",
      name: "Income Tax (TDS)",
      type: ComponentType.DEDUCTION,
      rate: tds,
      earnedAmount: tds,
      calculationNote: "Monthly tax deducted at source",
      order: 23,
    });
  }

  if (loanAdvanceRecovery > 0) {
    lines.push({
      code: "LOAN_RECOVERY",
      name: "Loan / Advance Recovery",
      type: ComponentType.DEDUCTION,
      rate: scheduledLoanEmi,
      earnedAmount: loanAdvanceRecovery,
      calculationNote:
        loanShortfall > 0
          ? `Partial EMI recovery: ₹${(loanAdvanceRecovery / 100).toFixed(2)} (Shortfall ₹${(loanShortfall / 100).toFixed(2)} deferred to prevent negative net pay)`
          : `Full scheduled EMI deduction of ₹${(loanAdvanceRecovery / 100).toFixed(2)}`,
      order: 24,
    });
  }

  if (otherDeductions > 0) {
    lines.push({
      code: "OTHER_DEDUCTIONS",
      name: "Other Deductions",
      type: ComponentType.DEDUCTION,
      rate: otherDeductions,
      earnedAmount: otherDeductions,
      calculationNote: "Approved monthly deduction adjustments",
      order: 25,
    });
  }

  // Employer Contribution lines
  if (pfEmployerTotal > 0) {
    lines.push({
      code: "PF_ER_EPF",
      name: "Employer EPF Contribution (3.67%)",
      type: ComponentType.EMPLOYER_CONTRIBUTION,
      rate: pfEmployerEpf,
      earnedAmount: pfEmployerEpf,
      calculationNote: "3.67% of eligible PF wage base",
      order: 30,
    });

    lines.push({
      code: "PF_ER_EPS",
      name: "Employer EPS Pension Contribution (8.33%)",
      type: ComponentType.EMPLOYER_CONTRIBUTION,
      rate: pfEmployerEps,
      earnedAmount: pfEmployerEps,
      calculationNote: "8.33% of eligible PF wage base (legally capped at ₹1,250)",
      order: 31,
    });

    lines.push({
      code: "PF_ER_EDLI",
      name: "Employer EDLI Insurance (0.50%)",
      type: ComponentType.EMPLOYER_CONTRIBUTION,
      rate: pfEmployerEdli,
      earnedAmount: pfEmployerEdli,
      calculationNote: "0.50% of eligible PF wage base (capped at ₹75)",
      order: 32,
    });

    lines.push({
      code: "PF_ADMIN",
      name: "PF Admin Charges (0.50%)",
      type: ComponentType.EMPLOYER_CONTRIBUTION,
      rate: pfAdminCharges,
      earnedAmount: pfAdminCharges,
      calculationNote: "0.50% PF administrative handling charges",
      order: 33,
    });
  }

  if (esiEmployer > 0) {
    lines.push({
      code: "ESI_ER",
      name: "Employer ESI Contribution (3.25%)",
      type: ComponentType.EMPLOYER_CONTRIBUTION,
      rate: esiEmployer,
      earnedAmount: esiEmployer,
      calculationNote: "3.25% of earned gross salary",
      order: 34,
    });
  }

  // 13. UI Component Breakdown & Transparent Notes
  const components: ComponentBreakdown[] = lines.map((l) => ({
    component: l.name,
    rate: l.rate,
    earned: l.earnedAmount,
    isDeduction: l.type === ComponentType.DEDUCTION,
    notes: l.calculationNote,
  }));

  const notes: string[] = [
    `Payable Days Derived: ${payableDays} of ${divisorDays} days (${settings.payPeriodType} divisor).`,
    `Employment Active Days: ${activeEmploymentDaysInMonth} days${isMidMonthJoiner ? " (Mid-month joiner)" : ""}${isMidMonthLeaver ? " (Mid-month exit)" : ""}.`,
  ];

  if (latePenaltyDays > 0) {
    notes.push(
      `Late Arrival Penalty: ${latePenaltyDays} day(s) deducted for ${attendance.lateCount} late mark(s).`
    );
  }

  if (loanShortfall > 0) {
    notes.push(
      `Loan EMI Cap Alert: ₹${(loanShortfall / 100).toFixed(2)} shortfall carried forward to protect net take-home pay.`
    );
  }

  return {
    userId: employee.userId,
    userName: employee.userName,
    userEmail: employee.userEmail,
    designation: employee.designation || undefined,
    department: employee.department || undefined,
    month,
    year,
    currency: settings.currency || "INR",

    calendarDays,
    divisorDays,
    workingDays: attendance.standardWorkingDays,
    weeklyOffDays: attendance.weeklyOffDays,
    holidayDays: attendance.holidayDays,
    presentDays: attendance.presentDays,
    absentDays: attendance.absentDays,
    halfDays: attendance.halfDays,
    paidLeaveDays: attendance.paidLeaveDays,
    unpaidLeaveDays: attendance.unpaidLeaveDays,
    lateCount: attendance.lateCount,
    latePenaltyDays,
    payableDays,
    lopDays,

    isMidMonthJoiner,
    isMidMonthLeaver,
    activeEmploymentDaysInMonth,

    fixedBasic,
    fixedHra,
    fixedSpecialAllowance,
    fixedOtherAllowances,
    fixedMonthlyGross,

    earnedBasic,
    earnedHra,
    earnedSpecialAllowance,
    earnedOtherAllowances,
    earnedGross,

    overtimeHours: attendance.totalOvertimeHours,
    overtimeHourlyRate,
    overtimePay,
    bonus,
    reimbursements,
    oneTimeEarnings,
    arrears,
    leaveEncashment,
    totalAdditions,
    totalEarnings,

    pfEmployee,
    pfEmployer: pfEmployerEpf + pfEmployerEps,
    pfEmployerEpf,
    pfEmployerEps,
    pfEmployerEdli,
    pfAdminCharges,
    pfEmployerTotal,

    esiEmployee,
    esiEmployer,
    professionalTax,
    tds,
    loanAdvanceRecovery,
    loanShortfall,
    otherDeductions,
    totalEmployeeDeductions,
    totalEmployerContributions,

    netSalary,
    totalEmployerCost,

    lines,

    formulaBreakdown: {
      perDaySalary,
      perHourSalary,
      payableDaysFormula: `${attendance.presentDays}P + ${attendance.weeklyOffDays}WO + ${attendance.holidayDays}H + ${attendance.paidLeaveDays}PL - (${attendance.halfDays}HD × 0.5) - ${latePenaltyDays}LP = ${payableDays} days`,
      earnedGrossFormula: `Earned Basic (₹${(earnedBasic / 100).toFixed(0)}) + HRA (₹${(earnedHra / 100).toFixed(0)}) + Special (₹${(earnedSpecialAllowance / 100).toFixed(0)}) = ₹${(earnedGross / 100).toFixed(0)}`,
      components,
      notes,
      statutoryNotes: {
        pf: pfEmployee > 0 ? `EPF: 12% on ₹${(Math.min(earnedBasic, statutoryConfig.pfWageCeiling || 1500000) / 100).toFixed(0)} | EPS: ₹${(pfEmployerEps / 100).toFixed(0)}` : "Not enrolled",
        esi: esiEmployee > 0 ? `ESI: 0.75% EE, 3.25% ER on ₹${(earnedGross / 100).toFixed(0)}` : "Exempt / Non-eligible",
        pt: professionalTax > 0 ? `PT: ₹${(professionalTax / 100).toFixed(0)}` : "Nil",
        tds: tds > 0 ? `TDS: ₹${(tds / 100).toFixed(0)}/mo` : "Nil",
      },
    },

    engineVersion: ENGINE_VERSION,
    calculatedAt: new Date().toISOString(),
  };
}
