import type { TaskStatus } from "./task";

/** Sections the caller lacks permission to read come back as null. */
export interface DashboardSummary {
  invoices: {
    totalBilled: number;
    totalOutstanding: number;
    count: number;
    revenueByMonth: { label: string; value: number }[];
  } | null;
  projects: { total: number; active: number } | null;
  tasks: {
    total: number;
    pending: number;
    overdue: number;
    byStatus: Partial<Record<TaskStatus, number>>;
  };
  /** Work assigned to the viewer, regardless of what else they may see. */
  myTasks: {
    open: number;
    overdue: number;
    dueSoon: number;
    completed: number;
  };
}
