import { AttendanceStatus, AttendanceSource } from "@prisma/client";

export interface RawAttendanceRecord {
  employeeId: number;
  employeeEmail?: string;
  date: string; // YYYY-MM-DD
  checkIn: Date | null;
  checkOut: Date | null;
  totalHours: number;
  workedMinutes: number;
  status: AttendanceStatus;
  lateMinutes: number;
  earlyExitMinutes: number;
  overtimeHours: number;
  source: AttendanceSource;
  externalRef?: string;
  rawPayload?: Record<string, any>;
}

export interface AttendanceSyncResult {
  batchId: string;
  provider: string;
  startDate: string;
  endDate: string;
  totalRecords: number;
  syncedCount: number;
  skippedCount: number;
  errorCount: number;
  errors: Array<{ employeeId?: number; date?: string; error: string }>;
}

export interface AttendanceProvider {
  readonly name: string;
  fetchDailyAttendance(
    date: Date,
    employees: Array<{ id: number; email: string; name: string }>
  ): Promise<RawAttendanceRecord[]>;
  fetchRangeAttendance(
    startDate: Date,
    endDate: Date,
    employees: Array<{ id: number; email: string; name: string }>
  ): Promise<RawAttendanceRecord[]>;
}

/**
 * Deterministic Mock Attendance Provider.
 * Generates realistic attendance records (punches, late marks, overtime)
 * for testing and staging until real biometric hardware / HRMS API is connected.
 */
export class MockAttendanceProvider implements AttendanceProvider {
  readonly name = "MOCK";

  async fetchDailyAttendance(
    date: Date,
    employees: Array<{ id: number; email: string; name: string }>
  ): Promise<RawAttendanceRecord[]> {
    return this.generateForDate(date, employees);
  }

  async fetchRangeAttendance(
    startDate: Date,
    endDate: Date,
    employees: Array<{ id: number; email: string; name: string }>
  ): Promise<RawAttendanceRecord[]> {
    const records: RawAttendanceRecord[] = [];
    const current = new Date(startDate);

    while (current <= endDate) {
      const dayRecords = this.generateForDate(new Date(current), employees);
      records.push(...dayRecords);
      current.setDate(current.getDate() + 1);
    }

    return records;
  }

  private generateForDate(
    date: Date,
    employees: Array<{ id: number; email: string; name: string }>
  ): RawAttendanceRecord[] {
    const dayOfWeek = date.getDay(); // 0 = Sunday
    const isSunday = dayOfWeek === 0;
    const dateStr = date.toISOString().split("T")[0];

    return employees.map((emp) => {
      // Deterministic hash based on emp.id and date
      const hash = (emp.id * 31 + date.getDate() * 17 + (date.getMonth() + 1) * 7) % 100;

      if (isSunday) {
        return {
          employeeId: emp.id,
          employeeEmail: emp.email,
          date: dateStr,
          checkIn: null,
          checkOut: null,
          totalHours: 0,
          workedMinutes: 0,
          status: AttendanceStatus.WEEKLY_OFF,
          lateMinutes: 0,
          earlyExitMinutes: 0,
          overtimeHours: 0,
          source: AttendanceSource.SYSTEM,
          externalRef: `mock-sun-${emp.id}-${dateStr}`,
        };
      }

      // Check-in around 09:30 AM
      const inHour = 9;
      // 15% chance of being late (> 15 mins past 9:30 => past 9:45)
      const isLate = hash < 15;
      const inMinute = isLate ? 35 + (hash % 25) : 15 + (hash % 15);

      const checkIn = new Date(date);
      checkIn.setHours(inHour, inMinute, 0, 0);

      // Check-out around 06:30 PM (18:30)
      const outHour = 18;
      // 20% chance of overtime (staying till 20:00 or 21:00)
      const hasOvertime = hash > 80;
      const outMinute = hasOvertime ? 30 : 25 + (hash % 20);
      const actualOutHour = hasOvertime ? (hash > 90 ? 21 : 20) : outHour;

      const checkOut = new Date(date);
      checkOut.setHours(actualOutHour, outMinute, 0, 0);

      const totalMs = checkOut.getTime() - checkIn.getTime();
      const workedMinutes = Math.max(0, Math.round(totalMs / 60000));
      const totalHours = parseFloat((workedMinutes / 60).toFixed(2));

      // Late minutes measured from official start time 09:30 AM
      const officialStart = new Date(date);
      officialStart.setHours(9, 30, 0, 0);
      const lateMinutes =
        checkIn > officialStart ? Math.round((checkIn.getTime() - officialStart.getTime()) / 60000) : 0;

      // Overtime hours above 8.5 hours
      const overtimeHours = totalHours > 8.5 ? parseFloat((totalHours - 8.5).toFixed(2)) : 0;

      let status: AttendanceStatus = AttendanceStatus.PRESENT;
      if (isLate && lateMinutes > 15) {
        status = AttendanceStatus.LATE;
      }

      return {
        employeeId: emp.id,
        employeeEmail: emp.email,
        date: dateStr,
        checkIn,
        checkOut,
        totalHours,
        workedMinutes,
        status,
        lateMinutes,
        earlyExitMinutes: 0,
        overtimeHours,
        source: AttendanceSource.API,
        externalRef: `mock-${emp.id}-${dateStr}`,
      };
    });
  }
}

/**
 * Manual / CSV Import Attendance Provider.
 * Parses and validates CSV strings uploaded by HR.
 * Expected headers: employeeId or email, date (YYYY-MM-DD), checkIn (HH:MM or ISO), checkOut (HH:MM or ISO)
 */
export class ManualCsvAttendanceProvider implements AttendanceProvider {
  readonly name = "MANUAL_CSV";
  private csvRows: RawAttendanceRecord[] = [];

  constructor(csvContent?: string, employeeMap?: Map<string, number>) {
    if (csvContent && employeeMap) {
      this.csvRows = this.parseCsv(csvContent, employeeMap);
    }
  }

  setRecords(records: RawAttendanceRecord[]) {
    this.csvRows = records;
  }

  async fetchDailyAttendance(
    date: Date,
    _employees: Array<{ id: number; email: string; name: string }>
  ): Promise<RawAttendanceRecord[]> {
    const dateStr = date.toISOString().split("T")[0];
    return this.csvRows.filter((r) => r.date === dateStr);
  }

  async fetchRangeAttendance(
    startDate: Date,
    endDate: Date,
    _employees: Array<{ id: number; email: string; name: string }>
  ): Promise<RawAttendanceRecord[]> {
    const startStr = startDate.toISOString().split("T")[0];
    const endStr = endDate.toISOString().split("T")[0];
    return this.csvRows.filter((r) => r.date >= startStr && r.date <= endStr);
  }

  /**
   * Helper to parse CSV strings into normalized records.
   */
  public parseCsv(csvText: string, employeeMap: Map<string, number>): RawAttendanceRecord[] {
    const lines = csvText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) return [];

    const header = lines[0].toLowerCase().split(",").map((h) => h.trim());
    const empIdIdx = header.findIndex((h) => h.includes("id") || h.includes("empid"));
    const emailIdx = header.findIndex((h) => h.includes("email"));
    const dateIdx = header.findIndex((h) => h.includes("date"));
    const inIdx = header.findIndex((h) => h.includes("in") || h.includes("checkin"));
    const outIdx = header.findIndex((h) => h.includes("out") || h.includes("checkout"));

    const records: RawAttendanceRecord[] = [];

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(",").map((p) => p.trim());
      if (parts.length < 3) continue;

      let empId: number | undefined;
      let email: string | undefined;

      if (empIdIdx !== -1 && !isNaN(Number(parts[empIdIdx]))) {
        empId = Number(parts[empIdIdx]);
      } else if (emailIdx !== -1 && parts[emailIdx]) {
        email = parts[emailIdx].toLowerCase();
        empId = employeeMap.get(email);
      }

      if (!empId) continue;

      const dateStr = parts[dateIdx] || new Date().toISOString().split("T")[0];
      const inRaw = inIdx !== -1 ? parts[inIdx] : "";
      const outRaw = outIdx !== -1 ? parts[outIdx] : "";

      let checkIn: Date | null = null;
      let checkOut: Date | null = null;

      if (inRaw) {
        checkIn = inRaw.includes("T")
          ? new Date(inRaw)
          : new Date(`${dateStr}T${inRaw.length === 5 ? inRaw + ":00" : inRaw}`);
      }

      if (outRaw) {
        checkOut = outRaw.includes("T")
          ? new Date(outRaw)
          : new Date(`${dateStr}T${outRaw.length === 5 ? outRaw + ":00" : outRaw}`);
      }

      let workedMinutes = 0;
      let totalHours = 0;
      if (checkIn && checkOut && checkOut > checkIn) {
        workedMinutes = Math.round((checkOut.getTime() - checkIn.getTime()) / 60000);
        totalHours = parseFloat((workedMinutes / 60).toFixed(2));
      }

      records.push({
        employeeId: empId,
        employeeEmail: email,
        date: dateStr,
        checkIn,
        checkOut,
        totalHours,
        workedMinutes,
        status: workedMinutes >= 240 ? AttendanceStatus.PRESENT : AttendanceStatus.ABSENT,
        lateMinutes: 0,
        earlyExitMinutes: 0,
        overtimeHours: totalHours > 8.0 ? parseFloat((totalHours - 8.0).toFixed(2)) : 0,
        source: AttendanceSource.MANUAL,
        externalRef: `csv-row-${i}-${dateStr}`,
      });
    }

    return records;
  }
}

/**
 * =============================================================================
 * REAL BIOMETRIC / HRMS API ADAPTER (PRODUCTION-READY STUB)
 * =============================================================================
 * Connects to external biometric servers (e.g. ZKTeco, Matrix Cosec, eSSL,
 * Keka, Zoho People, or Cloud Punch APIs).
 *
 * Implements exponential backoff retries and structured payload normalization.
 */
export class BiometricApiAttendanceProvider implements AttendanceProvider {
  readonly name = "BIOMETRIC_API";
  private apiUrl: string;
  private apiKey: string;
  private timeoutMs: number;
  private maxRetries: number;

  constructor() {
    this.apiUrl = process.env.ATTENDANCE_API_URL || "https://api.biometric-provider.com/v1";
    this.apiKey = process.env.ATTENDANCE_API_KEY || "";
    this.timeoutMs = parseInt(process.env.ATTENDANCE_API_TIMEOUT_MS || "8000", 10);
    this.maxRetries = parseInt(process.env.ATTENDANCE_API_RETRIES || "3", 10);
  }

  async fetchDailyAttendance(
    date: Date,
    employees: Array<{ id: number; email: string; name: string }>
  ): Promise<RawAttendanceRecord[]> {
    return this.fetchRangeAttendance(date, date, employees);
  }

  async fetchRangeAttendance(
    startDate: Date,
    endDate: Date,
    employees: Array<{ id: number; email: string; name: string }>
  ): Promise<RawAttendanceRecord[]> {
    if (!this.apiKey) {
      console.warn(
        "[BiometricApiAttendanceProvider] ATTENDANCE_API_KEY not configured. Falling back to MockProvider."
      );
      return new MockAttendanceProvider().fetchRangeAttendance(startDate, endDate, employees);
    }

    const startIso = startDate.toISOString().split("T")[0];
    const endIso = endDate.toISOString().split("T")[0];

    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

        const res = await fetch(
          `${this.apiUrl}/punches?from=${startIso}&to=${endIso}`,
          {
            signal: controller.signal,
            headers: {
              Authorization: `Bearer ${this.apiKey}`,
              "Content-Type": "application/json",
            },
          }
        );
        clearTimeout(timeoutId);

        if (!res.ok) {
          throw new Error(`Biometric hardware API HTTP ${res.status}: ${res.statusText}`);
        }

        const data = await res.json();

        // Map external payload into normalized RawAttendanceRecord[]:
        const employeeEmailMap = new Map(employees.map((e) => [e.email.toLowerCase(), e.id]));
        const records: RawAttendanceRecord[] = [];

        for (const item of data.records || []) {
          const empId =
            item.employeeId ||
            (item.email ? employeeEmailMap.get(item.email.toLowerCase()) : undefined);

          if (!empId) continue;

          const checkIn = item.checkIn ? new Date(item.checkIn) : null;
          const checkOut = item.checkOut ? new Date(item.checkOut) : null;
          let workedMinutes = item.workedMinutes || 0;
          if (!workedMinutes && checkIn && checkOut && checkOut > checkIn) {
            workedMinutes = Math.round((checkOut.getTime() - checkIn.getTime()) / 60000);
          }

          records.push({
            employeeId: empId,
            employeeEmail: item.email,
            date: item.date || startIso,
            checkIn,
            checkOut,
            totalHours: parseFloat((workedMinutes / 60).toFixed(2)),
            workedMinutes,
            status: (item.status as AttendanceStatus) || AttendanceStatus.PRESENT,
            lateMinutes: item.lateMinutes || 0,
            earlyExitMinutes: item.earlyExitMinutes || 0,
            overtimeHours: item.overtimeHours || 0,
            source: AttendanceSource.BIOMETRIC,
            externalRef: item.punchId || item.id,
            rawPayload: item,
          });
        }

        return records;
      } catch (err: any) {
        lastError = err;
        console.warn(
          `[BiometricApiAttendanceProvider] Attempt ${attempt}/${this.maxRetries} failed: ${err.message}`
        );
        if (attempt < this.maxRetries) {
          // Exponential backoff
          await new Promise((resolve) => setTimeout(resolve, 500 * Math.pow(2, attempt)));
        }
      }
    }

    throw new Error(
      `Biometric hardware API failed after ${this.maxRetries} attempts: ${lastError?.message}`
    );
  }
}

/**
 * Factory to retrieve the configured attendance provider.
 */
export function getAttendanceProvider(providerType?: string): AttendanceProvider {
  const type = providerType || process.env.ATTENDANCE_PROVIDER || "MOCK";
  if (type === "REAL" || type === "BIOMETRIC_API") {
    return new BiometricApiAttendanceProvider();
  }
  if (type === "MANUAL_CSV") {
    return new ManualCsvAttendanceProvider();
  }
  return new MockAttendanceProvider();
}
