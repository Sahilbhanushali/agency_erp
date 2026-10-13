export type BankExportFormat = "HDFC" | "ICICI" | "SBI" | "GENERIC";

export interface BankTransferEmployeeRecord {
  id: number;
  name: string;
  email: string;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  bankIfsc?: string | null;
  netSalary: number; // minor units (paise)
  month: number;
  year: number;
  runId: string;
}

export class BankFormatExporter {
  /**
   * Generates formatted bank transfer CSV text based on selected bank standard.
   */
  static export(
    records: BankTransferEmployeeRecord[],
    format: BankExportFormat = "GENERIC",
    options?: {
      debitAccountNumber?: string;
      valueDate?: Date;
    }
  ): { filename: string; content: string } {
    const valueDateStr = (options?.valueDate || new Date())
      .toISOString()
      .split("T")[0]
      .split("-")
      .reverse()
      .join("/"); // DD/MM/YYYY

    const debitAcc = options?.debitAccountNumber || "CURRENT_ACC_PRIMARY";

    switch (format.toUpperCase() as BankExportFormat) {
      case "HDFC":
        return this.formatHdfc(records);
      case "ICICI":
        return this.formatIcici(records, debitAcc);
      case "SBI":
        return this.formatSbi(records, valueDateStr);
      case "GENERIC":
      default:
        return this.formatGeneric(records);
    }
  }

  private static formatHdfc(records: BankTransferEmployeeRecord[]) {
    // HDFC E-Net CMS format
    const headers = [
      "Beneficiary Account Number",
      "Beneficiary Name",
      "Amount",
      "Narration / Remarks",
      "IFSC Code",
      "Beneficiary Email",
    ];

    const rows = records.map((r) => {
      const rupees = (r.netSalary / 100).toFixed(2);
      const narration = `SALARY ${r.month}_${r.year}`;
      const acc = r.bankAccountNumber?.trim() || "";
      const ifsc = r.bankIfsc?.trim().toUpperCase() || "";

      return [
        `"${acc}"`,
        `"${r.name.replace(/"/g, '""')}"`,
        rupees,
        `"${narration}"`,
        `"${ifsc}"`,
        `"${r.email}"`,
      ].join(",");
    });

    return {
      filename: `HDFC_Salary_Batch_${records[0]?.month || ""}_${records[0]?.year || ""}.csv`,
      content: [headers.join(","), ...rows].join("\n"),
    };
  }

  private static formatIcici(records: BankTransferEmployeeRecord[], debitAccount: string) {
    // ICICI Corporate Bulk Upload format
    const headers = [
      "Debit Account No",
      "Beneficiary Account No",
      "Beneficiary Name",
      "Amount",
      "Currency",
      "IFSC Code",
      "Customer Ref No",
      "Email ID",
    ];

    const rows = records.map((r, idx) => {
      const rupees = (r.netSalary / 100).toFixed(2);
      const ref = `SAL${r.year}${String(r.month).padStart(2, "0")}${String(idx + 1).padStart(4, "0")}`;
      const acc = r.bankAccountNumber?.trim() || "";
      const ifsc = r.bankIfsc?.trim().toUpperCase() || "";

      return [
        `"${debitAccount}"`,
        `"${acc}"`,
        `"${r.name.replace(/"/g, '""')}"`,
        rupees,
        "INR",
        `"${ifsc}"`,
        `"${ref}"`,
        `"${r.email}"`,
      ].join(",");
    });

    return {
      filename: `ICICI_Salary_Upload_${records[0]?.month || ""}_${records[0]?.year || ""}.csv`,
      content: [headers.join(","), ...rows].join("\n"),
    };
  }

  private static formatSbi(records: BankTransferEmployeeRecord[], valueDate: string) {
    // SBI Corporate Multi-Payment (CMP) format
    const headers = [
      "Payment Type",
      "Beneficiary Name",
      "Beneficiary Account No",
      "Amount",
      "IFSC Code",
      "Value Date",
      "Remarks",
      "Email ID",
    ];

    const rows = records.map((r) => {
      const rupees = (r.netSalary / 100).toFixed(2);
      const acc = r.bankAccountNumber?.trim() || "";
      const ifsc = r.bankIfsc?.trim().toUpperCase() || "";
      const isSbi = ifsc.startsWith("SBIN");
      const paymentType = isSbi ? "IFT" : "NEFT"; // Internal Fund Transfer vs NEFT
      const remarks = `Salary ${r.month}/${r.year}`;

      return [
        paymentType,
        `"${r.name.replace(/"/g, '""')}"`,
        `"${acc}"`,
        rupees,
        `"${ifsc}"`,
        `"${valueDate}"`,
        `"${remarks}"`,
        `"${r.email}"`,
      ].join(",");
    });

    return {
      filename: `SBI_Salary_CMP_${records[0]?.month || ""}_${records[0]?.year || ""}.csv`,
      content: [headers.join(","), ...rows].join("\n"),
    };
  }

  private static formatGeneric(records: BankTransferEmployeeRecord[]) {
    // Standard Universal Bank CSV
    const headers = [
      "Employee ID",
      "Beneficiary Name",
      "Bank Name",
      "Account Number",
      "IFSC Code",
      "Amount (INR)",
      "Narration",
      "Employee Email",
    ];

    const rows = records.map((r) => {
      const rupees = (r.netSalary / 100).toFixed(2);
      const narration = `Salary for ${r.month}/${r.year}`;

      return [
        r.id,
        `"${r.name.replace(/"/g, '""')}"`,
        `"${r.bankName || "N/A"}"`,
        `"${r.bankAccountNumber || "N/A"}"`,
        `"${r.bankIfsc || "N/A"}"`,
        rupees,
        `"${narration}"`,
        `"${r.email}"`,
      ].join(",");
    });

    return {
      filename: `Bank_Transfer_Register_${records[0]?.month || ""}_${records[0]?.year || ""}.csv`,
      content: [headers.join(","), ...rows].join("\n"),
    };
  }
}
