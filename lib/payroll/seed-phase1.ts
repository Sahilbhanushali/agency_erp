import { prisma } from "../prisma";
import { ComponentType, CalculationType } from "@prisma/client";

export const DEFAULT_COMPONENTS = [
  // Earnings
  {
    code: "BASIC",
    name: "Basic Salary",
    type: ComponentType.EARNING,
    calculationType: CalculationType.PERCENTAGE_OF_GROSS,
    isTaxable: true,
    isStatutory: true,
    includeInCtc: true,
    isProrated: true,
    displayOrder: 1,
  },
  {
    code: "HRA",
    name: "House Rent Allowance (HRA)",
    type: ComponentType.EARNING,
    calculationType: CalculationType.PERCENTAGE_OF_BASIC,
    isTaxable: true,
    isStatutory: false,
    includeInCtc: true,
    isProrated: true,
    displayOrder: 2,
  },
  {
    code: "SPECIAL_ALLOWANCE",
    name: "Special Allowance",
    type: ComponentType.EARNING,
    calculationType: CalculationType.FLAT_AMOUNT,
    isTaxable: true,
    isStatutory: false,
    includeInCtc: true,
    isProrated: true,
    displayOrder: 3,
  },
  {
    code: "CONVEYANCE",
    name: "Conveyance Allowance",
    type: ComponentType.EARNING,
    calculationType: CalculationType.FLAT_AMOUNT,
    isTaxable: true,
    isStatutory: false,
    includeInCtc: true,
    isProrated: false, // Fixed stipend
    displayOrder: 4,
  },
  {
    code: "OVERTIME",
    name: "Overtime Pay",
    type: ComponentType.EARNING,
    calculationType: CalculationType.FORMULA,
    isTaxable: true,
    isStatutory: false,
    includeInCtc: false,
    isProrated: false,
    displayOrder: 5,
  },
  {
    code: "BONUS",
    name: "Performance Bonus",
    type: ComponentType.EARNING,
    calculationType: CalculationType.FLAT_AMOUNT,
    isTaxable: true,
    isStatutory: false,
    includeInCtc: false,
    isProrated: false,
    displayOrder: 6,
  },
  {
    code: "REIMBURSEMENT",
    name: "Travel / Internet Reimbursement",
    type: ComponentType.REIMBURSEMENT,
    calculationType: CalculationType.FLAT_AMOUNT,
    isTaxable: false,
    isStatutory: false,
    includeInCtc: false,
    isProrated: false,
    displayOrder: 7,
  },

  // Deductions
  {
    code: "PF_EE",
    name: "Provident Fund (Employee 12%)",
    type: ComponentType.DEDUCTION,
    calculationType: CalculationType.PERCENTAGE_OF_BASIC,
    isTaxable: false,
    isStatutory: true,
    includeInCtc: false,
    isProrated: true,
    displayOrder: 10,
  },
  {
    code: "ESI_EE",
    name: "ESI (Employee 0.75%)",
    type: ComponentType.DEDUCTION,
    calculationType: CalculationType.PERCENTAGE_OF_GROSS,
    isTaxable: false,
    isStatutory: true,
    includeInCtc: false,
    isProrated: true,
    displayOrder: 11,
  },
  {
    code: "PT",
    name: "Professional Tax",
    type: ComponentType.DEDUCTION,
    calculationType: CalculationType.FORMULA,
    isTaxable: false,
    isStatutory: true,
    includeInCtc: false,
    isProrated: false,
    displayOrder: 12,
  },
  {
    code: "TDS",
    name: "Income Tax (TDS)",
    type: ComponentType.DEDUCTION,
    calculationType: CalculationType.FLAT_AMOUNT,
    isTaxable: false,
    isStatutory: true,
    includeInCtc: false,
    isProrated: false,
    displayOrder: 13,
  },
  {
    code: "LOAN_RECOVERY",
    name: "Loan / Advance EMI Recovery",
    type: ComponentType.DEDUCTION,
    calculationType: CalculationType.FLAT_AMOUNT,
    isTaxable: false,
    isStatutory: false,
    includeInCtc: false,
    isProrated: false,
    displayOrder: 14,
  },

  // Employer Contributions
  {
    code: "PF_ER_EPF",
    name: "Employer EPF Contribution (3.67%)",
    type: ComponentType.EMPLOYER_CONTRIBUTION,
    calculationType: CalculationType.PERCENTAGE_OF_BASIC,
    isTaxable: false,
    isStatutory: true,
    includeInCtc: true,
    isProrated: true,
    displayOrder: 20,
  },
  {
    code: "PF_ER_EPS",
    name: "Employer EPS Contribution (8.33%)",
    type: ComponentType.EMPLOYER_CONTRIBUTION,
    calculationType: CalculationType.PERCENTAGE_OF_BASIC,
    isTaxable: false,
    isStatutory: true,
    includeInCtc: true,
    isProrated: true,
    displayOrder: 21,
  },
  {
    code: "PF_ER_EDLI",
    name: "Employer EDLI Insurance (0.50%)",
    type: ComponentType.EMPLOYER_CONTRIBUTION,
    calculationType: CalculationType.PERCENTAGE_OF_BASIC,
    isTaxable: false,
    isStatutory: true,
    includeInCtc: true,
    isProrated: true,
    displayOrder: 22,
  },
  {
    code: "PF_ADMIN",
    name: "PF Admin Charges (0.50%)",
    type: ComponentType.EMPLOYER_CONTRIBUTION,
    calculationType: CalculationType.PERCENTAGE_OF_BASIC,
    isTaxable: false,
    isStatutory: true,
    includeInCtc: true,
    isProrated: true,
    displayOrder: 23,
  },
  {
    code: "ESI_ER",
    name: "Employer ESI Contribution (3.25%)",
    type: ComponentType.EMPLOYER_CONTRIBUTION,
    calculationType: CalculationType.PERCENTAGE_OF_GROSS,
    isTaxable: false,
    isStatutory: true,
    includeInCtc: true,
    isProrated: true,
    displayOrder: 24,
  },
];

export async function seedPhase1Defaults() {
  console.log("▶ Initializing Phase 1 Schema Defaults...");

  // 1. Seed SalaryComponent Catalog
  for (const comp of DEFAULT_COMPONENTS) {
    await prisma.salaryComponent.upsert({
      where: { code: comp.code },
      create: comp,
      update: comp,
    });
  }
  console.log(`  ✔ Seeded ${DEFAULT_COMPONENTS.length} Salary Components.`);

  // 2. Seed Default Shift
  await prisma.shift.upsert({
    where: { id: "default-general-shift" },
    create: {
      id: "default-general-shift",
      name: "General Shift",
      startTime: "09:30",
      endTime: "18:30",
      graceMinutes: 15,
      halfDayMinutes: 240,
      fullDayMinutes: 480,
      isNightShift: false,
      isActive: true,
    },
    update: {},
  });
  console.log("  ✔ Seeded Default General Shift.");

  // 3. Seed Weekly Off Patterns
  await prisma.weeklyOffPattern.upsert({
    where: { id: "default-sunday-off" },
    create: {
      id: "default-sunday-off",
      name: "Standard Sunday Off",
      patternJson: JSON.stringify({ "0": true }),
      isDefault: true,
      description: "Weekly off on all Sundays",
    },
    update: {},
  });
  console.log("  ✔ Seeded Standard Weekly Off Pattern.");

  // 4. Seed Leave Policy
  await prisma.leavePolicy.upsert({
    where: { id: "default-agency-leave-policy" },
    create: {
      id: "default-agency-leave-policy",
      name: "Agency Standard Leave Policy 2025",
      effectiveFrom: new Date(Date.UTC(2025, 0, 1)),
      sandwichRuleEnabled: false,
      allowNegativeBalance: false,
      probationLeaveAllowed: true,
      encashmentAllowed: true,
      maxCarryForwardDays: 15,
      accrualFrequency: "YEARLY",
      prorateForNewJoiners: true,
    },
    update: {},
  });
  console.log("  ✔ Seeded Default Leave Policy.");

  // 5. Seed Versioned Statutory Config
  const ptMaharashtraSlabs = [
    { min: 0, max: 750000, amount: 0 },
    { min: 750001, max: 1000000, amount: 17500 }, // ₹175
    { min: 1000001, max: 999999999, amount: 20000 }, // ₹200 (Feb ₹300 handled in engine)
  ];

  await prisma.statutoryConfig.upsert({
    where: { id: "default-statutory-in-all" },
    create: {
      id: "default-statutory-in-all",
      country: "IN",
      state: "ALL",
      effectiveFrom: new Date(Date.UTC(2024, 3, 1)), // April 1, 2024
      version: 1,
      pfEmployeeRate: 12.0,
      pfEmployerEpfRate: 3.67,
      pfEmployerEpsRate: 8.33,
      pfEmployerEdliRate: 0.50,
      pfAdminChargesRate: 0.50,
      pfWageCeiling: 1500000, // ₹15,000 in paise
      esiEmployeeRate: 0.75,
      esiEmployerRate: 3.25,
      esiWageCeiling: 2100000, // ₹21,000 in paise
      ptSlabsJson: JSON.stringify(ptMaharashtraSlabs),
      lwfConfigJson: JSON.stringify({ employeeContribution: 1200, employerContribution: 3600 }),
      tdsConfigJson: JSON.stringify({ standardDeductionNewRegime: 7500000 }), // ₹75,000
    },
    update: {},
  });
  console.log("  ✔ Seeded Versioned Statutory Configuration (IN).");

  // 6. Verify Table Health
  const componentsCount = await prisma.salaryComponent.count();
  const shiftsCount = await prisma.shift.count();
  const patternsCount = await prisma.weeklyOffPattern.count();
  const policiesCount = await prisma.leavePolicy.count();
  const statutoryCount = await prisma.statutoryConfig.count();

  console.log("🎉 PHASE 1 DATA MODEL VERIFICATION COMPLETE:");
  console.log(`   - Components: ${componentsCount}`);
  console.log(`   - Shifts: ${shiftsCount}`);
  console.log(`   - Weekly Off Patterns: ${patternsCount}`);
  console.log(`   - Leave Policies: ${policiesCount}`);
  console.log(`   - Statutory Configs: ${statutoryCount}`);
}

if (require.main === module) {
  seedPhase1Defaults()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("❌ Seed Phase 1 failed:", err);
      process.exit(1);
    });
}
