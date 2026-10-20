/**
 * The single source of truth for what can be permitted in this application.
 *
 * Why this exists: permissions used to be free-form strings in two shapes — `View-X`
 * (read) and `Manage-X` (create AND update AND delete, inseparably). A role could not
 * be allowed to edit a quotation without also being allowed to delete it. This catalog
 * splits every module into individual actions while keeping the old names working, so
 * existing role assignments keep their exact current capability.
 *
 * Canonical names are `module:action`. Legacy names are listed per action and still
 * satisfy a check, which is what lets the migration be additive rather than a cutover.
 *
 * Note on tenancy: this application is single-agency. There is no companyId/tenantId on
 * User — `Company` is a billing entity that issues documents, not a tenant (see
 * CLAUDE.md). Permission checks therefore scope by role only; record-level ownership
 * rules that already exist in route handlers are preserved untouched.
 */

export const ACTIONS = ["read", "create", "update", "delete"] as const
export type CrudAction = (typeof ACTIONS)[number]

/** Actions beyond CRUD that this app already distinguishes and must keep distinguishing. */
export const EXTRA_ACTIONS = ["approve", "publish", "share", "convert", "reveal", "export", "status"] as const
export type ExtraAction = (typeof EXTRA_ACTIONS)[number]

export type Action = CrudAction | ExtraAction

export interface ModuleAction {
  action: Action
  /** Shown in the permission matrix. */
  label: string
  /** Pre-existing permission names that must continue to grant this action. */
  legacy: string[]
  /**
   * True when this action was ungated before the migration, so every pre-existing role
   * must receive it. Without this, an action with no legacy name maps from nothing and
   * would silently be revoked from everyone — the dashboard landing page being the case
   * that caught it.
   */
  baseline?: boolean
}

export interface PermissionModule {
  /** Stable key used in `module:action` and in `can(user, module, action)`. */
  key: string
  label: string
  /** Dashboard path this module governs, for navigation and page guards. */
  href?: string
  /** Grouping in the matrix UI, mirroring the sidebar sections. */
  group: "Delivery" | "Agency" | "People" | "Finance" | "System"
  actions: ModuleAction[]
}

/** Shorthand for the overwhelmingly common View-/Manage- pair. */
const crud = (view: string | null, manage: string | null): ModuleAction[] => [
  { action: "read", label: "Read", legacy: view ? [view] : [] },
  { action: "create", label: "Create", legacy: manage ? [manage] : [] },
  { action: "update", label: "Update", legacy: manage ? [manage] : [] },
  { action: "delete", label: "Delete", legacy: manage ? [manage] : [] },
]

const readOnly = (view: string | null): ModuleAction[] => [
  { action: "read", label: "Read", legacy: view ? [view] : [] },
]

export const MODULES: PermissionModule[] = [
  // ---- Delivery ----
  // The dashboard landing page had no gate at all before, so every existing role keeps
  // it. New roles get it by default too — it is the page you land on after signing in.
  { key: "dashboard", label: "Dashboard", href: "/dashboard", group: "Delivery",
    actions: [{ action: "read", label: "Read", legacy: [], baseline: true }] },
  { key: "tasks", label: "My Tasks", href: "/dashboard/tasks", group: "Delivery",
    actions: crud("View-tasks", "Manage-tasks") },
  /**
   * Daily todos. Everyone manages their own regardless of these — the endpoints
   * self-scope, exactly as attendance and leaves do. These actions govern seeing and
   * acting on OTHER people's days, which is a manager's job.
   */
  { key: "todos", label: "Daily Plan", href: "/dashboard/my-day", group: "Delivery",
    actions: [
      { action: "read", label: "See team's day", legacy: [] },
      { action: "update", label: "Edit team's todos", legacy: [] },
      { action: "delete", label: "Delete team's todos", legacy: [] },
      { action: "export", label: "Receive EOD report", legacy: [] },
    ] },
  { key: "projects", label: "Projects", href: "/dashboard/projects", group: "Delivery",
    actions: crud("View-project", "Manage-projects") },
  { key: "posts", label: "Content & Posts", href: "/dashboard/projects/posts", group: "Delivery",
    actions: [
      { action: "read", label: "Read", legacy: ["View-post", "View-posts"] },
      { action: "create", label: "Create", legacy: ["Manage-post"] },
      { action: "update", label: "Update", legacy: ["Manage-post", "Manage-content", "Manage-design"] },
      { action: "delete", label: "Delete", legacy: ["Manage-post"] },
      { action: "approve", label: "Approve", legacy: ["Manage-approvals"] },
      { action: "publish", label: "Publish", legacy: ["Manage-post"] },
      /**
       * Moving a post through its workflow states. Separate from `update` because
       * designers and writers may edit a post's content without being able to declare
       * it approved — a rule that used to live as a hardcoded deny-list of role names
       * inside three route handlers.
       */
      { action: "status", label: "Change status", legacy: [] },
    ] },
  { key: "calendar", label: "Calendar", href: "/dashboard/calendar", group: "Delivery",
    actions: readOnly("View-calender") },
  { key: "approvals", label: "Pending Approvals", href: "/dashboard/approvals", group: "Delivery",
    actions: [
      { action: "read", label: "Read", legacy: ["Manage-approvals"] },
      { action: "approve", label: "Approve", legacy: ["Manage-approvals"] },
    ] },
  { key: "assets", label: "Assets", href: "/dashboard/assets", group: "Delivery",
    actions: [
      { action: "read", label: "Read", legacy: ["View-assets"] },
      { action: "create", label: "Upload", legacy: ["Manage-assets"] },
      { action: "delete", label: "Delete", legacy: ["Manage-assets"] },
    ] },
  { key: "reports", label: "Reports", href: "/dashboard/reports", group: "Delivery",
    actions: [
      { action: "read", label: "Read", legacy: ["View-reports"] },
      { action: "export", label: "Export", legacy: ["View-reports"] },
    ] },

  // ---- Agency ----
  { key: "leads", label: "Leads Pipeline", href: "/dashboard/leads", group: "Agency",
    actions: [
      ...crud("View-clients", "Manage-clients"),
      { action: "convert", label: "Convert", legacy: ["Manage-clients"] },
    ] },
  { key: "clients", label: "Clients", href: "/dashboard/clients", group: "Agency",
    actions: crud("View-clients", "Manage-clients") },
  { key: "contracts", label: "Contracts & SOW", href: "/dashboard/contracts", group: "Agency",
    actions: crud("View-clients", "Manage-clients") },
  { key: "credentials", label: "Credentials", href: "/dashboard/credentials", group: "Agency",
    actions: [
      ...crud("View-credentials", "Manage-credentials"),
      { action: "reveal", label: "Reveal", legacy: ["View-credentials"] },
    ] },
  { key: "utilities", label: "Utilities", href: "/dashboard/utilities", group: "Agency",
    actions: crud("View-utilities", "Manage-settings") },
  { key: "festivals", label: "Festivals", href: "/dashboard/festivals", group: "Agency",
    actions: crud("View-festivals", "Manage-festival") },

  // ---- Finance ----
  { key: "companies", label: "Companies", href: "/dashboard/companies", group: "Finance",
    actions: crud("View-companies", "Manage-companies") },
  { key: "quotations", label: "Quotations", href: "/dashboard/quotations", group: "Finance",
    actions: [
      ...crud("View-quotations", "Manage-quotations"),
      { action: "share", label: "Share link", legacy: ["Manage-quotations"] },
      { action: "convert", label: "Convert to invoice", legacy: ["Manage-invoices"] },
    ] },
  { key: "invoices", label: "Invoices", href: "/dashboard/invoices", group: "Finance",
    actions: [
      ...crud("View-invoices", "Manage-invoices"),
      { action: "share", label: "Share link", legacy: ["Manage-invoices"] },
    ] },
  { key: "expenses", label: "Expenses & Margins", href: "/dashboard/expenses", group: "Finance",
    actions: crud("View-reports", "Manage-settings") },

  // ---- People ----
  { key: "users", label: "User Management", href: "/dashboard/users", group: "People",
    actions: crud("Manage-User", "Manage-User") },
  { key: "hrms", label: "Recruitment & HRMS", href: "/dashboard/hrms", group: "People",
    actions: [
      ...crud("View-hrms", "Manage-hrms"),
      { action: "approve", label: "Approve offer", legacy: ["Manage-offers"] },
    ] },
  { key: "attendance", label: "Attendance", href: "/dashboard/attendance", group: "People",
    actions: [
      { action: "read", label: "Read", legacy: ["View-attendance"] },
      { action: "create", label: "Create", legacy: ["Manage-attendance"] },
      { action: "update", label: "Update", legacy: ["Manage-attendance"] },
      { action: "delete", label: "Delete", legacy: ["Manage-attendance"] },
      { action: "approve", label: "Approve", legacy: ["Approve-attendance"] },
    ] },
  { key: "leaves", label: "Leaves", href: "/dashboard/attendance", group: "People",
    actions: [
      { action: "read", label: "Read", legacy: ["View-leaves"] },
      { action: "create", label: "Create", legacy: ["Manage-leaves"] },
      { action: "update", label: "Update", legacy: ["Manage-leaves"] },
      { action: "delete", label: "Delete", legacy: ["Manage-leaves"] },
      { action: "approve", label: "Approve", legacy: ["Approve-leaves"] },
    ] },
  { key: "payroll", label: "Payroll", href: "/dashboard/payroll", group: "People",
    actions: [
      { action: "read", label: "Read", legacy: ["View-payroll"] },
      { action: "create", label: "Create", legacy: ["Manage-payroll"] },
      { action: "update", label: "Update", legacy: ["Manage-payroll", "Manage-loans", "Manage-fnf"] },
      { action: "delete", label: "Delete", legacy: ["Manage-payroll"] },
      { action: "approve", label: "Approve & publish", legacy: ["Approve-payroll"] },
      { action: "export", label: "Export", legacy: ["View-payroll"] },
    ] },
  { key: "salary", label: "Salary Structures", group: "People",
    actions: [
      { action: "read", label: "Read", legacy: ["View-salary"] },
      { action: "update", label: "Update", legacy: ["Manage-salary"] },
    ] },

  // ---- System ----
  { key: "roles", label: "Roles & Permissions", href: "/dashboard/users", group: "System",
    actions: [
      { action: "read", label: "Read", legacy: ["Manage-settings", "Manage-User"] },
      { action: "update", label: "Update", legacy: ["Manage-settings"] },
    ] },
  { key: "settings", label: "Settings", href: "/dashboard/settings", group: "System",
    actions: [
      { action: "read", label: "Read", legacy: ["Manage-settings"] },
      { action: "update", label: "Update", legacy: ["Manage-settings"] },
    ] },
]

/** `module:action` — the canonical permission name stored in the database. */
export const permissionName = (module: string, action: Action | string) => `${module}:${action}`

const moduleIndex = new Map(MODULES.map((m) => [m.key, m]))
export const getModule = (key: string) => moduleIndex.get(key)

/** Every canonical permission, flattened — used by the seed and the migration. */
export function allPermissions(): {
  name: string
  module: string
  action: string
  label: string
  description: string
  legacy: string[]
  baseline: boolean
}[] {
  return MODULES.flatMap((m) =>
    m.actions.map((a) => ({
      name: permissionName(m.key, a.action),
      module: m.key,
      action: a.action,
      label: a.label,
      description: `${a.label} access for ${m.label}`,
      legacy: a.legacy,
      baseline: !!a.baseline,
    })),
  )
}

/**
 * The names that satisfy one check: the canonical one plus its legacy aliases.
 * Holding ANY of them grants the action, which is what keeps pre-migration roles working.
 */
export function namesSatisfying(module: string, action: Action | string): string[] {
  const found = moduleIndex.get(module)?.actions.find((a) => a.action === action)
  return [permissionName(module, action), ...(found?.legacy ?? [])]
}
