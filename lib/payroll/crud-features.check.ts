import { prisma } from "../prisma";
import { PayrollService } from "./payroll-service";

async function runCrudVerificationSuite() {
  console.log("\n=================================================================");
  console.log("▶ RUNNING HRMS & PAYROLL EXTENDED CRUD VERIFICATION SUITE");
  console.log("=================================================================\n");

  let totalTests = 0;
  let passedTests = 0;

  function assert(condition: boolean, desc: string, got?: any) {
    totalTests++;
    if (condition) {
      console.log(`  ✔ PASS: ${desc}`);
      passedTests++;
    } else {
      console.error(`  ❌ FAIL: ${desc} (Got: ${JSON.stringify(got)})`);
    }
  }

  // 1. SALARY STRUCTURE TEMPLATES CRUD & ASSIGNMENT
  console.log("TEST 1: Salary Structure Templates CRUD & Assignment");
  const testCode = `TEST_SWE_${Date.now()}`;
  const template = await prisma.salaryStructureTemplate.create({
    data: {
      name: `Test Engineering Tier (${testCode})`,
      code: testCode,
      description: "Automated test structure template with 50-30-15-5 split",
      basicPercentage: 50.0,
      hraPercentage: 30.0,
      specialPercentage: 15.0,
      otherPercentage: 5.0,
      pfApplicable: true,
      esiApplicable: false,
      professionalTax: true,
      isDefault: false,
      isActive: true,
    },
  });
  assert(template.code === testCode, "Salary structure template created with code", template.code);

  // Update template
  const updatedTmpl = await prisma.salaryStructureTemplate.update({
    where: { id: template.id },
    data: { description: "Updated description for test template" },
  });
  assert(updatedTmpl.description === "Updated description for test template", "Template updated successfully");

  // Find or create test user
  let testUser = await prisma.user.findFirst({ where: { email: "crud.test.emp@agency.com" } });
  if (!testUser) {
    testUser = await prisma.user.create({
      data: {
        name: "Test CRUD Employee",
        email: "crud.test.emp@agency.com",
        password: "hashedpassword",
        designation: "Frontend Engineer",
        department: "Engineering",
        exitStatus: "ACTIVE",
      },
    });
  }

  // Assign template to user: 60,000 monthly gross => 50% basic (30k), 30% HRA (18k), 15% special (9k), 5% other (3k)
  const monthlyGrossPaise = 6000000;
  const basicPaise = Math.round(monthlyGrossPaise * (template.basicPercentage / 100));
  const hraPaise = Math.round(monthlyGrossPaise * (template.hraPercentage / 100));
  const specialPaise = Math.round(monthlyGrossPaise * (template.specialPercentage / 100));
  const otherPaise = Math.round(monthlyGrossPaise * (template.otherPercentage / 100));

  const assigned = await PayrollService.upsertSalaryStructure({
    userId: testUser.id,
    templateId: template.id,
    basicSalary: basicPaise,
    hra: hraPaise,
    specialAllowance: specialPaise,
    otherAllowances: otherPaise,
    pfDeduction: template.pfApplicable,
    esiDeduction: template.esiApplicable,
    professionalTax: template.professionalTax,
    revisionReason: "Assigned Test Engineering Tier",
  });

  assert(assigned.templateId === template.id, "Structure assigned with template ID", assigned.templateId);
  assert(assigned.basicSalary === 3000000, "Basic computed as ₹30,000 (3000000 paise)", assigned.basicSalary);
  assert(assigned.hra === 1800000, "HRA computed as ₹18,000 (1800000 paise)", assigned.hra);
  assert(assigned.specialAllowance === 900000, "Special allowance computed as ₹9,000", assigned.specialAllowance);
  assert(assigned.otherAllowances === 300000, "Other allowance computed as ₹3,000", assigned.otherAllowances);

  // 2. MONTHLY ADJUSTMENTS CRUD
  console.log("\nTEST 2: Monthly Adjustments CRUD (View, Edit, Delete)");
  const adj = await prisma.salaryAdjustment.create({
    data: {
      userId: testUser.id,
      title: "Q3 High Performer Spot Award",
      type: "BONUS",
      amount: 1500000, // ₹15,000
      month: 10,
      year: 2026,
      notes: "Awarded by Engineering Lead",
      isApproved: true,
    },
  });
  assert(adj.title === "Q3 High Performer Spot Award", "Adjustment created", adj.title);

  // Read / View
  const viewAdj = await prisma.salaryAdjustment.findUnique({ where: { id: adj.id } });
  assert(viewAdj !== null && viewAdj.amount === 1500000, "Adjustment viewed successfully with amount ₹15,000");

  // Edit / Update
  const updatedAdj = await prisma.salaryAdjustment.update({
    where: { id: adj.id },
    data: { amount: 2000000, notes: "Award amount increased to ₹20,000" },
  });
  assert(updatedAdj.amount === 2000000, "Adjustment edited to ₹20,000 (2000000 paise)", updatedAdj.amount);

  // Delete
  await prisma.salaryAdjustment.delete({ where: { id: adj.id } });
  const deletedAdj = await prisma.salaryAdjustment.findUnique({ where: { id: adj.id } });
  assert(deletedAdj === null, "Adjustment successfully deleted from database");

  // 3. CALCULATION RULES & STATUTORY SETTINGS
  console.log("\nTEST 3: Calculation Rules & Statutory Settings");
  const settings = await PayrollService.getSettings();
  assert(settings.payPeriodType !== undefined, "Retrieved agency calculation rules", settings.payPeriodType);

  const updatedSettings = await PayrollService.updateSettings({
    overtimeHourlyRateMultiplier: 1.75,
    lateMarkGraceMinutes: 20,
  });
  assert(updatedSettings.overtimeHourlyRateMultiplier === 1.75, "Overtime multiplier updated to 1.75x", updatedSettings.overtimeHourlyRateMultiplier);
  assert(updatedSettings.lateMarkGraceMinutes === 20, "Grace minutes updated to 20m", updatedSettings.lateMarkGraceMinutes);

  // Restore settings
  await PayrollService.updateSettings({
    overtimeHourlyRateMultiplier: 1.5,
    lateMarkGraceMinutes: 15,
  });

  // 4. LETTERHEADS CRUD
  console.log("\nTEST 4: Letterheads CRUD & Archival Safeguards");
  const lh = await prisma.hrmsLetterhead.create({
    data: {
      name: "Test Executive Letterhead",
      companyName: "Agency Corp Ltd",
      city: "Gurugram",
      country: "India",
      primaryColor: "#0f766e",
      secondaryColor: "#475569",
      fontFamily: "'Inter', sans-serif",
      status: "DRAFT",
    },
  });
  assert(lh.name === "Test Executive Letterhead", "Letterhead created", lh.name);

  // Update
  const updatedLh = await prisma.hrmsLetterhead.update({
    where: { id: lh.id },
    data: { name: "Test Executive Letterhead (Updated)", website: "https://agency.com" },
  });
  assert(updatedLh.website === "https://agency.com", "Letterhead updated with website", updatedLh.website);

  // Delete
  await prisma.hrmsLetterhead.delete({ where: { id: lh.id } });
  const deletedLh = await prisma.hrmsLetterhead.findUnique({ where: { id: lh.id } });
  assert(deletedLh === null, "Letterhead successfully deleted");

  // 5. CLEANUP TEMPLATE
  await prisma.salaryStructure.deleteMany({ where: { userId: testUser.id } });
  await prisma.salaryStructureTemplate.delete({ where: { id: template.id } });
  const checkTmpl = await prisma.salaryStructureTemplate.findUnique({ where: { id: template.id } });
  assert(checkTmpl === null, "Test template safely deleted after assignment cleanup");

  console.log("\n=================================================================");
  console.log(`TOTAL TESTS: ${totalTests} | PASSED: ${passedTests} | FAILED: ${totalTests - passedTests}`);
  console.log("=================================================================\n");

  if (totalTests !== passedTests) {
    process.exit(1);
  }
}

runCrudVerificationSuite().catch((err) => {
  console.error("Test execution fatal error:", err);
  process.exit(1);
});
