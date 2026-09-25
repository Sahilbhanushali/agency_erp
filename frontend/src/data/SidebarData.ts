import type { AuthUser } from "@/context/AuthContext";
import {
  Briefcase,
  Building2,
  CalendarDays,
  CheckCheck,
  CheckSquare,
  FileText,
  FolderKanban,
  LayoutDashboard,
  LayoutGrid,
  Link2,
  Megaphone,
  Receipt,
  ShieldCheck,
  Target,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

export interface SidebarNavItem {
  title?: string;
  url?: string;
  icon?: LucideIcon;
  label?: string;
  badge?: string | number;
  /** Permission code (e.g. "clients:read") required to see this item. Omit for items open to any authenticated user. */
  permission?: string;
  /** Restrict to the platform SUPER_ADMIN role, for modules with no per-permission access (e.g. Companies). */
  superAdminOnly?: boolean;
}

const NAV_ITEMS: SidebarNavItem[] = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "My Tasks",
    url: "/tasks",
    icon: CheckSquare,
  },
  {
    label: "Sales",
  },
  {
    title: "Leads",
    url: "/leads",
    icon: Target,
    permission: "leads:read",
  },
  {
    label: "Delivery",
  },
  {
    title: "Projects",
    url: "/projects-list",
    icon: FolderKanban,
    permission: "projects:read",
  },
  {
    title: "Workspaces",
    url: "/workspaces-list",
    icon: LayoutGrid,
    permission: "workspaces:read",
  },
  {
    title: "Clients",
    url: "/clients-list",
    icon: Briefcase,
    permission: "clients:read",
  },
  {
    title: "Approvals",
    url: "/approvals",
    icon: CheckCheck,
    permission: "approvals:read",
  },
  {
    label: "Marketing",
  },
  {
    title: "Campaigns",
    url: "/campaigns-list",
    icon: Megaphone,
    permission: "campaigns:read",
  },
  {
    title: "Content",
    url: "/content",
    icon: FileText,
    permission: "posts:read",
  },
  {
    title: "Content Calendar",
    url: "/content/calendar",
    icon: CalendarDays,
    permission: "posts:read",
  },
  {
    title: "Social Accounts",
    url: "/social-accounts",
    icon: Link2,
    permission: "social_accounts:read",
  },
  {
    label: "Financials",
  },
  {
    title: "Invoices & Billing",
    url: "/invoices-list",
    icon: Receipt,
    permission: "invoices:read",
  },
  {
    title: "Quotations",
    url: "/quotations-list",
    icon: FileText,
    permission: "quotations:read",
  },
  {
    label: "Organization",
  },
  {
    title: "Team Members",
    url: "/users-list",
    icon: UsersRound,
    permission: "users:read",
  },
  {
    title: "Roles & Permissions",
    url: "/roles-list",
    icon: ShieldCheck,
    permission: "roles:read",
  },
  {
    title: "Companies",
    url: "/companies-list",
    icon: Building2,
    superAdminOnly: true,
  },
];

/** Filters the sidebar to modules the user can actually access, and drops any section label left with nothing under it. */
export function getSidebarNav(user: AuthUser | null): SidebarNavItem[] {
  const isSuperAdmin = user?.roleName === "SUPER_ADMIN";
  const canAccess = (item: SidebarNavItem) => {
    if (item.label) return true;
    if (item.superAdminOnly) return isSuperAdmin;
    if (item.permission) return isSuperAdmin || !!user?.permissions.includes(item.permission);
    return true;
  };

  const visible = NAV_ITEMS.filter(canAccess);

  return visible.filter((item, index) => {
    if (!item.label) return true;
    const next = visible[index + 1];
    return !!next && !next.label;
  });
}
