import assert from "node:assert";
import {
  calculateEmployeePayroll,
  DEFAULT_PT_SLABS,
} from "./calculation-engine";
import {
  PayrollSettingsData,
  EmployeeSalaryInput,
  MonthlyAttendanceSummary,
  MonthlyAdjustmentItem,
} from "./types";

const mockSettings: PayrollSettingsData = {
  id: "default",
  companyName: "Acme Agency",
  currency: "INR",
  payPeriodType: "CALENDAR_DAYS",
  weeklyOffDays: [0], // Sunday
  standardWorkHours: 8,
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
  ptSlabs: DEFAULT_PT_SLABS,
};

const mockEmployee: EmployeeSalaryInput = {
  userId: 1,
  userName: "Rahul Sharma",
  userEmail: "rahul@agency.com",
  designation: "Senior Designer",
  department: "Design",
  salaryStructure: {
    basicSalary: 3000000, // ₹30,000 in paise
    hra: 1500000, // ₹15,000 in paise
    specialAllowance: 1500000, // ₹15,000 in paise
    otherAllowances: 0,
    fixedBonus: 0,
    variablePay: 0,
    monthlyGross: 6000000, // ₹60,000 in paise
    ctcMonthly: 6500000,
    pfDeduction: true,
    esiDeduction: false, // Gross ₹60k > ₹21k, ESI not applicable
    professionalTax: true,
    tdsMonthly: 200000, // ₹2,000 in paise
  },
};

console.log("▶ Running Payroll Calculation Engine Tests...");

// Test Case 1: Full Attendance (100% Payout in a 30-day month)
{
  const attendance: MonthlyAttendanceSummary = {
    userId: 1,
    month: 4, // April (30 days)
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

  const result = calculateEmployeePayroll({
    employee: mockEmployee,
    attendance,
    settings: mockSettings,
  });

  assert.strictEqual(result.payableDays, 30, "Full month should have 30 payable days");
  assert.strictEqual(result.earnedGross, 6000000, "Full gross should be ₹60,000 in paise");
  assert.strictEqual(result.earnedBasic, 3000000, "Basic should be 100%");

  // PF on Basic capped at ₹15,000: 12% of 1,500,000 = 180,000 paise (₹1,800)
  assert.strictEqual(result.pfEmployee, 180000, "PF Employee should be ₹1,800");
  assert.strictEqual(result.pfEmployer, 180000, "PF Employer should be ₹1,800");

  // Professional Tax: ₹60,000 falls in highest slab = ₹200 (20,000 paise)
  assert.strictEqual(result.professionalTax, 20000, "PT should be ₹200");

  // TDS: ₹2,000 (200,000 paise)
  assert.strictEqual(result.tds, 200000, "TDS should be ₹2,000");

  // Net Pay = 6,000,000 - (180,000 + 20,000 + 200,000) = 5,600,000 (₹56,000)
  assert.strictEqual(result.netSalary, 5600000, "Net salary should be ₹56,000 in paise");
  console.log("  ✔ Test 1: Full month attendance 100% payout passed.");
}

// Test Case 2: Partial Attendance with Unpaid Leave & Late Penalty
{
  const attendance: MonthlyAttendanceSummary = {
    userId: 1,
    month: 4,
    year: 2026,
    calendarDays: 30,
    weeklyOffDays: 4,
    holidayDays: 1,
    standardWorkingDays: 25,
    presentDays: 20, // 20 days present
    absentDays: 2, // 2 unpaid absent
    halfDays: 1, // 1 half day (-0.5)
    paidLeaveDays: 2, // 2 approved paid leaves
    unpaidLeaveDays: 1, // 1 unpaid leave
    lateCount: 6, // 6 late marks = 2 half-day penalty = -1.0 day
    totalLateMinutes: 120,
    totalOvertimeHours: 0,
  };

  const result = calculateEmployeePayroll({
    employee: mockEmployee,
    attendance,
    settings: mockSettings,
  });

  // Payable days: 20 (Present) + 4 (Weekly Off) + 1 (Holiday) + 2 (Paid Leave) - 0.5 (Half Day) - 1.0 (6 late marks / 3 * 0.5) = 25.5 days
  assert.strictEqual(result.payableDays, 25.5, "Payable days should be 25.5");

  // Gross = 6,000,000 * (25.5 / 30) = 5,100,000 paise (₹51,000)
  assert.strictEqual(result.earnedGross, 5100000, "Earned gross should be prorated to ₹51,000");
  assert.strictEqual(result.latePenaltyDays, 1.0, "Late penalty should be 1.0 day");
  console.log("  ✔ Test 2: Prorated attendance and late penalties passed.");
}

// Test Case 3: Overtime, Reimbursements & Variable Bonuses
{
  const attendance: MonthlyAttendanceSummary = {
    userId: 1,
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
    totalOvertimeHours: 10, // 10 overtime hours
  };

  const adjustments: MonthlyAdjustmentItem[] = [
    { userId: 1, type: "REIMBURSEMENT", title: "Travel to Client Office", amount: 250000 }, // ₹2,500
    { userId: 1, type: "BONUS", title: "Quarterly Performance Bonus", amount: 500000 }, // ₹5,000
    { userId: 1, type: "LOAN_ADVANCE", title: "Laptop EMI Recovery", amount: 150000 }, // ₹1,500 deduction
  ];

  const result = calculateEmployeePayroll({
    employee: mockEmployee,
    attendance,
    settings: mockSettings,
    adjustments,
  });

  // Per day: 6,000,000 / 30 = 200,000 paise (₹2,000/day)
  // Per hour: 200,000 / 8 = 25,000 paise (₹250/hr)
  // Overtime rate: 25,000 * 1.5 = 37,500 paise (₹375/hr)
  // Overtime pay (10 hrs): 375,000 paise (₹3,750)
  assert.strictEqual(result.overtimePay, 375000, "Overtime pay should be ₹3,750");
  assert.strictEqual(result.bonus, 500000, "Bonus should be ₹5,000");
  assert.strictEqual(result.reimbursements, 250000, "Reimbursement should be ₹2,500");
  assert.strictEqual(result.loanAdvanceRecovery, 150000, "Loan recovery should be ₹1,500");

  // Total additions = 375,000 + 500,000 + 250,000 = 1,125,000
  assert.strictEqual(result.totalAdditions, 1125000, "Total additions match");
  console.log("  ✔ Test 3: Overtime, bonus, and reimbursements calculation passed.");
}

// Test Case 4: ESI Applicability (Gross <= ₹21,000)
{
  const lowWageEmployee: EmployeeSalaryInput = {
    userId: 2,
    userName: "Junior Intern",
    userEmail: "intern@agency.com",
    salaryStructure: {
      basicSalary: 1000000, // ₹10,000
      hra: 500000, // ₹5,000
      specialAllowance: 500000, // ₹5,000
      otherAllowances: 0,
      fixedBonus: 0,
      variablePay: 0,
      monthlyGross: 2000000, // ₹20,000 (<= ₹21,000 ESI ceiling)
      ctcMonthly: 2200000,
      pfDeduction: true,
      esiDeduction: true,
      professionalTax: true,
      tdsMonthly: 0,
    },
  };

  const attendance: MonthlyAttendanceSummary = {
    userId: 2,
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

  const result = calculateEmployeePayroll({
    employee: lowWageEmployee,
    attendance,
    settings: mockSettings,
  });

  // ESI Employee: 0.75% of 2,000,000 = 15,000 paise (₹150)
  assert.strictEqual(result.esiEmployee, 15000, "ESI Employee should be ₹150");
  // ESI Employer: 3.25% of 2,000,000 = 65,000 paise (₹650)
  assert.strictEqual(result.esiEmployer, 65000, "ESI Employer should be ₹650");
  console.log("  ✔ Test 4: ESI calculation for eligible employee passed.");
}

console.log("🎉 ALL PAYROLL ENGINE TESTS PASSED SUCCESSFULLY!\n");
