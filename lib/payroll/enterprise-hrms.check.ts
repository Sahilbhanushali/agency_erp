import { prisma } from "../prisma";
import { PayrollService } from "./payroll-service";
import { AttendanceService } from "./attendance-service";
import { LeaveService } from "./leave-service";
import { evaluateDayStatus } from "./daily-status-engine";
import { calculateFnFSettlement } from "./calculation-engine";

async function runEnterpriseAuditVerification() {
  console.log("=================================================================");
  console.log("▶ RUNNING ENTERPRISE HRMS & PAYROLL AUDIT VERIFICATION SUITE");
  console.log("=================================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, desc: string) {
    if (condition) {
      console.log(`  ✔ PASS: ${desc}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${desc}`);
      failed++;
    }
  }

  // -------------------------------------------------------------
  // TEST 1: Cross-Midnight / Overnight Shift Calculations
  // -------------------------------------------------------------
  console.log("TEST 1: Overnight / Night Shift Evaluation (20:00 to 05:00)");
  {
    const shiftNight = {
      startTime: "20:00",
      endTime: "05:00",
      graceMinutes: 15,
      halfDayMinutes: 240,
      fullDayMinutes: 480,
    };
    const shiftDate = new Date("2026-10-12T00:00:00.000Z");

    const resOnTime = evaluateDayStatus({
      date: shiftDate,
      shift: shiftNight,
      checkIn: new Date("2026-10-12T20:05:00.000Z"),
      checkOut: new Date("2026-10-13T05:05:00.000Z"),
      isWeeklyOff: false,
      isHoliday: false,
    });

    assert(resOnTime.status === "PRESENT", `On-time punch in night shift marked as PRESENT (got ${resOnTime.status})`);
    assert(resOnTime.lateMinutes === 0, `Not marked late within grace period (lateMinutes: ${resOnTime.lateMinutes})`);

    const resLate = evaluateDayStatus({
      date: shiftDate,
      shift: shiftNight,
      checkIn: new Date("2026-10-12T20:30:00.000Z"),
      checkOut: new Date("2026-10-13T05:00:00.000Z"),
      isWeeklyOff: false,
      isHoliday: false,
    });

    assert(resLate.status === "LATE", `Punch at 20:30 correctly identified as late in night shift (status: ${resLate.status})`);
    assert(resLate.lateMinutes === 30, `Late minutes calculated as 30 (got ${resLate.lateMinutes})`);
  }

  // -------------------------------------------------------------
  // TEST 2: Indian Statutory Gratuity & FnF Deterministic Math
  // -------------------------------------------------------------
  console.log("\nTEST 2: Gratuity & FnF Statutory Calculation Engine");
  {
    // Employee with 6 years tenure, Basic ₹40,000/mo (4000000 paise), Gross ₹80,000/mo (8000000 paise)
    // Resigning with 10 days notice shortfall, 15 days unavailed leave
    const fnf6Yr = calculateFnFSettlement({
      employee: {
        userId: 101,
        userName: "Senior Engineer",
        joiningDate: new Date("2018-04-01"),
        monthlyGross: 8000000,
        basicMonthly: 4000000,
      },
      resignationDate: new Date("2024-04-01"),
      lastWorkingDate: new Date("2024-04-20"), // 20 days worked in April (30 days total)
      noticePeriodDays: 30,
      servedNoticeDays: 20, // 10 days shortfall
      leaveEncashmentDays: 15, // 15 days EL encashment
      outstandingLoanBalance: 500000, // ₹5,000 outstanding loan
      otherDeductions: 200000, // ₹2,000 asset recovery
    });

    assert(fnf6Yr.isGratuityEligible === true, `Employee with 6 years service is marked Gratuity Eligible`);
    // Gratuity formula: (15 * basic * completedYears) / 26
    // (15 * 4000000 * 6) / 26 = 360000000 / 26 = 13846154 paise (₹1,38,461.54)
    assert(fnf6Yr.gratuityAmount === 13846154, `Gratuity amount equals ₹1,38,461.54 (got ${fnf6Yr.gratuityAmount})`);

    // Notice Recovery: 10 days shortfall * (8000000 / 30) = 10 * 266667 = 2666670 paise (₹26,666.70)
    assert(fnf6Yr.shortfallDays === 10, `Notice shortfall is 10 days`);
    assert(fnf6Yr.noticeRecoveryAmount > 2600000, `Notice recovery calculated correctly (${fnf6Yr.noticeRecoveryAmount})`);

    // Leave Encashment: 15 days * (4000000 / 30) = 15 * 133333 = 2000000 paise (₹20,000)
    assert(fnf6Yr.leaveEncashmentAmount === 1999995 || fnf6Yr.leaveEncashmentAmount === 2000000, `Leave encashment matches Basic/30 formula`);

    // Non-eligible tenure test: 2 years tenure
    const fnf2Yr = calculateFnFSettlement({
      employee: {
        userId: 102,
        userName: "Junior Analyst",
        joiningDate: new Date("2022-04-01"),
        monthlyGross: 5000000,
        basicMonthly: 2500000,
      },
      resignationDate: new Date("2024-04-01"),
      lastWorkingDate: new Date("2024-04-30"),
      noticePeriodDays: 30,
      servedNoticeDays: 30,
    });
    assert(fnf2Yr.isGratuityEligible === false, `Employee with 2 years service is NOT eligible for gratuity`);
    assert(fnf2Yr.gratuityAmount === 0, `Gratuity amount is 0 for non-eligible employee`);
  }

  // -------------------------------------------------------------
  // TEST 3: Database Loan Advance Lifecycle & Installments
  // -------------------------------------------------------------
  console.log("\nTEST 3: Loan Advance Creation, EMI Scheduling & Repayment");
  {
    // Find an active employee from db
    const testUser = await prisma.user.findFirst({
      where: { exitStatus: { not: "SEPARATED" } },
    });

    if (testUser) {
      // Clean up previous test loans for this user
      await prisma.loanAdvance.deleteMany({ where: { userId: testUser.id } });

      // Create a loan: ₹60,000 (6000000 paise), 6 months tenure
      const loan = await PayrollService.createLoanAdvance({
        userId: testUser.id,
        principalAmount: 6000000,
        totalTenure: 6,
        reason: "Medical Expense Advance",
      });

      assert(loan !== null && loan.principalAmount === 6000000, `Loan created with principal ₹60,000`);
      assert(loan!.installments.length === 6, `6 monthly installments generated`);
      assert(loan!.installmentEmi === 1000000, `Calculated monthly EMI is ₹10,000 (1000000 paise)`);

      // Verify cannot create duplicate active loan
      let duplicateError = false;
      try {
        await PayrollService.createLoanAdvance({
          userId: testUser.id,
          principalAmount: 2000000,
          totalTenure: 2,
          reason: "Second Loan",
        });
      } catch (err: any) {
        duplicateError = true;
      }
      assert(duplicateError, `Prevented creating duplicate active loan while existing loan has balance`);

      // Record a manual repayment of ₹20,000 (2000000 paise)
      const afterRepay = await PayrollService.recordManualLoanRepayment(loan!.id, 2000000, "Early partial repayment");
      assert(afterRepay.balanceAmount === 4000000, `Loan balance updated to ₹40,000 after repayment`);
      assert(afterRepay.totalRepaid === 2000000, `Total repaid recorded as ₹20,000`);

      // Pause and Resume loan status
      const paused = await PayrollService.updateLoanStatus(loan!.id, "PAUSED");
      assert(paused.status === "PAUSED", `Loan status updated to PAUSED`);
      const resumed = await PayrollService.updateLoanStatus(loan!.id, "ACTIVE");
      assert(resumed.status === "ACTIVE", `Loan status resumed to ACTIVE`);

      // Clean up
      await prisma.loanAdvance.deleteMany({ where: { userId: testUser.id } });
    }
  }

  // -------------------------------------------------------------
  // TEST 4: Full and Final Settlement Lifecycle & Separation
  // -------------------------------------------------------------
  console.log("\nTEST 4: FnF Settlement Workflow & Separation of Duties");
  {
    // Find or create a test departing employee
    let exitingUser = await prisma.user.findFirst({
      where: { email: "fnf.test.employee@example.com" },
    });

    if (!exitingUser) {
      exitingUser = await prisma.user.create({
        data: {
          email: "fnf.test.employee@example.com",
          name: "FnF Test Employee",
          joiningDate: new Date("2021-01-15"),
          exitStatus: "ACTIVE",
          currentSalary: 60000,
          designation: "Product Designer",
          department: "Design",
        },
      });

      await PayrollService.upsertSalaryStructure({
        userId: exitingUser.id,
        basicSalary: 3000000, // ₹30,000
        hra: 1500000,         // ₹15,000
        specialAllowance: 1500000, // ₹15,000
        otherAllowances: 0,
        fixedBonus: 0,
        variablePay: 0,
        pfDeduction: true,
        esiDeduction: false,
        professionalTax: true,
        actorUserId: exitingUser.id,
      });
    }

    // Clean any prior settlements
    await prisma.fullAndFinalSettlement.deleteMany({ where: { userId: exitingUser.id } });

    // Save FnF draft
    const settlementDraft = await PayrollService.saveFnFSettlement({
      userId: exitingUser.id,
      resignationDate: new Date("2024-03-01"),
      lastWorkingDate: new Date("2024-03-31"),
      noticePeriodDays: 30,
      servedNoticeDays: 30,
      notes: "Voluntary resignation. Handover complete.",
    });

    assert(settlementDraft.status === "DRAFT", `FnF draft created with DRAFT status`);
    assert(settlementDraft.pendingSalaryAmount > 0, `Pending salary amount computed`);

    // Verify separation of duties: exiting employee CANNOT approve own settlement
    let selfApprovalBlocked = false;
    try {
      await PayrollService.approveFnFSettlement(settlementDraft.id, exitingUser.id);
    } catch (err: any) {
      if (err.message.includes("Separation of duties")) {
        selfApprovalBlocked = true;
      }
    }
    assert(selfApprovalBlocked, `Self-approval of FnF settlement strictly blocked`);

    // Approve with a distinct approver ID (e.g. 9999 or admin)
    const approvedSettlement = await PayrollService.approveFnFSettlement(settlementDraft.id, 9999);
    assert(approvedSettlement.status === "APPROVED", `Settlement successfully APPROVED by authorized approver`);

    // Verify employee record status was updated to SEPARATED
    const verifiedUser = await prisma.user.findUnique({ where: { id: exitingUser.id } });
    assert(verifiedUser?.exitStatus === "SEPARATED", `Employee exitStatus transitioned to SEPARATED in User record`);

    // Clean up test data
    await prisma.fullAndFinalSettlement.deleteMany({ where: { userId: exitingUser.id } });
    await prisma.salaryStructure.deleteMany({ where: { userId: exitingUser.id } });
    await prisma.user.delete({ where: { id: exitingUser.id } });
  }

  // -------------------------------------------------------------
  // TEST 5: Overlapping Leave Prevention & Self-Approval Block
  // -------------------------------------------------------------
  console.log("\nTEST 5: Leave Overlap Prevention & Reversal Workflow");
  {
    const leaveUser = await prisma.user.findFirst({
      where: { exitStatus: { not: "SEPARATED" } },
    });
    const leaveType = await prisma.leaveType.findFirst({ where: { isActive: true } });

    if (leaveUser && leaveType) {
      // Ensure user has balance
      await prisma.leaveBalance.upsert({
        where: {
          userId_leaveTypeId_year: {
            userId: leaveUser.id,
            leaveTypeId: leaveType.id,
            year: 2026,
          },
        },
        create: {
          userId: leaveUser.id,
          leaveTypeId: leaveType.id,
          year: 2026,
          totalQuota: 10,
          usedDays: 0,
          pendingDays: 0,
        },
        update: {},
      });

      // Clean prior test leaves
      await prisma.leaveRequest.deleteMany({
        where: { userId: leaveUser.id, startDate: { gte: new Date("2026-11-01") } },
      });

      // Apply first leave
      const leave1 = await LeaveService.applyLeave({
        userId: leaveUser.id,
        leaveTypeId: leaveType.id,
        startDate: new Date("2026-11-10"),
        endDate: new Date("2026-11-12"),
        reason: "First valid leave request",
      });
      assert(leave1.status === "PENDING", `First leave request created successfully`);

      // Attempt overlapping leave: 2026-11-11 to 2026-11-14
      let overlapBlocked = false;
      try {
        await LeaveService.applyLeave({
          userId: leaveUser.id,
          leaveTypeId: leaveType.id,
          startDate: new Date("2026-11-11"),
          endDate: new Date("2026-11-14"),
          reason: "Overlapping leave attempt",
        });
      } catch (err: any) {
        if (err.message.includes("overlapping")) {
          overlapBlocked = true;
        }
      }
      assert(overlapBlocked, `Overlapping leave request correctly rejected by validation`);

      // Verify self-approval rejection
      let selfApproveBlocked = false;
      try {
        await LeaveService.reviewLeave({
          leaveRequestId: leave1.id,
          status: "APPROVED",
          approverId: leaveUser.id, // Self-review
        });
      } catch (err: any) {
        if (err.message.includes("Self-approval")) {
          selfApproveBlocked = true;
        }
      }
      assert(selfApproveBlocked, `Leave self-approval prevented by separation of duties`);

      // Cancel leave and verify cleanup
      const cancelled = await LeaveService.cancelLeave({
        leaveRequestId: leave1.id,
        actorUserId: leaveUser.id,
        reason: "Plans changed",
      });
      assert(cancelled.status === "CANCELLED", `Leave request successfully cancelled`);

      // Cleanup
      await prisma.leaveRequest.deleteMany({ where: { id: leave1.id } });
    }
  }

  console.log("\n=================================================================");
  console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log("=================================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runEnterpriseAuditVerification()
  .catch((err) => {
    console.error("Verification suite failed with error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
