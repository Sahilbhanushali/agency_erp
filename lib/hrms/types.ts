export const HRMS_STAGES = [
  "Applied",
  "Resume Screening",
  "Shortlisted",
  "Interview Scheduled",
  "Interview in Progress",
  "Interview Completed",
  "Selected",
  "Offer Preparation",
  "Offer Sent",
  "Offer Accepted",
  "Offer Rejected",
  "Hired",
  "Onboarding",
  "Rejected",
  "Withdrawn",
] as const;

export type HrmsStage = (typeof HRMS_STAGES)[number];

export const STAGE_CONFIG: Record<
  HrmsStage,
  {
    label: string;
    color: string;
    bg: string;
    border: string;
    badgeVariant: "default" | "secondary" | "destructive" | "outline";
    description: string;
    category: "sourcing" | "screening" | "interview" | "offer" | "hired" | "archive";
  }
> = {
  Applied: {
    label: "Applied",
    color: "text-blue-700 dark:text-blue-300",
    bg: "bg-blue-50 dark:bg-blue-950/40",
    border: "border-blue-200 dark:border-blue-900",
    badgeVariant: "secondary",
    description: "New applications submitted for review",
    category: "sourcing",
  },
  "Resume Screening": {
    label: "Resume Screening",
    color: "text-indigo-700 dark:indigo-300",
    bg: "bg-indigo-50 dark:bg-indigo-950/40",
    border: "border-indigo-200 dark:border-indigo-900",
    badgeVariant: "secondary",
    description: "Reviewing resume, portfolio, and qualifications",
    category: "screening",
  },
  Shortlisted: {
    label: "Shortlisted",
    color: "text-sky-700 dark:text-sky-300",
    bg: "bg-sky-50 dark:bg-sky-950/40",
    border: "border-sky-200 dark:border-sky-900",
    badgeVariant: "secondary",
    description: "Qualified profile approved for interviews",
    category: "screening",
  },
  "Interview Scheduled": {
    label: "Interview Scheduled",
    color: "text-amber-700 dark:text-amber-300",
    bg: "bg-amber-50 dark:bg-amber-950/40",
    border: "border-amber-200 dark:border-amber-900",
    badgeVariant: "outline",
    description: "Interview slot confirmed with candidate and panel",
    category: "interview",
  },
  "Interview in Progress": {
    label: "Interview in Progress",
    color: "text-orange-700 dark:text-orange-300",
    bg: "bg-orange-50 dark:bg-orange-950/40",
    border: "border-orange-200 dark:border-orange-900",
    badgeVariant: "outline",
    description: "Evaluation rounds actively ongoing",
    category: "interview",
  },
  "Interview Completed": {
    label: "Interview Completed",
    color: "text-purple-700 dark:text-purple-300",
    bg: "bg-purple-50 dark:bg-purple-950/40",
    border: "border-purple-200 dark:border-purple-900",
    badgeVariant: "secondary",
    description: "All interview rounds completed, awaiting scorecard",
    category: "interview",
  },
  Selected: {
    label: "Selected",
    color: "text-emerald-700 dark:text-emerald-300",
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    border: "border-emerald-200 dark:border-emerald-900",
    badgeVariant: "default",
    description: "Candidate approved by hiring manager for offer",
    category: "interview",
  },
  "Offer Preparation": {
    label: "Offer Preparation",
    color: "text-teal-700 dark:text-teal-300",
    bg: "bg-teal-50 dark:bg-teal-950/40",
    border: "border-teal-200 dark:border-teal-900",
    badgeVariant: "secondary",
    description: "Drafting compensation package and terms",
    category: "offer",
  },
  "Offer Sent": {
    label: "Offer Sent",
    color: "text-cyan-700 dark:text-cyan-300",
    bg: "bg-cyan-50 dark:bg-cyan-950/40",
    border: "border-cyan-200 dark:border-cyan-900",
    badgeVariant: "secondary",
    description: "Formal offer letter delivered to candidate",
    category: "offer",
  },
  "Offer Accepted": {
    label: "Offer Accepted",
    color: "text-green-700 dark:text-green-300",
    bg: "bg-green-50 dark:bg-green-950/40",
    border: "border-green-200 dark:border-green-900",
    badgeVariant: "default",
    description: "Candidate signed and accepted the offer",
    category: "offer",
  },
  "Offer Rejected": {
    label: "Offer Rejected",
    color: "text-rose-700 dark:text-rose-300",
    bg: "bg-rose-50 dark:bg-rose-950/40",
    border: "border-rose-200 dark:border-rose-900",
    badgeVariant: "destructive",
    description: "Candidate declined the employment offer",
    category: "archive",
  },
  Hired: {
    label: "Hired",
    color: "text-emerald-800 dark:text-emerald-200",
    bg: "bg-emerald-100 dark:bg-emerald-900/50",
    border: "border-emerald-300 dark:border-emerald-800",
    badgeVariant: "default",
    description: "Hiring confirmed, transitioning to onboarding",
    category: "hired",
  },
  Onboarding: {
    label: "Onboarding",
    color: "text-blue-800 dark:text-blue-200",
    bg: "bg-blue-100 dark:bg-blue-900/50",
    border: "border-blue-300 dark:border-blue-800",
    badgeVariant: "default",
    description: "Completing checklist, documents and account setup",
    category: "hired",
  },
  Rejected: {
    label: "Rejected",
    color: "text-red-700 dark:text-red-300",
    bg: "bg-red-50 dark:bg-red-950/40",
    border: "border-red-200 dark:border-red-900",
    badgeVariant: "destructive",
    description: "Candidate not selected with documented rationale",
    category: "archive",
  },
  Withdrawn: {
    label: "Withdrawn",
    color: "text-gray-700 dark:text-gray-300",
    bg: "bg-gray-100 dark:bg-gray-800/40",
    border: "border-gray-200 dark:border-gray-700",
    badgeVariant: "secondary",
    description: "Candidate withdrew application or opted out",
    category: "archive",
  },
};

export interface PlaceholderDefinition {
  token: string;
  label: string;
  category: "Candidate" | "Employment" | "Compensation" | "Company" | "Document";
  description: string;
  exampleValue: string;
}

export const PLACEHOLDERS: PlaceholderDefinition[] = [
  // Candidate details
  {
    token: "{{candidate_name}}",
    label: "Candidate Full Name",
    category: "Candidate",
    description: "Full legal name of the candidate",
    exampleValue: "Aarav Sharma",
  },
  {
    token: "{{candidate_email}}",
    label: "Candidate Email",
    category: "Candidate",
    description: "Primary email address of the candidate",
    exampleValue: "aarav.sharma@example.com",
  },
  {
    token: "{{candidate_phone}}",
    label: "Candidate Phone",
    category: "Candidate",
    description: "Contact phone number of the candidate",
    exampleValue: "+91 98765 43210",
  },
  {
    token: "{{candidate_address}}",
    label: "Candidate Address",
    category: "Candidate",
    description: "Residential address of the candidate",
    exampleValue: "42 MG Road, Indiranagar, Bengaluru, KA 560038",
  },

  // Employment details
  {
    token: "{{job_title}}",
    label: "Job Position / Title",
    category: "Employment",
    description: "Designation offered to candidate",
    exampleValue: "Senior Full Stack Engineer",
  },
  {
    token: "{{department}}",
    label: "Department",
    category: "Employment",
    description: "Assigned department or business unit",
    exampleValue: "Engineering & Technology",
  },
  {
    token: "{{employment_type}}",
    label: "Employment Type",
    category: "Employment",
    description: "Full-Time, Part-Time, Contract, Internship",
    exampleValue: "Full-Time",
  },
  {
    token: "{{reporting_manager}}",
    label: "Reporting Manager",
    category: "Employment",
    description: "Name of the designated reporting manager",
    exampleValue: "Vikram Malhotra (Director of Engineering)",
  },
  {
    token: "{{joining_date}}",
    label: "Date of Joining",
    category: "Employment",
    description: "Proposed joining date",
    exampleValue: "November 1, 2026",
  },
  {
    token: "{{work_location}}",
    label: "Work Location / Mode",
    category: "Employment",
    description: "Office branch or Remote / Hybrid location",
    exampleValue: "Bengaluru HQ (Hybrid)",
  },

  // Compensation details
  {
    token: "{{annual_salary}}",
    label: "Annual CTC / Salary",
    category: "Compensation",
    description: "Total annual cost-to-company package",
    exampleValue: "₹ 18,00,000",
  },
  {
    token: "{{monthly_salary}}",
    label: "Monthly Gross Salary",
    category: "Compensation",
    description: "Gross salary payable per month",
    exampleValue: "₹ 1,50,000",
  },
  {
    token: "{{salary_breakdown}}",
    label: "Salary Breakdown Table",
    category: "Compensation",
    description: "Formatted table with Basic, HRA, Allowances, PF",
    exampleValue: `<table class="salary-table" style="width:100%; border-collapse:collapse; margin:16px 0; font-size:13px;">
      <thead>
        <tr style="background:#f1f5f9; border-bottom:2px solid #cbd5e1;">
          <th style="padding:8px 12px; text-align:left;">Component</th>
          <th style="padding:8px 12px; text-align:right;">Monthly (₹)</th>
          <th style="padding:8px 12px; text-align:right;">Annual (₹)</th>
        </tr>
      </thead>
      <tbody>
        <tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:6px 12px;">Basic Salary (50%)</td><td style="padding:6px 12px; text-align:right;">75,000</td><td style="padding:6px 12px; text-align:right;">9,00,000</td></tr>
        <tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:6px 12px;">House Rent Allowance (HRA)</td><td style="padding:6px 12px; text-align:right;">37,500</td><td style="padding:6px 12px; text-align:right;">4,50,000</td></tr>
        <tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:6px 12px;">Special Allowance</td><td style="padding:6px 12px; text-align:right;">28,500</td><td style="padding:6px 12px; text-align:right;">3,42,000</td></tr>
        <tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:6px 12px;">Provident Fund (Employer)</td><td style="padding:6px 12px; text-align:right;">9,000</td><td style="padding:6px 12px; text-align:right;">1,08,000</td></tr>
        <tr style="font-weight:bold; background:#f8fafc; border-top:2px solid #0f172a;"><td style="padding:8px 12px;">Total Cost to Company (CTC)</td><td style="padding:8px 12px; text-align:right;">1,50,000</td><td style="padding:8px 12px; text-align:right;">18,00,000</td></tr>
      </tbody>
    </table>`,
  },
  {
    token: "{{probation_period}}",
    label: "Probation Period",
    category: "Compensation",
    description: "Duration of the probation assessment period",
    exampleValue: "3 Months",
  },

  // Company details
  {
    token: "{{company_name}}",
    label: "Company Legal Name",
    category: "Company",
    description: "Official entity name",
    exampleValue: "It's Me Dezino Digital Technologies Pvt. Ltd.",
  },
  {
    token: "{{company_address}}",
    label: "Company Address",
    category: "Company",
    description: "Registered office address",
    exampleValue: "Level 4, Dezino Tower, Cyber City, Sector 44, Gurugram, HR 122002",
  },
  {
    token: "{{company_email}}",
    label: "Company Contact Email",
    category: "Company",
    description: "Official recruitment/contact email",
    exampleValue: "careers@itsmedezino.com",
  },
  {
    token: "{{company_logo}}",
    label: "Company Logo",
    category: "Company",
    description: "Embedded branded company logo image",
    exampleValue: `<img src="/logo.png" alt="Company Logo" style="height:48px; object-fit:contain;" />`,
  },

  // Document details
  {
    token: "{{offer_date}}",
    label: "Offer Date",
    category: "Document",
    description: "Date when offer letter is generated or issued",
    exampleValue: "October 13, 2026",
  },
  {
    token: "{{offer_expiry_date}}",
    label: "Offer Expiry Date",
    category: "Document",
    description: "Deadline for candidate acceptance",
    exampleValue: "October 20, 2026",
  },
  {
    token: "{{authorized_signatory}}",
    label: "Authorized Signatory",
    category: "Document",
    description: "Name & title of the authorizing HR executive",
    exampleValue: "Neha Kapoor (Head of People & Culture)",
  },
];

export interface DefaultOnboardingTask {
  id: string;
  task: string;
  category: "Documentation" | "IT Setup" | "HR Orientation" | "Team Intro" | "Training";
  done: boolean;
  dueDateOffsetDays: number;
}

export const DEFAULT_ONBOARDING_CHECKLIST: DefaultOnboardingTask[] = [
  { id: "1", task: "Collect signed offer letter & signed NDA", category: "Documentation", done: false, dueDateOffsetDays: -3 },
  { id: "2", task: "Verify Government ID (Aadhaar & PAN)", category: "Documentation", done: false, dueDateOffsetDays: -2 },
  { id: "3", task: "Collect past employment relieving letters & payslips", category: "Documentation", done: false, dueDateOffsetDays: -1 },
  { id: "4", task: "Collect bank account details & cancelled cheque", category: "Documentation", done: false, dueDateOffsetDays: 0 },
  { id: "5", task: "Provision corporate email (@agency.com) & Slack workspace", category: "IT Setup", done: false, dueDateOffsetDays: 0 },
  { id: "6", task: "Issue company laptop & configure security tools", category: "IT Setup", done: false, dueDateOffsetDays: 1 },
  { id: "7", task: "Agency HR orientation & policies walkthrough", category: "HR Orientation", done: false, dueDateOffsetDays: 1 },
  { id: "8", task: "Assign onboarding buddy & welcome lunch", category: "Team Intro", done: false, dueDateOffsetDays: 1 },
  { id: "9", task: "Introduction to team leads and active project managers", category: "Team Intro", done: false, dueDateOffsetDays: 2 },
  { id: "10", task: "Role-specific tools onboarding & training roadmap", category: "Training", done: false, dueDateOffsetDays: 3 },
  { id: "11", task: "30-day expectation alignment session with manager", category: "Training", done: false, dueDateOffsetDays: 7 },
];
