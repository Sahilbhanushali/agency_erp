import { PLACEHOLDERS } from "./types";

export interface PlaceholderContext {
  candidate?: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
  };
  job?: {
    title?: string | null;
    department?: string | null;
    employmentType?: string | null;
    location?: string | null;
  };
  offer?: {
    annualCtc?: number | string | null;
    monthlyGross?: number | string | null;
    joiningDate?: string | Date | null;
    probationPeriodMonths?: number | null;
    workLocation?: string | null;
    validityDate?: string | Date | null;
    reportingManagerName?: string | null;
    salaryBreakdownJson?: string | null;
    offerDate?: string | Date | null;
    authorizedSignatory?: string | null;
  };
  letterhead?: {
    companyName?: string | null;
    address?: string | null;
    email?: string | null;
    logoUrl?: string | null;
  };
}

export function formatCurrencyINR(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined || amount === "") return "₹ 0";
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return "₹ 0";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(num);
}

export function formatDatePretty(date: string | Date | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-IN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function generateSalaryBreakdownTable(
  annualCtcNum: number,
  monthlyGrossNum: number,
  customBreakdownJson?: string | null
): string {
  let basicMonthly = Math.round(monthlyGrossNum * 0.5);
  let hraMonthly = Math.round(monthlyGrossNum * 0.25);
  let specialMonthly = Math.round(monthlyGrossNum * 0.19);
  let pfEmployerMonthly = Math.min(1800, Math.round(basicMonthly * 0.12));

  // If custom breakdown JSON is provided, parse it
  if (customBreakdownJson) {
    try {
      const parsed = JSON.parse(customBreakdownJson);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const rows = parsed
          .map(
            (item: { component: string; monthly: number; annual: number }) => `
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 8px 14px; text-align: left; font-size: 13px; color: #1e293b;">${item.component}</td>
            <td style="padding: 8px 14px; text-align: right; font-size: 13px; font-weight: 500; color: #334155;">${formatCurrencyINR(item.monthly)}</td>
            <td style="padding: 8px 14px; text-align: right; font-size: 13px; font-weight: 500; color: #334155;">${formatCurrencyINR(item.annual)}</td>
          </tr>`
          )
          .join("");

        return `
        <table style="width: 100%; border-collapse: collapse; margin: 18px 0; border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden; font-family: inherit;">
          <thead>
            <tr style="background-color: #f8fafc; border-bottom: 2px solid #cbd5e1;">
              <th style="padding: 10px 14px; text-align: left; font-size: 13px; font-weight: 600; color: #0f172a;">Component</th>
              <th style="padding: 10px 14px; text-align: right; font-size: 13px; font-weight: 600; color: #0f172a;">Monthly</th>
              <th style="padding: 10px 14px; text-align: right; font-size: 13px; font-weight: 600; color: #0f172a;">Annual</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
            <tr style="background-color: #f1f5f9; font-weight: 700; border-top: 2px solid #94a3b8;">
              <td style="padding: 10px 14px; font-size: 13px; color: #0f172a;">Cost to Company (CTC)</td>
              <td style="padding: 10px 14px; text-align: right; font-size: 13px; color: #0f172a;">${formatCurrencyINR(monthlyGrossNum)}</td>
              <td style="padding: 10px 14px; text-align: right; font-size: 13px; color: #0f172a;">${formatCurrencyINR(annualCtcNum)}</td>
            </tr>
          </tbody>
        </table>`;
      }
    } catch {
      // fallback to standard formula
    }
  }

  // Standard calculation fallback
  const basicAnnual = basicMonthly * 12;
  const hraAnnual = hraMonthly * 12;
  const specialAnnual = specialMonthly * 12;
  const pfEmployerAnnual = pfEmployerMonthly * 12;

  return `
  <table style="width: 100%; border-collapse: collapse; margin: 18px 0; border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden; font-family: inherit;">
    <thead>
      <tr style="background-color: #f8fafc; border-bottom: 2px solid #cbd5e1;">
        <th style="padding: 10px 14px; text-align: left; font-size: 13px; font-weight: 600; color: #0f172a;">Salary Component</th>
        <th style="padding: 10px 14px; text-align: right; font-size: 13px; font-weight: 600; color: #0f172a;">Monthly Gross</th>
        <th style="padding: 10px 14px; text-align: right; font-size: 13px; font-weight: 600; color: #0f172a;">Annual CTC</th>
      </tr>
    </thead>
    <tbody>
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 8px 14px; text-align: left; font-size: 13px; color: #1e293b;">Basic Salary (50%)</td>
        <td style="padding: 8px 14px; text-align: right; font-size: 13px; font-weight: 500; color: #334155;">${formatCurrencyINR(basicMonthly)}</td>
        <td style="padding: 8px 14px; text-align: right; font-size: 13px; font-weight: 500; color: #334155;">${formatCurrencyINR(basicAnnual)}</td>
      </tr>
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 8px 14px; text-align: left; font-size: 13px; color: #1e293b;">House Rent Allowance (HRA - 25%)</td>
        <td style="padding: 8px 14px; text-align: right; font-size: 13px; font-weight: 500; color: #334155;">${formatCurrencyINR(hraMonthly)}</td>
        <td style="padding: 8px 14px; text-align: right; font-size: 13px; font-weight: 500; color: #334155;">${formatCurrencyINR(hraAnnual)}</td>
      </tr>
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 8px 14px; text-align: left; font-size: 13px; color: #1e293b;">Special & Flexible Allowances</td>
        <td style="padding: 8px 14px; text-align: right; font-size: 13px; font-weight: 500; color: #334155;">${formatCurrencyINR(specialMonthly)}</td>
        <td style="padding: 8px 14px; text-align: right; font-size: 13px; font-weight: 500; color: #334155;">${formatCurrencyINR(specialAnnual)}</td>
      </tr>
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 8px 14px; text-align: left; font-size: 13px; color: #1e293b;">Employer Provident Fund (PF)</td>
        <td style="padding: 8px 14px; text-align: right; font-size: 13px; font-weight: 500; color: #334155;">${formatCurrencyINR(pfEmployerMonthly)}</td>
        <td style="padding: 8px 14px; text-align: right; font-size: 13px; font-weight: 500; color: #334155;">${formatCurrencyINR(pfEmployerAnnual)}</td>
      </tr>
      <tr style="background-color: #f1f5f9; font-weight: 700; border-top: 2px solid #94a3b8;">
        <td style="padding: 10px 14px; font-size: 13px; color: #0f172a;">Total Cost to Company (Annual CTC)</td>
        <td style="padding: 10px 14px; text-align: right; font-size: 13px; color: #0f172a;">${formatCurrencyINR(monthlyGrossNum)}</td>
        <td style="padding: 10px 14px; text-align: right; font-size: 13px; color: #0f172a;">${formatCurrencyINR(annualCtcNum)}</td>
      </tr>
    </tbody>
  </table>`;
}

export function resolvePlaceholders(
  htmlContent: string,
  context: PlaceholderContext,
  useSampleDataFallback: boolean = false
): {
  renderedHtml: string;
  unresolvedTokens: string[];
  resolvedMap: Record<string, string>;
} {
  const unresolvedTokens: string[] = [];
  const resolvedMap: Record<string, string> = {};

  const annualNum = context.offer?.annualCtc
    ? Number(context.offer.annualCtc)
    : useSampleDataFallback
    ? 1800000
    : 0;

  const monthlyNum = context.offer?.monthlyGross
    ? Number(context.offer.monthlyGross)
    : annualNum
    ? Math.round(annualNum / 12)
    : useSampleDataFallback
    ? 150000
    : 0;

  const dictionary: Record<string, string | null | undefined> = {
    "{{candidate_name}}":
      context.candidate?.name || (useSampleDataFallback ? "Aarav Sharma" : null),
    "{{candidate_email}}":
      context.candidate?.email || (useSampleDataFallback ? "aarav.sharma@example.com" : null),
    "{{candidate_phone}}":
      context.candidate?.phone || (useSampleDataFallback ? "+91 98765 43210" : null),
    "{{candidate_address}}":
      context.candidate?.address ||
      (useSampleDataFallback ? "42 MG Road, Indiranagar, Bengaluru, Karnataka 560038" : null),

    "{{job_title}}":
      context.job?.title || (useSampleDataFallback ? "Senior Full Stack Engineer" : null),
    "{{department}}":
      context.job?.department || (useSampleDataFallback ? "Engineering & Product" : null),
    "{{employment_type}}":
      context.job?.employmentType || (useSampleDataFallback ? "Full-Time Employee" : null),
    "{{reporting_manager}}":
      context.offer?.reportingManagerName ||
      (useSampleDataFallback ? "Vikram Malhotra (Director of Engineering)" : null),
    "{{joining_date}}":
      formatDatePretty(context.offer?.joiningDate) ||
      (useSampleDataFallback ? "November 1, 2026" : null),
    "{{work_location}}":
      context.offer?.workLocation ||
      context.job?.location ||
      (useSampleDataFallback ? "Bengaluru HQ (Hybrid)" : null),

    "{{annual_salary}}": annualNum
      ? formatCurrencyINR(annualNum)
      : useSampleDataFallback
      ? "₹ 18,00,000"
      : null,
    "{{monthly_salary}}": monthlyNum
      ? formatCurrencyINR(monthlyNum)
      : useSampleDataFallback
      ? "₹ 1,50,000"
      : null,
    "{{salary_breakdown}}": generateSalaryBreakdownTable(
      annualNum || 1800000,
      monthlyNum || 150000,
      context.offer?.salaryBreakdownJson
    ),
    "{{probation_period}}":
      context.offer?.probationPeriodMonths
        ? `${context.offer.probationPeriodMonths} Months`
        : useSampleDataFallback
        ? "3 Months"
        : null,

    "{{company_name}}":
      context.letterhead?.companyName || "It's Me Dezino Digital Technologies Pvt. Ltd.",
    "{{company_address}}":
      context.letterhead?.address ||
      "Level 4, Dezino Tower, Cyber City, Sector 44, Gurugram, HR 122002",
    "{{company_email}}":
      context.letterhead?.email || "careers@itsmedezino.com",
    "{{company_logo}}": context.letterhead?.logoUrl
      ? `<img src="${context.letterhead.logoUrl}" alt="Logo" style="max-height: 48px; object-fit: contain;" />`
      : `<div style="font-weight: 800; font-size: 20px; color: #1e40af; letter-spacing: -0.5px;">ITS ME DEZINO</div>`,

    "{{offer_date}}":
      formatDatePretty(context.offer?.offerDate) ||
      (useSampleDataFallback ? "October 13, 2026" : formatDatePretty(new Date())),
    "{{offer_expiry_date}}":
      formatDatePretty(context.offer?.validityDate) ||
      (useSampleDataFallback ? "October 20, 2026" : null),
    "{{authorized_signatory}}":
      context.offer?.authorizedSignatory ||
      (useSampleDataFallback ? "Neha Kapoor (Head of People & Culture)" : "Authorized Signatory"),
  };

  let renderedHtml = htmlContent;

  for (const item of PLACEHOLDERS) {
    const token = item.token;
    const value = dictionary[token];

    if (value !== null && value !== undefined && value !== "") {
      resolvedMap[token] = value;
      // replace all instances of token
      renderedHtml = renderedHtml.split(token).join(value);
    } else {
      // Check if token exists in content
      if (renderedHtml.includes(token)) {
        unresolvedTokens.push(token);
        // Highlight in preview with warning pill
        renderedHtml = renderedHtml
          .split(token)
          .join(
            `<span style="background-color: #fef3c7; color: #92400e; padding: 2px 6px; border-radius: 4px; border: 1px dashed #f59e0b; font-weight: 600; font-size: 12px;">${token} [MISSING]</span>`
          );
      }
    }
  }

  return { renderedHtml, unresolvedTokens, resolvedMap };
}
