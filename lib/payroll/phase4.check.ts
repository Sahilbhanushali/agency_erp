import assert from "node:assert";
import { prisma } from "../prisma";
import { PayrollService } from "./payroll-service";
import { PayrollRunStatus } from "@prisma/client";

console.log("=================================================================");
console.log("▶ RUNNING PHASE 4 PAYROLL WORKFLOW & IMMUTABILITY VERIFICATION");
console.log("=================================================================\n");

async function main() {
  // 1. Ensure test employees exist with active salary structures
  let testUser1 = await prisma.user.findFirst({
    where: { email: "worker1.phase4@agency.com" },
  });

  if (!testUser1) {
    testUser1 = await prisma.user.create({
      data: {
        name: "Aakash Mehta",
        email: "worker1.phase4@agency.com",
        password: "hashed_password",
        roleId: 4, // Designer
        designation: "Frontend Developer",
        department: "Engineering",
        bankName: "HDFC Bank",
        bankAccountNumber: "50100223344556",
        bankIfsc: "HDFC0001234",
        panNumber: "ABCDE1234F",
      },
    });
  }

  // Ensure active salary structure for testUser1: Gross ₹60,000 (Basic 30k, HRA 15k, Special 15k)
  await PayrollService.upsertSalaryStructure({
    userId: testUser1.id,
    basicSalary: 3000000,
    hra: 1500000,
    specialAllowance: 1500000,
    actorUserId: testUser1.id,
  });

  let testUser2 = await prisma.user.findFirst({
    where: { email: "worker2.phase4@agency.com" },
  });

  if (!testUser2) {
    testUser2 = await prisma.user.create({
      data: {
        name: "Pooja Hegde",
        email: "worker2.phase4@agency.com",
        password: "hashed_password",
        roleId: 5, // Content Writer
        designation: "Copywriter",
        department: "Content",
        bankName: "ICICI Bank",
        bankAccountNumber: "123456789012",
        bankIfsc: "ICIC0000987",
        panNumber: "XYZPQ9876K",
      },
    });
  }

  // Ensure active salary structure for testUser2: Gross ₹40,000
  await PayrollService.upsertSalaryStructure({
    userId: testUser2.id,
    basicSalary: 2000000,
    hra: 1000000,
    specialAllowance: 1000000,
    actorUserId: testUser2.id,
  });

  const testMonth1 = 7;
  const testMonth2 = 8;
  const testYear = 2026;

  // Clean up any existing test runs for Month 7 & Month 8
  await prisma.payrollRun.deleteMany({
    where: {
      year: testYear,
      month: { in: [testMonth1, testMonth2] },
    },
  });

  // -------------------------------------------------------------------------
  // TEST 1: Creation of Baseline Month 7 Regular Run
  // -------------------------------------------------------------------------
  console.log("TEST 1: Creating Baseline Month 7 Run...");
  const run1 = await PayrollService.createPayrollRun({
    month: testMonth1,
    year: testYear,
    runType: "REGULAR",
    notes: "Phase 4 Baseline Month 7",
    actorUserId: testUser1.id,
  });

  assert.ok(run1.id, "Run 1 should be created with an ID");
  assert.strictEqual(run1.status, PayrollRunStatus.CALCULATED, "Run 1 should be CALCULATED");
  assert.ok(run1.totalHeadcount >= 2, "Run 1 should process at least 2 employees");
  console.log(`  ✔ Run 1 created: Headcount=${run1.totalHeadcount}, Gross=₹${(run1.totalGross / 100).toFixed(2)}\n`);

  // -------------------------------------------------------------------------
  // TEST 2: Creation of Month 8 Run with Variance (Add bonus to User 1)
  // -------------------------------------------------------------------------
  console.log("TEST 2: Adding Bonus to User 1 and Creating Month 8 Run...");
  // Add ₹20,000 bonus adjustment for User 1 in Month 8
  await prisma.salaryAdjustment.create({
    data: {
      userId: testUser1.id,
      month: testMonth2,
      year: testYear,
      type: "BONUS",
      title: "Q2 Performance Award",
      amount: 2000000, // ₹20,000
      isApproved: true,
    },
  });

  const run2 = await PayrollService.createPayrollRun({
    month: testMonth2,
    year: testYear,
    runType: "REGULAR",
    notes: "Phase 4 Month 8 with Bonus",
    actorUserId: testUser1.id,
  });

  assert.ok(run2.totalGross > run1.totalGross, "Run 2 gross should exceed Run 1 due to bonus");
  console.log(`  ✔ Run 2 created: Gross=₹${(run2.totalGross / 100).toFixed(2)}\n`);

  // -------------------------------------------------------------------------
  // TEST 3: MoM Variance Analysis
  // -------------------------------------------------------------------------
  console.log("TEST 3: Computing Month-Over-Month Variance Analysis...");
  const variance = await PayrollService.getRunVariance(run2.id);

  assert.strictEqual(variance.hasPreviousRun, true, "Variance report should find previous run");
  assert.strictEqual(variance.previousPeriod?.month, testMonth1, "Previous period should be month 7");
  assert.ok(variance.summary.gross.delta > 0, "Gross delta should be positive");

  const user1Var = variance.employeeVariances.find((v) => v.userId === testUser1.id);
  assert.ok(user1Var, "User 1 should be in variance list");
  assert.strictEqual(user1Var.isFlagged, true, "User 1 should be flagged for >10% variance");
  assert.ok(user1Var.reasons.some((r) => r.includes("Bonus")), "Variance reason should mention Bonus");

  console.log(`  ✔ MoM Variance verified: User 1 delta = +${user1Var.percentDelta}% (${user1Var.reasons.join(", ")})\n`);

  // -------------------------------------------------------------------------
  // TEST 4: Single Employee Recalculation
  // -------------------------------------------------------------------------
  console.log("TEST 4: Single Employee Recalculation...");
  const oldUser2Net = run2.payslips.find((p) => p.userId === testUser2.id)?.netSalary;

  // Add ₹5,000 Travel Reimbursement for User 2
  await prisma.salaryAdjustment.create({
    data: {
      userId: testUser2.id,
      month: testMonth2,
      year: testYear,
      type: "REIMBURSEMENT",
      title: "Client Travel Claim",
      amount: 500000, // ₹5,000
      isApproved: true,
    },
  });

  const recalcResult = await PayrollService.recalculateEmployeePayslip({
    payrollRunId: run2.id,
    userId: testUser2.id,
    actorUserId: testUser2.id,
  });

  assert.strictEqual(
    recalcResult.payslip.netSalary,
    oldUser2Net! + 500000,
    "User 2 net pay should increase by exactly ₹5,000"
  );
  assert.strictEqual(
    recalcResult.run.totalNetPay,
    run2.totalNetPay + 500000,
    "Run total net pay should increase by ₹5,000"
  );
  console.log("  ✔ Single employee recalculation succeeded without wiping run.\n");

  // -------------------------------------------------------------------------
  // TEST 5: Hold and Release Salary Workflow
  // -------------------------------------------------------------------------
  console.log("TEST 5: Hold & Release Salary Workflow...");
  const user2PayslipId = recalcResult.payslip.id;

  // 5a. Attempt hold without reason should fail
  await assert.rejects(
    async () => {
      await PayrollService.holdPayslip({
        payslipId: user2PayslipId,
        reason: "",
        actorUserId: testUser1.id,
      });
    },
    /mandatory/i,
    "Should reject hold without mandatory reason"
  );

  // 5b. Hold with reason
  const heldSlip = await PayrollService.holdPayslip({
    payslipId: user2PayslipId,
    reason: "Pending resignation clearance",
    actorUserId: testUser1.id,
  });
  assert.strictEqual(heldSlip.status, "ON_HOLD", "Status should be ON_HOLD");
  assert.strictEqual(heldSlip.holdReason, "Pending resignation clearance");

  // 5c. Release hold
  const releasedSlip = await PayrollService.releasePayslip({
    payslipId: user2PayslipId,
    actorUserId: testUser1.id,
  });
  assert.strictEqual(releasedSlip.status, "CALCULATED", "Status should be restored to CALCULATED");
  assert.strictEqual(releasedSlip.holdReason, null, "Hold reason should be cleared");

  console.log("  ✔ Hold and release salary workflow verified.\n");

  // -------------------------------------------------------------------------
  // TEST 6: Approval Workflow, Finance Expense Posting & Locking Immutability
  // -------------------------------------------------------------------------
  console.log("TEST 6: Approval Workflow & Immutability...");
  // 6a. Submit for Review
  await PayrollService.updateRunStatus({
    payrollRunId: run2.id,
    newStatus: PayrollRunStatus.UNDER_REVIEW,
    actorUserId: testUser1.id,
  });

  // 6b. Reject during review
  const rejectedRun = await PayrollService.rejectRun({
    payrollRunId: run2.id,
    reason: "Recheck attendance for design team",
    actorUserId: testUser1.id,
  });
  assert.strictEqual(rejectedRun.status, PayrollRunStatus.CALCULATED, "Rejection returns to CALCULATED");

  // 6c. Approve Run -> Automatically creates Expense entry in Finance
  const approvedRun = await PayrollService.updateRunStatus({
    payrollRunId: run2.id,
    newStatus: PayrollRunStatus.APPROVED,
    actorUserId: testUser1.id,
  });
  assert.strictEqual(approvedRun.status, PayrollRunStatus.APPROVED);

  const linkedExpense = await prisma.expense.findFirst({
    where: { payrollRunId: run2.id },
  });
  assert.ok(linkedExpense, "Approved payroll run must generate linked Expense entry");
  console.log(`  ✔ Finance expense posted automatically: ₹${linkedExpense.amount}`);

  // 6d. Lock Run
  const lockedRun = await PayrollService.updateRunStatus({
    payrollRunId: run2.id,
    newStatus: PayrollRunStatus.LOCKED,
    actorUserId: testUser1.id,
  });
  assert.strictEqual(lockedRun.status, PayrollRunStatus.LOCKED);

  // 6e. Verify immutability: attempting to recalculate or modify locked run must fail
  await assert.rejects(
    async () => {
      await PayrollService.recalculateEmployeePayslip({
        payrollRunId: run2.id,
        userId: testUser1.id,
        actorUserId: testUser1.id,
      });
    },
    /locked/i,
    "Recalculating a locked run must be rejected"
  );

  await assert.rejects(
    async () => {
      await PayrollService.createPayrollRun({
        month: testMonth2,
        year: testYear,
        runType: "REGULAR",
        actorUserId: testUser1.id,
      });
    },
    /locked/i,
    "Re-creating a locked run must be rejected"
  );
  console.log("  ✔ Immutability verified: modifications to locked run strictly prohibited.\n");

  // 6f. Super-Admin Void Run cancels run & voids linked expense
  const voidedRun = await PayrollService.voidRun({
    payrollRunId: run2.id,
    reason: "Test teardown cancellation",
    actorUserId: testUser1.id,
  });
  assert.strictEqual(voidedRun.status, PayrollRunStatus.DRAFT);

  const voidedExpense = await prisma.expense.findFirst({
    where: { payrollRunId: run2.id },
  });
  assert.strictEqual(voidedExpense?.status, "REJECTED", "Linked expense should be voided");
  console.log("  ✔ Void workflow verified with expense reversal.\n");

  // Cleanup test records
  await prisma.payrollRun.deleteMany({
    where: { year: testYear, month: { in: [testMonth1, testMonth2] } },
  });
  await prisma.salaryAdjustment.deleteMany({
    where: { year: testYear, month: { in: [testMonth1, testMonth2] } },
  });

  console.log("=================================================================");
  console.log("🎉 ALL PHASE 4 WORKFLOW & IMMUTABILITY TESTS PASSED!");
  console.log("=================================================================\n");
}

main()
  .catch((err) => {
    console.error("❌ Phase 4 Test Failure:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
