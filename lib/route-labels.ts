"use client";

import { useEffect, useState } from "react";

// In-memory cache for dynamic breadcrumb names (ID -> human name)
const breadcrumbCache: Record<string, string> = {
  dashboard: "Workspace",
  projects: "Projects",
  quotations: "Quotations",
  invoices: "Invoices",
  companies: "Companies",
  tasks: "Tasks",
  leads: "Leads",
  users: "Team & HR",
  documents: "Document Verification",
  clients: "Clients",
  assets: "Asset Library",
  calendar: "Calendar",
  festivals: "Festival Posts",
  reports: "Reports & Analytics",
  settings: "Settings",
  profile: "Profile Settings",
  smtp: "SMTP Config",
  credentials: "Credentials",
  approvals: "Approvals",
  utilities: "Utilities",
  hrms: "Recruitment & HRMS",
  new: "Create New",
  edit: "Edit",
  posts: "Posts & Content",
};

const LISTENERS = new Set<() => void>();

export function setCustomBreadcrumbTitle(key: string, title: string) {
  if (!key || !title) return;
  breadcrumbCache[key] = title;
  LISTENERS.forEach((fn) => fn());
}

export function isIdSegment(segment: string): boolean {
  if (!segment) return false;
  // CUID, UUID, or pure numeric ID
  return (
    /^\d+$/.test(segment) ||
    /^[a-z0-9]{20,}$/i.test(segment) ||
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment)
  );
}

export function getBreadcrumbTitle(segment: string, parentSegment?: string): string {
  const normalized = segment.toLowerCase();
  
  if (breadcrumbCache[segment]) {
    return breadcrumbCache[segment];
  }

  if (breadcrumbCache[normalized]) {
    return breadcrumbCache[normalized];
  }

  // Check if segment is an ID
  if (isIdSegment(segment)) {
    const parent = parentSegment?.toLowerCase();
    switch (parent) {
      case "projects":
        return "Project Details";
      case "quotations":
        return "Quotation Details";
      case "invoices":
        return "Invoice Details";
      case "clients":
        return "Client Profile";
      case "leads":
        return "Lead Details";
      case "tasks":
        return "Task Details";
      case "companies":
        return "Company Details";
      case "users":
        return "Employee Details";
      default:
        return "Details";
    }
  }

  // Fallback human readable formatting
  return segment
    .split(/[-_]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Hook to register an entity's real name for the current page breadcrumb
 */
export function useBreadcrumbTitle(idOrSegment?: string | null, name?: string | null) {
  useEffect(() => {
    if (idOrSegment && name) {
      setCustomBreadcrumbTitle(idOrSegment, name);
    }
  }, [idOrSegment, name]);
}

/**
 * Hook for components (like DashboardLayout) to subscribe to breadcrumb title updates
 */
export function useBreadcrumbs(pathname: string) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const update = () => setTick((t) => t + 1);
    LISTENERS.add(update);
    return () => {
      LISTENERS.delete(update);
    };
  }, []);

  const segments = pathname.split("/").filter(Boolean);
  return segments.map((seg, i) => {
    const href = "/" + segments.slice(0, i + 1).join("/");
    const parent = i > 0 ? segments[i - 1] : undefined;
    const title = getBreadcrumbTitle(seg, parent);
    return { title, href, raw: seg };
  });
}
