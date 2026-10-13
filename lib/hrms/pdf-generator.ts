import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatCurrencyINR, formatDatePretty } from "./placeholder-engine";

export interface OfferPdfOptions {
  offerNumber: string;
  candidateName: string;
  candidateEmail?: string | null;
  candidatePhone?: string | null;
  candidateAddress?: string | null;
  jobTitle: string;
  department: string;
  employmentType: string;
  workLocation: string;
  joiningDate: string | Date;
  probationPeriodMonths: number;
  validityDate: string | Date;
  annualCtc: number;
  monthlyGross: number;
  salaryBreakdownJson?: string | null;
  benefits?: string | null;
  additionalTerms?: string | null;
  documentHtml?: string | null;
  letterhead?: {
    companyName: string;
    address?: string | null;
    email?: string | null;
    phone?: string | null;
    website?: string | null;
    primaryColor?: string | null;
    secondaryColor?: string | null;
    watermarkText?: string | null;
  } | null;
  authorizedSignatory?: string | null;
  offerDate?: string | Date;
}

export function generateOfferLetterPdf(options: OfferPdfOptions): Buffer {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const marginX = 20;
  let cursorY = 22;

  const primaryHex = options.letterhead?.primaryColor || "#1e40af";
  const compName = options.letterhead?.companyName || "It's Me Dezino Digital Technologies Pvt. Ltd.";
  const compAddress =
    options.letterhead?.address ||
    "Level 4, Dezino Tower, Cyber City, Sector 44, Gurugram, Haryana 122002";
  const compContact = [
    options.letterhead?.email || "careers@itsmedezino.com",
    options.letterhead?.phone || "+91 124 456 7890",
    options.letterhead?.website || "www.itsmedezino.com",
  ]
    .filter(Boolean)
    .join("  |  ");

  // Helper function to draw branded header
  const drawHeader = (pageNumber: number) => {
    // Top colored accent bar
    doc.setFillColor(30, 64, 175);
    doc.rect(0, 0, pageWidth, 5, "F");

    if (pageNumber === 1) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.setTextColor(30, 64, 175);
      doc.text(compName.toUpperCase(), marginX, 17);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139);
      doc.text(compAddress, marginX, 22);
      doc.text(compContact, marginX, 26);

      // Decorative divider
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.5);
      doc.line(marginX, 29, pageWidth - marginX, 29);
      cursorY = 36;
    } else {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(`${compName} — Offer of Employment (${options.offerNumber})`, marginX, 12);
      doc.setDrawColor(226, 232, 240);
      doc.line(marginX, 14, pageWidth - marginX, 14);
      cursorY = 20;
    }
  };

  // Helper function to draw footer
  const drawFooter = (currentPage: number, totalPages: number) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.line(marginX, pageHeight - 16, pageWidth - marginX, pageHeight - 16);
    doc.text(
      "CONFIDENTIAL — This document and its attachments are proprietary to the company.",
      marginX,
      pageHeight - 11
    );
    doc.text(`Page ${currentPage} of ${totalPages}`, pageWidth - marginX, pageHeight - 11, {
      align: "right",
    });
  };

  // PAGE 1: Formal Offer Letter
  drawHeader(1);

  // Reference and Date Row
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(`Ref: ${options.offerNumber}`, marginX, cursorY);
  doc.text(
    `Date: ${formatDatePretty(options.offerDate || new Date())}`,
    pageWidth - marginX,
    cursorY,
    { align: "right" }
  );
  cursorY += 8;

  // Candidate Address Block
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text("To,", marginX, cursorY);
  cursorY += 5;
  doc.text(options.candidateName, marginX, cursorY);
  cursorY += 4.5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  if (options.candidateEmail) {
    doc.text(options.candidateEmail, marginX, cursorY);
    cursorY += 4.5;
  }
  if (options.candidatePhone) {
    doc.text(options.candidatePhone, marginX, cursorY);
    cursorY += 4.5;
  }
  if (options.candidateAddress) {
    const addressLines = doc.splitTextToSize(options.candidateAddress, 100);
    doc.text(addressLines, marginX, cursorY);
    cursorY += addressLines.length * 4.5;
  }
  cursorY += 4;

  // Document Heading Banner
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(marginX, cursorY, pageWidth - marginX * 2, 9, 1.5, 1.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(30, 64, 175);
  doc.text(
    `OFFER OF EMPLOYMENT: ${options.jobTitle.toUpperCase()}`,
    marginX + 4,
    cursorY + 6
  );
  cursorY += 14;

  // Opening Paragraph
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59);
  const openingPara = `Dear ${options.candidateName},

We are pleased to extend an offer of employment with ${compName} for the position of ${options.jobTitle} in our ${options.department} department. Following our comprehensive evaluation process, we were very impressed by your background, professional accomplishments, and the energy you bring. We believe your contributions will play a pivotal role in our continued growth.`;

  const lines1 = doc.splitTextToSize(openingPara, pageWidth - marginX * 2);
  doc.text(lines1, marginX, cursorY);
  cursorY += lines1.length * 4.8 + 4;

  // Key Terms Table
  const termsData = [
    ["Position / Designation", options.jobTitle],
    ["Department", options.department],
    ["Employment Type", options.employmentType.replace(/_/g, " ")],
    ["Work Location", options.workLocation],
    ["Proposed Date of Joining", formatDatePretty(options.joiningDate)],
    ["Probation Period", `${options.probationPeriodMonths} Months from Joining`],
    ["Total Annual CTC", formatCurrencyINR(options.annualCtc)],
    ["Monthly Gross Salary", formatCurrencyINR(options.monthlyGross)],
    ["Offer Expiry Date", formatDatePretty(options.validityDate)],
  ];

  autoTable(doc, {
    startY: cursorY,
    margin: { left: marginX, right: marginX },
    body: termsData,
    theme: "grid",
    styles: {
      fontSize: 8.5,
      cellPadding: 2.5,
      font: "helvetica",
      textColor: [30, 41, 59],
    },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 60, fillColor: [248, 250, 252] },
      1: { cellWidth: 110 },
    },
  });

  cursorY = (doc as any).lastAutoTable.finalY + 8;

  // Closing acceptance paragraph on Page 1
  const closingPara = `This offer is subject to satisfactory reference checks and submission of required pre-onboarding documents. Please signify your formal acceptance of this offer by signing below and returning a duplicate copy on or before ${formatDatePretty(options.validityDate)}.`;
  const lines2 = doc.splitTextToSize(closingPara, pageWidth - marginX * 2);
  doc.text(lines2, marginX, cursorY);
  cursorY += lines2.length * 4.8 + 10;

  // Signatures Row
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text(`For ${compName}`, marginX, cursorY);
  doc.text("Candidate Acceptance", pageWidth - marginX - 60, cursorY);
  cursorY += 15;

  doc.setDrawColor(203, 213, 225);
  doc.line(marginX, cursorY, marginX + 60, cursorY);
  doc.line(pageWidth - marginX - 60, cursorY, pageWidth - marginX, cursorY);
  cursorY += 4.5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(options.authorizedSignatory || "Authorized HR Signatory", marginX, cursorY);
  doc.text(`${options.candidateName} (Signature & Date)`, pageWidth - marginX - 60, cursorY);

  // PAGE 2: Annexure A - Compensation Breakdown & Detailed Terms
  doc.addPage();
  drawHeader(2);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(30, 64, 175);
  doc.text("ANNEXURE A — DETAILED COMPENSATION BREAKDOWN", marginX, cursorY);
  cursorY += 6;

  // Calculate standard or custom salary breakdown
  const basicMonthly = Math.round(options.monthlyGross * 0.5);
  const hraMonthly = Math.round(options.monthlyGross * 0.25);
  const specialMonthly = Math.round(options.monthlyGross * 0.19);
  const pfMonthly = Math.min(1800, Math.round(basicMonthly * 0.12));

  let salaryRows: [string, string, string][] = [
    ["Basic Salary (50%)", formatCurrencyINR(basicMonthly), formatCurrencyINR(basicMonthly * 12)],
    ["House Rent Allowance (HRA 25%)", formatCurrencyINR(hraMonthly), formatCurrencyINR(hraMonthly * 12)],
    ["Special & Flexible Allowance", formatCurrencyINR(specialMonthly), formatCurrencyINR(specialMonthly * 12)],
    ["Employer Provident Fund (PF)", formatCurrencyINR(pfMonthly), formatCurrencyINR(pfMonthly * 12)],
    ["Total Cost to Company (CTC)", formatCurrencyINR(options.monthlyGross), formatCurrencyINR(options.annualCtc)],
  ];

  if (options.salaryBreakdownJson) {
    try {
      const parsed = JSON.parse(options.salaryBreakdownJson);
      if (Array.isArray(parsed) && parsed.length > 0) {
        salaryRows = parsed.map((item: any) => [
          item.component,
          formatCurrencyINR(item.monthly),
          formatCurrencyINR(item.annual),
        ]);
        salaryRows.push([
          "Total Cost to Company (CTC)",
          formatCurrencyINR(options.monthlyGross),
          formatCurrencyINR(options.annualCtc),
        ]);
      }
    } catch {}
  }

  autoTable(doc, {
    startY: cursorY,
    margin: { left: marginX, right: marginX },
    head: [["Salary Component", "Monthly Amount", "Annual Amount"]],
    body: salaryRows,
    theme: "striped",
    headStyles: {
      fillColor: [30, 64, 175],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 9,
    },
    styles: {
      fontSize: 8.5,
      cellPadding: 3,
      textColor: [30, 41, 59],
    },
    columnStyles: {
      0: { cellWidth: 80 },
      1: { cellWidth: 45, halign: "right" },
      2: { cellWidth: 45, halign: "right" },
    },
  });

  cursorY = (doc as any).lastAutoTable.finalY + 10;

  // Benefits & Additional Terms Block
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text("ANNEXURE B — TERMS, BENEFITS & POLICIES", marginX, cursorY);
  cursorY += 6;

  const termsText =
    options.additionalTerms ||
    `1. Working Hours & Hybrid Policy: Standard working hours are Monday to Friday. The company operates in a collaborative hybrid model.
2. Group Health Insurance: Covered under the agency's medical insurance policy for up to ₹5,00,000 for self and dependents upon joining.
3. Annual Performance Reviews: Appraisals and performance incentives are evaluated annually based on organizational and individual KPIs.
4. Confidentiality & IP Ownership: All intellectual property, designs, codes, client materials, and trade secrets created during employment remain the sole exclusive property of the company.
5. Notice Period: During probation, either party may terminate employment by giving 15 days notice. Post probation confirmation, notice period is 60 calendar days.`;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  const termsLines = doc.splitTextToSize(termsText, pageWidth - marginX * 2);
  doc.text(termsLines, marginX, cursorY);

  // Apply footer to all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    drawFooter(i, totalPages);
  }

  const pdfOutput = doc.output("arraybuffer");
  return Buffer.from(pdfOutput);
}
