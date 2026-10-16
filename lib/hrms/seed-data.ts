import { prisma } from "@/lib/prisma";

export async function seedHrmsInitialData() {
  // Check if letterhead already exists
  const existingLetterheadCount = await prisma.hrmsLetterhead.count();
  let defaultLetterhead = null;

  if (existingLetterheadCount === 0) {
    defaultLetterhead = await prisma.hrmsLetterhead.create({
      data: {
        name: "Corporate Executive Letterhead",
        companyName: "It's Me Dezino Digital Technologies Pvt. Ltd.",
        address: "Level 4, Dezino Tower, Cyber City, Sector 44",
        city: "Gurugram",
        state: "Haryana",
        country: "India",
        postalCode: "122002",
        email: "careers@itsmedezino.com",
        phone: "+91 124 456 7890",
        website: "https://itsmedezino.com",
        primaryColor: "#1e40af",
        secondaryColor: "#64748b",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        marginTop: 25,
        marginBottom: 20,
        marginLeft: 20,
        marginRight: 20,
        isDefault: true,
        status: "ACTIVE",
        headerHtml: `
          <div style="display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 12px; border-bottom: 2px solid #1e40af;">
            <div>
              <h1 style="margin: 0; font-size: 20px; font-weight: 800; color: #1e40af; letter-spacing: -0.5px;">ITS ME DEZINO</h1>
              <p style="margin: 2px 0 0; font-size: 11px; color: #64748b; font-weight: 500;">DIGITAL TECHNOLOGIES & CREATIVE SOLUTIONS</p>
            </div>
            <div style="text-align: right; font-size: 11px; color: #475569; line-height: 1.4;">
              <div>Level 4, Dezino Tower, Cyber City, Sector 44</div>
              <div>Gurugram, Haryana 122002, India</div>
              <div>careers@itsmedezino.com | +91 124 456 7890</div>
            </div>
          </div>
        `,
        footerHtml: `
          <div style="padding-top: 10px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; font-size: 10px; color: #94a3b8;">
            <span>Confidential — Employment Document</span>
            <span>www.itsmedezino.com</span>
          </div>
        `,
      },
    });
  } else {
    defaultLetterhead = await prisma.hrmsLetterhead.findFirst({
      where: { isDefault: true },
    }) || await prisma.hrmsLetterhead.findFirst();
  }

  // Check offer templates
  const existingTemplatesCount = await prisma.hrmsOfferTemplate.count();
  if (existingTemplatesCount === 0 && defaultLetterhead) {
    // 1. Standard Full-Time Offer Template
    await prisma.hrmsOfferTemplate.create({
      data: {
        name: "Standard Full-Time Employment Offer",
        description: "Official employment offer letter template for full-time engineering and product roles",
        category: "STANDARD",
        employmentType: "FULL_TIME",
        status: "ACTIVE",
        version: 1,
        letterheadId: defaultLetterhead.id,
        contentHtml: `
<p style="font-size: 12px; color: #64748b; margin-bottom: 16px;"><strong>Date:</strong> {{offer_date}}</p>

<p style="font-size: 14px; margin-bottom: 4px;"><strong>To,</strong></p>
<p style="font-size: 15px; font-weight: bold; margin: 0; color: #0f172a;">{{candidate_name}}</p>
<p style="font-size: 13px; color: #475569; margin: 2px 0;">{{candidate_email}} | {{candidate_phone}}</p>
<p style="font-size: 13px; color: #475569; margin: 2px 0 20px 0;">{{candidate_address}}</p>

<div style="background-color: #f1f5f9; padding: 10px 16px; border-left: 4px solid #1e40af; border-radius: 4px; margin-bottom: 20px;">
  <h2 style="font-size: 15px; margin: 0; color: #1e40af; font-weight: 700;">SUBJECT: LETTER OF EMPLOYMENT OFFER — {{job_title}}</h2>
</div>

<p style="font-size: 13px; line-height: 1.6; color: #1e293b;">Dear {{candidate_name}},</p>

<p style="font-size: 13px; line-height: 1.6; color: #1e293b;">
On behalf of <strong>{{company_name}}</strong>, we are thrilled to offer you the position of <strong>{{job_title}}</strong> in our <strong>{{department}}</strong> department. We were thoroughly impressed with your experience, technical expertise, and alignment with our team culture throughout the interview rounds.
</p>

<h3 style="font-size: 14px; color: #0f172a; margin: 18px 0 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">1. Terms of Appointment</h3>
<ul style="font-size: 13px; line-height: 1.7; color: #334155; padding-left: 20px;">
  <li><strong>Designation:</strong> {{job_title}}</li>
  <li><strong>Department:</strong> {{department}}</li>
  <li><strong>Reporting Manager:</strong> {{reporting_manager}}</li>
  <li><strong>Employment Type:</strong> {{employment_type}}</li>
  <li><strong>Date of Joining:</strong> {{joining_date}}</li>
  <li><strong>Work Location:</strong> {{work_location}}</li>
  <li><strong>Probation Period:</strong> {{probation_period}} from the effective date of joining.</li>
</ul>

<h3 style="font-size: 14px; color: #0f172a; margin: 18px 0 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">2. Compensation & Benefits</h3>
<p style="font-size: 13px; line-height: 1.6; color: #1e293b;">
Your total Cost to Company (CTC) will be <strong>{{annual_salary}}</strong> per annum (gross monthly compensation of <strong>{{monthly_salary}}</strong>). The detailed component-wise breakdown is outlined below:
</p>

{{salary_breakdown}}

<h3 style="font-size: 14px; color: #0f172a; margin: 18px 0 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">3. Acceptance of Offer</h3>
<p style="font-size: 13px; line-height: 1.6; color: #1e293b;">
This offer remains valid until <strong>{{offer_expiry_date}}</strong>. To accept, please sign and return a duplicate copy of this letter along with the onboarding document checklist.
</p>

<p style="font-size: 13px; line-height: 1.6; color: #1e293b; margin-top: 24px;">
We look forward to welcoming you to the {{company_name}} family!
</p>

<table style="width: 100%; margin-top: 40px; border-collapse: collapse;">
  <tr>
    <td style="width: 50%; vertical-align: top;">
      <p style="font-size: 13px; font-weight: bold; margin: 0 0 45px 0;">For {{company_name}}</p>
      <div style="border-top: 1px solid #94a3b8; width: 200px; padding-top: 4px;">
        <p style="font-size: 12px; font-weight: 600; margin: 0;">{{authorized_signatory}}</p>
        <p style="font-size: 11px; color: #64748b; margin: 0;">Head of People & Operations</p>
      </div>
    </td>
    <td style="width: 50%; vertical-align: top;">
      <p style="font-size: 13px; font-weight: bold; margin: 0 0 45px 0;">Candidate Acceptance</p>
      <div style="border-top: 1px solid #94a3b8; width: 200px; padding-top: 4px;">
        <p style="font-size: 12px; font-weight: 600; margin: 0;">{{candidate_name}}</p>
        <p style="font-size: 11px; color: #64748b; margin: 0;">Date: ____________________</p>
      </div>
    </td>
  </tr>
</table>
        `,
      },
    });

    // 2. Executive Leadership Template
    await prisma.hrmsOfferTemplate.create({
      data: {
        name: "Executive Leadership Appointment Letter",
        description: "Comprehensive offer letter template for executive, director, and VP leadership roles",
        category: "EXECUTIVE",
        employmentType: "FULL_TIME",
        status: "ACTIVE",
        version: 1,
        letterheadId: defaultLetterhead.id,
        contentHtml: `
<p style="font-size: 12px; color: #64748b; margin-bottom: 16px;"><strong>Date:</strong> {{offer_date}}</p>
<p style="font-size: 14px; margin-bottom: 4px;"><strong>To,</strong></p>
<p style="font-size: 16px; font-weight: bold; margin: 0; color: #0f172a;">{{candidate_name}}</p>
<p style="font-size: 13px; color: #475569; margin: 2px 0;">{{candidate_email}} | {{candidate_phone}}</p>

<div style="background-color: #f8fafc; border: 1px solid #cbd5e1; padding: 12px 18px; border-radius: 6px; margin: 20px 0;">
  <h2 style="font-size: 16px; margin: 0; color: #0f172a; font-weight: 800;">EXECUTIVE APPOINTMENT OFFER: {{job_title}}</h2>
</div>

<p style="font-size: 13px; line-height: 1.7; color: #1e293b;">
The Board of Directors and Leadership at <strong>{{company_name}}</strong> are delighted to formally invite you to join us as <strong>{{job_title}}</strong> in <strong>{{department}}</strong>.
</p>

<h3 style="font-size: 14px; color: #0f172a; margin: 18px 0 8px;">Executive Terms</h3>
<p style="font-size: 13px; line-height: 1.6;">Reporting to: <strong>{{reporting_manager}}</strong> | Joining Date: <strong>{{joining_date}}</strong> | Work Location: <strong>{{work_location}}</strong></p>

<h3 style="font-size: 14px; color: #0f172a; margin: 18px 0 8px;">Executive Compensation Structure</h3>
<p style="font-size: 13px; line-height: 1.6;">Annual Package: <strong>{{annual_salary}}</strong> (Monthly CTC: <strong>{{monthly_salary}}</strong>)</p>

{{salary_breakdown}}

<p style="font-size: 13px; line-height: 1.6; margin-top: 30px;">Signed on behalf of {{company_name}}:</p>
<p style="font-size: 13px; font-weight: bold;">{{authorized_signatory}}</p>
        `,
      },
    });

    // 3. Creative & Contractor Template
    await prisma.hrmsOfferTemplate.create({
      data: {
        name: "Creative & Design Consultancy Contract",
        description: "Contractor agreement template for UI/UX designers and creative strategists",
        category: "CONTRACTOR",
        employmentType: "CONTRACT",
        status: "ACTIVE",
        version: 1,
        letterheadId: defaultLetterhead.id,
        contentHtml: `
<p style="font-size: 12px; color: #64748b; margin-bottom: 16px;"><strong>Date:</strong> {{offer_date}}</p>
<p style="font-size: 14px; font-weight: bold; margin: 0;">{{candidate_name}}</p>
<p style="font-size: 13px; color: #475569;">{{candidate_email}} | {{candidate_phone}}</p>

<h2 style="font-size: 15px; color: #0f172a; font-weight: 700; margin: 20px 0 10px;">CONSULTANCY ENGAGEMENT OFFER — {{job_title}}</h2>
<p style="font-size: 13px; line-height: 1.6;">
We are delighted to engage your creative consultancy services for {{company_name}} as {{job_title}}.
</p>
<ul style="font-size: 13px; line-height: 1.7;">
  <li><strong>Project/Department:</strong> {{department}}</li>
  <li><strong>Commencement Date:</strong> {{joining_date}}</li>
  <li><strong>Monthly Retainer / Payout:</strong> {{monthly_salary}}</li>
  <li><strong>Annual Value:</strong> {{annual_salary}}</li>
</ul>
<p style="font-size: 13px; line-height: 1.6; margin-top: 24px;">Authorized by: {{authorized_signatory}}</p>
        `,
      },
    });
  }

  // Check job openings
  const existingJobCount = await prisma.hrmsJobOpening.count();
  if (existingJobCount === 0) {
    const job1 = await prisma.hrmsJobOpening.create({
      data: {
        title: "Senior Full Stack Engineer (Next.js & Node)",
        code: "JOB-2026-001",
        department: "Engineering",
        location: "Bengaluru (Hybrid)",
        employmentType: "FULL_TIME",
        status: "ACTIVE",
        openingsCount: 2,
        experienceMin: 4,
        experienceMax: 8,
        salaryMin: 1500000,
        salaryMax: 2400000,
        currency: "INR",
        description:
          "Looking for a Senior Full Stack Engineer with strong proficiency in Next.js 15, React 19, TypeScript, PostgreSQL/MySQL, and scalable web architectures.",
        requirements:
          "4+ years experience with Next.js, React, Node.js, REST & GraphQL APIs, Prisma ORM, and cloud deployments.",
        benefits:
          "Comprehensive health insurance, flexible working hours, home office allowance, learning stipend.",
      },
    });

    const job2 = await prisma.hrmsJobOpening.create({
      data: {
        title: "Lead UI/UX Product Designer",
        code: "JOB-2026-002",
        department: "Design",
        location: "Remote",
        employmentType: "FULL_TIME",
        status: "ACTIVE",
        openingsCount: 1,
        experienceMin: 5,
        experienceMax: 9,
        salaryMin: 1800000,
        salaryMax: 2600000,
        currency: "INR",
        description:
          "Seeking a creative design leader to own end-to-end design systems, high-converting agency client projects, and intuitive SaaS workflows.",
        requirements:
          "Expertise in Figma, modern design systems, typography, interaction design, and design handoff.",
        benefits: "MacBook Pro M3, annual design conference passes, health cover.",
      },
    });

    const job3 = await prisma.hrmsJobOpening.create({
      data: {
        title: "Digital Growth & Performance Marketer",
        code: "JOB-2026-003",
        department: "Marketing",
        location: "Gurugram HQ",
        employmentType: "FULL_TIME",
        status: "ACTIVE",
        openingsCount: 2,
        experienceMin: 3,
        experienceMax: 6,
        salaryMin: 1000000,
        salaryMax: 1600000,
        currency: "INR",
        description:
          "Drive client revenue and agency brand visibility through paid media, organic SEO campaigns, analytics, and creative storytelling.",
      },
    });

    // Populate realistic candidates across stages
    const candidateAarav = await prisma.hrmsCandidate.create({
      data: {
        name: "Aarav Sharma",
        email: "aarav.sharma@example.com",
        phone: "+91 98765 43210",
        currentCompany: "Zeta Technologies",
        currentTitle: "Senior Software Engineer",
        experienceYears: 5.5,
        currentSalary: 1400000,
        expectedSalary: 1900000,
        noticePeriodDays: 30,
        source: "LINKEDIN",
        city: "Bengaluru",
        state: "Karnataka",
        rating: 5,
        tags: "Next.js, Node.js, Prisma, Fast Learner",
      },
    });

    const candidatePriya = await prisma.hrmsCandidate.create({
      data: {
        name: "Priya Sundaram",
        email: "priya.sundaram@example.com",
        phone: "+91 98111 22334",
        currentCompany: "Studio Pixel",
        currentTitle: "Product Designer",
        experienceYears: 6.0,
        currentSalary: 1600000,
        expectedSalary: 2200000,
        noticePeriodDays: 15,
        source: "REFERRAL",
        city: "Mumbai",
        state: "Maharashtra",
        rating: 5,
        tags: "Design Systems, Figma, Animation",
      },
    });

    const candidateRohan = await prisma.hrmsCandidate.create({
      data: {
        name: "Rohan Verma",
        email: "rohan.verma@example.com",
        phone: "+91 97222 33445",
        currentCompany: "AdGrowth Agency",
        currentTitle: "Performance Marketing Lead",
        experienceYears: 4.2,
        currentSalary: 1100000,
        expectedSalary: 1500000,
        noticePeriodDays: 30,
        source: "JOB_BOARD",
        city: "Gurugram",
        state: "Haryana",
        rating: 4,
        tags: "Meta Ads, Google Ads, GA4",
      },
    });

    const candidateAnanya = await prisma.hrmsCandidate.create({
      data: {
        name: "Ananya Iyer",
        email: "ananya.iyer@example.com",
        phone: "+91 99333 44556",
        currentCompany: "FinTech Labs",
        currentTitle: "Frontend Developer",
        experienceYears: 3.5,
        currentSalary: 1000000,
        expectedSalary: 1400000,
        noticePeriodDays: 60,
        source: "CAREER_SITE",
        city: "Chennai",
        state: "Tamil Nadu",
        rating: 4,
        tags: "React, Tailwind, TypeScript",
      },
    });

    // Create applications linked to pipeline stages
    const appAarav = await prisma.hrmsApplication.create({
      data: {
        candidateId: candidateAarav.id,
        jobOpeningId: job1.id,
        stage: "Offer Sent",
        status: "IN_PROGRESS",
        rating: 5,
        notes: "Excellent technical assessment and system design clearance.",
      },
    });

    const appPriya = await prisma.hrmsApplication.create({
      data: {
        candidateId: candidatePriya.id,
        jobOpeningId: job2.id,
        stage: "Interview Scheduled",
        status: "IN_PROGRESS",
        rating: 5,
        notes: "Outstanding portfolio presentation.",
      },
    });

    const appRohan = await prisma.hrmsApplication.create({
      data: {
        candidateId: candidateRohan.id,
        jobOpeningId: job3.id,
        stage: "Shortlisted",
        status: "IN_PROGRESS",
        rating: 4,
      },
    });

    const appAnanya = await prisma.hrmsApplication.create({
      data: {
        candidateId: candidateAnanya.id,
        jobOpeningId: job1.id,
        stage: "Applied",
        status: "IN_PROGRESS",
        rating: 3,
      },
    });

    // Add activity records
    await prisma.hrmsCandidateActivity.create({
      data: {
        candidateId: candidateAarav.id,
        applicationId: appAarav.id,
        action: "STAGE_CHANGE",
        fromStage: "Selected",
        toStage: "Offer Sent",
        title: "Offer Letter Sent",
        notes: "Offer letter generated and dispatched for Aarav Sharma.",
      },
    });

    // Create an Interview for Priya
    const interviewDate = new Date();
    interviewDate.setDate(interviewDate.getDate() + 1);
    await prisma.hrmsInterview.create({
      data: {
        applicationId: appPriya.id,
        candidateId: candidatePriya.id,
        jobOpeningId: job2.id,
        title: "Design System & Portfolio Deep-Dive",
        roundNumber: 2,
        type: "ONLINE",
        status: "SCHEDULED",
        scheduledDate: interviewDate,
        startTime: "15:00",
        endTime: "16:00",
        timeZone: "Asia/Kolkata",
        meetingLink: "https://meet.google.com/dez-des-lead",
        instructions: "Please present your Figma design system workflow and case study.",
      },
    });

    // Create an Offer for Aarav
    const offerTemplate = await prisma.hrmsOfferTemplate.findFirst({
      where: { status: "ACTIVE" },
    });

    const joiningDate = new Date();
    joiningDate.setDate(joiningDate.getDate() + 20);
    const validityDate = new Date();
    validityDate.setDate(validityDate.getDate() + 7);

    const offerAarav = await prisma.hrmsOffer.create({
      data: {
        offerNumber: "OFF-2026-0001",
        applicationId: appAarav.id,
        candidateId: candidateAarav.id,
        jobOpeningId: job1.id,
        templateId: offerTemplate?.id,
        letterheadId: defaultLetterhead?.id,
        jobTitle: "Senior Full Stack Engineer",
        department: "Engineering",
        employmentType: "FULL_TIME",
        workLocation: "Bengaluru HQ (Hybrid)",
        joiningDate: joiningDate,
        probationPeriodMonths: 3,
        validityDate: validityDate,
        annualCtc: 1800000,
        monthlyGross: 150000,
        status: "SENT",
        version: 1,
        additionalTerms:
          "Standard employment terms apply. Includes group mediclaim policy up to ₹5,00,000.",
      },
    });

    // Create Onboarding record for candidate awaiting onboarding
    const candidateKaran = await prisma.hrmsCandidate.create({
      data: {
        name: "Karan Johar",
        email: "karan.johar.dev@example.com",
        phone: "+91 99887 66554",
        currentCompany: "TechSpire",
        currentTitle: "React Specialist",
        experienceYears: 4.0,
        currentSalary: 1200000,
        expectedSalary: 1600000,
        noticePeriodDays: 0,
        source: "DIRECT",
        city: "Bengaluru",
        state: "Karnataka",
        rating: 5,
        tags: "React, Redux, Performance",
      },
    });

    const appKaran = await prisma.hrmsApplication.create({
      data: {
        candidateId: candidateKaran.id,
        jobOpeningId: job1.id,
        stage: "Onboarding",
        status: "HIRED",
        rating: 5,
      },
    });

    const joiningDateKaran = new Date();
    joiningDateKaran.setDate(joiningDateKaran.getDate() + 5);

    await prisma.hrmsOnboarding.create({
      data: {
        candidateId: candidateKaran.id,
        jobOpeningId: job1.id,
        status: "IN_PROGRESS",
        joiningDate: joiningDateKaran,
        checklistJson: JSON.stringify([
          { id: "1", task: "Collect signed offer letter & signed NDA", category: "Documentation", done: true },
          { id: "2", task: "Verify Government ID (Aadhaar & PAN)", category: "Documentation", done: true },
          { id: "3", task: "Collect past employment relieving letters & payslips", category: "Documentation", done: true },
          { id: "4", task: "Collect bank account details & cancelled cheque", category: "Documentation", done: false },
          { id: "5", task: "Provision corporate email (@agency.com) & Slack workspace", category: "IT Setup", done: true },
          { id: "6", task: "Issue company laptop & configure security tools", category: "IT Setup", done: false },
          { id: "7", task: "Agency HR orientation & policies walkthrough", category: "HR Orientation", done: false },
        ]),
      },
    });
  }
}
