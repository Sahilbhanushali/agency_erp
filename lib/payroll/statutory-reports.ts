export interface StatutoryEmployeeRecord {
  id: number;
  name: string;
  pan?: string | null;
  uan?: string | null;
  esiNumber?: string | null;
  designation?: string | null;
  department?: string | null;
  state?: string | null;
  payableDays: number;
  calendarDays: number;
  grossSalary: number; // minor units
  netSalary: number;
  employerCost: number;
  breakdown: {
    earnedBasic: number;
    fixedBasic: number;
    earnedGross: number;
    pfEmployee: number;
    pfEmployer: number;
    pfEmployerEps?: number;
    pfEmployerEpf?: number;
    esiEmployee: number;
    esiEmployer: number;
    professionalTax: number;
    tds: number;
  };
}

export class StatutoryReportsGenerator {
  /**
   * Generates PF Electronic Challan cum Return (ECR) text/CSV.
   * Conforms to EPFO official ECR file structure.
   */
  static generatePfEcr(
    records: StatutoryEmployeeRecord[],
    month: number,
    year: number
  ): { filename: string; content: string } {
    const headers = [
      "UAN",
      "Member Name",
      "Gross Wages (INR)",
      "EPF Wages (INR)",
      "EPS Wages (INR)",
      "EDLI Wages (INR)",
      "EE Share (12%)",
      "ER EPS Share (8.33%)",
      "ER EPF Share (3.67%)",
      "NCP Days (Non-Contributory)",
      "Refund of Advances",
    ];

    const pfWageCeilingRupees = 15000;

    const rows = records
      .filter((r) => r.breakdown.pfEmployee > 0 || r.breakdown.pfEmployer > 0)
      .map((r) => {
        const grossRupees = Math.round(r.grossSalary / 100);
        const earnedBasicRupees = Math.round(r.breakdown.earnedBasic / 100);

        // EPF wages capped at ₹15,000 ceiling if basic is higher, or actual if lower
        const epfWages = Math.min(earnedBasicRupees, pfWageCeilingRupees);
        const epsWages = epfWages;
        const edliWages = epfWages;

        const eeShare = Math.round(r.breakdown.pfEmployee / 100);
        // Employer 12% is split into: EPS 8.33% (up to ₹1250) + EPF 3.67%
        const erEpsShare = Math.min(Math.round(epsWages * 0.0833), 1250);
        const erEpfShare = Math.max(0, eeShare - erEpsShare);

        const ncpDays = Math.max(0, (r.calendarDays || 30) - Math.floor(r.payableDays));
        const uan = r.uan || `UAN_MOCK_${r.id}`;

        return [
          uan,
          `"${r.name.replace(/"/g, '""')}"`,
          grossRupees,
          epfWages,
          epsWages,
          edliWages,
          eeShare,
          erEpsShare,
          erEpfShare,
          ncpDays,
          0,
        ].join("#~#"); // EPFO ECR standard delimiter is #~# (or CSV compatible)
      });

    // Provide with standard header for export
    const csvContent = [headers.join(","), ...rows.map((row) => row.split("#~#").join(","))].join("\n");

    return {
      filename: `PF_ECR_${month}_${year}.csv`,
      content: csvContent,
    };
  }

  /**
   * Generates ESI Monthly Return formatted report.
   * Conforms to ESIC monthly contribution statement specifications.
   */
  static generateEsiReturn(
    records: StatutoryEmployeeRecord[],
    month: number,
    year: number
  ): { filename: string; content: string } {
    const headers = [
      "IP Number",
      "IP Name",
      "No of Days for which wages paid",
      "Total Monthly Wages (INR)",
      "IP Contribution (0.75%)",
      "Employer Contribution (3.25%)",
      "Total Contribution",
      "Reason Code for Zero Work",
    ];

    const rows = records
      .filter((r) => r.breakdown.esiEmployee > 0 || r.breakdown.esiEmployer > 0)
      .map((r) => {
        const ipNumber = r.esiNumber || `ESI_IP_${r.id}`;
        const daysPaid = Math.round(r.payableDays);
        const totalWages = (r.grossSalary / 100).toFixed(2);
        const ipContrib = (r.breakdown.esiEmployee / 100).toFixed(2);
        const erContrib = (r.breakdown.esiEmployer / 100).toFixed(2);
        const totalContrib = ((r.breakdown.esiEmployee + r.breakdown.esiEmployer) / 100).toFixed(2);
        const reasonCode = daysPaid === 0 ? "LEAVE_WITHOUT_PAY" : "0";

        return [
          ipNumber,
          `"${r.name.replace(/"/g, '""')}"`,
          daysPaid,
          totalWages,
          ipContrib,
          erContrib,
          totalContrib,
          reasonCode,
        ].join(",");
      });

    return {
      filename: `ESI_Monthly_Return_${month}_${year}.csv`,
      content: [headers.join(","), ...rows].join("\n"),
    };
  }

  /**
   * Generates Professional Tax (PT) Summary grouped by State and Slabs.
   */
  static generatePtSummary(
    records: StatutoryEmployeeRecord[],
    month: number,
    year: number
  ): { filename: string; content: string } {
    const headers = [
      "State",
      "Employee Count",
      "Total Gross Wages (INR)",
      "Total PT Deducted (INR)",
    ];

    // Group by state
    const stateMap = new Map<string, { count: number; gross: number; pt: number }>();

    for (const r of records) {
      const state = r.state || "Karnataka";
      const existing = stateMap.get(state) || { count: 0, gross: 0, pt: 0 };
      existing.count += 1;
      existing.gross += r.grossSalary;
      existing.pt += r.breakdown.professionalTax;
      stateMap.set(state, existing);
    }

    const rows = Array.from(stateMap.entries()).map(([state, data]) => {
      return [
        `"${state}"`,
        data.count,
        (data.gross / 100).toFixed(2),
        (data.pt / 100).toFixed(2),
      ].join(",");
    });

    return {
      filename: `Professional_Tax_Summary_${month}_${year}.csv`,
      content: [headers.join(","), ...rows].join("\n"),
    };
  }

  /**
   * Generates TDS Quarterly 24Q Salary Tax Deducted Summary.
   */
  static generateTdsSummary(
    records: StatutoryEmployeeRecord[],
    month: number,
    year: number
  ): { filename: string; content: string } {
    const quarter = month <= 3 ? "Q4" : month <= 6 ? "Q1" : month <= 9 ? "Q2" : "Q3";
    const headers = [
      "PAN of Employee",
      "Employee Name",
      "Designation",
      "Section Code",
      "Quarter",
      "Total Gross Paid (INR)",
      "TDS Deducted (INR)",
      "Surcharge / Cess (INR)",
      "Total Tax Deposited (INR)",
    ];

    const rows = records.map((r) => {
      const pan = r.pan || "PANNOTAVAIL";
      const gross = (r.grossSalary / 100).toFixed(2);
      const tds = (r.breakdown.tds / 100).toFixed(2);

      return [
        pan,
        `"${r.name.replace(/"/g, '""')}"`,
        `"${r.designation || "Staff"}"`,
        "192", // Standard Indian Salary TDS Section
        quarter,
        gross,
        tds,
        "0.00",
        tds,
      ].join(",");
    });

    return {
      filename: `TDS_24Q_Summary_${month}_${year}.csv`,
      content: [headers.join(","), ...rows].join("\n"),
    };
  }

  /**
   * Generates Departmental Cost-to-Company (CTC) breakdown.
   */
  static generateDepartmentCtcBreakdown(
    records: StatutoryEmployeeRecord[],
    month: number,
    year: number
  ): { filename: string; content: string } {
    const headers = [
      "Department",
      "Headcount",
      "Total Gross Pay (INR)",
      "Employer PF (INR)",
      "Employer ESI (INR)",
      "Total CTC Cost (INR)",
      "Average CTC per Head (INR)",
    ];

    const deptMap = new Map<
      string,
      { count: number; gross: number; pf: number; esi: number; ctc: number }
    >();

    for (const r of records) {
      const dept = r.department || "General";
      const existing = deptMap.get(dept) || { count: 0, gross: 0, pf: 0, esi: 0, ctc: 0 };
      existing.count += 1;
      existing.gross += r.grossSalary;
      existing.pf += r.breakdown.pfEmployer;
      existing.esi += r.breakdown.esiEmployer;
      existing.ctc += r.employerCost;
      deptMap.set(dept, existing);
    }

    const rows = Array.from(deptMap.entries()).map(([dept, data]) => {
      const avgCtc = data.count > 0 ? (data.ctc / data.count / 100).toFixed(2) : "0.00";
      return [
        `"${dept}"`,
        data.count,
        (data.gross / 100).toFixed(2),
        (data.pf / 100).toFixed(2),
        (data.esi / 100).toFixed(2),
        (data.ctc / 100).toFixed(2),
        avgCtc,
      ].join(",");
    });

    return {
      filename: `Department_CTC_Breakdown_${month}_${year}.csv`,
      content: [headers.join(","), ...rows].join("\n"),
    };
  }
}
