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
 * Raised when a sync is asked for but no attendance source is set up. There used to be a
 * mock provider here that invented punches, late marks and overtime for every employee,
 * and it was both the default and the silent fallback when the biometric API key was
 * missing — so a "sync" on a server with no device filled payroll inputs with fiction.
 */
export class AttendanceNotConfiguredError extends Error {
  constructor(message = "Biometric sync is not set up. Set ATTENDANCE_API_URL and ATTENDANCE_API_KEY on the server, or upload a CSV instead.") {
    super(message);
    this.name = "AttendanceNotConfiguredError";
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
    this.apiUrl = process.env.ATTENDANCE_API_URL || "";
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
    if (!this.apiKey || !process.env.ATTENDANCE_API_URL) throw new AttendanceNotConfiguredError();

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
  const type = providerType || process.env.ATTENDANCE_PROVIDER || "BIOMETRIC_API";
  if (type === "REAL" || type === "BIOMETRIC_API") {
    return new BiometricApiAttendanceProvider();
  }
  if (type === "MANUAL_CSV") {
    return new ManualCsvAttendanceProvider();
  }
  throw new AttendanceNotConfiguredError(`Unknown attendance provider "${type}".`);
}
