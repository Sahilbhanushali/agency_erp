/**
 * Demo data for manual testing — two tenants side by side so multi-company
 * behaviour (scoping, roles, task visibility) can be exercised end to end.
 *
 * Safe to re-run: every row uses an id derived from its demo key, so the script
 * upserts the same records instead of piling up duplicates. It never deletes
 * anything it did not create.
 *
 *   npm run prisma:seed:demo
 */
import {
  EmploymentType,
  Gender,
  InvoiceStatus,
  PaymentMethod,
  PrismaClient,
  ProjectStatus,
  QuotationStatus,
  TaskPriority,
  TaskStatus,
  UserStatus,
  WorkspaceMemberRole,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash } from 'crypto';
import { PERMISSION_ACTIONS, PERMISSION_MODULES, seedPermissions } from './permissions';

const prisma = new PrismaClient();

const DEMO_PASSWORD = 'Demo@12345';

/**
 * Stable uuid per demo key, so re-runs update the same row. It has to be a real
 * v5 uuid: the API validates ids with @IsUUID(), which rejects a hex string that
 * only looks uuid-shaped.
 */
function demoId(key: string) {
  const hash = createHash('sha1').update(`agencyos-demo:${key}`).digest();
  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const hex = hash.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function daysFromNow(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

/** Date-only value for `@db.Date` columns. */
function dateFromNow(days: number) {
  return new Date(daysFromNow(days).toISOString().slice(0, 10));
}

const round2 = (value: number) => Math.round(value * 100) / 100;

interface DocLine {
  description: string;
  quantity: number;
  unit?: string;
  unitPrice: number;
}

function documentTotals(lines: DocLine[], discountPercent: number, taxPercent: number) {
  const subTotal = round2(lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0));
  const taxable = round2(subTotal - subTotal * (discountPercent / 100));
  return { subTotal, totalAmount: round2(taxable + taxable * (taxPercent / 100)) };
}

const ALL_PERMISSIONS = PERMISSION_MODULES.flatMap((module) =>
  PERMISSION_ACTIONS.map((action) => `${module}:${action}`),
);

// ─────────────────────────────────────────────────────────────────────────────
// Demo specification
// ─────────────────────────────────────────────────────────────────────────────

interface RoleSpec {
  key: string;
  name: string;
  displayName: string;
  description: string;
  permissions: string[];
}

interface UserSpec {
  key: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: string;
  department: string;
  designation: string;
  employeeCode?: string;
}

interface TaskSpec {
  key: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignee?: string;
  workspace?: string;
  dueInDays?: number;
  subTasks?: { title: string; done?: boolean }[];
  comments?: { by: string; text: string }[];
}

interface WorkspaceSpec {
  key: string;
  name: string;
  description: string;
  colorHex: string;
  members: { user: string; role: WorkspaceMemberRole }[];
}

interface ProjectSpec {
  key: string;
  title: string;
  description: string;
  client: string;
  manager: string;
  status: ProjectStatus;
  startInDays: number;
  deadlineInDays: number;
  budget: number;
  colorHex: string;
  workspaces: WorkspaceSpec[];
  tasks: TaskSpec[];
}

interface ClientSpec {
  key: string;
  name: string;
  industry: string;
  email: string;
  phone: string;
  city: string;
  accountManager: string;
  gstNumber: string;
}

interface QuotationSpec {
  key: string;
  quotationNumber: string;
  title: string;
  client: string;
  project?: string;
  createdBy: string;
  status: QuotationStatus;
  discountPercent: number;
  taxPercent: number;
  validInDays: number;
  lines: DocLine[];
}

interface InvoiceSpec {
  key: string;
  invoiceNumber: string;
  title: string;
  client: string;
  project?: string;
  createdBy: string;
  status: InvoiceStatus;
  discountPercent: number;
  taxPercent: number;
  issueInDays: number;
  dueInDays: number;
  lines: DocLine[];
  payments?: { portion: number; method: PaymentMethod; daysAgo: number; recordedBy: string }[];
}

interface CompanySpec {
  key: string;
  name: string;
  legalName: string;
  email: string;
  phone: string;
  website: string;
  gstNumber: string;
  panNumber: string;
  bankName: string;
  bankAccountName: string;
  bankAccountNumber: string;
  bankIfsc: string;
  address: { line1: string; city: string; state: string; postalCode: string };
  roles: RoleSpec[];
  users: UserSpec[];
  clients: ClientSpec[];
  projects: ProjectSpec[];
  quotations: QuotationSpec[];
  invoices: InvoiceSpec[];
}

const MANAGER_PERMISSIONS = [
  'clients:read',
  'users:read',
  'projects:create',
  'projects:read',
  'projects:update',
  'workspaces:create',
  'workspaces:read',
  'workspaces:update',
  'tasks:create',
  'tasks:read',
  'tasks:update',
  'tasks:delete',
  'quotations:read',
  'invoices:read',
];

const ACCOUNTANT_PERMISSIONS = [
  'clients:read',
  'projects:read',
  'quotations:create',
  'quotations:read',
  'quotations:update',
  'invoices:create',
  'invoices:read',
  'invoices:update',
];

const standardRoles = (prefix: string): RoleSpec[] => [
  {
    key: `${prefix}-admin`,
    name: 'COMPANY_ADMIN',
    displayName: 'Company Admin',
    description: 'Full access inside this company.',
    permissions: ALL_PERMISSIONS,
  },
  {
    key: `${prefix}-manager`,
    name: 'PROJECT_MANAGER',
    displayName: 'Project Manager',
    description: 'Runs delivery: projects, boards and tasks.',
    permissions: MANAGER_PERMISSIONS,
  },
  {
    key: `${prefix}-accountant`,
    name: 'ACCOUNTANT',
    displayName: 'Accountant',
    description: 'Quotations, invoices and payments only.',
    permissions: ACCOUNTANT_PERMISSIONS,
  },
  {
    // Deliberately empty: proves an employee still sees their own tasks and boards.
    key: `${prefix}-employee`,
    name: 'EMPLOYEE',
    displayName: 'Employee',
    description: 'No module permissions — sees only their own work.',
    permissions: [],
  },
];

const NOVA: CompanySpec = {
  key: 'nova',
  name: 'Nova Media Labs',
  legalName: 'Nova Media Labs Pvt Ltd',
  email: 'hello@novamedia.test',
  phone: '+91 98200 11223',
  website: 'https://novamedia.test',
  gstNumber: '27AAACN1234A1Z5',
  panNumber: 'AAACN1234A',
  bankName: 'HDFC Bank',
  bankAccountName: 'Nova Media Labs Pvt Ltd',
  bankAccountNumber: '50200012345678',
  bankIfsc: 'HDFC0001234',
  address: { line1: '4th Floor, Trade Link, Kamala Mills', city: 'Mumbai', state: 'Maharashtra', postalCode: '400013' },
  roles: standardRoles('nova'),
  users: [
    {
      key: 'nova-admin',
      firstName: 'Aarav',
      lastName: 'Mehta',
      email: 'admin@nova.test',
      phone: '+91 98200 10001',
      role: 'nova-admin',
      department: 'Management',
      designation: 'Founder',
      employeeCode: 'NOVA-001',
    },
    {
      key: 'nova-pm',
      firstName: 'Priya',
      lastName: 'Nair',
      email: 'pm@nova.test',
      phone: '+91 98200 10002',
      role: 'nova-manager',
      department: 'Delivery',
      designation: 'Project Manager',
      employeeCode: 'NOVA-002',
    },
    {
      key: 'nova-designer',
      firstName: 'Rohan',
      lastName: 'Das',
      email: 'designer@nova.test',
      phone: '+91 98200 10003',
      role: 'nova-employee',
      department: 'Creative',
      designation: 'Senior Designer',
      employeeCode: 'NOVA-003',
    },
    {
      key: 'nova-writer',
      firstName: 'Isha',
      lastName: 'Kapoor',
      email: 'writer@nova.test',
      phone: '+91 98200 10004',
      role: 'nova-employee',
      department: 'Content',
      designation: 'Content Lead',
      employeeCode: 'NOVA-004',
    },
    {
      key: 'nova-accounts',
      firstName: 'Vikram',
      lastName: 'Shah',
      email: 'accounts@nova.test',
      phone: '+91 98200 10005',
      role: 'nova-accountant',
      department: 'Finance',
      designation: 'Accounts Manager',
      employeeCode: 'NOVA-005',
    },
  ],
  clients: [
    {
      key: 'nova-zenith',
      name: 'Zenith Coffee Roasters',
      industry: 'Food & Beverage',
      email: 'marketing@zenithcoffee.test',
      phone: '+91 22 4000 1100',
      city: 'Mumbai',
      accountManager: 'nova-pm',
      gstNumber: '27AACCZ4567B1Z2',
    },
    {
      key: 'nova-lumen',
      name: 'Lumen Fitness',
      industry: 'Health & Fitness',
      email: 'growth@lumenfitness.test',
      phone: '+91 22 4000 2200',
      city: 'Pune',
      accountManager: 'nova-pm',
      gstNumber: '27AACCL7788C1Z9',
    },
    {
      // Same email as a BrightRise client — client emails are unique per company, not globally.
      key: 'nova-kairo',
      name: 'Kairo Realty',
      industry: 'Real Estate',
      email: 'hello@shared-brand.test',
      phone: '+91 22 4000 3300',
      city: 'Mumbai',
      accountManager: 'nova-admin',
      gstNumber: '27AACCK1122D1Z7',
    },
  ],
  projects: [
    {
      key: 'nova-p1',
      title: 'Zenith Social Retainer — Q4',
      description: 'Always-on social content and community management for Zenith.',
      client: 'nova-zenith',
      manager: 'nova-pm',
      status: ProjectStatus.ACTIVE,
      startInDays: -40,
      deadlineInDays: 50,
      budget: 450000,
      colorHex: '#4F46E5',
      workspaces: [
        {
          key: 'nova-p1-content',
          name: 'Content Studio',
          description: 'Copy, design and scheduling.',
          colorHex: '#4F46E5',
          members: [
            { user: 'nova-pm', role: WorkspaceMemberRole.LEAD },
            { user: 'nova-writer', role: WorkspaceMemberRole.MEMBER },
            { user: 'nova-designer', role: WorkspaceMemberRole.MEMBER },
          ],
        },
        {
          key: 'nova-p1-performance',
          name: 'Performance',
          description: 'Paid media and reporting.',
          colorHex: '#0EA5E9',
          members: [
            { user: 'nova-pm', role: WorkspaceMemberRole.LEAD },
            { user: 'nova-writer', role: WorkspaceMemberRole.VIEWER },
          ],
        },
      ],
      tasks: [
        {
          key: 'nova-t1',
          title: 'October content calendar',
          description: 'Plan 20 posts across Instagram and LinkedIn.',
          status: TaskStatus.IN_PROGRESS,
          priority: TaskPriority.HIGH,
          assignee: 'nova-writer',
          workspace: 'nova-p1-content',
          dueInDays: 3,
          subTasks: [
            { title: 'Pull September performance data', done: true },
            { title: 'Draft 20 captions' },
            { title: 'Review with client' },
          ],
          comments: [
            { by: 'nova-pm', text: 'Client asked for two extra reels this month — please fit them in.' },
            { by: 'nova-writer', text: 'Noted, adding them to week 3.' },
          ],
        },
        {
          key: 'nova-t2',
          title: 'Reel edit: cold brew launch',
          status: TaskStatus.IN_REVIEW,
          priority: TaskPriority.URGENT,
          assignee: 'nova-designer',
          workspace: 'nova-p1-content',
          dueInDays: -2,
          comments: [{ by: 'nova-pm', text: 'Waiting on the client soundtrack approval.' }],
        },
        {
          key: 'nova-t3',
          title: 'Community replies — week 39',
          status: TaskStatus.DONE,
          priority: TaskPriority.MEDIUM,
          assignee: 'nova-writer',
          workspace: 'nova-p1-content',
          dueInDays: -6,
        },
        {
          key: 'nova-t4',
          title: 'Paid media report — September',
          status: TaskStatus.TODO,
          priority: TaskPriority.MEDIUM,
          assignee: 'nova-pm',
          workspace: 'nova-p1-performance',
          dueInDays: 7,
        },
        {
          key: 'nova-t5',
          title: 'Refresh brand asset library',
          status: TaskStatus.TODO,
          priority: TaskPriority.LOW,
          workspace: 'nova-p1-content',
        },
      ],
    },
    {
      key: 'nova-p2',
      title: 'Lumen Website Revamp',
      description: 'New marketing site with a booking funnel.',
      client: 'nova-lumen',
      manager: 'nova-pm',
      status: ProjectStatus.ACTIVE,
      startInDays: -20,
      deadlineInDays: 70,
      budget: 780000,
      colorHex: '#10B981',
      workspaces: [
        {
          key: 'nova-p2-build',
          name: 'Design & Build',
          description: 'Wireframes through to launch.',
          colorHex: '#10B981',
          members: [
            { user: 'nova-pm', role: WorkspaceMemberRole.LEAD },
            { user: 'nova-designer', role: WorkspaceMemberRole.MEMBER },
          ],
        },
      ],
      tasks: [
        {
          key: 'nova-t6',
          title: 'Homepage wireframe',
          status: TaskStatus.DONE,
          priority: TaskPriority.HIGH,
          assignee: 'nova-designer',
          workspace: 'nova-p2-build',
          dueInDays: -9,
        },
        {
          key: 'nova-t7',
          title: 'Design the membership pricing page',
          status: TaskStatus.IN_PROGRESS,
          priority: TaskPriority.HIGH,
          assignee: 'nova-designer',
          workspace: 'nova-p2-build',
          dueInDays: 5,
          subTasks: [{ title: 'Plan comparison table', done: true }, { title: 'Mobile layout' }],
        },
        {
          key: 'nova-t8',
          title: 'Write launch announcement email',
          status: TaskStatus.TODO,
          priority: TaskPriority.MEDIUM,
          assignee: 'nova-writer',
          workspace: 'nova-p2-build',
          dueInDays: 12,
        },
        {
          key: 'nova-t9',
          title: 'Scope the booking integration',
          status: TaskStatus.CANCELLED,
          priority: TaskPriority.LOW,
          workspace: 'nova-p2-build',
        },
      ],
    },
  ],
  quotations: [
    {
      key: 'nova-q1',
      quotationNumber: 'Q-NOVA-2026-0001',
      title: 'Social retainer — Q4 extension',
      client: 'nova-zenith',
      project: 'nova-p1',
      createdBy: 'nova-accounts',
      status: QuotationStatus.SENT,
      discountPercent: 5,
      taxPercent: 18,
      validInDays: 15,
      lines: [
        { description: 'Monthly content production (20 posts)', quantity: 3, unit: 'month', unitPrice: 85000 },
        { description: 'Community management', quantity: 3, unit: 'month', unitPrice: 25000 },
      ],
    },
    {
      key: 'nova-q2',
      quotationNumber: 'Q-NOVA-2026-0002',
      title: 'Website revamp — phase 2',
      client: 'nova-lumen',
      project: 'nova-p2',
      createdBy: 'nova-accounts',
      status: QuotationStatus.ACCEPTED,
      discountPercent: 0,
      taxPercent: 18,
      validInDays: -5,
      lines: [
        { description: 'UI design (12 screens)', quantity: 12, unit: 'screen', unitPrice: 12000 },
        { description: 'Frontend build', quantity: 1, unit: 'project', unitPrice: 320000 },
      ],
    },
  ],
  invoices: [
    {
      key: 'nova-i1',
      invoiceNumber: 'INV-NOVA-2026-0001',
      title: 'Social retainer — September',
      client: 'nova-zenith',
      project: 'nova-p1',
      createdBy: 'nova-accounts',
      status: InvoiceStatus.PAID,
      discountPercent: 0,
      taxPercent: 18,
      issueInDays: -30,
      dueInDays: -15,
      lines: [
        { description: 'Content production — September', quantity: 1, unit: 'month', unitPrice: 85000 },
        { description: 'Community management — September', quantity: 1, unit: 'month', unitPrice: 25000 },
      ],
      payments: [
        { portion: 1, method: PaymentMethod.BANK_TRANSFER, daysAgo: 12, recordedBy: 'nova-accounts' },
      ],
    },
    {
      key: 'nova-i2',
      invoiceNumber: 'INV-NOVA-2026-0002',
      title: 'Website revamp — milestone 1',
      client: 'nova-lumen',
      project: 'nova-p2',
      createdBy: 'nova-accounts',
      status: InvoiceStatus.PARTIAL,
      discountPercent: 0,
      taxPercent: 18,
      issueInDays: -12,
      dueInDays: 3,
      lines: [{ description: 'Design milestone 1', quantity: 1, unit: 'milestone', unitPrice: 240000 }],
      payments: [{ portion: 0.4, method: PaymentMethod.UPI, daysAgo: 5, recordedBy: 'nova-accounts' }],
    },
    {
      key: 'nova-i3',
      invoiceNumber: 'INV-NOVA-2026-0003',
      title: 'Brand shoot — August',
      client: 'nova-kairo',
      createdBy: 'nova-accounts',
      status: InvoiceStatus.SENT,
      discountPercent: 0,
      taxPercent: 18,
      issueInDays: -45,
      dueInDays: -18,
      lines: [
        { description: 'Photography day rate', quantity: 2, unit: 'day', unitPrice: 45000 },
        { description: 'Post production', quantity: 1, unit: 'package', unitPrice: 30000 },
      ],
    },
  ],
};

const BRIGHTRISE: CompanySpec = {
  key: 'brightrise',
  name: 'BrightRise Digital',
  legalName: 'BrightRise Digital LLP',
  email: 'team@brightrise.test',
  phone: '+91 80 4100 5500',
  website: 'https://brightrise.test',
  gstNumber: '29AABCB9876C1Z3',
  panNumber: 'AABCB9876C',
  bankName: 'ICICI Bank',
  bankAccountName: 'BrightRise Digital LLP',
  bankAccountNumber: '002105001234',
  bankIfsc: 'ICIC0000021',
  address: { line1: '2nd Floor, Prestige Atrium, Church Street', city: 'Bengaluru', state: 'Karnataka', postalCode: '560001' },
  roles: standardRoles('brightrise'),
  users: [
    {
      key: 'br-admin',
      firstName: 'Neha',
      lastName: 'Rao',
      email: 'admin@brightrise.test',
      phone: '+91 98450 20001',
      role: 'brightrise-admin',
      department: 'Management',
      designation: 'Managing Partner',
      employeeCode: 'BR-001',
    },
    {
      key: 'br-pm',
      firstName: 'Arjun',
      lastName: 'Iyer',
      email: 'pm@brightrise.test',
      phone: '+91 98450 20002',
      role: 'brightrise-manager',
      department: 'Delivery',
      designation: 'Account Director',
      employeeCode: 'BR-002',
    },
    {
      key: 'br-dev',
      firstName: 'Sana',
      lastName: 'Qureshi',
      email: 'dev@brightrise.test',
      phone: '+91 98450 20003',
      role: 'brightrise-employee',
      department: 'Engineering',
      designation: 'Web Developer',
      employeeCode: 'BR-003',
    },
    {
      key: 'br-accounts',
      firstName: 'Karthik',
      lastName: 'Menon',
      email: 'accounts@brightrise.test',
      phone: '+91 98450 20004',
      role: 'brightrise-accountant',
      department: 'Finance',
      designation: 'Finance Lead',
      employeeCode: 'BR-004',
    },
  ],
  clients: [
    {
      key: 'br-peak',
      name: 'Peak Organics',
      industry: 'FMCG',
      email: 'brand@peakorganics.test',
      phone: '+91 80 4100 7700',
      city: 'Bengaluru',
      accountManager: 'br-pm',
      gstNumber: '29AACCP3344E1Z1',
    },
    {
      key: 'br-vertex',
      name: 'Vertex Motors',
      industry: 'Automotive',
      email: 'digital@vertexmotors.test',
      phone: '+91 80 4100 8800',
      city: 'Hyderabad',
      accountManager: 'br-admin',
      gstNumber: '29AACCV5566F1Z4',
    },
    {
      key: 'br-kairo',
      name: 'Kairo Realty (South)',
      industry: 'Real Estate',
      email: 'hello@shared-brand.test',
      phone: '+91 80 4100 9900',
      city: 'Bengaluru',
      accountManager: 'br-pm',
      gstNumber: '29AACCK1122D1Z8',
    },
  ],
  projects: [
    {
      key: 'br-p1',
      title: 'Peak Organics Launch Campaign',
      description: 'Go-to-market campaign for the new cold-pressed range.',
      client: 'br-peak',
      manager: 'br-pm',
      status: ProjectStatus.ACTIVE,
      startInDays: -15,
      deadlineInDays: 35,
      budget: 620000,
      colorHex: '#F59E0B',
      workspaces: [
        {
          key: 'br-p1-creative',
          name: 'Creative Pod',
          description: 'Campaign creative and landing pages.',
          colorHex: '#F59E0B',
          members: [
            { user: 'br-pm', role: WorkspaceMemberRole.LEAD },
            { user: 'br-dev', role: WorkspaceMemberRole.MEMBER },
          ],
        },
      ],
      tasks: [
        {
          key: 'br-t1',
          title: 'Build the campaign landing page',
          description: 'Single page with the pre-order form.',
          status: TaskStatus.IN_PROGRESS,
          priority: TaskPriority.URGENT,
          assignee: 'br-dev',
          workspace: 'br-p1-creative',
          dueInDays: 2,
          subTasks: [
            { title: 'Hero section', done: true },
            { title: 'Pre-order form + validation' },
            { title: 'Analytics events' },
          ],
          comments: [{ by: 'br-pm', text: 'Please keep the form to four fields.' }],
        },
        {
          key: 'br-t2',
          title: 'Launch teaser creatives',
          status: TaskStatus.IN_REVIEW,
          priority: TaskPriority.HIGH,
          assignee: 'br-dev',
          workspace: 'br-p1-creative',
          dueInDays: -1,
        },
        {
          key: 'br-t3',
          title: 'Set up the ad account structure',
          status: TaskStatus.TODO,
          priority: TaskPriority.MEDIUM,
          assignee: 'br-pm',
          workspace: 'br-p1-creative',
          dueInDays: 9,
        },
        {
          key: 'br-t4',
          title: 'Competitor pricing scan',
          status: TaskStatus.DONE,
          priority: TaskPriority.LOW,
          assignee: 'br-pm',
          workspace: 'br-p1-creative',
          dueInDays: -8,
        },
      ],
    },
    {
      key: 'br-p2',
      title: 'Vertex Lead Gen Sprint',
      description: 'Paused until the dealer data handover.',
      client: 'br-vertex',
      manager: 'br-pm',
      status: ProjectStatus.ON_HOLD,
      startInDays: -60,
      deadlineInDays: 20,
      budget: 300000,
      colorHex: '#EF4444',
      workspaces: [
        {
          key: 'br-p2-growth',
          name: 'Growth Pod',
          description: 'Lead capture and nurture.',
          colorHex: '#EF4444',
          members: [{ user: 'br-pm', role: WorkspaceMemberRole.LEAD }],
        },
      ],
      tasks: [
        {
          key: 'br-t5',
          title: 'Rebuild the lead capture form',
          status: TaskStatus.TODO,
          priority: TaskPriority.MEDIUM,
          assignee: 'br-dev',
          workspace: 'br-p2-growth',
          dueInDays: -4,
        },
        {
          key: 'br-t6',
          title: 'Chase the dealer data handover',
          status: TaskStatus.TODO,
          priority: TaskPriority.HIGH,
          assignee: 'br-pm',
          workspace: 'br-p2-growth',
          dueInDays: 1,
        },
      ],
    },
  ],
  quotations: [
    {
      key: 'br-q1',
      quotationNumber: 'Q-BRDG-2026-0001',
      title: 'Launch campaign — media budget',
      client: 'br-peak',
      project: 'br-p1',
      createdBy: 'br-accounts',
      status: QuotationStatus.DRAFT,
      discountPercent: 0,
      taxPercent: 18,
      validInDays: 21,
      lines: [
        { description: 'Campaign management fee', quantity: 2, unit: 'month', unitPrice: 90000 },
        { description: 'Creative production', quantity: 1, unit: 'package', unitPrice: 150000 },
      ],
    },
  ],
  invoices: [
    {
      key: 'br-i1',
      invoiceNumber: 'INV-BRDG-2026-0001',
      title: 'Campaign management — September',
      client: 'br-peak',
      project: 'br-p1',
      createdBy: 'br-accounts',
      status: InvoiceStatus.SENT,
      discountPercent: 0,
      taxPercent: 18,
      issueInDays: -35,
      dueInDays: -20,
      lines: [{ description: 'Campaign management fee', quantity: 1, unit: 'month', unitPrice: 90000 }],
    },
    {
      key: 'br-i2',
      invoiceNumber: 'INV-BRDG-2026-0002',
      title: 'Lead gen sprint — setup',
      client: 'br-vertex',
      project: 'br-p2',
      createdBy: 'br-accounts',
      status: InvoiceStatus.PAID,
      discountPercent: 10,
      taxPercent: 18,
      issueInDays: -50,
      dueInDays: -35,
      lines: [
        { description: 'Funnel setup', quantity: 1, unit: 'project', unitPrice: 120000 },
        { description: 'CRM integration', quantity: 1, unit: 'project', unitPrice: 60000 },
      ],
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Seeding
// ─────────────────────────────────────────────────────────────────────────────

async function seedCompany(spec: CompanySpec, passwordHash: string) {
  const companyId = demoId(`company:${spec.key}`);
  const addressId = demoId(`address:${spec.key}`);

  await prisma.address.upsert({
    where: { id: addressId },
    update: { ...spec.address, country: 'India' },
    create: { id: addressId, ...spec.address, country: 'India' },
  });

  const companyData = {
    name: spec.name,
    legalName: spec.legalName,
    email: spec.email,
    phone: spec.phone,
    website: spec.website,
    gstNumber: spec.gstNumber,
    panNumber: spec.panNumber,
    bankName: spec.bankName,
    bankAccountName: spec.bankAccountName,
    bankAccountNumber: spec.bankAccountNumber,
    bankIfsc: spec.bankIfsc,
    registeredAddressId: addressId,
    isActive: true,
    deletedAt: null,
  };
  await prisma.company.upsert({
    where: { id: companyId },
    update: companyData,
    create: { id: companyId, ...companyData },
  });

  const permissions = await prisma.permission.findMany();
  const permissionIdByCode = new Map(permissions.map((permission) => [permission.code, permission.id]));

  for (const role of spec.roles) {
    const roleId = demoId(`role:${role.key}`);
    const roleData = {
      companyId,
      name: role.name,
      displayName: role.displayName,
      description: role.description,
      deletedAt: null,
    };
    await prisma.role.upsert({
      where: { id: roleId },
      update: roleData,
      create: { id: roleId, ...roleData },
    });

    await prisma.rolePermission.deleteMany({ where: { roleId } });
    await prisma.rolePermission.createMany({
      data: role.permissions
        .map((code) => permissionIdByCode.get(code))
        .filter((permissionId): permissionId is string => !!permissionId)
        .map((permissionId) => ({ roleId, permissionId })),
    });
  }

  for (const user of spec.users) {
    const userData = {
      companyId,
      roleId: demoId(`role:${user.role}`),
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      passwordHash,
      status: UserStatus.ACTIVE,
      gender: Gender.PREFER_NOT_TO_SAY,
      employmentType: EmploymentType.FULL_TIME,
      department: user.department,
      designation: user.designation,
      joiningDate: dateFromNow(-400),
      emailVerifiedAt: new Date(),
      deletedAt: null,
    };
    await prisma.user.upsert({
      where: { id: demoId(`user:${user.key}`) },
      update: userData,
      create: { id: demoId(`user:${user.key}`), ...userData },
    });

    if (!user.employeeCode) continue;
    const profileId = demoId(`profile:${user.key}`);
    const profileData = {
      userId: demoId(`user:${user.key}`),
      employeeCode: user.employeeCode,
      nationality: 'Indian',
      personalEmail: `${user.key}@personal.test`,
      emergencyContactName: 'Emergency Contact',
      emergencyContactPhone: '+91 90000 00000',
      emergencyContactRelation: 'Family',
      deletedAt: null,
    };
    await prisma.employeeProfile.upsert({
      where: { id: profileId },
      update: profileData,
      create: { id: profileId, ...profileData },
    });

    const bankId = demoId(`bank:${user.key}`);
    const bankData = {
      employeeProfileId: profileId,
      accountHolderName: `${user.firstName} ${user.lastName}`,
      accountNumber: `9${demoId(user.key).replace(/\D/g, '').slice(0, 11)}`,
      bankName: spec.bankName,
      ifscCode: spec.bankIfsc,
      branchName: spec.address.city,
      deletedAt: null,
    };
    await prisma.employeeBankDetail.upsert({
      where: { id: bankId },
      update: bankData,
      create: { id: bankId, ...bankData },
    });

    for (const [index, skill] of ['Campaign Strategy', 'Copywriting', 'Figma'].entries()) {
      const skillId = demoId(`skill:${user.key}:${skill}`);
      await prisma.employeeSkill.upsert({
        where: { id: skillId },
        update: { name: skill, proficiency: 3 + (index % 3) },
        create: { id: skillId, employeeProfileId: profileId, name: skill, proficiency: 3 + (index % 3) },
      });
    }
  }

  for (const client of spec.clients) {
    const billingAddressId = demoId(`address:client:${client.key}`);
    await prisma.address.upsert({
      where: { id: billingAddressId },
      update: { line1: `${client.name} HQ`, city: client.city, country: 'India' },
      create: { id: billingAddressId, line1: `${client.name} HQ`, city: client.city, country: 'India' },
    });

    const clientData = {
      companyId,
      accountManagerId: demoId(`user:${client.accountManager}`),
      billingAddressId,
      name: client.name,
      industry: client.industry,
      email: client.email,
      phone: client.phone,
      gstNumber: client.gstNumber,
      website: `https://${client.key}.test`,
      isActive: true,
      deletedAt: null,
    };
    await prisma.client.upsert({
      where: { id: demoId(`client:${client.key}`) },
      update: clientData,
      create: { id: demoId(`client:${client.key}`), ...clientData },
    });
  }

  for (const project of spec.projects) {
    const projectId = demoId(`project:${project.key}`);
    const projectData = {
      companyId,
      clientId: demoId(`client:${project.client}`),
      managerId: demoId(`user:${project.manager}`),
      title: project.title,
      description: project.description,
      status: project.status,
      startDate: dateFromNow(project.startInDays),
      deadline: dateFromNow(project.deadlineInDays),
      budget: project.budget,
      colorHex: project.colorHex,
      deletedAt: null,
    };
    await prisma.project.upsert({
      where: { id: projectId },
      update: projectData,
      create: { id: projectId, ...projectData },
    });

    for (const workspace of project.workspaces) {
      const workspaceId = demoId(`workspace:${workspace.key}`);
      const workspaceData = {
        companyId,
        projectId,
        name: workspace.name,
        description: workspace.description,
        colorHex: workspace.colorHex,
        isActive: true,
        deletedAt: null,
      };
      await prisma.workspace.upsert({
        where: { id: workspaceId },
        update: workspaceData,
        create: { id: workspaceId, ...workspaceData },
      });

      for (const member of workspace.members) {
        const memberData = {
          workspaceId,
          userId: demoId(`user:${member.user}`),
          addedById: demoId(`user:${project.manager}`),
          memberRole: member.role,
          deletedAt: null,
        };
        await prisma.workspaceMember.upsert({
          where: { id: demoId(`member:${workspace.key}:${member.user}`) },
          update: memberData,
          create: { id: demoId(`member:${workspace.key}:${member.user}`), ...memberData },
        });
      }
    }

    for (const task of project.tasks) {
      const taskId = demoId(`task:${task.key}`);
      const taskData = {
        companyId,
        projectId,
        workspaceId: task.workspace ? demoId(`workspace:${task.workspace}`) : null,
        createdById: demoId(`user:${project.manager}`),
        assigneeId: task.assignee ? demoId(`user:${task.assignee}`) : null,
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        dueDate: task.dueInDays === undefined ? null : dateFromNow(task.dueInDays),
        completedAt: task.status === TaskStatus.DONE ? daysFromNow(-1) : null,
        deletedAt: null,
      };
      await prisma.task.upsert({
        where: { id: taskId },
        update: taskData,
        create: { id: taskId, ...taskData },
      });

      for (const subTask of task.subTasks ?? []) {
        const subTaskId = demoId(`task:${task.key}:${subTask.title}`);
        const subTaskData = {
          ...taskData,
          parentTaskId: taskId,
          title: subTask.title,
          description: null,
          status: subTask.done ? TaskStatus.DONE : TaskStatus.TODO,
          priority: TaskPriority.MEDIUM,
          dueDate: null,
          completedAt: subTask.done ? daysFromNow(-1) : null,
        };
        await prisma.task.upsert({
          where: { id: subTaskId },
          update: subTaskData,
          create: { id: subTaskId, ...subTaskData },
        });
      }

      for (const [index, comment] of (task.comments ?? []).entries()) {
        const commentId = demoId(`comment:${task.key}:${index}`);
        const commentData = {
          taskId,
          userId: demoId(`user:${comment.by}`),
          content: comment.text,
          deletedAt: null,
        };
        await prisma.taskComment.upsert({
          where: { id: commentId },
          update: commentData,
          create: { id: commentId, ...commentData },
        });
      }
    }
  }

  for (const quotation of spec.quotations) {
    const quotationId = demoId(`quotation:${quotation.key}`);
    const { subTotal, totalAmount } = documentTotals(
      quotation.lines,
      quotation.discountPercent,
      quotation.taxPercent,
    );
    const quotationData = {
      companyId,
      clientId: demoId(`client:${quotation.client}`),
      projectId: quotation.project ? demoId(`project:${quotation.project}`) : null,
      createdById: demoId(`user:${quotation.createdBy}`),
      quotationNumber: quotation.quotationNumber,
      title: quotation.title,
      status: quotation.status,
      subTotal,
      discountPercent: quotation.discountPercent,
      taxPercent: quotation.taxPercent,
      totalAmount,
      validUntil: dateFromNow(quotation.validInDays),
      terms: '50% advance, balance on delivery.',
      portalVisible: quotation.status !== QuotationStatus.DRAFT,
      sentAt: quotation.status === QuotationStatus.DRAFT ? null : daysFromNow(-7),
      deletedAt: null,
    };
    await prisma.quotation.upsert({
      where: { id: quotationId },
      update: quotationData,
      create: { id: quotationId, ...quotationData },
    });

    await prisma.quotationLine.deleteMany({ where: { quotationId } });
    await prisma.quotationLine.createMany({
      data: quotation.lines.map((line, position) => ({
        id: demoId(`quotation-line:${quotation.key}:${position}`),
        quotationId,
        description: line.description,
        quantity: line.quantity,
        unit: line.unit,
        unitPrice: line.unitPrice,
        position,
      })),
    });
  }

  for (const invoice of spec.invoices) {
    const invoiceId = demoId(`invoice:${invoice.key}`);
    const { subTotal, totalAmount } = documentTotals(invoice.lines, invoice.discountPercent, invoice.taxPercent);
    const invoiceData = {
      companyId,
      clientId: demoId(`client:${invoice.client}`),
      projectId: invoice.project ? demoId(`project:${invoice.project}`) : null,
      createdById: demoId(`user:${invoice.createdBy}`),
      invoiceNumber: invoice.invoiceNumber,
      title: invoice.title,
      status: invoice.status,
      subTotal,
      discountPercent: invoice.discountPercent,
      taxPercent: invoice.taxPercent,
      totalAmount,
      issueDate: dateFromNow(invoice.issueInDays),
      dueDate: dateFromNow(invoice.dueInDays),
      terms: 'Payable within 15 days of the issue date.',
      portalVisible: true,
      sentAt: invoice.status === InvoiceStatus.DRAFT ? null : daysFromNow(invoice.issueInDays),
      deletedAt: null,
    };
    await prisma.invoice.upsert({
      where: { id: invoiceId },
      update: invoiceData,
      create: { id: invoiceId, ...invoiceData },
    });

    await prisma.invoiceLine.deleteMany({ where: { invoiceId } });
    await prisma.invoiceLine.createMany({
      data: invoice.lines.map((line, position) => ({
        id: demoId(`invoice-line:${invoice.key}:${position}`),
        invoiceId,
        description: line.description,
        quantity: line.quantity,
        unit: line.unit,
        unitPrice: line.unitPrice,
        position,
      })),
    });

    for (const [index, payment] of (invoice.payments ?? []).entries()) {
      const paymentId = demoId(`payment:${invoice.key}:${index}`);
      const paymentData = {
        invoiceId,
        recordedById: demoId(`user:${payment.recordedBy}`),
        amount: round2(totalAmount * payment.portion),
        method: payment.method,
        transactionRef: `DEMO-${invoice.invoiceNumber}-${index + 1}`,
        paidAt: daysFromNow(-payment.daysAgo),
        deletedAt: null,
      };
      await prisma.payment.upsert({
        where: { id: paymentId },
        update: paymentData,
        create: { id: paymentId, ...paymentData },
      });
    }
  }

  return { companyId, name: spec.name };
}

async function main() {
  await seedPermissions(prisma);
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  for (const spec of [NOVA, BRIGHTRISE]) {
    const company = await seedCompany(spec, passwordHash);
    console.log(`✓ ${company.name} (${company.companyId})`);
  }

  console.log(`\nAll demo accounts use the password: ${DEMO_PASSWORD}`);
  console.log(`
  Nova Media Labs                      BrightRise Digital
  ───────────────────────────────      ────────────────────────────────
  admin@nova.test      Company Admin   admin@brightrise.test    Company Admin
  pm@nova.test         Project Manager pm@brightrise.test       Project Manager
  accounts@nova.test   Accountant      accounts@brightrise.test Accountant
  designer@nova.test   Employee        dev@brightrise.test      Employee
  writer@nova.test     Employee
`);
  console.log('Employees have no module permissions on purpose — they should still see My Tasks.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
