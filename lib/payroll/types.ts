import { ComponentType, CalculationType } from "@prisma/client";

export interface PayrollSettingsData {
  id: string;
  companyName: string;
  currency: string;
  payPeriodType: "CALENDAR_DAYS" | "FIXED_30" | "FIXED_26" | "WORKING_DAYS" | string;
  weeklyOffDays: number[]; // e.g. [0] for Sunday, [0, 6] for Sat & Sun
  standardWorkHours: number;
  enableOvertime: boolean;
  overtimeHourlyRateMultiplier: number;
  lateMarkGraceMinutes: number;
  lateMarksForHalfDayPenalty: number;
  pfEmployeeRate: number; // e.g. 12.0 (%)
  pfEmployerRate: number; // e.g. 12.0 (%)
  pfWageCeiling: number; // minor units (e.g. 1500000 = ₹15,000)
  esiEmployeeRate: number; // e.g. 0.75 (%)
  esiEmployerRate: number; // e.g. 3.25 (%)
  esiWageCeiling: number; // minor units (e.g. 2100000 = ₹21,000)
  ptSlabs: { min: number; max: number; amount: number; febAmount?: number }[]; // minor units
  roundingRule?: string; // ROUND_HALF_UP, ROUND_NEAREST_RUPEE
  lopRule?: string; // PRORATE_GROSS, BASIC_ONLY
}

export interface StatutoryConfigData {
  id?: string;
  country: string; // "IN"
  state: string; // "MH", "KA", "ALL"
  version?: number;
  pfEmployeeRate: number; // 12.0
  pfEmployerEpfRate: number; // 3.67
  pfEmployerEpsRate: number; // 8.33
  pfEmployerEdliRate: number; // 0.50
  pfAdminChargesRate: number; // 0.50
  pfWageCeiling: number; // 1500000 paise (₹15,000)
  esiEmployeeRate: number; // 0.75
  esiEmployerRate: number; // 3.25
  esiWageCeiling: number; // 2100000 paise (₹21,000)
  ptSlabs: Array<{ min: number; max: number; amount: number; febAmount?: number }>;
  lwfEmployeeContribution?: number; // paise
  lwfEmployerContribution?: number;
  standardDeductionAnnual?: number; // 7500000 paise (₹75,000)
}

export interface SalaryComponentItem {
  code: string;
  name: string;
  type: ComponentType;
  calculationType: CalculationType;
  rate: number; // minor units (paise)
  isTaxable: boolean;
  isStatutory: boolean;
  includeInCtc: boolean;
  isProrated: boolean; // false for fixed stipends
  displayOrder: number;
}

export interface NormalizedSalaryStructure {
  effectiveFrom: Date | string;
  effectiveTo?: Date | string | null;
  monthlyGross: number; // in paise
  ctcMonthly: number;
  components: SalaryComponentItem[];
}

export interface EmployeeSalaryInput {
  userId: number;
  userName: string;
  userEmail: string;
  designation?: string | null;
  department?: string | null;
  bankAccountNumber?: string | null;
  bankIfsc?: string | null;
  bankName?: string | null;
  panNumber?: string | null;
  joiningDate?: Date | string | null;
  exitDate?: Date | string | null;
  taxRegime?: "OLD" | "NEW";
  salaryStructure: {
    basicSalary: number; // minor units
    hra: number; // minor units
    specialAllowance: number; // minor units
    otherAllowances: number; // minor units
    fixedBonus: number; // minor units
    variablePay: number; // minor units
    monthlyGross: number; // minor units
    ctcMonthly: number; // minor units
    pfDeduction: boolean;
    esiDeduction: boolean;
    professionalTax: boolean;
    tdsMonthly: number; // minor units
  };
  // Optional normalized structures for effective dating & mid-month hikes
  structures?: NormalizedSalaryStructure[];
}

export interface MonthlyAttendanceSummary {
  userId: number;
  month: number; // 1-12
  year: number;
  calendarDays: number;
  weeklyOffDays: number;
  holidayDays: number;
  standardWorkingDays: number;
  presentDays: number;
  absentDays: number;
  halfDays: number;
  paidLeaveDays: number;
  unpaidLeaveDays: number;
  lateCount: number;
  totalLateMinutes: number;
  totalOvertimeHours: number;
}

export interface MonthlyAdjustmentItem {
  id?: string;
  userId: number;
  type:
    | "REIMBURSEMENT"
    | "BONUS"
    | "INCENTIVE"
    | "ARREARS"
    | "ONE_TIME_EARNING"
    | "DEDUCTION"
    | "LOAN_ADVANCE"
    | "LEAVE_ENCASHMENT"
    | "RECOVERY";
  title: string;
  amount: number; // minor units (positive integer)
  isTaxable?: boolean;
  notes?: string | null;
}

export interface LoanRecoveryItem {
  loanAdvanceId?: string;
  installmentId?: string;
  installmentEmi?: number; // minor units (paise)
  scheduledEmi?: number; // alias for installmentEmi in minor units
  balanceRemaining?: number; // minor units
}

export interface ComponentBreakdown {
  component: string;
  rate: number; // minor units
  earned: number; // minor units
  isDeduction: boolean;
  notes?: string;
}

export interface PayslipLineItem {
  code: string;
  name: string;
  type: ComponentType;
  rate: number; // minor units (paise)
  earnedAmount: number; // minor units (paise)
  calculationNote: string;
  order: number;
}

export interface EmployeePayrollCalculation {
  userId: number;
  userName: string;
  userEmail: string;
  designation?: string;
  department?: string;
  month: number;
  year: number;
  currency: string;

  // Attendance metrics
  calendarDays: number;
  divisorDays: number;
  workingDays: number;
  weeklyOffDays: number;
  holidayDays: number;
  presentDays: number;
  absentDays: number;
  halfDays: number;
  paidLeaveDays: number;
  unpaidLeaveDays: number;
  lateCount: number;
  latePenaltyDays: number;
  payableDays: number;
  lopDays: number;

  // Joiner / Leaver flags
  isMidMonthJoiner: boolean;
  isMidMonthLeaver: boolean;
  activeEmploymentDaysInMonth: number;

  // Earnings
  fixedBasic: number;
  fixedHra: number;
  fixedSpecialAllowance: number;
  fixedOtherAllowances: number;
  fixedMonthlyGross: number;

  earnedBasic: number;
  earnedHra: number;
  earnedSpecialAllowance: number;
  earnedOtherAllowances: number;
  earnedGross: number;

  // Additions
  overtimeHours: number;
  overtimeHourlyRate: number;
  overtimePay: number;
  bonus: number;
  reimbursements: number;
  oneTimeEarnings: number;
  arrears: number;
  leaveEncashment: number;
  totalAdditions: number;
  totalEarnings: number; // earnedGross + additions

  // Deductions
  pfEmployee: number;
  pfEmployer?: number; // backwards compatibility alias for pfEmployerTotal
  pfEmployerEpf: number;
  pfEmployerEps: number;
  pfEmployerEdli: number;
  pfAdminCharges: number;
  pfEmployerTotal: number;

  esiEmployee: number;
  esiEmployer: number;
  professionalTax: number;
  tds: number;
  loanAdvanceRecovery: number;
  loanShortfall: number; // Deferred if net pay cap reached
  otherDeductions: number;
  totalEmployeeDeductions: number;
  totalEmployerContributions: number;

  // Final totals (minor units)
  netSalary: number; // totalEarnings - totalEmployeeDeductions
  totalEmployerCost: number; // totalEarnings + totalEmployerContributions

  // Normalized lines for PayslipLine database model
  lines: PayslipLineItem[];

  // Step-by-step formula breakdown for transparency
  formulaBreakdown: {
    perDaySalary: number;
    perHourSalary: number;
    payableDaysFormula: string;
    earnedGrossFormula: string;
    components: ComponentBreakdown[];
    notes: string[];
    statutoryNotes: {
      pf: string;
      esi: string;
      pt: string;
      tds: string;
    };
  };

  engineVersion: string;
  calculatedAt: string;
}

export interface CreateLoanInput {
  userId: number;
  principalAmount: number; // minor units (paise)
  totalTenure: number; // in months
  installmentEmi?: number; // optional custom EMI, otherwise principalAmount / totalTenure
  reason: string;
  disbursedAt?: Date | string;
}

export interface FnFCalculationInput {
  userId: number;
  resignationDate: Date | string;
  lastWorkingDate: Date | string;
  noticePeriodDays?: number;
  servedNoticeDays?: number;
  otherDeductions?: number; // minor units
  notes?: string;
}

export interface FnFCalculationBreakdown {
  userId: number;
  userName: string;
  resignationDate: string;
  lastWorkingDate: string;
  tenureYears: number;
  tenureMonths: number;
  noticePeriodDays: number;
  servedNoticeDays: number;
  shortfallDays: number;
  noticeRecoveryAmount: number; // minor units
  unpaidDaysInFinalMonth: number;
  pendingSalaryAmount: number; // minor units
  leaveEncashmentDays: number;
  leaveEncashmentAmount: number; // minor units
  isGratuityEligible: boolean;
  gratuityAmount: number; // minor units
  outstandingLoanBalance: number; // minor units
  otherDeductions: number; // minor units
  totalPayable: number; // minor units
  totalRecoverable: number; // minor units
  netSettlementAmount: number; // minor units
  calculationNotes: string[];
}
