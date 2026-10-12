import assert from "node:assert";
import {
  calculateEmployeePayroll,
  getDaysInMonth,
  DEFAULT_PT_SLABS,
  DEFAULT_STATUTORY_CONFIG,
} from "./calculation-engine";
import {
  PayrollSettingsData,
  EmployeeSalaryInput,
  MonthlyAttendanceSummary,
  MonthlyAdjustmentItem,
  LoanRecoveryItem,
  StatutoryConfigData,
} from "./types";
import { ComponentType } from "@prisma/client";

console.log("=================================================================");
console.log("▶ RUNNING PHASE 3 CALCULATION ENGINE GOLDEN VERIFICATION SUITE");
console.log("=================================================================\n");

const baseSettings: PayrollSettingsData = {
  id: "default",
  companyName: "Production Agency",
  currency: "INR",
  payPeriodType: "CALENDAR_DAYS",
  weeklyOffDays: [0], // Sundays
  standardWorkHours: 8,
  enableOvertime: true,
  overtimeHourlyRateMultiplier: 1.5,
  lateMarkGraceMinutes: 15,
  lateMarksForHalfDayPenalty: 3,
  pfEmployeeRate: 12.0,
  pfEmployerRate: 12.0,
  pfWageCeiling: 1500000, // ₹15,000
  esiEmployeeRate: 0.75,
  esiEmployerRate: 3.25,
  esiWageCeiling: 2100000, // ₹21,000
  ptSlabs: DEFAULT_PT_SLABS,
};

// -------------------------------------------------------------------------
// TEST 1: Mid-Month Joiner Proration
// Employee joined on 16th April 2026 (30 calendar days). Active days = 15.
// -------------------------------------------------------------------------
{
  console.log("TEST 1: Mid-Month Joiner (Joined April 16th)");
  const employee: EmployeeSalaryInput = {
    userId: 101,
    userName: "Ananya Deshmukh",
    userEmail: "ananya@agency.com",
    joiningDate: "2026-04-16T00:00:00.000Z",
    salaryStructure: {
      basicSalary: 4000000, // ₹40,000
      hra: 2000000, // ₹20,000
      specialAllowance: 2000000, // ₹20,000
      otherAllowances: 0,
      fixedBonus: 0,
      variablePay: 0,
      monthlyGross: 8000000, // ₹80,000
      ctcMonthly: 8500000,
      pfDeduction: true,
      esiDeduction: false,
      professionalTax: true,
      tdsMonthly: 0,
    },
  };

  const attendance: MonthlyAttendanceSummary = {
    userId: 101,
    month: 4,
    year: 2026,
    calendarDays: 30,
    weeklyOffDays: 2, // 2 Sundays in the second half
    holidayDays: 0,
    standardWorkingDays: 13,
    presentDays: 13,
    absentDays: 0,
    halfDays: 0,
    paidLeaveDays: 0,
    unpaidLeaveDays: 0,
    lateCount: 0,
    totalLateMinutes: 0,
    totalOvertimeHours: 0,
  };

  const calc = calculateEmployeePayroll({
    employee,
    attendance,
    settings: baseSettings,
  });

  assert.strictEqual(calc.isMidMonthJoiner, true, "Should be flagged as mid-month joiner");
  assert.strictEqual(calc.activeEmploymentDaysInMonth, 15, "Active employment days should be 15");
  assert.strictEqual(calc.payableDays, 15, "Payable days capped at active employment days (15)");

  // Proration ratio = 15 / 30 = 0.50
  assert.strictEqual(calc.earnedGross, 4000000, "Earned gross must be exactly 50% (₹40,000)");
  assert.strictEqual(calc.earnedBasic, 2000000, "Earned basic must be exactly 50% (₹20,000)");
  assert.strictEqual(calc.earnedHra, 1000000, "Earned HRA must be ₹10,000");

  // PF ceiling ₹15,000 applies since ₹20,000 > ₹15,000: 12% of 15,000 = ₹1,800 (180,000 paise)
  assert.strictEqual(calc.pfEmployee, 180000, "PF Employee should be ₹1,800");

  console.log("  ✔ Mid-month joiner proration and caps verified.\n");
}

// -------------------------------------------------------------------------
// TEST 2: Mid-Month Exit / Resignation Proration
// Employee relieved on 10th April 2026. Active days = 10.
// -------------------------------------------------------------------------
{
  console.log("TEST 2: Mid-Month Exit (Relieved April 10th)");
  const employee: EmployeeSalaryInput = {
    userId: 102,
    userName: "Vikram Malhotra",
    userEmail: "vikram@agency.com",
    exitDate: "2026-04-10T00:00:00.000Z",
    salaryStructure: {
      basicSalary: 3000000, // ₹30,000
      hra: 1500000, // ₹15,000
      specialAllowance: 1500000, // ₹15,000
      otherAllowances: 0,
      fixedBonus: 0,
      variablePay: 0,
      monthlyGross: 6000000, // ₹60,000
      ctcMonthly: 6500000,
      pfDeduction: true,
      esiDeduction: false,
      professionalTax: true,
      tdsMonthly: 0,
    },
  };

  const attendance: MonthlyAttendanceSummary = {
    userId: 102,
    month: 4,
    year: 2026,
    calendarDays: 30,
    weeklyOffDays: 1, // 1 Sunday in the first 10 days
    holidayDays: 1, // 1 holiday
    standardWorkingDays: 8,
    presentDays: 8,
    absentDays: 0,
    halfDays: 0,
    paidLeaveDays: 0,
    unpaidLeaveDays: 0,
    lateCount: 0,
    totalLateMinutes: 0,
    totalOvertimeHours: 0,
  };

  const calc = calculateEmployeePayroll({
    employee,
    attendance,
    settings: baseSettings,
  });

  assert.strictEqual(calc.isMidMonthLeaver, true, "Should be flagged as mid-month leaver");
  assert.strictEqual(calc.activeEmploymentDaysInMonth, 10, "Active employment days should be 10");
  assert.strictEqual(calc.payableDays, 10, "Payable days capped at 10");

  // Proration ratio = 10 / 30 = 1/3
  assert.strictEqual(calc.earnedGross, 2000000, "Earned gross must be exactly ₹20,000 (1/3 of ₹60,000)");
  assert.strictEqual(calc.earnedBasic, 1000000, "Earned basic must be ₹10,000 (1/3 of ₹30,000)");

  // PF on Basic ₹10,000 (below ₹15,000 ceiling): 12% of ₹10,000 = ₹1,200 (120,000 paise)
  assert.strictEqual(calc.pfEmployee, 120000, "PF on ₹10,000 earned basic should be ₹1,200");

  console.log("  ✔ Mid-month exit proration verified.\n");
}

// -------------------------------------------------------------------------
// TEST 3: Configurable Pay Period Divisor (FIXED_26 vs CALENDAR_DAYS)
// -------------------------------------------------------------------------
{
  console.log("TEST 3: Configurable Divisors (FIXED_26)");
  const settingsFixed26: PayrollSettingsData = {
    ...baseSettings,
    payPeriodType: "FIXED_26",
  };

  const employee: EmployeeSalaryInput = {
    userId: 103,
    userName: "Kavita Rao",
    userEmail: "kavita@agency.com",
    salaryStructure: {
      basicSalary: 2600000, // ₹26,000
      hra: 1300000, // ₹13,000
      specialAllowance: 1300000, // ₹13,000
      otherAllowances: 0,
      fixedBonus: 0,
      variablePay: 0,
      monthlyGross: 5200000, // ₹52,000
      ctcMonthly: 5500000,
      pfDeduction: false,
      esiDeduction: false,
      professionalTax: false,
      tdsMonthly: 0,
    },
  };

  const attendance: MonthlyAttendanceSummary = {
    userId: 103,
    month: 4,
    year: 2026,
    calendarDays: 30,
    weeklyOffDays: 4,
    holidayDays: 0,
    standardWorkingDays: 26,
    presentDays: 20, // 20 present out of 26
    absentDays: 2,
    halfDays: 0,
    paidLeaveDays: 0,
    unpaidLeaveDays: 0,
    lateCount: 0,
    totalLateMinutes: 0,
    totalOvertimeHours: 0,
  };

  const calc = calculateEmployeePayroll({
    employee,
    attendance,
    settings: settingsFixed26,
  });

  // Payable days = 20 present + 4 weekly offs = 24 days out of 26
  assert.strictEqual(calc.divisorDays, 26, "Divisor days must be 26");
  assert.strictEqual(calc.payableDays, 24, "Payable days should be 24");
  // Per day salary = 5,200,000 / 26 = 200,000 paise (₹2,000/day)
  // Earned gross = 5,200,000 * (24/26) = 4,800,000 paise (₹48,000)
  assert.strictEqual(calc.earnedGross, 4800000, "Earned gross must be exactly ₹48,000");

  console.log("  ✔ Fixed 26-day divisor calculation verified.\n");
}

// -------------------------------------------------------------------------
// TEST 4: Statutory Split - PF EPF/EPS/EDLI/Admin Breakdown
// Basic = ₹30,000 (> ₹15,000 ceiling). Wage base = ₹15,000.
// -------------------------------------------------------------------------
{
  console.log("TEST 4: PF Statutory EPF/EPS/EDLI/Admin Breakdown");
  const employee: EmployeeSalaryInput = {
    userId: 104,
    userName: "Amit Verma",
    userEmail: "amit@agency.com",
    salaryStructure: {
      basicSalary: 3000000,
      hra: 1500000,
      specialAllowance: 1500000,
      otherAllowances: 0,
      fixedBonus: 0,
      variablePay: 0,
      monthlyGross: 6000000,
      ctcMonthly: 6500000,
      pfDeduction: true,
      esiDeduction: false,
      professionalTax: false,
      tdsMonthly: 0,
    },
  };

  const attendance: MonthlyAttendanceSummary = {
    userId: 104,
    month: 4,
    year: 2026,
    calendarDays: 30,
    weeklyOffDays: 4,
    holidayDays: 1,
    standardWorkingDays: 25,
    presentDays: 25,
    absentDays: 0,
    halfDays: 0,
    paidLeaveDays: 0,
    unpaidLeaveDays: 0,
    lateCount: 0,
    totalLateMinutes: 0,
    totalOvertimeHours: 0,
  };

  const calc = calculateEmployeePayroll({
    employee,
    attendance,
    settings: baseSettings,
  });

  // Base = 1,500,000 paise (₹15,000)
  // Employee PF: 12% = 180,000 paise (₹1,800)
  assert.strictEqual(calc.pfEmployee, 180000, "Employee PF should be ₹1,800");

  // Employer EPF: 3.67% of 15,000 = 55,050 paise (₹550.50)
  assert.strictEqual(calc.pfEmployerEpf, 55050, "Employer EPF (3.67%) = 55,050 paise");

  // Employer EPS: 8.33% capped at ₹1,250 (125,000 paise). 8.33% of 1,500,000 = 124,950 paise
  assert.strictEqual(calc.pfEmployerEps, 124950, "Employer EPS = 124,950 paise");

  // EDLI: 0.50% of 15,000 = 7,500 paise (₹75)
  assert.strictEqual(calc.pfEmployerEdli, 7500, "Employer EDLI = 7,500 paise");

  // Admin charges: 0.50% of 15,000 = 7,500 paise (₹75)
  assert.strictEqual(calc.pfAdminCharges, 7500, "PF Admin charges = 7,500 paise");

  // Total Employer PF cost = 55,050 + 124,950 + 7,500 + 7,500 = 195,000 paise (₹1,950 = 13%)
  assert.strictEqual(calc.pfEmployerTotal, 195000, "Employer PF Total should be 195,000 paise");

  console.log("  ✔ Indian PF statutory breakdown verified.\n");
}

// -------------------------------------------------------------------------
// TEST 5: Professional Tax February Surcharge Schedule
// Highest slab in Feb has ₹300 (30,000 paise) instead of ₹200 (20,000 paise).
// -------------------------------------------------------------------------
{
  console.log("TEST 5: Professional Tax February Surcharge Schedule");
  const employee: EmployeeSalaryInput = {
    userId: 105,
    userName: "Sneha Patel",
    userEmail: "sneha@agency.com",
    salaryStructure: {
      basicSalary: 2500000,
      hra: 1500000,
      specialAllowance: 1000000,
      otherAllowances: 0,
      fixedBonus: 0,
      variablePay: 0,
      monthlyGross: 5000000, // ₹50,000
      ctcMonthly: 5500000,
      pfDeduction: false,
      esiDeduction: false,
      professionalTax: true,
      tdsMonthly: 0,
    },
  };

  // January (Month 1): should be ₹200
  const janAttendance: MonthlyAttendanceSummary = {
    userId: 105,
    month: 1,
    year: 2026,
    calendarDays: 31,
    weeklyOffDays: 4,
    holidayDays: 1,
    standardWorkingDays: 26,
    presentDays: 26,
    absentDays: 0,
    halfDays: 0,
    paidLeaveDays: 0,
    unpaidLeaveDays: 0,
    lateCount: 0,
    totalLateMinutes: 0,
    totalOvertimeHours: 0,
  };

  const janCalc = calculateEmployeePayroll({
    employee,
    attendance: janAttendance,
    settings: baseSettings,
  });
  assert.strictEqual(janCalc.professionalTax, 20000, "January PT should be ₹200 (20,000 paise)");

  // February (Month 2): should be ₹300
  const febAttendance: MonthlyAttendanceSummary = {
    ...janAttendance,
    month: 2,
    calendarDays: 28,
    standardWorkingDays: 24,
    presentDays: 24,
  };

  const febCalc = calculateEmployeePayroll({
    employee,
    attendance: febAttendance,
    settings: baseSettings,
  });
  assert.strictEqual(febCalc.professionalTax, 30000, "February PT should be ₹300 (30,000 paise)");

  console.log("  ✔ Professional tax February schedule verified.\n");
}

// -------------------------------------------------------------------------
// TEST 6: Loan Recovery Capping & Negative Net Pay Protection
// Scheduled EMI = ₹25,000. Employee has only ₹10,000 available earnings.
// Net salary MUST NOT become negative. Shortfall must be deferred.
// -------------------------------------------------------------------------
{
  console.log("TEST 6: Loan Recovery Cap & Zero-Negative Take-Home Protection");
  const employee: EmployeeSalaryInput = {
    userId: 106,
    userName: "Devendra Kulkarni",
    userEmail: "devendra@agency.com",
    salaryStructure: {
      basicSalary: 1000000, // ₹10,000
      hra: 500000, // ₹5,000
      specialAllowance: 500000, // ₹5,000
      otherAllowances: 0,
      fixedBonus: 0,
      variablePay: 0,
      monthlyGross: 2000000, // ₹20,000
      ctcMonthly: 2200000,
      pfDeduction: true, // ₹10,000 * 12% = ₹1,200 (120,000 paise)
      esiDeduction: false,
      professionalTax: true, // ₹200 (20,000 paise)
      tdsMonthly: 0,
    },
  };

  // Only worked 10 days out of 30 -> Earned gross = ₹6,667
  const attendance: MonthlyAttendanceSummary = {
    userId: 106,
    month: 4,
    year: 2026,
    calendarDays: 30,
    weeklyOffDays: 4,
    holidayDays: 0,
    standardWorkingDays: 26,
    presentDays: 6, // 6 present + 4 WO = 10 payable days
    absentDays: 20,
    halfDays: 0,
    paidLeaveDays: 0,
    unpaidLeaveDays: 0,
    lateCount: 0,
    totalLateMinutes: 0,
    totalOvertimeHours: 0,
  };

  // Scheduled Loan EMI = ₹15,000 (1,500,000 paise), which exceeds net pay!
  const loanRecovery: LoanRecoveryItem = {
    loanAdvanceId: "loan_123",
    installmentEmi: 1500000, // ₹15,000
    balanceRemaining: 5000000,
  };

  const calc = calculateEmployeePayroll({
    employee,
    attendance,
    settings: baseSettings,
    loanRecovery,
  });

  // Earned gross: 2,000,000 * (10/30) = 666,667 paise
  // Earned basic: 1,000,000 * (10/30) = 333,333 paise
  // Mandatory PF (12% of 333,333) = 40,000 paise
  // Mandatory PT = 0 (earned gross < ₹7,500)
  // Max available for loan = 666,667 - 40,000 = 626,667 paise
  assert.ok(calc.netSalary >= 0, "Net salary must never be negative");
  assert.strictEqual(calc.netSalary, 0, "Net salary should be protected to 0 exactly");
  assert.strictEqual(calc.loanAdvanceRecovery, 626667, "Loan recovered should be capped at available pay");
  assert.strictEqual(calc.loanShortfall, 1500000 - 626667, "Shortfall should be deferred");

  console.log(`  ✔ Loan recovery capped at ₹${(calc.loanAdvanceRecovery / 100).toFixed(2)} with ₹${(calc.loanShortfall / 100).toFixed(2)} shortfall deferred.\n`);
}

// -------------------------------------------------------------------------
// TEST 7: Complete Mathematical Audit of Lines to Header Totals
// Every line item in `lines` must exactly sum to header gross, additions,
// deductions, employer cost, and net pay. Zero float drift.
// -------------------------------------------------------------------------
{
  console.log("TEST 7: Audit of PayslipLine Items vs Header Totals");
  const employee: EmployeeSalaryInput = {
    userId: 107,
    userName: "Meera Nair",
    userEmail: "meera@agency.com",
    salaryStructure: {
      basicSalary: 3500000, // ₹35,000
      hra: 1750000, // ₹17,500
      specialAllowance: 1250000, // ₹12,500
      otherAllowances: 500000, // ₹5,000
      fixedBonus: 0,
      variablePay: 0,
      monthlyGross: 7000000, // ₹70,000
      ctcMonthly: 7800000,
      pfDeduction: true,
      esiDeduction: false,
      professionalTax: true,
      tdsMonthly: 300000, // ₹3,000
    },
  };

  const attendance: MonthlyAttendanceSummary = {
    userId: 107,
    month: 4,
    year: 2026,
    calendarDays: 30,
    weeklyOffDays: 4,
    holidayDays: 1,
    standardWorkingDays: 25,
    presentDays: 22,
    absentDays: 2,
    halfDays: 1, // 0.5
    paidLeaveDays: 1,
    unpaidLeaveDays: 0,
    lateCount: 3, // 1 half day penalty (-0.5)
    totalLateMinutes: 65,
    totalOvertimeHours: 6,
  };

  const adjustments: MonthlyAdjustmentItem[] = [
    { userId: 107, type: "REIMBURSEMENT", title: "Client Dinner", amount: 450000 }, // ₹4,500
    { userId: 107, type: "BONUS", title: "Spot Award", amount: 1000000 }, // ₹10,000
    { userId: 107, type: "DEDUCTION", title: "Keycard Loss", amount: 50000 }, // ₹500
  ];

  const calc = calculateEmployeePayroll({
    employee,
    attendance,
    settings: baseSettings,
    adjustments,
  });

  // Calculate sum of earning lines (including non-taxable reimbursement)
  const earningLinesSum = calc.lines
    .filter((l) => l.type === ComponentType.EARNING || l.type === ComponentType.REIMBURSEMENT)
    .reduce((sum, l) => sum + l.earnedAmount, 0);

  const deductionLinesSum = calc.lines
    .filter((l) => l.type === ComponentType.DEDUCTION)
    .reduce((sum, l) => sum + l.earnedAmount, 0);

  const employerContribLinesSum = calc.lines
    .filter((l) => l.type === ComponentType.EMPLOYER_CONTRIBUTION)
    .reduce((sum, l) => sum + l.earnedAmount, 0);

  assert.strictEqual(
    earningLinesSum,
    calc.totalEarnings,
    "Sum of all earning lines must equal calc.totalEarnings exactly"
  );

  assert.strictEqual(
    deductionLinesSum,
    calc.totalEmployeeDeductions,
    "Sum of all deduction lines must equal calc.totalEmployeeDeductions exactly"
  );

  assert.strictEqual(
    calc.totalEarnings - calc.totalEmployeeDeductions,
    calc.netSalary,
    "Total Earnings minus Total Deductions must equal Net Salary exactly"
  );

  assert.strictEqual(
    employerContribLinesSum,
    calc.totalEmployerContributions,
    "Sum of employer contribution lines must equal calc.totalEmployerContributions exactly"
  );

  assert.strictEqual(
    calc.totalEarnings + calc.totalEmployerContributions,
    calc.totalEmployerCost,
    "Total Earnings plus Employer Contributions must equal Total Employer Cost exactly"
  );

  // Verify every single line has non-empty calculation notes
  for (const line of calc.lines) {
    assert.ok(line.calculationNote && line.calculationNote.length > 5, `Line ${line.code} must have formula audit note`);
  }

  console.log(`  ✔ Lines reconciled: Earnings=₹${(earningLinesSum / 100).toFixed(2)}, Deductions=₹${(deductionLinesSum / 100).toFixed(2)}, Net=₹${(calc.netSalary / 100).toFixed(2)}`);
  console.log("  ✔ Line item equality and audit notes verified.\n");
}

console.log("=================================================================");
console.log("🎉 ALL PHASE 3 CALCULATION ENGINE GOLDEN TESTS PASSED!");
console.log("=================================================================\n");
