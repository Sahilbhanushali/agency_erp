import type { AuthUser } from "@/context/AuthContext";
import {
  Briefcase,
  Building2,
  FolderKanban,
  House,
  LayoutGrid,
  ListTodo,
  Receipt,
  ShieldCheck,
  UsersRound,
  Wallet,
  type LucideIcon,
} from "lucide-react";

interface SidebarNavItem {
  title?: string;
  url?: string;
  icon?: LucideIcon;
  label?: string;
  /** Permission code (e.g. "clients:read") required to see this item. Omit for items open to any authenticated user. */
  permission?: string;
  /** Restrict to the platform SUPER_ADMIN role, for modules with no per-permission access (e.g. Companies). */
  superAdminOnly?: boolean;
}

const NAV_ITEMS: SidebarNavItem[] = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: House,
  },
  {
    title: "My Tasks",
    url: "/tasks",
    icon: ListTodo,
  },
  {
    label: "Application",
  },
  {
    title: "Companies",
    url: "/companies-list",
    icon: Building2,
    superAdminOnly: true,
  },
  {
    title: "Clients",
    url: "/clients-list",
    icon: Briefcase,
    permission: "clients:read",
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
    title: "Quotations",
    url: "/quotations-list",
    icon: Receipt,
    permission: "quotations:read",
  },
  {
    title: "Billing",
    url: "/invoices-list",
    icon: Wallet,
    permission: "invoices:read",
  },
  {
    title: "Users",
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
