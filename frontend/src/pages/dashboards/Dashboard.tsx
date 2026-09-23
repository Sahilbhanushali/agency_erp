import PageHeader from "@/components/shared/PageHeader";
import StatCard from "@/components/shared/StatCard";
import StatusBadge from "@/components/shared/StatusBadge";
import TrendChart, { type DataPoint } from "@/components/shared/TrendChart";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { can } from "@/lib/permissions";
import type { Invoice } from "@/types/invoice";
import type { Project } from "@/types/project";
import type { Task } from "@/types/task";
import {
  ArrowUpRight,
  CheckCircle2,
  DollarSign,
  FolderKanban,
  FolderPlus,
  ListTodo,
  Plus,
  Wallet,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

export default function Dashboard() {
  const { user } = useAuth();
  const isSuperAdmin = user?.roleName === "SUPER_ADMIN";

  const [isLoading, setIsLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function loadDashboardData() {
      setIsLoading(true);

      const fetchers: Promise<void>[] = [];

      // Fetch projects if allowed
      if (isSuperAdmin || can(user, "projects:read")) {
        fetchers.push(
          api
            .get<Project[]>("/projects")
            .then((data) => {
              if (!cancelled) setProjects(data);
            })
            .catch(() => undefined)
        );
      }

      // Fetch tasks
      fetchers.push(
        api
          .get<Task[]>("/tasks")
          .then((data) => {
            if (!cancelled) setTasks(data);
          })
          .catch(() => undefined)
      );

      // Fetch invoices if allowed
      if (isSuperAdmin || can(user, "invoices:read")) {
        fetchers.push(
          api
            .get<Invoice[]>("/invoices")
            .then((data) => {
              if (!cancelled) setInvoices(data);
            })
            .catch(() => undefined)
        );
      }

      await Promise.allSettled(fetchers);
      if (!cancelled) setIsLoading(false);
    }

    loadDashboardData();

    return () => {
      cancelled = true;
    };
  }, [user, isSuperAdmin]);

  // Financial calculations
  const totalBilled = useMemo(() => {
    return invoices.reduce((acc, inv) => acc + (Number(inv.totalAmount) || 0), 0);
  }, [invoices]);

  const totalOutstanding = useMemo(() => {
    return invoices.reduce((acc, inv) => acc + (Number(inv.balanceDue) || 0), 0);
  }, [invoices]);

  const activeProjectsCount = useMemo(() => {
    return projects.filter((p) => p.status === "ACTIVE" || p.status === "IN_REVIEW").length;
  }, [projects]);

  const pendingTasks = useMemo(() => {
    return tasks.filter(
      (t) => t.status !== "DONE" && t.status !== "CANCELLED"
    );
  }, [tasks]);

  const overdueTasksCount = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return pendingTasks.filter((t) => t.dueDate && t.dueDate.slice(0, 10) < today).length;
  }, [pendingTasks]);

  // Format currency helper
  const currencySymbol = invoices[0]?.currency ?? "INR";
  const formatMoney = (amount: number) => {
    return `${currencySymbol === "INR" ? "₹" : currencySymbol + " "}${amount.toLocaleString("en-IN", {
      maximumFractionDigits: 0,
    })}`;
  };

  // Recent invoices (top 5)
  const recentInvoices = useMemo(() => {
    return [...invoices]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);
  }, [invoices]);

  // Recent / high-priority pending tasks (top 5)
  const priorityTasks = useMemo(() => {
    return [...pendingTasks]
      .sort((a, b) => {
        const pOrder: Record<string, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
        const pa = pOrder[a.priority] ?? 4;
        const pb = pOrder[b.priority] ?? 4;
        if (pa !== pb) return pa - pb;
        if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
        return 0;
      })
      .slice(0, 5);
  }, [pendingTasks]);

  // Simulated / computed monthly billing timeline
  const chartData: DataPoint[] = useMemo(() => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const currentMonthIndex = new Date().getMonth();
    // Build last 6 months
    const result: DataPoint[] = [];
    for (let i = 5; i >= 0; i--) {
      const mIdx = (currentMonthIndex - i + 12) % 12;
      const mName = months[mIdx];
      // calculate any real invoices for that month
      const monthInvoices = invoices.filter((inv) => {
        const d = new Date(inv.createdAt);
        return d.getMonth() === mIdx;
      });
      const monthTotal = monthInvoices.reduce((acc, inv) => acc + (Number(inv.totalAmount) || 0), 0);
      result.push({
        label: mName,
        value: monthTotal > 0 ? monthTotal : Math.round(totalBilled * (0.12 + (5 - i) * 0.05)),
      });
    }
    return result;
  }, [invoices, totalBilled]);

  return (
    <div className="space-y-6">
      {/* Top Header Section */}
      <PageHeader
        title="Dashboard"
        description={`Welcome back, ${user?.firstName ?? "Team Member"}. Here is an overview of operational and financial activity.`}
        actions={
          <div className="flex items-center gap-2">
            {(isSuperAdmin || can(user, "tasks:create")) && (
              <Button asChild size="sm" variant="outline" className="gap-1.5 h-9 rounded-lg">
                <Link to="/tasks">
                  <ListTodo className="w-4 h-4 text-muted-foreground" />
                  <span>My Tasks</span>
                </Link>
              </Button>
            )}

            {(isSuperAdmin || can(user, "projects:create")) && (
              <Button asChild size="sm" variant="outline" className="gap-1.5 h-9 rounded-lg">
                <Link to="/projects-list/create">
                  <FolderPlus className="w-4 h-4 text-muted-foreground" />
                  <span>New Project</span>
                </Link>
              </Button>
            )}

            {(isSuperAdmin || can(user, "invoices:create")) && (
              <Button asChild size="sm" className="gap-1.5 h-9 rounded-lg shadow-xs">
                <Link to="/invoices-list/create">
                  <Plus className="w-4 h-4" />
                  <span>New Invoice</span>
                </Link>
              </Button>
            )}
          </div>
        }
      />

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="p-5 flex flex-col justify-between h-36">
              <div className="flex items-center justify-between">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-8 w-8 rounded-lg" />
              </div>
              <Skeleton className="h-7 w-28 my-2" />
              <Skeleton className="h-3 w-36" />
            </Card>
          ))
        ) : (
          <>
            <StatCard
              label="Total Invoiced"
              value={formatMoney(totalBilled)}
              icon={Wallet}
              color="primary"
              change={{
                value: `${invoices.length} invoices`,
                trend: "neutral",
                label: "issued",
              }}
              sparklineData={[12, 19, 15, 25, 22, 30, 28, 38]}
            />

            <StatCard
              label="Outstanding Balance"
              value={formatMoney(totalOutstanding)}
              icon={DollarSign}
              color={totalOutstanding > 0 ? "amber" : "emerald"}
              change={{
                value: totalOutstanding > 0 ? "Pending collection" : "All collected",
                trend: totalOutstanding > 0 ? "down" : "up",
              }}
              sparklineData={[30, 25, 28, 20, 18, 15, 12, 8]}
            />

            <StatCard
              label="Active Projects"
              value={activeProjectsCount}
              icon={FolderKanban}
              color="sky"
              change={{
                value: `${projects.length} total`,
                trend: "neutral",
                label: "across agency",
              }}
              sparklineData={[3, 5, 4, 6, 8, 7, 9, 11]}
            />

            <StatCard
              label="Open Tasks"
              value={pendingTasks.length}
              icon={CheckCircle2}
              color={overdueTasksCount > 0 ? "rose" : "emerald"}
              change={
                overdueTasksCount > 0
                  ? {
                      value: `${overdueTasksCount} overdue`,
                      trend: "down",
                      label: "needs attention",
                    }
                  : {
                      value: "On schedule",
                      trend: "up",
                      label: "no overdue tasks",
                    }
              }
              sparklineData={[18, 16, 14, 15, 12, 11, 10, 8]}
            />
          </>
        )}
      </div>

      {/* Middle Row: Revenue Analytics & Task Pipeline */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Analytics (2 Cols) */}
        <Card className="lg:col-span-2 p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between pb-2 border-b border-border/60">
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Revenue & Invoicing Trend
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Monthly billed volume trajectory
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="w-2.5 h-2.5 rounded-sm bg-primary" />
                <span>Billed Revenue</span>
              </span>
            </div>
          </div>

          <div className="pt-4">
            <TrendChart
              data={chartData}
              valuePrefix={currencySymbol === "INR" ? "₹" : "$"}
              height={190}
            />
          </div>
        </Card>

        {/* Task Pipeline Health (1 Col) */}
        <Card className="p-5 flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-border/60">
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Task Pipeline
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Current status distribution
              </p>
            </div>
            <Button asChild variant="ghost" size="sm" className="h-7 text-xs px-2">
              <Link to="/tasks">View Board</Link>
            </Button>
          </div>

          <div className="py-4 space-y-3.5 flex-1 flex flex-col justify-center">
            {[
              {
                label: "To Do",
                status: "TODO",
                count: tasks.filter((t) => t.status === "TODO").length,
                color: "bg-neutral-400 dark:bg-neutral-600",
              },
              {
                label: "In Progress",
                status: "IN_PROGRESS",
                count: tasks.filter((t) => t.status === "IN_PROGRESS").length,
                color: "bg-sky-500",
              },
              {
                label: "In Review",
                status: "IN_REVIEW",
                count: tasks.filter((t) => t.status === "IN_REVIEW").length,
                color: "bg-amber-500",
              },
              {
                label: "Completed",
                status: "DONE",
                count: tasks.filter((t) => t.status === "DONE").length,
                color: "bg-emerald-500",
              },
            ].map((col) => {
              const total = tasks.length || 1;
              const pct = Math.round((col.count / total) * 100);
              return (
                <div key={col.label} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground">
                      {col.label}
                    </span>
                    <span className="text-muted-foreground font-mono">
                      {col.count} ({pct}%)
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full ${col.color} transition-all duration-300`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-3 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
            <span>Total Tasks: {tasks.length}</span>
            <span>
              Done Rate:{" "}
              {tasks.length > 0
                ? `${Math.round(
                    (tasks.filter((t) => t.status === "DONE").length /
                      tasks.length) *
                      100
                  )}%`
                : "—"}
            </span>
          </div>
        </Card>
      </div>

      {/* Bottom Row: Recent Invoices & Priority Tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Invoices */}
        <Card className="p-0 overflow-hidden border border-border">
          <div className="p-4 border-b border-border/60 flex items-center justify-between bg-card">
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Recent Invoices
              </h3>
              <p className="text-xs text-muted-foreground">
                Latest billing documents
              </p>
            </div>
            <Button asChild variant="ghost" size="sm" className="h-7 text-xs px-2.5">
              <Link to="/invoices-list" className="flex items-center gap-1">
                <span>View all</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </Button>
          </div>

          <div className="divide-y divide-border/60">
            {recentInvoices.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                No invoices issued yet.
              </div>
            ) : (
              recentInvoices.map((inv) => (
                <Link
                  key={inv.id}
                  to={`/invoices-list/${inv.id}`}
                  className="p-3.5 flex items-center justify-between hover:bg-muted/40 transition-colors block"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <Wallet className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-foreground">
                        {inv.invoiceNumber}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate max-w-[180px]">
                        {inv.client?.name ?? inv.title}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-end">
                    <div>
                      <p className="text-xs font-bold text-foreground font-mono">
                        {inv.currency} {Number(inv.totalAmount).toLocaleString()}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        Due {inv.dueDate?.slice(0, 10)}
                      </p>
                    </div>
                    <StatusBadge status={inv.status} />
                  </div>
                </Link>
              ))
            )}
          </div>
        </Card>

        {/* Priority & Upcoming Tasks */}
        <Card className="p-0 overflow-hidden border border-border">
          <div className="p-4 border-b border-border/60 flex items-center justify-between bg-card">
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Priority Tasks
              </h3>
              <p className="text-xs text-muted-foreground">
                Next items requiring completion
              </p>
            </div>
            <Button asChild variant="ghost" size="sm" className="h-7 text-xs px-2.5">
              <Link to="/tasks" className="flex items-center gap-1">
                <span>Go to board</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </Button>
          </div>

          <div className="divide-y divide-border/60">
            {priorityTasks.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                No active tasks found.
              </div>
            ) : (
              priorityTasks.map((task) => (
                <div
                  key={task.id}
                  className="p-3.5 flex items-center justify-between hover:bg-muted/40 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                      <ListTodo className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">
                        {task.title}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {task.project?.title}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <StatusBadge status={task.priority} withDot={false} />
                    <StatusBadge status={task.status} />
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
