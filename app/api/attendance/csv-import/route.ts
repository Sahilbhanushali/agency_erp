import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ManualCsvAttendanceProvider } from "@/lib/payroll/attendance-provider";
import { evaluateDayStatus } from "@/lib/payroll/daily-status-engine";
import { requireCan } from "@/lib/api-auth";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireCan("attendance", "create");
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const csvContent = formData.get("csv") as string | null;

    let csvText = "";
    if (file) {
      csvText = await file.text();
    } else if (csvContent) {
      csvText = csvContent;
    } else {
      return NextResponse.json({ error: "No CSV file or content provided" }, { status: 400 });
    }

    const users = await prisma.user.findMany({
      select: { id: true, email: true, name: true, shift: true, weeklyOffPattern: true },
    });
    const emailToIdMap = new Map(users.map((u) => [u.email.toLowerCase(), u.id]));

    const parser = new ManualCsvAttendanceProvider();
    const rawRecords = parser.parseCsv(csvText, emailToIdMap);

    if (rawRecords.length === 0) {
      return NextResponse.json(
        { error: "Could not parse any valid attendance rows. Ensure headers include (EmployeeId or Email), Date, CheckIn, CheckOut." },
        { status: 400 }
      );
    }

    let syncedCount = 0;
    const errors: Array<{ row: number; error: string }> = [];

    for (let i = 0; i < rawRecords.length; i++) {
      const record = rawRecords[i];
      try {
        const recordDate = new Date(`${record.date}T00:00:00.000Z`);
        const user = users.find((u) => u.id === record.employeeId);
        if (!user) {
          errors.push({ row: i + 1, error: `Employee ID #${record.employeeId} not found` });
          continue;
        }

        // Check if existing record is HR manual correction
        const existing = await prisma.attendance.findUnique({
          where: {
            userId_date: {
              userId: record.employeeId,
              date: recordDate,
            },
          },
        });

        if (existing?.isCorrected) {
          continue; // Respect existing HR manual lock
        }

        const evaluated = evaluateDayStatus({
          date: recordDate,
          checkIn: record.checkIn,
          checkOut: record.checkOut,
          isWeeklyOff: recordDate.getUTCDay() === 0,
          isHoliday: false,
        });

        await prisma.attendance.upsert({
          where: {
            userId_date: {
              userId: record.employeeId,
              date: recordDate,
            },
          },
          create: {
            userId: record.employeeId,
            date: recordDate,
            checkIn: record.checkIn,
            checkOut: record.checkOut,
            totalHours: evaluated.totalHours,
            workedMinutes: evaluated.workedMinutes,
            status: evaluated.status,
            lateMinutes: evaluated.lateMinutes,
            earlyExitMinutes: evaluated.earlyExitMinutes,
            overtimeHours: evaluated.overtimeHours,
            source: record.source,
            externalRef: record.externalRef,
          },
          update: {
            checkIn: record.checkIn,
            checkOut: record.checkOut,
            totalHours: evaluated.totalHours,
            workedMinutes: evaluated.workedMinutes,
            status: evaluated.status,
            lateMinutes: evaluated.lateMinutes,
            earlyExitMinutes: evaluated.earlyExitMinutes,
            overtimeHours: evaluated.overtimeHours,
            source: record.source,
            externalRef: record.externalRef,
          },
        });

        syncedCount++;
      } catch (err: any) {
        errors.push({ row: i + 1, error: err.message });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully imported ${syncedCount} attendance records from CSV.`,
      totalRows: rawRecords.length,
      syncedCount,
      errorCount: errors.length,
      errors,
    });
  } catch (error: any) {
    console.error("POST /api/attendance/csv-import error:", error);
    return NextResponse.json({ error: error.message || "Failed to import CSV attendance" }, { status: 500 });
  }
}
