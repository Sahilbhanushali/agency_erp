import { PayrollPdfGenerator, PayslipPdfData } from "./pdf-generator";
import { BankFormatExporter, BankTransferEmployeeRecord } from "./bank-formats";
import { StatutoryReportsGenerator, StatutoryEmployeeRecord } from "./statutory-reports";
import { AccountingJournalExporter, AccountingRunData } from "./accounting-export";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`  ✓ ${message}`);
}

async function runPhase5Verification() {
  console.log("=================================================================");
  console.log("🚀 STARTING PHASE 5 VERIFICATION: OUTPUTS & INTEGRATIONS");
  console.log("=================================================================\n");

  // -------------------------------------------------------------
  // TEST SUITE 1: Branded Executive PDF Payslip Generation
  // -------------------------------------------------------------
  console.log("👉 Test Suite 1: Branded Payslip PDF Generation");

  const samplePayslip: PayslipPdfData = {
    id: "slip_test_001",
    month: 10,
    year: 2026,
    calendarDays: 31,
    workingDays: 22,
    payableDays: 30,
    lopDays: 1,
    paidLeaveDays: 2,
    absentDays: 1,
    holidayDays: 2,
    weeklyOffDays: 8,
    overtimeHours: 5,
    grossSalary: 8500000, // ₹85,000.00
    netSalary: 7350000,   // ₹73,500.00
    totalDeductions: 1150000, // ₹11,500.00
    employerCost: 9200000, // ₹92,000.00
    paymentStatus: "PAID",
    agencyName: "Acme Digital Agency India Pvt Ltd",
    agencyAddress: "Prestige Tech Park, Outer Ring Road, Bengaluru 560103",
    user: {
      id: 101,
      name: "Rahul Sharma",
      email: "rahul.sharma@acmedigital.com",
      designation: "Senior Full Stack Engineer",
      department: "Engineering",
      panNumber: "ABCPS1234F",
      bankName: "HDFC Bank",
      bankAccountNumber: "50100234567890",
      bankIfsc: "HDFC0001234",
      joiningDate: "2024-03-01",
      uan: "100987654321",
      esiNumber: "31009876543210001",
    },
    calculationBreakdown: {
      earnings: [
        { name: "Basic Salary", earnedAmount: 4000000, fixedAmount: 4000000 },
        { name: "House Rent Allowance (HRA)", earnedAmount: 2000000, fixedAmount: 2000000 },
        { name: "Special Allowance", earnedAmount: 2000000, fixedAmount: 2000000 },
        { name: "Overtime Allowance", earnedAmount: 500000, fixedAmount: 0 },
      ],
      deductions: [
        { name: "Provident Fund (EE)", amount: 180000 },
        { name: "Professional Tax", amount: 20000 },
        { name: "TDS / Income Tax", amount: 750000 },
        { name: "Salary Advance EMI", amount: 200000 },
      ],
      employerContributions: [
        { name: "Provident Fund (ER)", amount: 180000 },
        { name: "Gratuity Provision", amount: 192300 },
      ],
    },
  };

  const pdfBuffer = PayrollPdfGenerator.generatePayslipPdf(samplePayslip);
  assert(Buffer.isBuffer(pdfBuffer), "PDF generator output must be a valid Buffer");
  assert(pdfBuffer.length > 2000, `PDF size must be substantial (${pdfBuffer.length} bytes)`);

  const pdfHeader = pdfBuffer.slice(0, 5).toString("ascii");
  assert(pdfHeader === "%PDF-", `Generated file must start with valid PDF magic bytes: received "${pdfHeader}"`);

  // Bulk ZIP archive generation
  console.log("\n👉 Test Suite 2: Bulk Payslips ZIP Archive Compression");
  const samplePayslip2: PayslipPdfData = {
    ...samplePayslip,
    id: "slip_test_002",
    user: {
      ...samplePayslip.user,
      id: 102,
      name: "Priya Nair",
      email: "priya.nair@acmedigital.com",
      designation: "UI/UX Lead",
      department: "Design",
    },
  };

  const zipBuffer = await PayrollPdfGenerator.generatePayslipsZip(
    [samplePayslip, samplePayslip2],
    "October_2026"
  );
  assert(Buffer.isBuffer(zipBuffer), "ZIP generator output must be a valid Buffer");
  assert(zipBuffer.length > 4000, `ZIP size must be substantial (${zipBuffer.length} bytes)`);

  const zipMagic = zipBuffer.slice(0, 4);
  assert(
    zipMagic[0] === 0x50 && zipMagic[1] === 0x4b && zipMagic[2] === 0x03 && zipMagic[3] === 0x04,
    "Generated archive must start with PK standard ZIP header bytes (0x50, 0x4B, 0x03, 0x04)"
  );

  // -------------------------------------------------------------
  // TEST SUITE 3: Multi-Bank Transfer File Exports (HDFC, ICICI, SBI, Generic)
  // -------------------------------------------------------------
  console.log("\n👉 Test Suite 3: Multi-Bank Transfer File Exports");

  const bankRecords: BankTransferEmployeeRecord[] = [
    {
      id: 101,
      name: "Rahul Sharma",
      email: "rahul@acmedigital.com",
      bankName: "HDFC Bank",
      bankAccountNumber: "50100234567890",
      bankIfsc: "HDFC0001234",
      netSalary: 7350000, // ₹73,500.00
      month: 10,
      year: 2026,
      runId: "run_oct_2026",
    },
    {
      id: 102,
      name: "Priya Nair",
      email: "priya@acmedigital.com",
      bankName: "ICICI Bank",
      bankAccountNumber: "000105009876",
      bankIfsc: "ICIC0000001",
      netSalary: 6200000, // ₹62,000.00
      month: 10,
      year: 2026,
      runId: "run_oct_2026",
    },
  ];

  // Test HDFC
  const hdfc = BankFormatExporter.export(bankRecords, "HDFC");
  assert(hdfc.filename.includes("HDFC_Salary_Batch"), "HDFC filename must indicate salary batch");
  assert(hdfc.content.includes("50100234567890"), "HDFC content must include employee account number");
  assert(hdfc.content.includes("73500.00"), "HDFC content must format amount as rupees 73500.00");

  // Test ICICI
  const icici = BankFormatExporter.export(bankRecords, "ICICI", {
    debitAccountNumber: "CORP_ICICI_PRIMARY",
  });
  assert(icici.filename.includes("ICICI_Salary_Upload"), "ICICI filename must indicate upload batch");
  assert(icici.content.includes("CORP_ICICI_PRIMARY"), "ICICI content must include debit account number");
  assert(icici.content.includes("62000.00"), "ICICI content must format amount as rupees 62000.00");

  // Test SBI
  const sbi = BankFormatExporter.export(bankRecords, "SBI");
  assert(sbi.filename.includes("SBI_Salary_CMP"), "SBI filename must indicate Corporate Multi-Payment format");
  assert(sbi.content.includes("HDFC0001234"), "SBI content must include beneficiary IFSC");

  // Test Generic Universal Bank CSV
  const generic = BankFormatExporter.export(bankRecords, "GENERIC");
  assert(generic.filename.includes("Bank_Transfer_Register"), "Generic filename must indicate register");
  assert(generic.content.includes("50100234567890"), "Generic content must include account number");

  // -------------------------------------------------------------
  // TEST SUITE 4: Statutory Challan Summaries (EPFO, ESIC, PT, TDS 24Q, Dept CTC)
  // -------------------------------------------------------------
  console.log("\n👉 Test Suite 4: Statutory Returns & Compliance Reports");

  const statutoryRecords: StatutoryEmployeeRecord[] = [
    {
      id: 101,
      name: "Rahul Sharma",
      pan: "ABCPS1234F",
      uan: "100987654321",
      esiNumber: "31009876543210001",
      designation: "Tech Lead",
      department: "Engineering",
      state: "Karnataka",
      payableDays: 30,
      calendarDays: 31,
      grossSalary: 8500000,
      netSalary: 7350000,
      employerCost: 9200000,
      breakdown: {
        fixedBasic: 4000000,
        earnedBasic: 4000000,
        earnedGross: 8500000,
        pfEmployee: 180000, // capped basic 15k * 12% = 1800
        pfEmployer: 180000,
        esiEmployee: 0, // gross > 21k, not eligible
        esiEmployer: 0,
        professionalTax: 20000, // ₹200 Karnataka slab
        tds: 750000,
      },
    },
    {
      id: 102,
      name: "Anita Rao",
      pan: "XYZPA9876K",
      uan: "100123456789",
      esiNumber: "31001234567890002",
      designation: "Support Executive",
      department: "Customer Success",
      state: "Maharashtra",
      payableDays: 28,
      calendarDays: 31,
      grossSalary: 2000000, // ₹20,000 (ESI eligible!)
      netSalary: 1850000,
      employerCost: 2300000,
      breakdown: {
        fixedBasic: 1200000,
        earnedBasic: 1083870,
        earnedGross: 2000000,
        pfEmployee: 130000,
        pfEmployer: 130000,
        esiEmployee: 15000, // 0.75% of 20,000 = ₹150
        esiEmployer: 65000, // 3.25% of 20,000 = ₹650
        professionalTax: 20000, // ₹200 Maharashtra slab
        tds: 0,
      },
    },
  ];

  // 1. PF ECR
  const pfEcr = StatutoryReportsGenerator.generatePfEcr(statutoryRecords, 10, 2026);
  assert(pfEcr.filename.includes("PF_ECR_10_2026"), "PF ECR filename must include period");
  assert(pfEcr.content.includes("100987654321"), "PF ECR must include member UAN");
  assert(pfEcr.content.includes("15000"), "PF ECR wages must cap at statutory ceiling ₹15,000");

  // 2. ESI Return
  const esiReturn = StatutoryReportsGenerator.generateEsiReturn(statutoryRecords, 10, 2026);
  assert(esiReturn.filename.includes("ESI_Monthly_Return"), "ESI return filename must match standard");
  assert(esiReturn.content.includes("31001234567890002"), "ESI return must include eligible employee IP number");
  assert(esiReturn.content.includes("150.00"), "ESI return must calculate 0.75% IP share accurately (₹150.00)");
  assert(esiReturn.content.includes("650.00"), "ESI return must calculate 3.25% ER share accurately (₹650.00)");

  // 3. PT Summary
  const ptSummary = StatutoryReportsGenerator.generatePtSummary(statutoryRecords, 10, 2026);
  assert(ptSummary.content.includes("Karnataka"), "PT summary must report Karnataka state");
  assert(ptSummary.content.includes("Maharashtra"), "PT summary must report Maharashtra state");

  // 4. TDS 24Q Summary
  const tdsSummary = StatutoryReportsGenerator.generateTdsSummary(statutoryRecords, 10, 2026);
  assert(tdsSummary.content.includes("ABCPS1234F"), "TDS 24Q must include employee PAN");
  assert(tdsSummary.content.includes("192"), "TDS 24Q must declare Section 192");
  assert(tdsSummary.content.includes("7500.00"), "TDS 24Q must report deducted tax (₹7,500.00)");

  // 5. Department CTC Breakdown
  const ctcReport = StatutoryReportsGenerator.generateDepartmentCtcBreakdown(statutoryRecords, 10, 2026);
  assert(ctcReport.content.includes("Engineering"), "CTC report must include Engineering department");
  assert(ctcReport.content.includes("Customer Success"), "CTC report must include Customer Success department");

  // -------------------------------------------------------------
  // TEST SUITE 5: Double-Entry Balanced Accounting Journal Voucher
  // -------------------------------------------------------------
  console.log("\n👉 Test Suite 5: Double-Entry Balanced Accounting Journal Voucher");

  // In double-entry payroll accounting:
  // Gross = 10,500,000 (105,000)
  // Employer PF = 310,000 (3,100)
  // Employer ESI = 65,000 (650)
  // Total Debits = 10,875,000 (108,750)
  //
  // Deductions:
  // Employee PF = 310,000
  // Employee ESI = 15,000
  // PT = 40,000
  // TDS = 750,000
  // Loan Recovery = 200,000
  // Total Deductions = 1,315,000
  // Net Pay = Gross - Total Deductions = 10,500,000 - 1,315,000 = 9,185,000
  //
  // Credits:
  // Net Salaries Payable = 9,185,000
  // PF Payable = EE (310k) + ER (310k) = 620,000
  // ESI Payable = EE (15k) + ER (65k) = 80,000
  // PT Payable = 40,000
  // TDS Payable = 750,000
  // Salary Advance Recoverable = 200,000
  // Total Credits = 9,185,000 + 620,000 + 80,000 + 40,000 + 750,000 + 200,000 = 10,875,000
  // Exactly equal! Total Debits === Total Credits.

  const accountingData: AccountingRunData = {
    runId: "run_verified_001",
    month: 10,
    year: 2026,
    totalGross: 10500000,
    totalNetPay: 9185000,
    totalDeductions: 1315000,
    totalEmployerCost: 10875000,
    totalPfEmployee: 310000,
    totalPfEmployer: 310000,
    totalEsiEmployee: 15000,
    totalEsiEmployer: 65000,
    totalPt: 40000,
    totalTds: 750000,
    totalLoanRecovery: 200000,
  };

  const journalResult = AccountingJournalExporter.buildJournalLines(accountingData);
  assert(journalResult.isBalanced === true, "Journal entry voucher MUST be strictly balanced");
  assert(
    journalResult.totalDebit === journalResult.totalCredit,
    `Total Debits (${journalResult.totalDebit}) must equal Total Credits (${journalResult.totalCredit})`
  );
  assert(
    journalResult.totalDebit === 10875000,
    `Total journal volume must match total employer cost (₹1,08,750.00)`
  );

  // Check formats
  const standardCsv = AccountingJournalExporter.exportStandardCsv(accountingData);
  assert(standardCsv.content.includes("EXP_SAL_WAGES"), "Standard CSV must include expense accounts");
  assert(standardCsv.content.includes("LIAB_SAL_PAYABLE"), "Standard CSV must include payable liabilities");

  const tallyXml = AccountingJournalExporter.exportTallyXml(accountingData);
  assert(tallyXml.content.includes('<VOUCHER VCHTYPE="Journal"'), "Tally XML must export Journal voucher type");
  assert(tallyXml.content.includes("<ALLLEDGERENTRIES.LIST>"), "Tally XML must include standard ledger entries list");

  const zohoCsv = AccountingJournalExporter.exportZohoBooksCsv(accountingData);
  assert(zohoCsv.filename.includes("ZohoBooks_Journal"), "Zoho export must target Zoho Books format");

  console.log("\n=================================================================");
  console.log("🎉 ALL 18 PHASE 5 VERIFICATION CHECKS PASSED PERFECTLY!");
  console.log("=================================================================");
}

runPhase5Verification().catch((err) => {
  console.error("FATAL ERROR in Phase 5 verification:", err);
  process.exit(1);
});
