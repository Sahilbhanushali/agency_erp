/**
 * Comprehensive Dummy Data Seeder for itsmeDezino Agency ERP
 *
 * Seeds realistic dummy data across ALL modules in the application:
 *   1. RBAC: Permissions, Roles, RolePermissions
 *   2. Users & Staff: Admin, Manager, Team Lead, Designers, Writer, SMM (with full HR data)
 *   3. HR & Ops: User Documents, SMTP Details, Invites, Password Resets
 *   4. Utilities: Platform lookups, Post Types, Content Categories, Departments
 *   5. Billing Entities: Multiple Company legal entities (GST, PAN, Bank Accounts)
 *   6. Clients: Diverse B2B/B2C brands with complete statutory and contact details
 *   7. Credentials Vault: Encrypted social media credentials
 *   8. Projects & Strategies: Active client campaigns & monthly strategy targets
 *   9. Festivals: Indian & international festival calendar
 *  10. Content & Posts: Posts across all platforms, types, and workflow statuses
 *  11. Production Assets & Comments: Creatives, reference assets, internal reviews
 *  12. Workflow & Approvals: ApprovalFlows, Audio/Visual Attachments, ApprovalHistory trails
 *  13. Team Tasks & Assignments: Post assignments across production stages
 *  14. Performance Metrics: Designer and Writer metrics for reports
 *  15. Public Share Links: ExportLinks for unauthenticated client sign-offs
 *  16. Finance: Quotations & Quotation Lines across all lifecycle states
 *  17. Invoicing & Billing: Invoices, Line Items, and Payments (bank transfer, UPI)
 *  18. Legal: Retainer contracts, SOWs, MSAs, NDAs with deliverable quotas
 *  19. CRM Pipeline: Leads across all stages with lead activity logs
 *  20. Production & Events: Video / photography shoot events
 *  21. System Feed: In-app notifications, Audit logs, Task logs, User activity streams
 *
 * Run with:
 *   npm run db:seed
 */

import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"
import crypto from "crypto"

const prisma = new PrismaClient()

// Encryption helper matching lib/encryption.ts
const ALGORITHM = "aes-256-cbc"
const SECRET_KEY = crypto
  .createHash("sha256")
  .update(String(process.env.NEXTAUTH_SECRET || "fallback-secret-key-for-dev-only-32"))
  .digest("base64")
  .substring(0, 32)

function encryptText(text) {
  if (!text) return text
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(SECRET_KEY), iv)
  let encrypted = cipher.update(text)
  encrypted = Buffer.concat([encrypted, cipher.final()])
  return iv.toString("hex") + ":" + encrypted.toString("hex")
}

// Financial calculations helper matching lib/finance.ts
const round2 = (val) => Math.round(Number((val * 100).toFixed(4))) / 100

function computeTotals(lineItems, discountPercent = 0, taxPercent = 18, taxType = "CGST_SGST") {
  const subtotal = round2(
    lineItems.reduce((sum, line) => sum + round2(line.quantity * line.unitPrice), 0),
  )
  const discountAmount = round2((subtotal * discountPercent) / 100)
  const taxableAmount = round2(subtotal - discountAmount)
  const taxAmount = round2((taxableAmount * taxPercent) / 100)
  const half = round2(taxAmount / 2)
  const isSplit = taxType === "CGST_SGST"

  return {
    subtotal,
    discountAmount,
    taxableAmount,
    cgst: isSplit ? half : 0,
    sgst: isSplit ? round2(taxAmount - half) : 0,
    igst: isSplit ? 0 : taxAmount,
    taxAmount,
    totalAmount: round2(taxableAmount + taxAmount),
  }
}

// Every permission checked in the codebase
const PERMISSIONS = [
  ["Manage-User", "Create, edit and remove users and their roles"],
  ["Manage-settings", "Change application settings, roles and permissions"],
  ["Manage-clients", "Create, edit and remove clients"],
  ["View-clients", "View the client list and client details"],
  ["Manage-projects", "Create, edit and remove projects"],
  ["View-project", "View a project and its details"],
  ["Manage-post", "Create, edit and remove posts"],
  ["View-post", "View an individual post"],
  ["View-posts", "View the post list"],
  ["Manage-content", "Write and edit post content and captions"],
  ["Manage-design", "Upload and manage design work on posts"],
  ["Manage-approvals", "Approve or reject submitted work"],
  ["Manage-assets", "Upload, replace and delete assets"],
  ["View-assets", "View and download assets"],
  ["Manage-festival", "Create and edit festivals"],
  ["View-festivals", "View the festival calendar"],
  ["View-calender", "View the content calendar"],
  ["View-tasks", "View assigned tasks"],
  ["View-reports", "View reports and analytics"],
  ["View-utilities", "View utility lists"],
  ["Manage-companies", "Create, edit and remove billing companies"],
  ["View-companies", "View billing companies and their details"],
  ["Manage-quotations", "Create, edit, send and delete quotations"],
  ["View-quotations", "View quotations and their totals"],
  ["Manage-invoices", "Create, edit, send and delete invoices, and record payments"],
  ["View-invoices", "View invoices, payments and balances"],
]

async function cleanPreviousData() {
  console.log("🧹  Cleaning previous records to ensure a fresh, consistent seed state...")

  // Delete child/dependent relations first
  await prisma.payment.deleteMany({})
  await prisma.invoiceLine.deleteMany({})
  await prisma.invoice.deleteMany({})
  await prisma.quotationLine.deleteMany({})
  await prisma.quotation.deleteMany({})
  await prisma.contract.deleteMany({})
  await prisma.leadActivity.deleteMany({})
  await prisma.lead.deleteMany({})
  await prisma.approvalAttachment.deleteMany({})
  await prisma.approvalHistory.deleteMany({})
  await prisma.approvalFlow.deleteMany({})
  await prisma.postAssignment.deleteMany({})
  await prisma.taskLog.deleteMany({})
  await prisma.userActivity.deleteMany({})
  await prisma.auditLog.deleteMany({})
  await prisma.notification.deleteMany({})
  await prisma.comment.deleteMany({})
  await prisma.asset.deleteMany({})
  await prisma.postPlatform.deleteMany({})
  await prisma.post.deleteMany({})
  await prisma.projectStrategy.deleteMany({})
  await prisma.credential.deleteMany({})
  await prisma.exportLink.deleteMany({})
  await prisma.project.deleteMany({})
  await prisma.client.deleteMany({})
  await prisma.company.deleteMany({})
  await prisma.festival.deleteMany({})
  await prisma.shootEvent.deleteMany({})
  await prisma.userMetrics.deleteMany({})
  await prisma.userDocument.deleteMany({})
  await prisma.passwordReset.deleteMany({})
  await prisma.invite.deleteMany({})
  await prisma.utility.deleteMany({})
  await prisma.smtpDetails.deleteMany({})

  // Remove non-admin seeded users
  await prisma.user.deleteMany({
    where: {
      email: {
        not: "admin@gmail.com",
      },
    },
  })

  console.log("✓ Previous data cleaned successfully.")
}

async function main() {
  console.log("🌱  Starting itsmeDezino Agency ERP Dummy Data Seeder...\n")

  // Step 0: Clean existing tables so seed is 100% idempotent and consistent
  await cleanPreviousData()

  // ---------------------------------------------------------------------------
  // 1. PERMISSIONS & ROLES
  // ---------------------------------------------------------------------------
  console.log("\n📦  [1/15] Seeding Permissions & Roles...")
  for (const [name, description] of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { name },
      update: { description },
      create: { name, description },
    })
  }
  const allPermissions = await prisma.permission.findMany({ select: { id: true, name: true } })
  const permMap = Object.fromEntries(allPermissions.map((p) => [p.name, p.id]))

  // Define core agency roles
  const rolesData = [
    {
      name: "ADMIN",
      description: "Full system administration access across all modules",
      permissions: allPermissions.map((p) => p.id),
    },
    {
      name: "Manager",
      description: "Project management, client handling, approvals, billing & reports",
      permissions: [
        permMap["Manage-clients"],
        permMap["View-clients"],
        permMap["Manage-projects"],
        permMap["View-project"],
        permMap["Manage-post"],
        permMap["View-post"],
        permMap["View-posts"],
        permMap["Manage-content"],
        permMap["Manage-design"],
        permMap["Manage-approvals"],
        permMap["Manage-assets"],
        permMap["View-assets"],
        permMap["Manage-festival"],
        permMap["View-festivals"],
        permMap["View-calender"],
        permMap["View-tasks"],
        permMap["View-reports"],
        permMap["View-utilities"],
        permMap["Manage-companies"],
        permMap["View-companies"],
        permMap["Manage-quotations"],
        permMap["View-quotations"],
        permMap["Manage-invoices"],
        permMap["View-invoices"],
      ],
    },
    {
      name: "Team Lead",
      description: "Design lead & creative director overseeing approvals and assignments",
      permissions: [
        permMap["View-clients"],
        permMap["View-project"],
        permMap["Manage-projects"],
        permMap["Manage-post"],
        permMap["View-post"],
        permMap["View-posts"],
        permMap["Manage-design"],
        permMap["Manage-approvals"],
        permMap["Manage-assets"],
        permMap["View-assets"],
        permMap["View-festivals"],
        permMap["View-calender"],
        permMap["View-tasks"],
        permMap["View-reports"],
      ],
    },
    {
      name: "Designer",
      description: "Graphic and visual designer responsible for post creatives",
      permissions: [
        permMap["View-project"],
        permMap["View-post"],
        permMap["View-posts"],
        permMap["Manage-design"],
        permMap["Manage-assets"],
        permMap["View-assets"],
        permMap["View-calender"],
        permMap["View-tasks"],
      ],
    },
    {
      name: "Content Writer",
      description: "Copywriter and content strategist for captions, copy and write-ups",
      permissions: [
        permMap["View-project"],
        permMap["View-post"],
        permMap["View-posts"],
        permMap["Manage-content"],
        permMap["View-festivals"],
        permMap["View-calender"],
        permMap["View-tasks"],
      ],
    },
    {
      name: "Social Media Manager",
      description: "Scheduling, platform publishing, calendar curation, and reports",
      permissions: [
        permMap["View-project"],
        permMap["Manage-post"],
        permMap["View-post"],
        permMap["View-posts"],
        permMap["View-festivals"],
        permMap["View-calender"],
        permMap["View-tasks"],
        permMap["View-reports"],
        permMap["View-assets"],
      ],
    },
    {
      name: "Client",
      description: "Client portal viewer for project progress and campaign preview",
      permissions: [permMap["View-project"], permMap["View-posts"], permMap["View-calender"]],
    },
  ]

  const roles = {}
  for (const r of rolesData) {
    const createdRole = await prisma.role.upsert({
      where: { name: r.name },
      update: { description: r.description },
      create: { name: r.name, description: r.description },
    })
    roles[r.name] = createdRole

    // Assign role permissions
    await prisma.rolePermission.deleteMany({ where: { roleId: createdRole.id } })
    await prisma.rolePermission.createMany({
      data: r.permissions.map((pId) => ({ roleId: createdRole.id, permissionId: pId })),
      skipDuplicates: true,
    })
  }

  // Also support uppercase role aliases if code checks uppercase names
  for (const [canonical, upperName] of [
    ["Manager", "MANAGER"],
    ["Team Lead", "TEAM_LEAD"],
    ["Designer", "DESIGNER"],
    ["Content Writer", "CONTENT_WRITER"],
    ["Social Media Manager", "SOCIAL_MEDIA_MANAGER"],
  ]) {
    await prisma.role.upsert({
      where: { name: upperName },
      update: { description: `Alias for ${canonical}` },
      create: { name: upperName, description: `Alias for ${canonical}` },
    })
  }

  console.log(`✓ Seeded ${allPermissions.length} permissions and ${Object.keys(roles).length} roles`)

  // ---------------------------------------------------------------------------
  // 2. USERS & HR PROFILES
  // ---------------------------------------------------------------------------
  console.log("\n👤  [2/15] Seeding Users with Complete HR Profiles...")

  const defaultPasswordHash = await bcrypt.hash("password123", 10)
  const adminPasswordHash = await bcrypt.hash("admin123", 10)

  const usersData = [
    {
      email: "admin@gmail.com",
      name: "System Admin",
      role: roles["ADMIN"],
      password: adminPasswordHash,
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
      joiningDate: new Date("2023-01-01"),
      designation: "Managing Director",
      department: "Executive Leadership",
      currentSalary: 180000.0,
      phone: "+91 98200 00001",
      personalEmail: "director@dezino.com",
      address: "1401, Tower 2, Oberoi Sky City, Borivali East, Mumbai, Maharashtra 400066",
      panNumber: "AABPA1234F",
      aadhaarNumber: "987654321012",
      bankName: "HDFC Bank Ltd.",
      bankAccountNumber: "50100012345678",
      bankIfsc: "HDFC0000240",
      emergencyContactName: "Pooja Admin",
      emergencyContactPhone: "+91 98200 00002",
      emergencyContactRelation: "Spouse",
    },
    {
      email: "sarah.pm@dezino.com",
      name: "Sarah Jenkins",
      role: roles["Manager"],
      password: defaultPasswordHash,
      avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80",
      joiningDate: new Date("2023-06-15"),
      designation: "Senior Project & Client Operations Manager",
      department: "Client Operations",
      currentSalary: 95000.0,
      phone: "+91 98201 11223",
      personalEmail: "sarah.jenkins.personal@gmail.com",
      address: "B-402, Sea Green Apartments, Bandra West, Mumbai, Maharashtra 400050",
      panNumber: "BCDPJ5678G",
      aadhaarNumber: "876543210987",
      bankName: "HDFC Bank Ltd.",
      bankAccountNumber: "50100023456789",
      bankIfsc: "HDFC0000240",
      emergencyContactName: "David Jenkins",
      emergencyContactPhone: "+91 98201 11224",
      emergencyContactRelation: "Brother",
    },
    {
      email: "arjun.lead@dezino.com",
      name: "Arjun Kapoor",
      role: roles["Team Lead"],
      password: defaultPasswordHash,
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
      joiningDate: new Date("2023-08-01"),
      designation: "Creative Director & Design Lead",
      department: "Creative & Design",
      currentSalary: 110000.0,
      phone: "+91 98111 22334",
      personalEmail: "arjun.kapoor.design@gmail.com",
      address: "Plot 89, Indiranagar 12th Main, Bengaluru, Karnataka 560038",
      panNumber: "CDEPK9012H",
      aadhaarNumber: "765432109876",
      bankName: "ICICI Bank Ltd.",
      bankAccountNumber: "000205009876",
      bankIfsc: "ICIC0000002",
      emergencyContactName: "Sunita Kapoor",
      emergencyContactPhone: "+91 98111 22335",
      emergencyContactRelation: "Mother",
    },
    {
      email: "priya.design@dezino.com",
      name: "Priya Sharma",
      role: roles["Designer"],
      password: defaultPasswordHash,
      avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80",
      joiningDate: new Date("2024-02-10"),
      designation: "Senior Visual & Brand Designer",
      department: "Design & Production",
      currentSalary: 72000.0,
      phone: "+91 98333 44556",
      personalEmail: "priya.sharma.creatives@gmail.com",
      address: "Flat 204, Green Heights, Andheri East, Mumbai, Maharashtra 400069",
      panNumber: "DEFPS3456J",
      aadhaarNumber: "654321098765",
      bankName: "Kotak Mahindra Bank",
      bankAccountNumber: "234567890123",
      bankIfsc: "KKBK0000654",
      emergencyContactName: "Rohan Sharma",
      emergencyContactPhone: "+91 98333 44557",
      emergencyContactRelation: "Spouse",
    },
    {
      email: "rohit.motion@dezino.com",
      name: "Rohit Verma",
      role: roles["Designer"],
      password: defaultPasswordHash,
      avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80",
      joiningDate: new Date("2024-04-01"),
      designation: "Motion Graphics & 3D Specialist",
      department: "Animation & Video",
      currentSalary: 68000.0,
      phone: "+91 98450 55667",
      personalEmail: "rohit.verma.fx@gmail.com",
      address: "12, Koramangala 4th Block, Bengaluru, Karnataka 560034",
      panNumber: "EFGPV7890K",
      aadhaarNumber: "543210987654",
      bankName: "State Bank of India",
      bankAccountNumber: "30987654321",
      bankIfsc: "SBIN0000853",
      emergencyContactName: "Kavita Verma",
      emergencyContactPhone: "+91 98450 55668",
      emergencyContactRelation: "Sister",
    },
    {
      email: "ananya.content@dezino.com",
      name: "Ananya Sen",
      role: roles["Content Writer"],
      password: defaultPasswordHash,
      avatar: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150&auto=format&fit=crop&q=80",
      joiningDate: new Date("2024-03-15"),
      designation: "Lead Copywriter & Content Strategist",
      department: "Content & Strategy",
      currentSalary: 64000.0,
      phone: "+91 98711 66778",
      personalEmail: "ananya.sen.words@gmail.com",
      address: "703, Cyber City Residences, DLF Phase 2, Gurugram, Haryana 122002",
      panNumber: "FGHPS1234L",
      aadhaarNumber: "432109876543",
      bankName: "Axis Bank Ltd.",
      bankAccountNumber: "918010023456789",
      bankIfsc: "UTIB0000045",
      emergencyContactName: "Subhash Sen",
      emergencyContactPhone: "+91 98711 66779",
      emergencyContactRelation: "Father",
    },
    {
      email: "vikram.smm@dezino.com",
      name: "Vikram Patel",
      role: roles["Social Media Manager"],
      password: defaultPasswordHash,
      avatar: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80",
      joiningDate: new Date("2024-05-01"),
      designation: "Senior Social Media & Community Manager",
      department: "Social Media",
      currentSalary: 60000.0,
      phone: "+91 98990 77889",
      personalEmail: "vikram.patel.smm@gmail.com",
      address: "C-12, Aundh Road, Pune, Maharashtra 411007",
      panNumber: "GHI PV5678M",
      aadhaarNumber: "321098765432",
      bankName: "HDFC Bank Ltd.",
      bankAccountNumber: "50100034567890",
      bankIfsc: "HDFC0000039",
      emergencyContactName: "Meena Patel",
      emergencyContactPhone: "+91 98990 77890",
      emergencyContactRelation: "Mother",
    },
    {
      email: "rahul.sharma@acmetech.com",
      name: "Rahul Sharma (Client VP)",
      role: roles["Client"],
      password: defaultPasswordHash,
      avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80",
      joiningDate: null,
      designation: "VP Marketing",
      department: "External Client",
      currentSalary: null,
      phone: "+91 98201 11222",
      personalEmail: "rahul@acmecloud.io",
      address: "Acme Tech Park, Outer Ring Road, Bengaluru 560103",
    },
  ]

  const users = {}
  for (const u of usersData) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {
        name: u.name,
        roleId: u.role.id,
        avatar: u.avatar,
        joiningDate: u.joiningDate,
        designation: u.designation,
        department: u.department,
        currentSalary: u.currentSalary,
        salaryFrequency: "MONTHLY",
        employmentType: "FULL_TIME",
        phone: u.phone,
        personalEmail: u.personalEmail,
        address: u.address,
        panNumber: u.panNumber,
        aadhaarNumber: u.aadhaarNumber,
        bankName: u.bankName,
        bankAccountNumber: u.bankAccountNumber,
        bankIfsc: u.bankIfsc,
        emergencyContactName: u.emergencyContactName,
        emergencyContactPhone: u.emergencyContactPhone,
        emergencyContactRelation: u.emergencyContactRelation,
      },
      create: {
        email: u.email,
        name: u.name,
        password: u.password,
        roleId: u.role.id,
        avatar: u.avatar,
        joiningDate: u.joiningDate,
        designation: u.designation,
        department: u.department,
        currentSalary: u.currentSalary,
        salaryFrequency: "MONTHLY",
        employmentType: "FULL_TIME",
        phone: u.phone,
        personalEmail: u.personalEmail,
        address: u.address,
        panNumber: u.panNumber,
        aadhaarNumber: u.aadhaarNumber,
        bankName: u.bankName,
        bankAccountNumber: u.bankAccountNumber,
        bankIfsc: u.bankIfsc,
        emergencyContactName: u.emergencyContactName,
        emergencyContactPhone: u.emergencyContactPhone,
        emergencyContactRelation: u.emergencyContactRelation,
      },
    })
    users[u.email] = user
  }

  // ---------------------------------------------------------------------------
  // 3. USER DOCUMENTS, SMTP & SYSTEM SETTINGS
  // ---------------------------------------------------------------------------
  console.log("📄  [3/15] Seeding User Documents & System SMTP...")

  // HR Documents for staff members
  const staffDocs = [
    {
      userId: users["priya.design@dezino.com"].id,
      title: "Offer Letter - Priya Sharma",
      category: "OFFER_LETTER",
      fileName: "Offer_Letter_Priya_Sharma_2024.pdf",
      fileUrl: "/uploads/documents/offer_priya.pdf",
      fileSize: 420150,
      fileType: "application/pdf",
      notes: "Signed acceptance received on Feb 5, 2024",
    },
    {
      userId: users["priya.design@dezino.com"].id,
      title: "PAN & Identity Verification",
      category: "ID_PROOF",
      fileName: "PAN_Priya_Sharma.pdf",
      fileUrl: "/uploads/documents/pan_priya.pdf",
      fileSize: 180240,
      fileType: "application/pdf",
      notes: "Verified against NSDL database",
    },
    {
      userId: users["arjun.lead@dezino.com"].id,
      title: "Creative Director Employment Agreement",
      category: "CONTRACT",
      fileName: "Employment_Agreement_Arjun_Kapoor.pdf",
      fileUrl: "/uploads/documents/contract_arjun.pdf",
      fileSize: 680450,
      fileType: "application/pdf",
      notes: "Three-year standard lock-in agreement with IP assignment",
    },
    {
      userId: users["ananya.content@dezino.com"].id,
      title: "September 2026 Salary Slip",
      category: "SALARY_SLIP",
      fileName: "Payslip_Sep2026_Ananya_Sen.pdf",
      fileUrl: "/uploads/documents/payslip_sep_ananya.pdf",
      fileSize: 120500,
      fileType: "application/pdf",
      notes: "Direct deposit transferred to Axis Bank",
    },
  ]

  for (const doc of staffDocs) {
    await prisma.userDocument.create({ data: doc })
  }

  // System SMTP configuration
  await prisma.smtpDetails.upsert({
    where: { userId: users["admin@gmail.com"].id },
    update: {
      host: "smtp.gmail.com",
      port: 587,
      username: "notifications@itsmedezino.com",
      password: encryptText("app-password-dezino-2026"),
      encryption: "TLS",
      isActive: true,
      isVerified: true,
    },
    create: {
      userId: users["admin@gmail.com"].id,
      host: "smtp.gmail.com",
      port: 587,
      username: "notifications@itsmedezino.com",
      password: encryptText("app-password-dezino-2026"),
      encryption: "TLS",
      isActive: true,
      isVerified: true,
    },
  })

  // Team invite tokens & password reset sample
  await prisma.invite.upsert({
    where: { token: "invite_token_intern_video_2026" },
    update: {},
    create: {
      email: "intern.video@dezino.com",
      token: "invite_token_intern_video_2026",
      role: "Designer",
      expiresAt: new Date(Date.now() + 14 * 86400000),
      invitedBy: users["sarah.pm@dezino.com"].id,
    },
  })

  await prisma.passwordReset.upsert({
    where: { token: "reset_token_priya_2026_sample" },
    update: {},
    create: {
      email: "priya.design@dezino.com",
      token: "reset_token_priya_2026_sample",
      expiresAt: new Date(Date.now() + 86400000),
    },
  })

  // ---------------------------------------------------------------------------
  // 4. UTILITIES & SYSTEM CONSTANTS
  // ---------------------------------------------------------------------------
  console.log("🛠️   [4/15] Seeding Utilities (Platforms, Post Types, Content Categories)...")

  const utilitiesData = [
    {
      name: "Social Media Platforms",
      type: "PLATFORM",
      values: [
        "INSTAGRAM",
        "FACEBOOK",
        "TWITTER",
        "LINKEDIN",
        "THREADS",
        "YOUTUBE",
        "IGTV",
        "GMB",
        "PINTEREST",
      ],
    },
    {
      name: "Content Deliverable Types",
      type: "POST_TYPE",
      values: ["PHOTO", "REEL", "STORY", "CAROUSEL", "CUSTOM", "BLOG", "VIDEO", "POST"],
    },
    {
      name: "Strategic Content Pillars",
      type: "CONTENT_CATEGORY",
      values: [
        "Product Showcase",
        "Behind The Scenes",
        "Educational & How-To",
        "Customer Testimonial",
        "Industry Trends",
        "Festive & Celebration",
        "Thought Leadership",
        "Meme / Relatable Culture",
      ],
    },
    {
      name: "Agency Operational Departments",
      type: "DEPARTMENT",
      values: [
        "Executive Leadership",
        "Client Operations",
        "Creative & Design",
        "Content & Strategy",
        "Animation & Video",
        "Social Media & Community",
        "Finance & Billing",
      ],
    },
  ]

  for (const util of utilitiesData) {
    await prisma.utility.create({ data: util })
  }

  // ---------------------------------------------------------------------------
  // 5. BILLING COMPANIES (Legal Entities)
  // ---------------------------------------------------------------------------
  console.log("🏢  [5/15] Seeding Billing Companies (Agency Legal Entities)...")

  const companiesData = [
    {
      id: "comp_dezino_media",
      name: "itsmeDezino Digital Media Pvt. Ltd.",
      legalName: "itsmeDezino Digital Media Private Limited",
      email: "finance@itsmedezino.com",
      phone: "+91 22 4567 8900",
      website: "https://itsmedezino.com",
      logo: "/logo.png",
      gstNumber: "27AABCI1234F1Z5",
      panNumber: "AABCI1234F",
      hsnNumber: "998311",
      bankName: "HDFC Bank Ltd.",
      bankAccountName: "itsmeDezino Digital Media Pvt Ltd",
      bankAccountNumber: "50200034821943",
      bankIfsc: "HDFC0000240",
      bankBranch: "Goregaon East, Mumbai",
      addressLine1: "Suite 402, Lotus Corporate Park",
      addressLine2: "Western Express Highway, Goregaon East",
      city: "Mumbai",
      state: "Maharashtra",
      postalCode: "400063",
      country: "India",
      currency: "INR",
      isActive: true,
      notes: "Primary operating company for social media retainers, marketing campaigns, and ad production.",
    },
    {
      id: "comp_dezino_studio",
      name: "Dezino Creative Studio LLP",
      legalName: "Dezino Creative Studio Limited Liability Partnership",
      email: "studio.accounts@itsmedezino.com",
      phone: "+91 80 2345 6789",
      website: "https://studio.itsmedezino.com",
      logo: "/logo.png",
      gstNumber: "29AABCI5678F1Z8",
      panNumber: "AABCI5678F",
      hsnNumber: "998313",
      bankName: "ICICI Bank Ltd.",
      bankAccountName: "Dezino Creative Studio LLP",
      bankAccountNumber: "000205001234",
      bankIfsc: "ICIC0000002",
      bankBranch: "Indiranagar, Bengaluru",
      addressLine1: "3rd Floor, 100ft Road",
      addressLine2: "HAL 2nd Stage, Indiranagar",
      city: "Bengaluru",
      state: "Karnataka",
      postalCode: "560038",
      country: "India",
      currency: "INR",
      isActive: true,
      notes: "Creative studio entity handling branding sprints, 3D CGI, and video shoot productions.",
    },
  ]

  const companies = {}
  for (const c of companiesData) {
    const comp = await prisma.company.upsert({
      where: { id: c.id },
      update: c,
      create: c,
    })
    companies[c.id] = comp
  }

  // ---------------------------------------------------------------------------
  // 6. CLIENTS
  // ---------------------------------------------------------------------------
  console.log("🤝  [6/15] Seeding Clients...")

  const clientsData = [
    {
      id: "client_acme_cloud",
      name: "Acme Cloud Technologies",
      email: "contact@acmecloud.io",
      phone: "+91 98201 11222",
      company: "Acme Cloud Technologies Pvt Ltd",
      website: "https://acmecloud.io",
      industry: "SaaS & Cloud DevOps",
      status: "ACTIVE",
      address: "Building 4B, EcoWorld SEZ, Outer Ring Road",
      city: "Bengaluru",
      state: "Karnataka",
      country: "India",
      postalCode: "560103",
      gstin: "29AAACA1111A1Z1",
      panNumber: "AAACA1111A",
      notes: "Series-B B2B SaaS platform. Focus on LinkedIn thought leadership, technical carousels and case studies.",
      avatar: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=80",
    },
    {
      id: "client_aurelia_luxe",
      name: "Aurelia Luxe Apparel",
      email: "hello@aurelialuxe.in",
      phone: "+91 98112 22333",
      company: "Aurelia Luxe Retail Ltd",
      website: "https://aurelialuxe.in",
      industry: "Fashion & Luxury E-Commerce",
      status: "ACTIVE",
      address: "12/A, Palladium Mall, High Street Phoenix, Lower Parel",
      city: "Mumbai",
      state: "Maharashtra",
      country: "India",
      postalCode: "400013",
      gstin: "27AAACA2222B1Z2",
      panNumber: "AAACA2222B",
      notes: "High-end ethnic & contemporary festive apparel. Reels, lookbooks and model photography.",
      avatar: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=150&auto=format&fit=crop&q=80",
    },
    {
      id: "client_urbanbite",
      name: "UrbanBite Kitchen & Bistro",
      email: "partnerships@urbanbite.co",
      phone: "+91 98334 44555",
      company: "UrbanBite Hospitality Chains",
      website: "https://urbanbite.co",
      industry: "Food & Beverage / QSR",
      status: "ACTIVE",
      address: "Shop 4, Pali Hill Road, Bandra West",
      city: "Mumbai",
      state: "Maharashtra",
      country: "India",
      postalCode: "400050",
      gstin: "27AAACA3333C1Z3",
      panNumber: "AAACA3333C",
      notes: "Gourmet artisanal cafe chain with 6 outlets across Mumbai and Pune. High engagement reels & foodie promos.",
      avatar: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=150&auto=format&fit=crop&q=80",
    },
    {
      id: "client_novacare",
      name: "NovaCare Health & Wellness",
      email: "communications@novacare.org",
      phone: "+91 98450 66777",
      company: "NovaCare Health Group",
      website: "https://novacare.org",
      industry: "Healthcare & Diagnostics",
      status: "ACTIVE",
      address: "Tower C, Cyber Park, Sector 62",
      city: "Gurugram",
      state: "Haryana",
      country: "India",
      postalCode: "122001",
      gstin: "06AAACA4444D1Z4",
      panNumber: "AAACA4444D",
      notes: "Preventive health check-ups and diagnostic labs network. Medical infographics and doctor video snippets.",
      avatar: "https://images.unsplash.com/photo-1538108149393-fbbd81895907?w=150&auto=format&fit=crop&q=80",
    },
    {
      id: "client_apex_prime",
      name: "Apex Prime Living Developers",
      email: "marketing@apexprimeliving.com",
      phone: "+91 98711 88999",
      company: "Apex Prime Living Pvt Ltd",
      website: "https://apexprimeliving.com",
      industry: "Real Estate & Luxury Living",
      status: "ACTIVE",
      address: "Level 14, Prestige Meridian, MG Road",
      city: "Bengaluru",
      state: "Karnataka",
      country: "India",
      postalCode: "560001",
      gstin: "29AAACA5555E1Z5",
      panNumber: "AAACA5555E",
      notes: "Ultra-luxury villas & penthouses in North Bengaluru. Architectural 3D walkthroughs and VIP invitation creatives.",
      avatar: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=150&auto=format&fit=crop&q=80",
    },
    {
      id: "client_pulsefit",
      name: "PulseFit Activewear",
      email: "social@pulsefitgear.com",
      phone: "+91 98210 99000",
      company: "PulseFit Brands India LLP",
      website: "https://pulsefitgear.com",
      industry: "Fitness & Sportswear",
      status: "ACTIVE",
      address: "Plot 45, MIDC Industrial Area, Bhosari",
      city: "Pune",
      state: "Maharashtra",
      country: "India",
      postalCode: "411026",
      gstin: "27AAACA6666F1Z6",
      panNumber: "AAACA6666F",
      notes: "Performance workout apparel and gym gear. High-energy motivational reels, athlete collabs and challenge posts.",
      avatar: "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=150&auto=format&fit=crop&q=80",
    },
  ]

  const clients = {}
  for (const cl of clientsData) {
    const client = await prisma.client.upsert({
      where: { id: cl.id },
      update: cl,
      create: cl,
    })
    clients[cl.id] = client
  }

  // ---------------------------------------------------------------------------
  // 7. PROJECTS & MONTHLY STRATEGIES
  // ---------------------------------------------------------------------------
  console.log("📂  [7/15] Seeding Projects & Monthly Strategies...")

  const projectsData = [
    {
      id: "proj_acme_q4",
      name: "Acme Q4 SaaS Growth & Product Launch",
      description: "Scale organic LinkedIn pipeline, promote the new AI Observability suite, and establish founder thought leadership.",
      clientId: clients["client_acme_cloud"].id,
      managerId: users["sarah.pm@dezino.com"].id,
      startDate: new Date("2026-08-01"),
      endDate: new Date("2026-12-31"),
      isActive: true,
      image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&auto=format&fit=crop&q=80",
      postTypes: { PHOTO: 6, CAROUSEL: 4, REEL: 4, BLOG: 2 },
      assignedUserIds: [
        users["sarah.pm@dezino.com"].id,
        users["arjun.lead@dezino.com"].id,
        users["priya.design@dezino.com"].id,
        users["ananya.content@dezino.com"].id,
      ],
      strategies: [
        { month: 8, year: 2026, postTypes: { PHOTO: 6, CAROUSEL: 4, REEL: 4, BLOG: 2 }, total: 16 },
        { month: 9, year: 2026, postTypes: { PHOTO: 6, CAROUSEL: 4, REEL: 4, BLOG: 2 }, total: 16 },
        { month: 10, year: 2026, postTypes: { PHOTO: 6, CAROUSEL: 4, REEL: 4, BLOG: 2 }, total: 16 },
        { month: 11, year: 2026, postTypes: { PHOTO: 6, CAROUSEL: 4, REEL: 4, BLOG: 2 }, total: 16 },
      ],
    },
    {
      id: "proj_aurelia_festive",
      name: "Aurelia Festive & Winter Runway 2026",
      description: "Diwali, Karwa Chauth & Winter bridal collection launch across Instagram Reels and high-fashion carousels.",
      clientId: clients["client_aurelia_luxe"].id,
      managerId: users["sarah.pm@dezino.com"].id,
      startDate: new Date("2026-09-01"),
      endDate: new Date("2026-11-30"),
      isActive: true,
      image: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=600&auto=format&fit=crop&q=80",
      postTypes: { REEL: 8, CAROUSEL: 6, PHOTO: 6, STORY: 12 },
      assignedUserIds: [
        users["sarah.pm@dezino.com"].id,
        users["arjun.lead@dezino.com"].id,
        users["priya.design@dezino.com"].id,
        users["rohit.motion@dezino.com"].id,
        users["vikram.smm@dezino.com"].id,
      ],
      strategies: [
        { month: 9, year: 2026, postTypes: { REEL: 8, CAROUSEL: 6, PHOTO: 6, STORY: 12 }, total: 32 },
        { month: 10, year: 2026, postTypes: { REEL: 8, CAROUSEL: 6, PHOTO: 6, STORY: 12 }, total: 32 },
        { month: 11, year: 2026, postTypes: { REEL: 8, CAROUSEL: 6, PHOTO: 6, STORY: 12 }, total: 32 },
      ],
    },
    {
      id: "proj_urbanbite_buzz",
      name: "UrbanBite Weekend Hangout & Reel Buzz",
      description: "Drive footfall to Bandra and Pune outlets through drool-worthy food reels, weekend live music announcements, and chef stories.",
      clientId: clients["client_urbanbite"].id,
      managerId: users["sarah.pm@dezino.com"].id,
      startDate: new Date("2026-07-01"),
      endDate: new Date("2026-12-31"),
      isActive: true,
      image: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=600&auto=format&fit=crop&q=80",
      postTypes: { REEL: 10, PHOTO: 8, STORY: 15 },
      assignedUserIds: [
        users["sarah.pm@dezino.com"].id,
        users["rohit.motion@dezino.com"].id,
        users["ananya.content@dezino.com"].id,
        users["vikram.smm@dezino.com"].id,
      ],
      strategies: [
        { month: 8, year: 2026, postTypes: { REEL: 10, PHOTO: 8, STORY: 15 }, total: 33 },
        { month: 9, year: 2026, postTypes: { REEL: 10, PHOTO: 8, STORY: 15 }, total: 33 },
        { month: 10, year: 2026, postTypes: { REEL: 10, PHOTO: 8, STORY: 15 }, total: 33 },
      ],
    },
    {
      id: "proj_novacare_health",
      name: "NovaCare Preventive Health Awareness",
      description: "Educate followers on cardiovascular health, diabetes management, and seasonal wellness with doctor-backed advice.",
      clientId: clients["client_novacare"].id,
      managerId: users["sarah.pm@dezino.com"].id,
      startDate: new Date("2026-09-15"),
      endDate: new Date("2026-12-15"),
      isActive: true,
      image: "https://images.unsplash.com/photo-1505751172876-fa1923c5c528?w=600&auto=format&fit=crop&q=80",
      postTypes: { CAROUSEL: 6, PHOTO: 6, REEL: 4, BLOG: 4 },
      assignedUserIds: [
        users["sarah.pm@dezino.com"].id,
        users["priya.design@dezino.com"].id,
        users["ananya.content@dezino.com"].id,
      ],
      strategies: [
        { month: 9, year: 2026, postTypes: { CAROUSEL: 6, PHOTO: 6, REEL: 4, BLOG: 4 }, total: 20 },
        { month: 10, year: 2026, postTypes: { CAROUSEL: 6, PHOTO: 6, REEL: 4, BLOG: 4 }, total: 20 },
      ],
    },
    {
      id: "proj_apex_luxury",
      name: "Apex Towers Phase-2 Luxury Pre-Launch",
      description: "Target high-net-worth buyers with 3D architectural renders, luxury lifestyle features, and private viewing booking forms.",
      clientId: clients["client_apex_prime"].id,
      managerId: users["sarah.pm@dezino.com"].id,
      startDate: new Date("2026-10-01"),
      endDate: new Date("2027-01-31"),
      isActive: true,
      image: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=600&auto=format&fit=crop&q=80",
      postTypes: { REEL: 6, PHOTO: 8, CAROUSEL: 4 },
      assignedUserIds: [
        users["sarah.pm@dezino.com"].id,
        users["arjun.lead@dezino.com"].id,
        users["rohit.motion@dezino.com"].id,
      ],
      strategies: [
        { month: 10, year: 2026, postTypes: { REEL: 6, PHOTO: 8, CAROUSEL: 4 }, total: 18 },
        { month: 11, year: 2026, postTypes: { REEL: 6, PHOTO: 8, CAROUSEL: 4 }, total: 18 },
      ],
    },
    {
      id: "proj_pulsefit_diwali",
      name: "PulseFit Diwali Marathon & Active Challenge",
      description: "Fitness community engagement campaign featuring 21-day workout routines and festive athlete challenges.",
      clientId: clients["client_pulsefit"].id,
      managerId: users["sarah.pm@dezino.com"].id,
      startDate: new Date("2026-10-01"),
      endDate: new Date("2026-11-15"),
      isActive: true,
      image: "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=600&auto=format&fit=crop&q=80",
      postTypes: { REEL: 8, PHOTO: 6, STORY: 10 },
      assignedUserIds: [
        users["sarah.pm@dezino.com"].id,
        users["priya.design@dezino.com"].id,
        users["vikram.smm@dezino.com"].id,
      ],
      strategies: [
        { month: 10, year: 2026, postTypes: { REEL: 8, PHOTO: 6, STORY: 10 }, total: 24 },
      ],
    },
  ]

  const projects = {}
  for (const pr of projectsData) {
    const { strategies, assignedUserIds, ...prData } = pr
    const project = await prisma.project.upsert({
      where: { id: pr.id },
      update: {
        ...prData,
        assignedUsers: {
          set: assignedUserIds.map((id) => ({ id })),
        },
      },
      create: {
        ...prData,
        assignedUsers: {
          connect: assignedUserIds.map((id) => ({ id })),
        },
      },
    })
    projects[pr.id] = project

    // Seed strategies
    for (const strat of strategies) {
      await prisma.projectStrategy.upsert({
        where: {
          projectId_month_year: {
            projectId: project.id,
            month: strat.month,
            year: strat.year,
          },
        },
        update: {
          postTypes: strat.postTypes,
          total: strat.total,
        },
        create: {
          projectId: project.id,
          month: strat.month,
          year: strat.year,
          postTypes: strat.postTypes,
          total: strat.total,
        },
      })
    }
  }

  // ---------------------------------------------------------------------------
  // 8. CREDENTIALS VAULT
  // ---------------------------------------------------------------------------
  console.log("🔐  [8/15] Seeding Client Social Media Credentials Vault...")

  const credentialsData = [
    {
      clientId: clients["client_acme_cloud"].id,
      projectId: projects["proj_acme_q4"].id,
      platform: "LinkedIn",
      location: "Acme Cloud Company Page Admin",
      userId: "acme-admin@itsmedezino.com",
      password: encryptText("AcmeLinkedin@2026Secure"),
    },
    {
      clientId: clients["client_aurelia_luxe"].id,
      projectId: projects["proj_aurelia_festive"].id,
      platform: "Instagram",
      location: "@aurelialuxe_official",
      userId: "aurelia_social_manager",
      password: encryptText("AureliaInsta@2026Pass"),
    },
    {
      clientId: clients["client_aurelia_luxe"].id,
      projectId: projects["proj_aurelia_festive"].id,
      platform: "Facebook",
      location: "Meta Business Suite - Aurelia Apparel",
      userId: "ads@aurelialuxe.in",
      password: encryptText("MetaAurelia@Pass2026"),
    },
    {
      clientId: clients["client_urbanbite"].id,
      projectId: projects["proj_urbanbite_buzz"].id,
      platform: "Instagram",
      location: "@urbanbite_mumbai",
      userId: "urbanbite_insta_lead",
      password: encryptText("UrbanBiteBistro#9988"),
    },
    {
      clientId: clients["client_novacare"].id,
      projectId: projects["proj_novacare_health"].id,
      platform: "YouTube",
      location: "NovaCare Health Talks Channel",
      userId: "youtube@novacare.org",
      password: encryptText("NovaCareYT#HealthTalks"),
    },
  ]

  for (const cred of credentialsData) {
    await prisma.credential.create({ data: cred })
  }

  // ---------------------------------------------------------------------------
  // 9. FESTIVALS CALENDAR
  // ---------------------------------------------------------------------------
  console.log("🎉  [9/15] Seeding Festivals Calendar...")

  const festivalsData = [
    {
      name: "Gandhi Jayanti",
      description: "National tribute to Mahatma Gandhi commemorating peace, truth, and non-violence.",
      date: new Date("2026-10-02T00:00:00.000Z"),
      primaryType: "NATIONAL",
    },
    {
      name: "Dussehra / Vijayadashami",
      description: "Celebration of the victory of good over evil, marking the triumph of Lord Rama.",
      date: new Date("2026-10-20T00:00:00.000Z"),
      primaryType: "CULTURAL",
    },
    {
      name: "Karwa Chauth",
      description: "Traditional celebration of love, fasting, and prayers for longevity.",
      date: new Date("2026-10-28T00:00:00.000Z"),
      primaryType: "CULTURAL",
    },
    {
      name: "Halloween",
      description: "Global spooky evening celebrated with costume parties, trick-or-treating, and horror themes.",
      date: new Date("2026-10-31T00:00:00.000Z"),
      primaryType: "INTERNATIONAL",
    },
    {
      name: "Diwali / Deepavali",
      description: "Festival of Lights celebrating prosperity, light, and new beginnings across India.",
      date: new Date("2026-11-08T00:00:00.000Z"),
      primaryType: "CULTURAL",
    },
    {
      name: "Children's Day",
      description: "Celebration of childhood and tribute to Pandit Jawaharlal Nehru.",
      date: new Date("2026-11-14T00:00:00.000Z"),
      primaryType: "NATIONAL",
    },
    {
      name: "Christmas",
      description: "Worldwide celebration of joy, gift-giving, and festive holiday cheer.",
      date: new Date("2026-12-25T00:00:00.000Z"),
      primaryType: "INTERNATIONAL",
    },
    {
      name: "New Year's Eve",
      description: "Welcoming 2027 with celebratory parties, resolutions, and countdowns.",
      date: new Date("2026-12-31T00:00:00.000Z"),
      primaryType: "INTERNATIONAL",
    },
  ]

  const festivals = []
  for (const f of festivalsData) {
    const fest = await prisma.festival.create({ data: f })
    festivals.push(fest)
  }

  // ---------------------------------------------------------------------------
  // 10. POSTS, PLATFORMS, ASSETS, COMMENTS & WORKFLOWS
  // ---------------------------------------------------------------------------
  console.log("📸  [10/15] Seeding Posts, Media Assets, Workflows & Approvals...")

  // Representative posts centered around Oct 2026 with diverse states
  const postsData = [
    {
      id: "post_acme_observability",
      title: "Acme AI Observability Suite 2.0 Teaser",
      caption: "Meet downtime before it meets your customers. Introducing real-time AI log tracing with zero instrumentation overhead. Link in bio to request early beta access! #CloudOps #DevOps #Observability #SaaSGrowth",
      type: "CAROUSEL",
      status: "POSTED",
      contentStatus: "APPROVED",
      designerHeadApproval: "APPROVED",
      projectId: projects["proj_acme_q4"].id,
      createdById: users["ananya.content@dezino.com"].id,
      assignedToId: users["priya.design@dezino.com"].id,
      scheduledAt: new Date("2026-10-04T10:00:00Z"),
      scheduledFor: new Date("2026-10-04T10:00:00Z"),
      postedAt: new Date("2026-10-04T10:05:00Z"),
      approvedAt: new Date("2026-10-03T16:00:00Z"),
      designDueDate: new Date("2026-10-02T18:00:00Z"),
      keyword: "AI, observability, devops, kubernetes",
      platforms: ["LINKEDIN", "TWITTER"],
      assets: [
        {
          filename: "acme_carousel_slide_1.jpg",
          url: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&auto=format&fit=crop&q=80",
          type: "image/jpeg",
          order: 1,
        },
        {
          filename: "acme_carousel_slide_2.jpg",
          url: "https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?w=800&auto=format&fit=crop&q=80",
          type: "image/jpeg",
          order: 2,
        },
      ],
      comments: [
        {
          userId: users["arjun.lead@dezino.com"].id,
          authorName: "Arjun Kapoor",
          authorRole: "Team Lead",
          type: "DESIGN",
          content: "Slide 2 typography hierarchy looks clean and on brand. Approved!",
        },
      ],
    },
    {
      id: "post_aurelia_diwali_sarees",
      title: "Royal Silk Saree Festive Drop - The Noor Collection",
      caption: "Draped in centuries of handcrafted heritage. The Noor Collection features pure Banarasi Katan silk woven with real zari. Available in limited batches online and at our Mumbai boutique. ✨ #AureliaFestive #HandwovenSilk #Diwali2026 #IndianLuxury",
      type: "REEL",
      status: "SCHEDULED",
      contentStatus: "APPROVED",
      designerHeadApproval: "APPROVED",
      festivalId: festivals.find((f) => f.name.includes("Diwali"))?.id,
      projectId: projects["proj_aurelia_festive"].id,
      createdById: users["ananya.content@dezino.com"].id,
      assignedToId: users["rohit.motion@dezino.com"].id,
      scheduledAt: new Date("2026-10-14T11:30:00Z"),
      scheduledFor: new Date("2026-10-14T11:30:00Z"),
      designDueDate: new Date("2026-10-11T18:00:00Z"),
      approvedAt: new Date("2026-10-10T14:20:00Z"),
      keyword: "diwali, royal silk, festive, reel, banarasi",
      platforms: ["INSTAGRAM", "FACEBOOK", "PINTEREST"],
      assets: [
        {
          filename: "aurelia_noor_reel_master.mp4",
          url: "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=800&auto=format&fit=crop&q=80",
          type: "video/mp4",
          order: 1,
        },
      ],
      comments: [
        {
          userId: users["sarah.pm@dezino.com"].id,
          authorName: "Sarah Jenkins",
          authorRole: "Manager",
          type: "CONTENT",
          content: "Client approved the audio track choice. Scheduled for optimal morning peak engagement.",
        },
      ],
    },
    {
      id: "post_urbanbite_smoky_pizza",
      title: "Chef's Secret 48-Hour Fermented Burrata Pizza",
      caption: "Crispy leopard-spotted crust, San Marzano tomato sauce, and creamy artisanal burrata flown straight from Puglia. Weekend plans sorted? Tag a pizza lover below! 🍕 #UrbanBite #WoodFiredPizza #ArtisanalFood #MumbaiBistro",
      type: "REEL",
      status: "APPROVED",
      contentStatus: "APPROVED",
      designerHeadApproval: "APPROVED",
      projectId: projects["proj_urbanbite_buzz"].id,
      createdById: users["ananya.content@dezino.com"].id,
      assignedToId: users["rohit.motion@dezino.com"].id,
      scheduledAt: new Date("2026-10-16T12:00:00Z"),
      designDueDate: new Date("2026-10-13T17:00:00Z"),
      approvedAt: new Date("2026-10-12T15:30:00Z"),
      keyword: "burrata, pizza, artisanal, reel, foodies",
      platforms: ["INSTAGRAM"],
      assets: [
        {
          filename: "urbanbite_burrata_reel.mp4",
          url: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800&auto=format&fit=crop&q=80",
          type: "video/mp4",
          order: 1,
        },
      ],
      comments: [
        {
          userId: users["arjun.lead@dezino.com"].id,
          authorName: "Arjun Kapoor",
          authorRole: "Team Lead",
          type: "DESIGNER_HEAD",
          content: "Color grading on the cheese pull scene is mouth-watering. Ready for client review.",
        },
      ],
    },
    {
      id: "post_novacare_burnout_signs",
      title: "5 Warning Signs of Workplace Burnout",
      caption: "Chronic exhaustion isn't a badge of honour — it's your nervous system waving a red flag. Swipe through for clinically verified markers and practical micro-habits to reclaim your energy. Save this for later! 🩺 #NovaCareHealth #MentalHealthAwareness #WorkplaceWellness",
      type: "CAROUSEL",
      status: "SUBMITTED",
      contentStatus: "APPROVED",
      designerHeadApproval: "DRAFT",
      projectId: projects["proj_novacare_health"].id,
      createdById: users["ananya.content@dezino.com"].id,
      assignedToId: users["priya.design@dezino.com"].id,
      designDueDate: new Date("2026-10-18T18:00:00Z"),
      keyword: "burnout, wellness, mental health, infographic",
      platforms: ["LINKEDIN", "INSTAGRAM"],
      assets: [
        {
          filename: "novacare_burnout_carousel_cover.jpg",
          url: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=800&auto=format&fit=crop&q=80",
          type: "image/jpeg",
          order: 1,
        },
      ],
      comments: [
        {
          userId: users["priya.design@dezino.com"].id,
          authorName: "Priya Sharma",
          authorRole: "Designer",
          type: "DESIGN",
          content: "Submitted for Design Lead review. Checked against NovaCare brand teal and coral palette.",
        },
      ],
    },
    {
      id: "post_apex_skydeck",
      title: "Apex Towers Infinity Pool & 40th Floor Skydeck",
      caption: "Where the Bengaluru skyline becomes your morning backdrop. Discover bespoke 4 & 5 BHK residences designed for elevated living. Private walkthrough by appointment only. #ApexPrimeLiving #LuxuryRealEstate #PenthouseLiving",
      type: "PHOTO",
      status: "RESUBMITTED",
      contentStatus: "APPROVED",
      designerHeadApproval: "NEEDS_MINOR_CHANGE",
      projectId: projects["proj_apex_luxury"].id,
      createdById: users["ananya.content@dezino.com"].id,
      assignedToId: users["priya.design@dezino.com"].id,
      designDueDate: new Date("2026-10-20T17:00:00Z"),
      keyword: "real estate, penthouse, luxury, skydeck",
      platforms: ["FACEBOOK", "INSTAGRAM"],
      assets: [
        {
          filename: "apex_skydeck_render_v2.jpg",
          url: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&auto=format&fit=crop&q=80",
          type: "image/jpeg",
          order: 1,
          isEdited: true,
        },
      ],
      comments: [
        {
          userId: users["arjun.lead@dezino.com"].id,
          authorName: "Arjun Kapoor",
          authorRole: "Team Lead",
          type: "DESIGNER_HEAD",
          content: "Please adjust sunset warmth on the glass railing reflection as requested.",
        },
      ],
    },
    {
      id: "post_pulsefit_marathon",
      title: "21-Day Diwali Transformation Challenge",
      caption: "Earn the sweets before you eat them. Join 10,000+ athletes across India for the PulseFit 21-Day Core & Cardio Challenge. Win exclusive festive drop kits! Are you in? Drop 🔥 in comments. #PulseFitChallenge #FitnessIndia #NoExcuses",
      type: "PHOTO",
      status: "DRAFT",
      contentStatus: "DRAFT",
      designerHeadApproval: "DRAFT",
      projectId: projects["proj_pulsefit_diwali"].id,
      createdById: users["ananya.content@dezino.com"].id,
      assignedToId: users["priya.design@dezino.com"].id,
      designDueDate: new Date("2026-10-22T18:00:00Z"),
      keyword: "fitness, marathon, diwali challenge, athlete",
      platforms: ["INSTAGRAM"],
      assets: [
        {
          filename: "pulsefit_moodboard_ref.jpg",
          url: "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=800&auto=format&fit=crop&q=80",
          type: "image/jpeg",
          order: 1,
          isReference: true,
        },
      ],
      comments: [],
    },
    {
      id: "post_urbanbite_spooky_burgers",
      title: "Black Brioche Monster Burgers for Halloween Weekend",
      caption: "Double smash patty, activated charcoal brioche, and ghost pepper relish that will haunt your tastebuds. Available exclusively Oct 30 - Nov 1 at all outlets. 👻🍔 #UrbanBiteHalloween #BlackBurger #FoodieSpooky",
      type: "PHOTO",
      status: "SCHEDULED",
      contentStatus: "APPROVED",
      designerHeadApproval: "APPROVED",
      festivalId: festivals.find((f) => f.name.includes("Halloween"))?.id,
      projectId: projects["proj_urbanbite_buzz"].id,
      createdById: users["ananya.content@dezino.com"].id,
      assignedToId: users["priya.design@dezino.com"].id,
      scheduledAt: new Date("2026-10-29T11:00:00Z"),
      scheduledFor: new Date("2026-10-29T11:00:00Z"),
      designDueDate: new Date("2026-10-25T18:00:00Z"),
      approvedAt: new Date("2026-10-24T16:00:00Z"),
      keyword: "halloween, black burger, spooky, promo",
      platforms: ["INSTAGRAM", "FACEBOOK"],
      assets: [
        {
          filename: "urbanbite_black_burger.jpg",
          url: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&auto=format&fit=crop&q=80",
          type: "image/jpeg",
          order: 1,
        },
      ],
      comments: [],
    },
    {
      id: "post_acme_soc2",
      title: "Acme Achieves SOC-2 Type II Compliance",
      caption: "Enterprise security isn't an afterthought. We are thrilled to share that Acme Cloud has officially achieved SOC-2 Type II and ISO 27001 certification with zero exceptions found. Read the compliance brief on our blog. #Cybersecurity #SOC2 #CloudTrust",
      type: "PHOTO",
      status: "SCHEDULED",
      contentStatus: "APPROVED",
      designerHeadApproval: "APPROVED",
      projectId: projects["proj_acme_q4"].id,
      createdById: users["ananya.content@dezino.com"].id,
      assignedToId: users["priya.design@dezino.com"].id,
      scheduledAt: new Date("2026-10-12T09:30:00Z"),
      scheduledFor: new Date("2026-10-12T09:30:00Z"),
      approvedAt: new Date("2026-10-09T14:00:00Z"),
      keyword: "security, soc2, enterprise, cloud",
      platforms: ["LINKEDIN"],
      assets: [
        {
          filename: "acme_soc2_badge_creative.jpg",
          url: "https://images.unsplash.com/photo-1563986768609-322da13575f3?w=800&auto=format&fit=crop&q=80",
          type: "image/jpeg",
          order: 1,
        },
      ],
      comments: [],
    },
  ]

  for (const postItem of postsData) {
    const { platforms, assets, comments, ...postFields } = postItem
    const post = await prisma.post.create({
      data: {
        ...postFields,
        assignedUsers: postFields.assignedToId
          ? { connect: [{ id: postFields.assignedToId }] }
          : undefined,
      },
    })

    // Seed Post Platforms
    for (const plat of platforms) {
      await prisma.postPlatform.create({
        data: {
          postId: post.id,
          platform: plat,
          isPosted: post.status === "POSTED",
        },
      })
    }

    // Seed Assets
    for (const asset of assets) {
      await prisma.asset.create({
        data: {
          ...asset,
          postId: post.id,
          uploadedById: postFields.assignedToId,
        },
      })
    }

    // Seed Comments
    for (const comm of comments) {
      await prisma.comment.create({
        data: {
          ...comm,
          postId: post.id,
        },
      })
    }

    // Seed Post Assignments
    await prisma.postAssignment.create({
      data: {
        postId: post.id,
        userId: postFields.assignedToId,
        role: "DESIGNER",
        stage: post.status === "POSTED" ? "PUBLISHED" : "DESIGN_IN_PROGRESS",
        status: post.status === "POSTED" ? "COMPLETED" : "ACTIVE",
        assignedAt: new Date("2026-10-01T09:00:00Z"),
        completedAt: post.status === "POSTED" ? post.postedAt : null,
      },
    })

    // Seed Approval Flows
    const approvalFlow = await prisma.approvalFlow.create({
      data: {
        postId: post.id,
        flowType: "DESIGN",
        status: post.status === "POSTED" || post.status === "SCHEDULED" ? "APPROVED" : "PENDING",
        submittedById: postFields.assignedToId,
        reviewedById: users["arjun.lead@dezino.com"].id,
        assignedToId: users["arjun.lead@dezino.com"].id,
        submissionCount: 1,
        version: 1,
        submittedAt: new Date("2026-10-02T14:00:00Z"),
        reviewedAt: post.approvedAt || null,
        feedback: "Color palette and typography approved as per client brand guide.",
      },
    })

    await prisma.approvalHistory.create({
      data: {
        approvalFlowId: approvalFlow.id,
        performedById: postFields.assignedToId,
        action: "SUBMITTED",
        toStatus: "SUBMITTED",
        feedback: "First draft ready for internal team lead review.",
        version: 1,
      },
    })

    // Seed Approval Attachment (e.g. voice note review / mockup attachment)
    await prisma.approvalAttachment.create({
      data: {
        approvalFlowId: approvalFlow.id,
        type: "AUDIO",
        url: "/uploads/audio/feedback_voicenote_sample.mp3",
        filename: "lead_feedback_audio_review.mp3",
        duration: 35,
        size: 420000,
        mimeType: "audio/mpeg",
        uploadedById: users["arjun.lead@dezino.com"].id,
      },
    })

    // Seed Task Log
    await prisma.taskLog.create({
      data: {
        postId: post.id,
        userId: postFields.assignedToId,
        action: "STATUS_UPDATE",
        oldStatus: "DRAFT",
        newStatus: post.status,
        feedback: `Post status progressed to ${post.status}`,
      },
    })
  }

  // ---------------------------------------------------------------------------
  // 11. USER PERFORMANCE METRICS
  // ---------------------------------------------------------------------------
  console.log("📊  [11/15] Seeding User Performance Metrics (Reports & Dashboards)...")

  const metricsData = [
    {
      userId: users["priya.design@dezino.com"].id,
      period: "monthly",
      periodStart: new Date("2026-10-01T00:00:00Z"),
      periodEnd: new Date("2026-10-31T23:59:59Z"),
      designsAssigned: 12,
      designsCompleted: 10,
      designsSubmitted: 11,
      designsResubmitted: 1,
      designsApproved: 10,
      designsRejected: 1,
      designApprovalRate: 90.9,
      avgDesignResubmissions: 1.1,
      avgDesignCompletionTime: 4.5,
      totalTasks: 14,
      tasksCompleted: 10,
      commentsAdded: 16,
      assetsUploaded: 24,
    },
    {
      userId: users["rohit.motion@dezino.com"].id,
      period: "monthly",
      periodStart: new Date("2026-10-01T00:00:00Z"),
      periodEnd: new Date("2026-10-31T23:59:59Z"),
      designsAssigned: 8,
      designsCompleted: 7,
      designsSubmitted: 8,
      designsResubmitted: 2,
      designsApproved: 7,
      designsRejected: 0,
      designApprovalRate: 87.5,
      avgDesignResubmissions: 1.25,
      avgDesignCompletionTime: 6.2,
      totalTasks: 10,
      tasksCompleted: 7,
      commentsAdded: 12,
      assetsUploaded: 14,
    },
    {
      userId: users["ananya.content@dezino.com"].id,
      period: "monthly",
      periodStart: new Date("2026-10-01T00:00:00Z"),
      periodEnd: new Date("2026-10-31T23:59:59Z"),
      contentsCreated: 18,
      contentsSubmitted: 18,
      contentsResubmitted: 1,
      contentsApproved: 17,
      contentsRejected: 0,
      contentApprovalRate: 94.4,
      avgContentResubmissions: 1.05,
      totalTasks: 18,
      tasksCompleted: 17,
      commentsAdded: 22,
    },
  ]

  for (const met of metricsData) {
    await prisma.userMetrics.create({ data: met })
  }

  // ---------------------------------------------------------------------------
  // 12. CLIENT EXPORT LINKS (Share Portals)
  // ---------------------------------------------------------------------------
  console.log("🔗  [12/15] Seeding Client Export Links (Share Portal Sign-offs)...")

  const exportLinksData = [
    {
      token: "acme-oct-review-2026-x7y9",
      projectId: projects["proj_acme_q4"].id,
      clientId: clients["client_acme_cloud"].id,
      createdById: users["sarah.pm@dezino.com"].id,
      month: 10,
      year: 2026,
      status: "CONFIRMED",
      confirmedByName: "Rahul Sharma",
      confirmedByEmail: "rahul.sharma@acmetech.com",
      confirmedAt: new Date("2026-10-05T14:30:00Z"),
      feedback: "All October posts approved without changes. Excellent technical copy on AI log tracing.",
      expiresAt: new Date("2026-10-31T23:59:59Z"),
    },
    {
      token: "aurelia-festive-preview-k3m2",
      projectId: projects["proj_aurelia_festive"].id,
      clientId: clients["client_aurelia_luxe"].id,
      createdById: users["sarah.pm@dezino.com"].id,
      month: 10,
      year: 2026,
      status: "ACTIVE",
      expiresAt: new Date("2026-10-25T23:59:59Z"),
    },
    {
      token: "urbanbite-reels-signoff-8p4q",
      projectId: projects["proj_urbanbite_buzz"].id,
      clientId: clients["client_urbanbite"].id,
      createdById: users["sarah.pm@dezino.com"].id,
      month: 10,
      year: 2026,
      status: "CHANGES_REQUESTED",
      feedback: "Please update the Sunday brunch timing to 12:30 PM on Reel #2 caption.",
      expiresAt: new Date("2026-10-20T23:59:59Z"),
    },
  ]

  for (const exp of exportLinksData) {
    await prisma.exportLink.create({ data: exp })
  }

  // ---------------------------------------------------------------------------
  // 13. FINANCE: QUOTATIONS, INVOICES & PAYMENTS
  // ---------------------------------------------------------------------------
  console.log("💰  [13/15] Seeding Finance (Quotations, Invoices, Line Items & Payments)...")

  // Quotation 1: Acme Cloud (Converted into an Invoice)
  const q1Lines = [
    { description: "Social Media Management & Strategy (16 Posts/mo)", quantity: 3, unitPrice: 65000, unit: "Months" },
    { description: "LinkedIn Thought Leadership & Technical Blog Copywriting", quantity: 3, unitPrice: 35000, unit: "Months" },
    { description: "Monthly Lead Attribution & Observability Analytics Reporting", quantity: 3, unitPrice: 15000, unit: "Months" },
  ]
  const q1Totals = computeTotals(q1Lines, 5, 18, "CGST_SGST")

  const quote1 = await prisma.quotation.create({
    data: {
      companyId: companies["comp_dezino_media"].id,
      clientId: clients["client_acme_cloud"].id,
      projectId: projects["proj_acme_q4"].id,
      createdById: users["sarah.pm@dezino.com"].id,
      number: "QT-2026-0001",
      title: "Quarterly SaaS Growth & Technical Content Retainer (Q4 2026)",
      status: "CONVERTED",
      currency: "INR",
      subtotal: q1Totals.subtotal,
      discountPercent: 5,
      taxType: "CGST_SGST",
      taxPercent: 18,
      totalAmount: q1Totals.totalAmount,
      validUntil: new Date("2026-09-30T18:00:00Z"),
      terms: "Payment terms: Net 15 days upon invoice issuance. 100% IP rights transferred on full settlement.",
      notes: "Annual renewal discount of 5% applied as agreed.",
      shareToken: "qt-acme-q4-2026-token",
      acceptedAt: new Date("2026-08-25T11:00:00Z"),
      convertedAt: new Date("2026-09-01T10:00:00Z"),
      lineItems: {
        create: q1Lines.map((line, idx) => ({ ...line, position: idx })),
      },
    },
  })

  // Invoice 1: Linked to Quotation 1 (PAID)
  const invoice1 = await prisma.invoice.create({
    data: {
      companyId: companies["comp_dezino_media"].id,
      clientId: clients["client_acme_cloud"].id,
      projectId: projects["proj_acme_q4"].id,
      quotationId: quote1.id,
      createdById: users["sarah.pm@dezino.com"].id,
      number: "INV-2026-0001",
      title: "Quarterly Retainer Q4 2026 - Acme Cloud Technologies",
      status: "PAID",
      currency: "INR",
      subtotal: q1Totals.subtotal,
      discountPercent: 5,
      taxType: "CGST_SGST",
      taxPercent: 18,
      totalAmount: q1Totals.totalAmount,
      issueDate: new Date("2026-09-01T10:00:00Z"),
      dueDate: new Date("2026-09-15T18:00:00Z"),
      terms: "Payment received in full. Thank you for your partnership.",
      shareToken: "inv-acme-q4-2026-token",
      sentAt: new Date("2026-09-01T10:30:00Z"),
      lineItems: {
        create: q1Lines.map((line, idx) => ({ ...line, position: idx })),
      },
    },
  })

  // Payment for Invoice 1
  await prisma.payment.create({
    data: {
      invoiceId: invoice1.id,
      recordedById: users["sarah.pm@dezino.com"].id,
      amount: q1Totals.totalAmount,
      method: "BANK_TRANSFER",
      reference: "HDFC-NEFT-90823145",
      notes: "Full settlement received via HDFC corporate NEFT.",
      paidAt: new Date("2026-09-10T15:30:00Z"),
    },
  })

  // Quotation 2: Aurelia Luxe (ACCEPTED)
  const q2Lines = [
    { description: "Festive Season Reel Shoot & Video Production (8 Reels)", quantity: 1, unitPrice: 150000, unit: "Package" },
    { description: "Bridal Silk Lookbook Photography & High-res Retouching", quantity: 1, unitPrice: 100000, unit: "Package" },
    { description: "Performance Ad Creatives & Motion Banners (15 Assets)", quantity: 1, unitPrice: 50000, unit: "Package" },
  ]
  const q2Totals = computeTotals(q2Lines, 0, 18, "IGST")

  await prisma.quotation.create({
    data: {
      companyId: companies["comp_dezino_studio"].id,
      clientId: clients["client_aurelia_luxe"].id,
      projectId: projects["proj_aurelia_festive"].id,
      createdById: users["sarah.pm@dezino.com"].id,
      number: "QT-2026-0002",
      title: "Festive Season Runway & Production Shoot Package",
      status: "ACCEPTED",
      currency: "INR",
      subtotal: q2Totals.subtotal,
      taxType: "IGST",
      taxPercent: 18,
      totalAmount: q2Totals.totalAmount,
      validUntil: new Date("2026-10-15T18:00:00Z"),
      terms: "50% advance before shoot date, balance 50% upon final creative delivery.",
      shareToken: "qt-aurelia-festive-token",
      acceptedAt: new Date("2026-09-15T14:00:00Z"),
      lineItems: {
        create: q2Lines.map((line, idx) => ({ ...line, position: idx })),
      },
    },
  })

  // Invoice 2: Aurelia Advance (PAID)
  const inv2Lines = [{ description: "50% Advance for Festive Shoot & Production", quantity: 1, unitPrice: 150000, unit: "Milestone" }]
  const inv2Totals = computeTotals(inv2Lines, 0, 18, "IGST")

  const invoice2 = await prisma.invoice.create({
    data: {
      companyId: companies["comp_dezino_studio"].id,
      clientId: clients["client_aurelia_luxe"].id,
      projectId: projects["proj_aurelia_festive"].id,
      createdById: users["sarah.pm@dezino.com"].id,
      number: "INV-2026-0002",
      title: "Festive Video Production Advance - Aurelia Luxe",
      status: "PAID",
      currency: "INR",
      subtotal: inv2Totals.subtotal,
      taxType: "IGST",
      taxPercent: 18,
      totalAmount: inv2Totals.totalAmount,
      issueDate: new Date("2026-09-16T11:00:00Z"),
      dueDate: new Date("2026-09-25T18:00:00Z"),
      shareToken: "inv-aurelia-adv-token",
      sentAt: new Date("2026-09-16T11:30:00Z"),
      lineItems: {
        create: inv2Lines.map((line, idx) => ({ ...line, position: idx })),
      },
    },
  })

  await prisma.payment.create({
    data: {
      invoiceId: invoice2.id,
      recordedById: users["sarah.pm@dezino.com"].id,
      amount: inv2Totals.totalAmount,
      method: "UPI",
      reference: "UPI/aurelia@icici/9988221",
      notes: "Advance cleared via UPI handle.",
      paidAt: new Date("2026-09-18T10:15:00Z"),
    },
  })

  // Invoice 3: Aurelia Milestone Balance (PARTIAL)
  const invoice3 = await prisma.invoice.create({
    data: {
      companyId: companies["comp_dezino_studio"].id,
      clientId: clients["client_aurelia_luxe"].id,
      projectId: projects["proj_aurelia_festive"].id,
      createdById: users["sarah.pm@dezino.com"].id,
      number: "INV-2026-0003",
      title: "Festive Creative Delivery Balance - Aurelia Luxe",
      status: "PARTIAL",
      currency: "INR",
      subtotal: inv2Totals.subtotal,
      taxType: "IGST",
      taxPercent: 18,
      totalAmount: inv2Totals.totalAmount,
      issueDate: new Date("2026-10-02T10:00:00Z"),
      dueDate: new Date("2026-10-18T18:00:00Z"),
      shareToken: "inv-aurelia-bal-token",
      sentAt: new Date("2026-10-02T10:15:00Z"),
      lineItems: {
        create: [{ description: "Final 50% Milestone Settlement for Approved Creatives", quantity: 1, unitPrice: 150000, unit: "Milestone", position: 0 }],
      },
    },
  })

  await prisma.payment.create({
    data: {
      invoiceId: invoice3.id,
      recordedById: users["sarah.pm@dezino.com"].id,
      amount: round2(inv2Totals.totalAmount / 2),
      method: "BANK_TRANSFER",
      reference: "ICICI-RTGS-7721098",
      notes: "Part-payment received; remaining 50% due post festival release.",
      paidAt: new Date("2026-10-05T16:00:00Z"),
    },
  })

  // Invoice 4: UrbanBite Retainer (SENT)
  const inv4Lines = [{ description: "Monthly Social Media & Reel Production - October 2026", quantity: 1, unitPrice: 70000, unit: "Month" }]
  const inv4Totals = computeTotals(inv4Lines, 0, 18, "CGST_SGST")

  await prisma.invoice.create({
    data: {
      companyId: companies["comp_dezino_media"].id,
      clientId: clients["client_urbanbite"].id,
      projectId: projects["proj_urbanbite_buzz"].id,
      createdById: users["sarah.pm@dezino.com"].id,
      number: "INV-2026-0004",
      title: "Monthly Retainer October 2026 - UrbanBite Bistro",
      status: "SENT",
      currency: "INR",
      subtotal: inv4Totals.subtotal,
      taxType: "CGST_SGST",
      taxPercent: 18,
      totalAmount: inv4Totals.totalAmount,
      issueDate: new Date("2026-10-01T09:00:00Z"),
      dueDate: new Date("2026-10-25T18:00:00Z"),
      shareToken: "inv-urbanbite-oct-token",
      sentAt: new Date("2026-10-01T09:30:00Z"),
      lineItems: {
        create: inv4Lines.map((line, idx) => ({ ...line, position: idx })),
      },
    },
  })

  // Invoice 5: PulseFit Branding (OVERDUE)
  const inv5Lines = [{ description: "Brand Strategy Sprint & Vector Asset Kit", quantity: 1, unitPrice: 95000, unit: "Project" }]
  const inv5Totals = computeTotals(inv5Lines, 0, 18, "CGST_SGST")

  await prisma.invoice.create({
    data: {
      companyId: companies["comp_dezino_media"].id,
      clientId: clients["client_pulsefit"].id,
      projectId: projects["proj_pulsefit_diwali"].id,
      createdById: users["sarah.pm@dezino.com"].id,
      number: "INV-2026-0005",
      title: "Brand Asset Kit Delivery - PulseFit Activewear",
      status: "OVERDUE",
      currency: "INR",
      subtotal: inv5Totals.subtotal,
      taxType: "CGST_SGST",
      taxPercent: 18,
      totalAmount: inv5Totals.totalAmount,
      issueDate: new Date("2026-08-15T10:00:00Z"),
      dueDate: new Date("2026-09-15T18:00:00Z"),
      shareToken: "inv-pulsefit-overdue-token",
      sentAt: new Date("2026-08-15T10:30:00Z"),
      lineItems: {
        create: inv5Lines.map((line, idx) => ({ ...line, position: idx })),
      },
    },
  })

  // Quotation 3 & 4 (DRAFT and EXPIRED)
  const q3Lines = [{ description: "Medical Copywriting & Infographics Package (12 Posts/mo)", quantity: 2, unitPrice: 40000, unit: "Months" }]
  const q3Totals = computeTotals(q3Lines, 0, 18, "CGST_SGST")

  await prisma.quotation.create({
    data: {
      companyId: companies["comp_dezino_media"].id,
      clientId: clients["client_novacare"].id,
      projectId: projects["proj_novacare_health"].id,
      createdById: users["sarah.pm@dezino.com"].id,
      number: "QT-2026-0003",
      title: "NovaCare Q4 Preventive Health Content Retainer",
      status: "DRAFT",
      currency: "INR",
      subtotal: q3Totals.subtotal,
      taxType: "CGST_SGST",
      taxPercent: 18,
      totalAmount: q3Totals.totalAmount,
      shareToken: "qt-novacare-q4-token",
      lineItems: {
        create: q3Lines.map((line, idx) => ({ ...line, position: idx })),
      },
    },
  })

  const q4Lines = [{ description: "3D CGI Luxury Architectural Renders (5 Views)", quantity: 1, unitPrice: 220000, unit: "Set" }]
  const q4Totals = computeTotals(q4Lines, 0, 18, "IGST")

  await prisma.quotation.create({
    data: {
      companyId: companies["comp_dezino_studio"].id,
      clientId: clients["client_apex_prime"].id,
      projectId: projects["proj_apex_luxury"].id,
      createdById: users["sarah.pm@dezino.com"].id,
      number: "QT-2026-0004",
      title: "Apex Towers Pre-Launch Architectural Renders",
      status: "EXPIRED",
      currency: "INR",
      subtotal: q4Totals.subtotal,
      taxType: "IGST",
      taxPercent: 18,
      totalAmount: q4Totals.totalAmount,
      validUntil: new Date("2026-09-15T18:00:00Z"),
      shareToken: "qt-apex-expired-token",
      lineItems: {
        create: q4Lines.map((line, idx) => ({ ...line, position: idx })),
      },
    },
  })

  // ---------------------------------------------------------------------------
  // 14. LEGAL CONTRACTS & SOW
  // ---------------------------------------------------------------------------
  console.log("📜  [14/15] Seeding Legal Contracts, Retainers & MSAs...")

  const contractsData = [
    {
      contractNumber: "CNT-2026-0001",
      title: "Master Digital Marketing & Growth Retainer - Acme Cloud",
      type: "RETAINER",
      status: "ACTIVE",
      clientId: clients["client_acme_cloud"].id,
      projectId: projects["proj_acme_q4"].id,
      createdById: users["sarah.pm@dezino.com"].id,
      value: 450000.0,
      currency: "INR",
      billingCycle: "MONTHLY",
      startDate: new Date("2026-08-01"),
      endDate: new Date("2027-01-31"),
      renewalDate: new Date("2027-01-15"),
      autoRenew: true,
      noticePeriodDays: 30,
      retainerHours: 80.0,
      deliverableQuota: { posts: 16, reels: 8, stories: 20 },
      signedAt: new Date("2026-07-28"),
      signedBy: "Rahul Sharma - VP Marketing",
      documentUrl: "/uploads/contracts/cnt_acme_retainer_2026.pdf",
    },
    {
      contractNumber: "CNT-2026-0002",
      title: "Festive Season Social Media Retainer - Aurelia Luxe",
      type: "RETAINER",
      status: "EXPIRING_SOON",
      clientId: clients["client_aurelia_luxe"].id,
      projectId: projects["proj_aurelia_festive"].id,
      createdById: users["sarah.pm@dezino.com"].id,
      value: 600000.0,
      currency: "INR",
      billingCycle: "MONTHLY",
      startDate: new Date("2026-06-01"),
      endDate: new Date("2026-11-30"),
      renewalDate: new Date("2026-11-15"),
      autoRenew: false,
      noticePeriodDays: 30,
      deliverableQuota: { reels: 12, carousels: 8, stories: 25 },
      signedAt: new Date("2026-05-25"),
      signedBy: "Simran Kaur - Brand Director",
      documentUrl: "/uploads/contracts/cnt_aurelia_festive_2026.pdf",
    },
    {
      contractNumber: "CNT-2026-0003",
      title: "Q3-Q4 Hospitality Food Reel Production SOW - UrbanBite",
      type: "FIXED_SOW",
      status: "ACTIVE",
      clientId: clients["client_urbanbite"].id,
      projectId: projects["proj_urbanbite_buzz"].id,
      createdById: users["sarah.pm@dezino.com"].id,
      value: 280000.0,
      currency: "INR",
      billingCycle: "MONTHLY",
      startDate: new Date("2026-07-01"),
      endDate: new Date("2026-12-31"),
      renewalDate: new Date("2026-12-15"),
      autoRenew: false,
      deliverableQuota: { reels: 10, photos: 8, stories: 15 },
      signedAt: new Date("2026-06-28"),
      signedBy: "Chef Kunal Roy - Founder",
    },
    {
      contractNumber: "CNT-2026-0004",
      title: "Medical Communications & Patient Education MSA - NovaCare",
      type: "MASTER_SERVICES_AGREEMENT",
      status: "ACTIVE",
      clientId: clients["client_novacare"].id,
      projectId: projects["proj_novacare_health"].id,
      createdById: users["sarah.pm@dezino.com"].id,
      value: 800000.0,
      currency: "INR",
      billingCycle: "QUARTERLY",
      startDate: new Date("2026-09-01"),
      endDate: new Date("2027-08-31"),
      renewalDate: new Date("2027-08-01"),
      autoRenew: true,
      signedAt: new Date("2026-08-20"),
      signedBy: "Dr. Arvind Mehra - Chief Medical Officer",
    },
    {
      contractNumber: "CNT-2026-0005",
      title: "Confidentiality & Non-Disclosure Agreement - Apex Prime",
      type: "NDA",
      status: "ACTIVE",
      clientId: clients["client_apex_prime"].id,
      projectId: projects["proj_apex_luxury"].id,
      createdById: users["sarah.pm@dezino.com"].id,
      value: 0.0,
      currency: "INR",
      billingCycle: "ONE_TIME",
      startDate: new Date("2026-09-15"),
      endDate: new Date("2028-09-15"),
      signedAt: new Date("2026-09-15"),
      signedBy: "Vikram Singhania - MD Apex Group",
    },
  ]

  for (const cnt of contractsData) {
    await prisma.contract.create({ data: cnt })
  }

  // ---------------------------------------------------------------------------
  // 15. CRM LEADS, PIPELINE, SHOOT EVENTS & ACTIVITY FEED
  // ---------------------------------------------------------------------------
  console.log("🎯  [15/15] Seeding Leads Pipeline, Shoot Events, Activity Feeds & Audit Logs...")

  // Leads pipeline
  const leadsData = [
    {
      title: "Zepto Hyperlocal - Q1 2027 Performance Ad Creative Sprint",
      name: "Rajiv Malhotra",
      company: "Zepto Hyperlocal Delivery",
      email: "rajiv.malhotra@zepto.in",
      phone: "+91 99001 22334",
      source: "INBOUND",
      status: "NEW",
      estimatedValue: 250000.0,
      assignedToId: users["sarah.pm@dezino.com"].id,
      createdById: users["admin@gmail.com"].id,
      city: "Mumbai",
      notes: "Looking for 40 short-form video variations for 10-minute grocery delivery app promotions.",
      requirements: "Quick turnaround, UGC creators roster, and performance creative testing.",
      activities: [
        { type: "NOTE", content: "Inbound form submitted on agency website. Form forwarded to Sarah." },
      ],
    },
    {
      title: "FinEdge Wealth - B2B Fintech Thought Leadership & LinkedIn Retainer",
      name: "Neha Gupta",
      company: "FinEdge Capital Advisory",
      email: "neha.gupta@finedgecap.com",
      phone: "+91 98113 44556",
      source: "WEBSITE",
      status: "CONTACTED",
      estimatedValue: 400000.0,
      assignedToId: users["sarah.pm@dezino.com"].id,
      createdById: users["sarah.pm@dezino.com"].id,
      city: "Bengaluru",
      nextFollowUp: new Date(Date.now() + 2 * 86400000),
      notes: "Initial discovery call completed. Need high-level proposal covering monthly retainer scope.",
      activities: [
        { type: "CALL", content: "Introductory 30-min discovery call held. Client wants 12 carousels and 4 blogs monthly." },
      ],
    },
    {
      title: "GreenRoot Organics - D2C Superfood Brand Launch",
      name: "Devendra Joshi",
      company: "GreenRoot Organics India",
      email: "dev@greenrootorganics.com",
      phone: "+91 98451 55667",
      source: "LINKEDIN",
      status: "QUALIFIED",
      estimatedValue: 320000.0,
      assignedToId: users["sarah.pm@dezino.com"].id,
      createdById: users["sarah.pm@dezino.com"].id,
      city: "Pune",
      nextFollowUp: new Date(Date.now() + 4 * 86400000),
      activities: [
        { type: "MEETING", content: "Zoom product demo held. Brand packaging files shared." },
      ],
    },
    {
      title: "Skyline Boutique Hotels - Luxury Resort Social Strategy",
      name: "Meera Chawla",
      company: "Skyline Hospitality Group",
      email: "meera.chawla@skylinehotels.in",
      phone: "+91 98205 66778",
      source: "REFERRAL",
      status: "PROPOSAL_SENT",
      estimatedValue: 550000.0,
      assignedToId: users["sarah.pm@dezino.com"].id,
      createdById: users["sarah.pm@dezino.com"].id,
      city: "Goa",
      nextFollowUp: new Date(Date.now() + 3 * 86400000),
      activities: [
        { type: "PROPOSAL", content: "Commercial quotation QT-2026-0005 sent with 3-tier pricing." },
      ],
    },
    {
      title: "Zenith EV Mobility - 360 Degree Digital Launch Retainer",
      name: "Tariq Siddiqui",
      company: "Zenith EV Mobility Pvt Ltd",
      email: "tariq@zenithev.com",
      phone: "+91 98332 77889",
      source: "REFERRAL",
      status: "WON",
      estimatedValue: 750000.0,
      assignedToId: users["sarah.pm@dezino.com"].id,
      createdById: users["sarah.pm@dezino.com"].id,
      city: "Delhi",
      convertedAt: new Date("2026-10-01T10:00:00Z"),
      activities: [
        { type: "NOTE", content: "Agreement signed! Converted to ongoing active client retainer." },
      ],
    },
    {
      title: "QuickBikes - Hyperlocal Delivery App Student Campaign",
      name: "Siddharth Nair",
      company: "QuickBikes Technologies",
      email: "siddharth@quickbikes.in",
      phone: "+91 98765 00112",
      source: "INBOUND",
      status: "LOST",
      estimatedValue: 150000.0,
      assignedToId: users["sarah.pm@dezino.com"].id,
      createdById: users["sarah.pm@dezino.com"].id,
      lostReason: "Budget constraints — reallocated funds towards offline event activations.",
      activities: [
        { type: "NOTE", content: "Lead marked lost. Keep warm for Q2 2027 re-engagement." },
      ],
    },
  ]

  for (const ld of leadsData) {
    const { activities, ...leadFields } = ld
    const lead = await prisma.lead.create({ data: leadFields })
    for (const act of activities) {
      await prisma.leadActivity.create({
        data: {
          leadId: lead.id,
          userId: leadFields.assignedToId,
          type: act.type,
          content: act.content,
        },
      })
    }
  }

  // Shoot Events
  const shootEventsData = [
    {
      name: "UrbanBite Chef's Special & Winter Menu Video Shoot",
      location: "UrbanBite Bistro, Pali Hill, Bandra West, Mumbai",
      date: "2026-10-18",
      time: "11:00 AM",
      completed: false,
    },
    {
      name: "Aurelia Winter Festive Fashion Runway Reel Shoot",
      location: "Studio 9, Laxmi Industrial Estate, Andheri West, Mumbai",
      date: "2026-10-12",
      time: "09:30 AM",
      completed: true,
    },
    {
      name: "Apex Towers Phase-2 Drone Footage & Walkthrough Recording",
      location: "Apex Site, Whitefield Main Road, Bengaluru",
      date: "2026-10-25",
      time: "06:30 AM",
      completed: false,
    },
    {
      name: "NovaCare Doctors Round-table Podcast Session",
      location: "NovaCare HQ Studio, Cyber City, Gurugram",
      date: "2026-10-14",
      time: "03:00 PM",
      completed: false,
    },
  ]

  for (const se of shootEventsData) {
    await prisma.shootEvent.create({ data: se })
  }

  // Notifications
  const notificationsData = [
    {
      userId: users["priya.design@dezino.com"].id,
      title: "New Creative Task Assigned",
      message: "Sarah Jenkins assigned you: 'NovaCare 5 Warning Signs of Burnout Infographic'",
      isRead: false,
      link: "/dashboard/tasks",
    },
    {
      userId: users["rohit.motion@dezino.com"].id,
      title: "Design Approved by Team Lead",
      message: "Arjun Kapoor approved your video edit for 'Aurelia Diwali Royal Silk Sarees Drop'",
      isRead: true,
      link: "/dashboard/projects/posts",
    },
    {
      userId: users["sarah.pm@dezino.com"].id,
      title: "Client Feedback Received",
      message: "Rahul Sharma from Acme Cloud confirmed and approved the October content calendar.",
      isRead: false,
      link: "/dashboard/projects",
    },
    {
      userId: users["admin@gmail.com"].id,
      title: "Payment Received: ₹3,86,750",
      message: "Payment successfully recorded for Invoice INV-2026-0001 (Acme Cloud Technologies)",
      isRead: false,
      link: "/dashboard/companies",
    },
  ]

  for (const notif of notificationsData) {
    await prisma.notification.create({ data: notif })
  }

  // Audit Logs
  const auditLogsData = [
    {
      userId: users["admin@gmail.com"].id,
      action: "PERMISSION_GRANT",
      entityType: "RolePermission",
      entityId: String(roles["ADMIN"].id),
      newValues: JSON.stringify({ role: "ADMIN", permissionsCount: allPermissions.length }),
      feedback: "Permission catalog initialized with standard RBAC matrix",
      ipAddress: "127.0.0.1",
    },
    {
      userId: users["sarah.pm@dezino.com"].id,
      action: "CREATE_PROJECT",
      entityType: "Project",
      entityId: projects["proj_acme_q4"].id,
      newValues: JSON.stringify({ name: projects["proj_acme_q4"].name, client: "Acme Cloud" }),
      feedback: "Project initialized for Q4 campaign",
      ipAddress: "127.0.0.1",
    },
    {
      userId: users["arjun.lead@dezino.com"].id,
      action: "APPROVE_DESIGN",
      entityType: "Post",
      entityId: "post_acme_observability",
      newValues: JSON.stringify({ status: "APPROVED", approvedBy: "Arjun Kapoor" }),
      feedback: "Design conforms to brand visual identity",
      ipAddress: "127.0.0.1",
    },
  ]

  for (const audit of auditLogsData) {
    await prisma.auditLog.create({ data: audit })
  }

  // User Activities
  const userActivitiesData = [
    {
      userId: users["ananya.content@dezino.com"].id,
      activityType: "POST_CREATED",
      entityType: "Post",
      entityId: "post_acme_observability",
      description: "Ananya Sen drafted new carousel: 'Acme AI Observability Suite 2.0 Teaser'",
      projectId: projects["proj_acme_q4"].id,
    },
    {
      userId: users["priya.design@dezino.com"].id,
      activityType: "DESIGN_UPLOADED",
      entityType: "Post",
      entityId: "post_acme_observability",
      description: "Priya Sharma uploaded 2 carousel slides for review",
      projectId: projects["proj_acme_q4"].id,
    },
    {
      userId: users["arjun.lead@dezino.com"].id,
      activityType: "DESIGN_APPROVED",
      entityType: "Post",
      entityId: "post_acme_observability",
      description: "Arjun Kapoor approved design submission for Acme Observability",
      projectId: projects["proj_acme_q4"].id,
    },
  ]

  for (const act of userActivitiesData) {
    await prisma.userActivity.create({ data: act })
  }

  // ---------------------------------------------------------------------------
  // SUMMARY REPORT
  // ---------------------------------------------------------------------------
  console.log("\n===============================================================================")
  console.log("🎉  SEEDING COMPLETED SUCCESSFULLY! DUMMY DATA ADDED FOR ALL MODULES.")
  console.log("===============================================================================\n")

  const counts = await Promise.all([
    prisma.user.count(),
    prisma.role.count(),
    prisma.permission.count(),
    prisma.company.count(),
    prisma.client.count(),
    prisma.project.count(),
    prisma.projectStrategy.count(),
    prisma.post.count(),
    prisma.postPlatform.count(),
    prisma.asset.count(),
    prisma.comment.count(),
    prisma.approvalFlow.count(),
    prisma.postAssignment.count(),
    prisma.quotation.count(),
    prisma.quotationLine.count(),
    prisma.invoice.count(),
    prisma.invoiceLine.count(),
    prisma.payment.count(),
    prisma.contract.count(),
    prisma.lead.count(),
    prisma.shootEvent.count(),
    prisma.festival.count(),
    prisma.credential.count(),
    prisma.exportLink.count(),
    prisma.utility.count(),
    prisma.notification.count(),
    prisma.auditLog.count(),
  ])

  console.log("📊 Database Record Summary:")
  console.log(`   - Users:              ${counts[0]}`)
  console.log(`   - Roles / Perms:      ${counts[1]} roles / ${counts[2]} permissions`)
  console.log(`   - Companies:          ${counts[3]} (Billing entities)`)
  console.log(`   - Clients:            ${counts[4]}`)
  console.log(`   - Projects / Strat:   ${counts[5]} projects / ${counts[6]} strategies`)
  console.log(`   - Posts & Platforms:  ${counts[7]} posts / ${counts[8]} platforms`)
  console.log(`   - Assets / Comments:  ${counts[9]} media assets / ${counts[10]} comments`)
  console.log(`   - Workflow / Tasks:   ${counts[11]} approval flows / ${counts[12]} task assignments`)
  console.log(`   - Quotations:         ${counts[13]} quotations (${counts[14]} line items)`)
  console.log(`   - Invoices & Pay:     ${counts[15]} invoices (${counts[16]} line items) / ${counts[17]} payments`)
  console.log(`   - Legal Contracts:    ${counts[18]} contracts & SOWs`)
  console.log(`   - CRM Leads Pipeline: ${counts[19]} leads`)
  console.log(`   - Shoot Events:       ${counts[20]}`)
  console.log(`   - Festivals:          ${counts[21]}`)
  console.log(`   - Credentials Vault:  ${counts[22]}`)
  console.log(`   - Client Share Links: ${counts[23]}`)
  console.log(`   - Utilities:          ${counts[24]}`)
  console.log(`   - Notifications & Log: ${counts[25]} notifications / ${counts[26]} audit logs\n`)

  console.log("🔑 Test Login Credentials:")
  console.log("   ┌─────────────────────────────┬───────────────┬───────────────────────────────┐")
  console.log("   │ Email                       │ Password      │ Role / Designation            │")
  console.log("   ├─────────────────────────────┼───────────────┼───────────────────────────────┤")
  console.log("   │ admin@gmail.com             │ admin123      │ ADMIN (Full Access)           │")
  console.log("   │ sarah.pm@dezino.com         │ password123   │ Manager (Project & Ops Lead)  │")
  console.log("   │ arjun.lead@dezino.com       │ password123   │ Team Lead (Creative Director) │")
  console.log("   │ priya.design@dezino.com     │ password123   │ Designer (Senior Visual)      │")
  console.log("   │ rohit.motion@dezino.com     │ password123   │ Designer (Motion / 3D)        │")
  console.log("   │ ananya.content@dezino.com   │ password123   │ Content Writer (Copy Lead)    │")
  console.log("   │ vikram.smm@dezino.com       │ password123   │ Social Media Manager          │")
  console.log("   │ rahul.sharma@acmetech.com   │ password123   │ Client (Acme Cloud VP)        │")
  console.log("   └─────────────────────────────┴───────────────┴───────────────────────────────┘\n")
}

main()
  .catch((error) => {
    console.error("❌ Seeding failed with error:", error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
