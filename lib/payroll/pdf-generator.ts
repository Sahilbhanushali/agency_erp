import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import JSZip from "jszip";

export interface PayslipPdfData {
  id: string;
  month: number;
  year: number;
  calendarDays: number;
  workingDays: number;
  payableDays: number;
  lopDays?: number;
  paidLeaveDays?: number;
  absentDays?: number;
  holidayDays?: number;
  weeklyOffDays?: number;
  overtimeHours?: number;
  grossSalary: number; // minor units (paise)
  netSalary: number; // minor units (paise)
  totalDeductions: number; // minor units (paise)
  employerCost: number; // minor units (paise)
  paymentStatus: string;
  calculationBreakdown?: any;
  breakdownJson?: string;
  agencyName?: string;
  agencyAddress?: string;
  user: {
    id: number;
    name: string;
    email: string;
    designation?: string | null;
    department?: string | null;
    panNumber?: string | null;
    bankName?: string | null;
    bankAccountNumber?: string | null;
    bankIfsc?: string | null;
    joiningDate?: string | Date | null;
    uan?: string | null;
    esiNumber?: string | null;
  };
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

function formatCurrency(minorUnits: number): string {
  const rupees = Math.round(minorUnits) / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(rupees);
}

function numberToWords(amountMinor: number): string {
  const rupees = Math.floor(amountMinor / 100);
  if (rupees === 0) return "Zero Rupees Only";

  const a = [
    "", "One ", "Two ", "Three ", "Four ", "Five ", "Six ", "Seven ", "Eight ", "Nine ", "Ten ",
    "Eleven ", "Twelve ", "Thirteen ", "Fourteen ", "Fifteen ", "Sixteen ", "Seventeen ", "Eighteen ", "Nineteen "
  ];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  function inWords(num: number): string {
    if (num === 0) return "";
    let str = "";
    if (num >= 10000000) {
      str += inWords(Math.floor(num / 10000000)) + "Crore ";
      num %= 10000000;
    }
    if (num >= 100000) {
      str += inWords(Math.floor(num / 100000)) + "Lakh ";
      num %= 100000;
    }
    if (num >= 1000) {
      str += inWords(Math.floor(num / 1000)) + "Thousand ";
      num %= 1000;
    }
    if (num >= 100) {
      str += inWords(Math.floor(num / 100)) + "Hundred ";
      num %= 100;
    }
    if (num > 0) {
      if (str !== "") str += "and ";
      if (num < 20) {
        str += a[num];
      } else {
        str += b[Math.floor(num / 10)] + (num % 10 !== 0 ? " " + a[num % 10] : " ");
      }
    }
    return str;
  }

  return `Rupees ${inWords(rupees).trim()} Only`;
}

export class PayrollPdfGenerator {
  /**
   * Generates a branded executive-ready Payslip PDF document.
   */
  static generatePayslipPdf(data: PayslipPdfData): Buffer {
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const agencyName = data.agencyName || "Marketing Agency Private Limited";
    const agencyAddress = data.agencyAddress || "101 Creative Avenue, Tech City, Karnataka 560001";
    const monthLabel = `${MONTH_NAMES[data.month - 1]} ${data.year}`;

    let calc: any = data.calculationBreakdown || null;
    if (!calc && data.breakdownJson) {
      try {
        calc = JSON.parse(data.breakdownJson);
      } catch {}
    }

    // Colors
    const primaryColor: [number, number, number] = [15, 23, 42]; // Slate 900
    const accentColor: [number, number, number] = [16, 185, 129]; // Emerald 500
    const mutedColor: [number, number, number] = [100, 116, 139]; // Slate 500

    // Header Top Banner
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(0, 0, 210, 26, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text(agencyName.toUpperCase(), 14, 11);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(226, 232, 240);
    doc.text(agencyAddress, 14, 17);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(52, 211, 153); // Emerald 400
    doc.text(`PAYSLIP FOR ${monthLabel.toUpperCase()}`, 196, 12, { align: "right" });

    doc.setFontSize(8);
    doc.setTextColor(203, 213, 225);
    doc.text(`Status: ${data.paymentStatus || "APPROVED"}`, 196, 18, { align: "right" });

    let currentY = 32;

    // Section 1: Employee & Bank Information (Two Columns)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text("EMPLOYEE SUMMARY", 14, currentY);
    doc.text("PAYMENT & STATUTORY DETAILS", 112, currentY);

    currentY += 2;

    const joiningDateStr = data.user.joiningDate
      ? new Date(data.user.joiningDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
      : "—";

    const empInfoLeft = [
      ["Employee ID", String(data.user.id)],
      ["Employee Name", data.user.name],
      ["Designation", data.user.designation || "Staff Member"],
      ["Department", data.user.department || "Operations"],
      ["Date of Joining", joiningDateStr],
    ];

    const empInfoRight = [
      ["Bank Name", data.user.bankName || "—"],
      ["Account Number", data.user.bankAccountNumber ? `••••${data.user.bankAccountNumber.slice(-4)}` : "—"],
      ["IFSC Code", data.user.bankIfsc || "—"],
      ["PAN Number", data.user.panNumber || "—"],
      ["UAN / PF No.", data.user.uan || "N/A"],
    ];

    autoTable(doc, {
      startY: currentY,
      margin: { left: 14, right: 108 },
      theme: "plain",
      styles: { fontSize: 8, cellPadding: 1.2 },
      columnStyles: {
        0: { fontStyle: "bold", textColor: mutedColor, cellWidth: 32 },
        1: { fontStyle: "normal", textColor: primaryColor },
      },
      body: empInfoLeft,
    });

    autoTable(doc, {
      startY: currentY,
      margin: { left: 112, right: 14 },
      theme: "plain",
      styles: { fontSize: 8, cellPadding: 1.2 },
      columnStyles: {
        0: { fontStyle: "bold", textColor: mutedColor, cellWidth: 35 },
        1: { fontStyle: "normal", textColor: primaryColor },
      },
      body: empInfoRight,
    });

    currentY = Math.max((doc as any).lastAutoTable.finalY, 56) + 4;

    // Section 2: Attendance Metrics Bar
    const attendanceHeaders = [
      "Calendar Days",
      "Working Days",
      "Payable Days",
      "LOP Days",
      "Paid Leaves",
      "Holidays",
      "Overtime (Hrs)",
    ];

    const attendanceValues = [
      String(data.calendarDays || 30),
      String(data.workingDays || 26),
      String(data.payableDays || 0),
      String(data.lopDays || 0),
      String(data.paidLeaveDays || 0),
      String(data.holidayDays || 0),
      String(data.overtimeHours || 0),
    ];

    autoTable(doc, {
      startY: currentY,
      margin: { left: 14, right: 14 },
      theme: "grid",
      headStyles: {
        fillColor: [241, 245, 249],
        textColor: primaryColor,
        fontStyle: "bold",
        fontSize: 7.5,
        halign: "center",
      },
      bodyStyles: {
        fontSize: 8.5,
        halign: "center",
        fontStyle: "bold",
        textColor: primaryColor,
        cellPadding: 2,
      },
      head: [attendanceHeaders],
      body: [attendanceValues],
    });

    currentY = (doc as any).lastAutoTable.finalY + 6;

    // Section 3: Itemized Earnings & Deductions Tables Side-by-Side
    const earnings: Array<{ name: string; rate: number; earned: number }> = [];
    const deductions: Array<{ name: string; amount: number }> = [];

    if (calc?.formulaBreakdown?.components) {
      calc.formulaBreakdown.components.forEach((c: any) => {
        if (c.isDeduction) {
          deductions.push({ name: c.component, amount: c.earned || c.rate || 0 });
        } else {
          earnings.push({ name: c.component, rate: c.rate || 0, earned: c.earned || 0 });
        }
      });
    } else {
      // Default standard presentation
      earnings.push(
        { name: "Basic Salary", rate: calc?.fixedBasic || 0, earned: calc?.earnedBasic || 0 },
        { name: "House Rent Allowance (HRA)", rate: calc?.fixedHra || 0, earned: calc?.earnedHra || 0 },
        { name: "Special Allowance", rate: calc?.fixedSpecialAllowance || 0, earned: calc?.earnedSpecialAllowance || 0 }
      );
      if (calc?.overtimePay > 0) {
        earnings.push({ name: "Overtime Pay", rate: calc.overtimePay, earned: calc.overtimePay });
      }
      if (calc?.bonus > 0) {
        earnings.push({ name: "Bonus / Incentives", rate: calc.bonus, earned: calc.bonus });
      }

      if (calc?.pfEmployee > 0) deductions.push({ name: "Provident Fund (PF)", amount: calc.pfEmployee });
      if (calc?.esiEmployee > 0) deductions.push({ name: "Employee State Insurance (ESI)", amount: calc.esiEmployee });
      if (calc?.professionalTax > 0) deductions.push({ name: "Professional Tax (PT)", amount: calc.professionalTax });
      if (calc?.tds > 0) deductions.push({ name: "Tax Deducted at Source (TDS)", amount: calc.tds });
      if (calc?.loanRecovery > 0) deductions.push({ name: "Loan Recovery / Advance", amount: calc.loanRecovery });
    }

    // Align rows so both tables match height
    const maxRows = Math.max(earnings.length, deductions.length);
    const earningsBody = [];
    const deductionsBody = [];

    for (let i = 0; i < maxRows; i++) {
      const e = earnings[i];
      earningsBody.push([
        e ? e.name : "",
        e ? formatCurrency(e.rate) : "",
        e ? formatCurrency(e.earned) : "",
      ]);

      const d = deductions[i];
      deductionsBody.push([
        d ? d.name : "",
        d ? formatCurrency(d.amount) : "",
      ]);
    }

    // Render Earnings Table (Left half: 14 to 108mm)
    autoTable(doc, {
      startY: currentY,
      margin: { left: 14, right: 108 },
      theme: "grid",
      headStyles: {
        fillColor: primaryColor,
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 8,
      },
      styles: { fontSize: 7.5, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 42, fontStyle: "normal" },
        1: { cellWidth: 26, halign: "right", fontStyle: "normal" },
        2: { cellWidth: 26, halign: "right", fontStyle: "bold", textColor: [16, 185, 129] },
      },
      head: [["EARNINGS", "RATE", "EARNED"]],
      body: earningsBody,
      foot: [["TOTAL GROSS EARNINGS", "", formatCurrency(data.grossSalary)]],
      footStyles: {
        fillColor: [241, 245, 249],
        textColor: primaryColor,
        fontStyle: "bold",
        fontSize: 8,
        halign: "right",
      },
    });

    const earningsEndY = (doc as any).lastAutoTable.finalY;

    // Render Deductions Table (Right half: 112 to 196mm)
    autoTable(doc, {
      startY: currentY,
      margin: { left: 112, right: 14 },
      theme: "grid",
      headStyles: {
        fillColor: primaryColor,
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 8,
      },
      styles: { fontSize: 7.5, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 54, fontStyle: "normal" },
        1: { cellWidth: 30, halign: "right", fontStyle: "bold", textColor: [220, 38, 38] },
      },
      head: [["DEDUCTIONS", "AMOUNT"]],
      body: deductionsBody,
      foot: [["TOTAL DEDUCTIONS", formatCurrency(data.totalDeductions)]],
      footStyles: {
        fillColor: [241, 245, 249],
        textColor: [220, 38, 38],
        fontStyle: "bold",
        fontSize: 8,
        halign: "right",
      },
    });

    const deductionsEndY = (doc as any).lastAutoTable.finalY;
    currentY = Math.max(earningsEndY, deductionsEndY) + 6;

    // Section 4: Net Salary Highlight Card
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.roundedRect(14, currentY, 182, 18, 2, 2, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("NET TAKE-HOME SALARY", 20, currentY + 7);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(203, 213, 225);
    const words = numberToWords(data.netSalary);
    doc.text(words, 20, currentY + 13);

    doc.setTextColor(52, 211, 153); // Emerald 400
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(formatCurrency(data.netSalary), 190, currentY + 11, { align: "right" });

    currentY += 24;

    // Section 5: Employer Statutory Contributions & Cost-to-Company (CTC)
    const employerPf = calc?.pfEmployer || 0;
    const employerEsi = calc?.esiEmployer || 0;
    const monthlyCtc = data.employerCost || (data.grossSalary + employerPf + employerEsi);

    autoTable(doc, {
      startY: currentY,
      margin: { left: 14, right: 14 },
      theme: "plain",
      headStyles: {
        fillColor: [248, 250, 252],
        textColor: mutedColor,
        fontStyle: "bold",
        fontSize: 7.5,
      },
      bodyStyles: {
        fontSize: 8,
        cellPadding: 1.5,
      },
      head: [["EMPLOYER CONTRIBUTIONS (NOT DEDUCTED FROM SALARY)", "AMOUNT"]],
      body: [
        ["Employer Provident Fund (PF Share)", formatCurrency(employerPf)],
        ["Employer State Insurance (ESI Share)", formatCurrency(employerEsi)],
        ["Total Monthly Cost to Company (CTC)", formatCurrency(monthlyCtc)],
      ],
      columnStyles: {
        0: { cellWidth: 140, fontStyle: "normal", textColor: mutedColor },
        1: { cellWidth: 42, halign: "right", fontStyle: "bold", textColor: primaryColor },
      },
    });

    currentY = (doc as any).lastAutoTable.finalY + 10;

    // Section 6: Authentication & Signature Footer
    doc.setDrawColor(226, 232, 240);
    doc.line(14, currentY, 196, currentY);

    currentY += 6;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text("HR & ACCOUNTS DEPARTMENT", 14, currentY);
    doc.text("AUTHORIZED SIGNATORY", 196, currentY, { align: "right" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(mutedColor[0], mutedColor[1], mutedColor[2]);
    doc.text("Generated securely via Internal Agency ERP", 14, currentY + 4);
    doc.text(agencyName, 196, currentY + 4, { align: "right" });

    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(
      "Note: This is a computer-generated payslip and does not require a physical signature.",
      105,
      currentY + 12,
      { align: "center" }
    );

    return Buffer.from(doc.output("arraybuffer"));
  }

  /**
   * Bundles all payslips for a payroll run into a single ZIP archive.
   */
  static async generatePayslipsZip(
    payslips: PayslipPdfData[],
    periodLabel: string
  ): Promise<Buffer> {
    const zip = new JSZip();

    for (const payslip of payslips) {
      const pdfBuffer = this.generatePayslipPdf(payslip);
      const safeName = (payslip.user.name || `emp_${payslip.user.id}`)
        .replace(/[^a-zA-Z0-9_-]/g, "_");
      const filename = `Payslip_${safeName}_${payslip.month}_${payslip.year}.pdf`;
      zip.file(filename, pdfBuffer);
    }

    const zipBuffer = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });

    return zipBuffer;
  }
}
