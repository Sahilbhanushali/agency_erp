import { evaluateDayStatus } from "./daily-status-engine";
import { AttendanceStatus } from "@prisma/client";

async function runPhase2Tests() {
  console.log("▶ Running Phase 2: Attendance & Leave Engine Tests...\n");

  const today = new Date("2026-10-12T00:00:00.000Z");
  const shift = {
    startTime: "09:30",
    endTime: "18:30",
    graceMinutes: 15,
    halfDayMinutes: 240, // 4 hours
    fullDayMinutes: 480, // 8 hours
  };

  // Test 1: On-time check-in (09:25 to 18:35) -> PRESENT
  const checkInOnTime = new Date("2026-10-12T09:25:00.000Z");
  const checkOutOnTime = new Date("2026-10-12T18:35:00.000Z");
  const res1 = evaluateDayStatus({
    date: today,
    checkIn: checkInOnTime,
    checkOut: checkOutOnTime,
    shift,
    isWeeklyOff: false,
    isHoliday: false,
  });
  if (res1.status !== AttendanceStatus.PRESENT) {
    throw new Error(`Test 1 Failed: Expected PRESENT, got ${res1.status}`);
  }
  console.log("  ✔ Test 1: On-time arrival evaluated as PRESENT.");

  // Test 2: Late arrival past grace period (10:05 to 18:30) -> LATE
  const checkInLate = new Date("2026-10-12T10:05:00.000Z");
  const checkOutNormal = new Date("2026-10-12T18:30:00.000Z");
  const res2 = evaluateDayStatus({
    date: today,
    checkIn: checkInLate,
    checkOut: checkOutNormal,
    shift,
    isWeeklyOff: false,
    isHoliday: false,
  });
  if (res2.status !== AttendanceStatus.LATE || res2.lateMinutes < 30) {
    throw new Error(`Test 2 Failed: Expected LATE with >= 30m late, got status ${res2.status}, late ${res2.lateMinutes}m`);
  }
  console.log("  ✔ Test 2: Arrival past grace period evaluated as LATE with accurate late minutes.");

  // Test 3: Worked 300 minutes (5 hours) -> HALF_DAY
  const checkInHalf = new Date("2026-10-12T09:30:00.000Z");
  const checkOutHalf = new Date("2026-10-12T14:30:00.000Z"); // 5 hours = 300m
  const res3 = evaluateDayStatus({
    date: today,
    checkIn: checkInHalf,
    checkOut: checkOutHalf,
    shift,
    isWeeklyOff: false,
    isHoliday: false,
  });
  if (res3.status !== AttendanceStatus.HALF_DAY) {
    throw new Error(`Test 3 Failed: Expected HALF_DAY, got ${res3.status}`);
  }
  console.log("  ✔ Test 3: 5 hours worked correctly categorized as HALF_DAY.");

  // Test 4: Worked only 2 hours (< 240m) -> ABSENT
  const checkInShort = new Date("2026-10-12T09:30:00.000Z");
  const checkOutShort = new Date("2026-10-12T11:30:00.000Z"); // 2 hours
  const res4 = evaluateDayStatus({
    date: today,
    checkIn: checkInShort,
    checkOut: checkOutShort,
    shift,
    isWeeklyOff: false,
    isHoliday: false,
  });
  if (res4.status !== AttendanceStatus.ABSENT) {
    throw new Error(`Test 4 Failed: Expected ABSENT for < 240 mins, got ${res4.status}`);
  }
  console.log("  ✔ Test 4: Less than 4 hours worked correctly categorized as ABSENT.");

  // Test 5: Overtime worked (09:30 to 21:00 = 11.5 hours) -> Overtime calculated
  const checkInOt = new Date("2026-10-12T09:30:00.000Z");
  const checkOutOt = new Date("2026-10-12T21:00:00.000Z"); // 11.5h vs 8h fullDay => 3.5h overtime
  const res5 = evaluateDayStatus({
    date: today,
    checkIn: checkInOt,
    checkOut: checkOutOt,
    shift,
    isWeeklyOff: false,
    isHoliday: false,
    overtimeEnabled: true,
  });
  if (res5.overtimeHours < 3.4) {
    throw new Error(`Test 5 Failed: Expected ~3.5h overtime, got ${res5.overtimeHours}h`);
  }
  console.log(`  ✔ Test 5: Overtime derived accurately (${res5.overtimeHours} hours).`);

  // Test 6: Sandwich Rule penalty on Sunday
  const res6 = evaluateDayStatus({
    date: new Date("2026-10-18T00:00:00.000Z"), // Sunday
    checkIn: null,
    checkOut: null,
    isWeeklyOff: true,
    isHoliday: false,
    isSandwichCandidate: true,
    sandwichRuleEnabled: true,
  });
  if (res6.status !== AttendanceStatus.ABSENT || !res6.isSandwichDeduction) {
    throw new Error(`Test 6 Failed: Expected ABSENT with sandwich deduction, got ${res6.status}`);
  }
  console.log("  ✔ Test 6: Sandwich rule penalty correctly marks Sunday as ABSENT with deduction.");

  // Test 7: Conflict Resolution: Manual HR correction beats raw punch
  const res7 = evaluateDayStatus({
    date: today,
    checkIn: checkInShort, // raw punch would be ABSENT
    checkOut: checkOutShort,
    isWeeklyOff: false,
    isHoliday: false,
    isManualCorrection: true,
    manualStatus: AttendanceStatus.PRESENT, // HR override
  });
  if (res7.status !== AttendanceStatus.PRESENT) {
    throw new Error(`Test 7 Failed: Expected HR manual correction to win, got ${res7.status}`);
  }
  console.log("  ✔ Test 7: Conflict resolution: HR manual correction strictly overrides raw API punches.");

  // Test 8: Approved Leave takes precedence over absent punch
  const res8 = evaluateDayStatus({
    date: today,
    checkIn: null,
    checkOut: null,
    isWeeklyOff: false,
    isHoliday: false,
    approvedLeave: {
      isPaid: true,
      isHalfDay: false,
      leaveTypeCode: "PL",
    },
  });
  if (res8.status !== AttendanceStatus.ON_LEAVE) {
    throw new Error(`Test 8 Failed: Expected ON_LEAVE, got ${res8.status}`);
  }
  console.log("  ✔ Test 8: Approved Leave takes precedence over missing punches.");

  console.log("\n🎉 ALL PHASE 2 ENGINE TESTS PASSED SUCCESSFULLY!");
}

runPhase2Tests().catch((err) => {
  console.error("❌ Phase 2 Tests Failed:", err);
  process.exit(1);
});
