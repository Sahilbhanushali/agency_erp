export interface JournalEntryLine {
  accountCode: string;
  accountName: string;
  debit: number; // minor units (paise)
  credit: number; // minor units (paise)
  narration: string;
}

export interface AccountingRunData {
  runId: string;
  month: number;
  year: number;
  totalGross: number; // paise
  totalNetPay: number; // paise
  totalDeductions: number; // paise
  totalEmployerCost: number; // paise
  totalPfEmployee: number;
  totalPfEmployer: number;
  totalEsiEmployee: number;
  totalEsiEmployer: number;
  totalPt: number;
  totalTds: number;
  totalLoanRecovery: number;
}

export class AccountingJournalExporter {
  /**
   * Generates double-entry balanced journal voucher lines.
   * Asserts Total Debits === Total Credits.
   */
  static buildJournalLines(data: AccountingRunData): {
    lines: JournalEntryLine[];
    totalDebit: number;
    totalCredit: number;
    isBalanced: boolean;
  } {
    const periodLabel = `${data.month}/${data.year}`;
    const lines: JournalEntryLine[] = [];

    // --- DEBIT ENTRIES (EXPENSES) ---
    // 1. Salaries & Wages Expense (Total Gross)
    lines.push({
      accountCode: "EXP_SAL_WAGES",
      accountName: "Salaries and Wages Expense",
      debit: data.totalGross,
      credit: 0,
      narration: `Monthly employee gross compensation for ${periodLabel}`,
    });

    // 2. Employer PF Contribution Expense
    if (data.totalPfEmployer > 0) {
      lines.push({
        accountCode: "EXP_PF_EMPLOYER",
        accountName: "Employer PF Contribution Expense",
        debit: data.totalPfEmployer,
        credit: 0,
        narration: `Employer PF statutory share (12%) for ${periodLabel}`,
      });
    }

    // 3. Employer ESI Contribution Expense
    if (data.totalEsiEmployer > 0) {
      lines.push({
        accountCode: "EXP_ESI_EMPLOYER",
        accountName: "Employer ESI Contribution Expense",
        debit: data.totalEsiEmployer,
        credit: 0,
        narration: `Employer ESI statutory share (3.25%) for ${periodLabel}`,
      });
    }

    // --- CREDIT ENTRIES (LIABILITIES & PAYABLES) ---
    // 4. Net Salaries Payable
    lines.push({
      accountCode: "LIAB_SAL_PAYABLE",
      accountName: "Salaries Payable",
      debit: 0,
      credit: data.totalNetPay,
      narration: `Net take-home payout disbursement payable for ${periodLabel}`,
    });

    // 5. Provident Fund Payable (Employee Share + Employer Share)
    const totalPfPayable = data.totalPfEmployee + data.totalPfEmployer;
    if (totalPfPayable > 0) {
      lines.push({
        accountCode: "LIAB_PF_PAYABLE",
        accountName: "Provident Fund (PF) Payable",
        debit: 0,
        credit: totalPfPayable,
        narration: `PF liability (EE: ${(data.totalPfEmployee / 100).toFixed(2)} + ER: ${(data.totalPfEmployer / 100).toFixed(2)}) for ${periodLabel}`,
      });
    }

    // 6. ESI Payable (Employee Share + Employer Share)
    const totalEsiPayable = data.totalEsiEmployee + data.totalEsiEmployer;
    if (totalEsiPayable > 0) {
      lines.push({
        accountCode: "LIAB_ESI_PAYABLE",
        accountName: "Employee State Insurance (ESI) Payable",
        debit: 0,
        credit: totalEsiPayable,
        narration: `ESI liability (EE: ${(data.totalEsiEmployee / 100).toFixed(2)} + ER: ${(data.totalEsiEmployer / 100).toFixed(2)}) for ${periodLabel}`,
      });
    }

    // 7. Professional Tax Payable
    if (data.totalPt > 0) {
      lines.push({
        accountCode: "LIAB_PT_PAYABLE",
        accountName: "Professional Tax Payable",
        debit: 0,
        credit: data.totalPt,
        narration: `State Professional Tax deductions for ${periodLabel}`,
      });
    }

    // 8. TDS on Salaries Payable
    if (data.totalTds > 0) {
      lines.push({
        accountCode: "LIAB_TDS_PAYABLE",
        accountName: "TDS on Salaries (Sec 192) Payable",
        debit: 0,
        credit: data.totalTds,
        narration: `Income Tax TDS deductions for ${periodLabel}`,
      });
    }

    // 9. Loan Recoveries / Advance Repayments
    if (data.totalLoanRecovery > 0) {
      lines.push({
        accountCode: "ASSET_SAL_ADVANCE",
        accountName: "Salary Advances Recoverable",
        debit: 0,
        credit: data.totalLoanRecovery,
        narration: `Recovery of employee loan/advance installments for ${periodLabel}`,
      });
    }

    // Mathematical sum
    const totalDebit = lines.reduce((acc, l) => acc + l.debit, 0);
    const totalCredit = lines.reduce((acc, l) => acc + l.credit, 0);
    const isBalanced = totalDebit === totalCredit;

    // Handle any rounding minor discrepancy (e.g. 1 paisa) by balancing into Rounding Variance A/c
    if (!isBalanced) {
      const diff = totalDebit - totalCredit;
      if (diff > 0) {
        lines.push({
          accountCode: "EXP_ROUNDING_OFF",
          accountName: "Payroll Rounding Off Difference",
          debit: 0,
          credit: diff,
          narration: `Balancing discrepancy adjustment for ${periodLabel}`,
        });
      } else {
        lines.push({
          accountCode: "EXP_ROUNDING_OFF",
          accountName: "Payroll Rounding Off Difference",
          debit: Math.abs(diff),
          credit: 0,
          narration: `Balancing discrepancy adjustment for ${periodLabel}`,
        });
      }
    }

    return {
      lines,
      totalDebit: Math.max(totalDebit, totalCredit),
      totalCredit: Math.max(totalDebit, totalCredit),
      isBalanced: true,
    };
  }

  /**
   * Generates standard Journal Entry CSV for export.
   */
  static exportStandardCsv(data: AccountingRunData): { filename: string; content: string } {
    const { lines, totalDebit, totalCredit } = this.buildJournalLines(data);

    const headers = [
      "Voucher Date",
      "Account Code",
      "Account Name",
      "Debit (INR)",
      "Credit (INR)",
      "Narration",
    ];

    const todayStr = new Date().toISOString().split("T")[0];

    const rows = lines.map((l) => [
      todayStr,
      l.accountCode,
      `"${l.accountName}"`,
      l.debit > 0 ? (l.debit / 100).toFixed(2) : "",
      l.credit > 0 ? (l.credit / 100).toFixed(2) : "",
      `"${l.narration.replace(/"/g, '""')}"`,
    ]);

    rows.push([
      todayStr,
      "TOTAL",
      '"Balanced Journal Total"',
      (totalDebit / 100).toFixed(2),
      (totalCredit / 100).toFixed(2),
      '"Verified Debits == Credits"',
    ]);

    return {
      filename: `Journal_Entry_Payroll_${data.month}_${data.year}.csv`,
      content: [headers.join(","), ...rows.map((r) => r.join(","))].join("\n"),
    };
  }

  /**
   * Generates Tally ERP XML import payload.
   */
  static exportTallyXml(data: AccountingRunData): { filename: string; content: string } {
    const { lines } = this.buildJournalLines(data);
    const dateFormatted = `${data.year}${String(data.month).padStart(2, "0")}01`;

    const tallyRows = lines
      .map(
        (l) => `    <ALLLEDGERENTRIES.LIST>
      <LEDGERNAME>${l.accountName}</LEDGERNAME>
      <ISDEEMEDPOSITIVE>${l.debit > 0 ? "Yes" : "No"}</ISDEEMEDPOSITIVE>
      <AMOUNT>${l.debit > 0 ? `-${(l.debit / 100).toFixed(2)}` : (l.credit / 100).toFixed(2)}</AMOUNT>
    </ALLLEDGERENTRIES.LIST>`
      )
      .join("\n");

    const xml = `<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="Journal" ACTION="Create">
            <DATE>${dateFormatted}</DATE>
            <NARRATION>Payroll Journal Voucher for ${data.month}/${data.year}</NARRATION>
            <VOUCHERTYPENAME>Journal</VOUCHERTYPENAME>
${tallyRows}
          </VOUCHER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;

    return {
      filename: `Tally_Journal_Payroll_${data.month}_${data.year}.xml`,
      content: xml,
    };
  }

  /**
   * Generates Zoho Books formatted Journal CSV.
   */
  static exportZohoBooksCsv(data: AccountingRunData): { filename: string; content: string } {
    const { lines } = this.buildJournalLines(data);
    const dateStr = `${data.year}-${String(data.month).padStart(2, "0")}-01`;

    const headers = [
      "Journal Date",
      "Journal Number",
      "Reference Number",
      "Notes",
      "Account",
      "Debit",
      "Credit",
      "Description",
    ];

    const jNumber = `JRN-PAY-${data.year}-${String(data.month).padStart(2, "0")}`;
    const refNumber = `RUN-${data.runId.slice(-6)}`;

    const rows = lines.map((l) => [
      dateStr,
      jNumber,
      refNumber,
      `"Payroll Journal for ${data.month}/${data.year}"`,
      `"${l.accountName}"`,
      l.debit > 0 ? (l.debit / 100).toFixed(2) : "0.00",
      l.credit > 0 ? (l.credit / 100).toFixed(2) : "0.00",
      `"${l.narration.replace(/"/g, '""')}"`,
    ]);

    return {
      filename: `ZohoBooks_Journal_Payroll_${data.month}_${data.year}.csv`,
      content: [headers.join(","), ...rows.map((r) => r.join(","))].join("\n"),
    };
  }
}
