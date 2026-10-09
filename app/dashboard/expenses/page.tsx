"use client";

import React, { useState, useMemo } from "react";
import useSWR from "swr";
import Link from "next/link";
import toast from "react-hot-toast";
import { format } from "date-fns";
import {
  Receipt,
  Plus,
  Search,
  Filter,
  DollarSign,
  TrendingUp,
  TrendingDown,
  PieChart,
  FolderKanban,
  Building2,
  FileText,
  CreditCard,
  Edit,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Layers,
  ArrowUpRight,
} from "lucide-react";

import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { getMediaUrl } from "@/lib/utils";
import { ExpenseDialog } from "@/components/expenses/expense-dialog";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const CATEGORY_NAMES: Record<string, string> = {
  SOFTWARE_TOOL: "Software & SaaS",
  CONTRACTOR_FREELANCER: "Contractors & Freelance",
  AD_SPEND: "Ad Spend",
  SHOOT_PRODUCTION: "Shoot & Studio",
  OFFICE_TRAVEL: "Travel & Office",
  HARDWARE_EQUIPMENT: "Hardware & Gear",
  OTHER: "Operational",
};

export default function ExpensesPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<any | null>(null);

  // Fetch expenses list
  const { data: expensesData, isLoading: expensesLoading, mutate: mutateExpenses } = useSWR(
    `/api/expenses?status=${statusFilter}&category=${categoryFilter}`,
    fetcher
  );

  // Fetch profitability report
  const { data: reportData, isLoading: reportLoading, mutate: mutateReport } = useSWR(
    "/api/reports/profitability",
    fetcher
  );

  const expenses: any[] = expensesData?.expenses || [];
  const metrics = expensesData?.metrics || {
    totalExpenses: 0,
    billableExpenses: 0,
    nonBillableExpenses: 0,
    pendingCount: 0,
    categoryBreakdown: {},
  };

  const agencyMetrics = reportData?.agencyMetrics || {
    totalRevenue: 0,
    totalExpenses: 0,
    netProfit: 0,
    marginPercent: 0,
    categoryBreakdown: {},
  };

  const projectProfitability: any[] = reportData?.projectProfitability || [];
  const clientProfitability: any[] = reportData?.clientProfitability || [];

  const filteredExpenses = useMemo(() => {
    if (!search.trim()) return expenses;
    const q = search.toLowerCase();
    return expenses.filter(
      (e) =>
        e.title?.toLowerCase().includes(q) ||
        e.client?.name?.toLowerCase().includes(q) ||
        e.client?.company?.toLowerCase().includes(q) ||
        e.project?.name?.toLowerCase().includes(q) ||
        e.notes?.toLowerCase().includes(q)
    );
  }, [expenses, search]);

  const handleDeleteExpense = async (id: string) => {
    if (!confirm("Are you sure you want to delete this expense record?")) return;
    try {
      const res = await fetch(`/api/expenses/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete expense");
      toast.success("Expense deleted successfully");
      mutateExpenses();
      mutateReport();
    } catch (err: any) {
      toast.error(err.message || "Error deleting expense");
    }
  };

  const formatCurrency = (val: number | string) => {
    return `₹${Number(val || 0).toLocaleString("en-IN")}`;
  };

  const getMarginBadge = (margin: number, status: string) => {
    if (status === "DEFICIT" || margin < 0) {
      return (
        <Badge variant="destructive" className="text-[10px]">
          {margin}% Deficit
        </Badge>
      );
    }
    if (status === "LOW_MARGIN" || margin < 20) {
      return (
        <Badge variant="neutral" className="text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-400">
          {margin}% Low
        </Badge>
      );
    }
    if (status === "MODERATE" || margin < 40) {
      return (
        <Badge variant="outline" className="text-[10px]">
          {margin}% Moderate
        </Badge>
      );
    }
    return (
      <Badge variant="success" className="text-[10px]">
        {margin}% Healthy
      </Badge>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      {/* Top Header */}
      <PageHeader
        title="Expenses & Profitability"
        description="Monitor agency operational costs, direct project expenses, and real-time profit margins."
      >
        <Button
          size="sm"
          className="text-xs"
          onClick={() => {
            setSelectedExpense(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="size-3.5 mr-1.5" />
          Log Expense
        </Button>
      </PageHeader>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Agency Revenue */}
        <Card className="shadow-2xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-muted-foreground mb-1">
              <span className="text-xs font-medium">Invoiced Revenue</span>
              <DollarSign className="size-4 text-emerald-600" />
            </div>
            <div className="text-xl font-bold tracking-tight text-foreground">
              {formatCurrency(agencyMetrics.totalRevenue)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Commercial billings</p>
          </CardContent>
        </Card>

        {/* Total Agency Expenses */}
        <Card className="shadow-2xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-muted-foreground mb-1">
              <span className="text-xs font-medium">Total Expenses</span>
              <Receipt className="size-4 text-primary" />
            </div>
            <div className="text-xl font-bold tracking-tight text-foreground">
              {formatCurrency(metrics.totalExpenses)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              ₹{Number(metrics.billableExpenses).toLocaleString("en-IN")} billable
            </p>
          </CardContent>
        </Card>

        {/* Net Agency Profit */}
        <Card className="shadow-2xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-muted-foreground mb-1">
              <span className="text-xs font-medium">Net Gross Profit</span>
              {agencyMetrics.netProfit >= 0 ? (
                <TrendingUp className="size-4 text-emerald-600" />
              ) : (
                <TrendingDown className="size-4 text-rose-600" />
              )}
            </div>
            <div
              className={`text-xl font-bold tracking-tight ${
                agencyMetrics.netProfit >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-600"
              }`}
            >
              {formatCurrency(agencyMetrics.netProfit)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Revenue minus approved expenses
            </p>
          </CardContent>
        </Card>

        {/* Agency Gross Margin % */}
        <Card className="shadow-2xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-muted-foreground mb-1">
              <span className="text-xs font-medium">Profit Margin</span>
              <PieChart className="size-4 text-sky-600" />
            </div>
            <div className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <span>{agencyMetrics.marginPercent}%</span>
              {getMarginBadge(agencyMetrics.marginPercent, agencyMetrics.marginPercent >= 35 ? "HEALTHY" : "MODERATE")}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Agency margin efficiency
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="expenses" className="space-y-4">
        <TabsList className="bg-muted p-1">
          <TabsTrigger value="expenses" className="text-xs">
            All Expenses ({expenses.length})
          </TabsTrigger>
          <TabsTrigger value="projects" className="text-xs">
            Project Profitability ({projectProfitability.length})
          </TabsTrigger>
          <TabsTrigger value="clients" className="text-xs">
            Client Profitability ({clientProfitability.length})
          </TabsTrigger>
          <TabsTrigger value="categories" className="text-xs">
            Cost Distribution
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: All Expenses */}
        <TabsContent value="expenses" className="space-y-4">
          <Card className="shadow-2xs">
            <CardHeader className="pb-3 border-b border-border/50">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search expenses, clients, projects..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8 text-xs h-8"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="text-xs h-8 w-36">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL" className="text-xs">All Categories</SelectItem>
                      <SelectItem value="SOFTWARE_TOOL" className="text-xs">Software & SaaS</SelectItem>
                      <SelectItem value="CONTRACTOR_FREELANCER" className="text-xs">Contractors</SelectItem>
                      <SelectItem value="AD_SPEND" className="text-xs">Ad Spend</SelectItem>
                      <SelectItem value="SHOOT_PRODUCTION" className="text-xs">Shoot & Studio</SelectItem>
                      <SelectItem value="OFFICE_TRAVEL" className="text-xs">Office & Travel</SelectItem>
                      <SelectItem value="HARDWARE_EQUIPMENT" className="text-xs">Hardware</SelectItem>
                      <SelectItem value="OTHER" className="text-xs">Other</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="text-xs h-8 w-32">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL" className="text-xs">All Statuses</SelectItem>
                      <SelectItem value="APPROVED" className="text-xs">Approved</SelectItem>
                      <SelectItem value="PENDING" className="text-xs">Pending</SelectItem>
                      <SelectItem value="REIMBURSED" className="text-xs">Reimbursed</SelectItem>
                      <SelectItem value="REJECTED" className="text-xs">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              {expensesLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : filteredExpenses.length === 0 ? (
                <EmptyState
                  icon={Receipt}
                  title="No expenses recorded"
                  description="Log freelancer costs, software tools, or shoot expenses to monitor project profitability."
                  actionLabel="Log First Expense"
                  onAction={() => {
                    setSelectedExpense(null);
                    setDialogOpen(true);
                  }}
                />
              ) : (
                <div className="rounded-lg border border-border/60 overflow-hidden">
                  <Table>
                    <TableHeader className="bg-muted/40">
                      <TableRow>
                        <TableHead className="text-xs font-semibold">Date</TableHead>
                        <TableHead className="text-xs font-semibold">Expense Title</TableHead>
                        <TableHead className="text-xs font-semibold">Category</TableHead>
                        <TableHead className="text-xs font-semibold">Attribution</TableHead>
                        <TableHead className="text-xs font-semibold text-right">Amount</TableHead>
                        <TableHead className="text-xs font-semibold text-center">Status</TableHead>
                        <TableHead className="text-xs font-semibold text-center">Receipt</TableHead>
                        <TableHead className="text-xs font-semibold text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredExpenses.map((exp) => (
                        <TableRow key={exp.id} className="hover:bg-muted/30">
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {format(new Date(exp.date), "MMM d, yyyy")}
                          </TableCell>

                          <TableCell className="text-xs font-medium">
                            <span className="font-semibold text-foreground block">
                              {exp.title}
                            </span>
                            {exp.isBillable && (
                              <Badge variant="outline" className="text-[9px] font-normal mt-0.5">
                                Billable to client
                              </Badge>
                            )}
                          </TableCell>

                          <TableCell className="text-xs">
                            <Badge variant="outline" className="text-[10px]">
                              {CATEGORY_NAMES[exp.category] || exp.category}
                            </Badge>
                          </TableCell>

                          <TableCell className="text-xs">
                            {exp.client ? (
                              <div className="text-foreground font-medium">
                                {exp.client.company || exp.client.name}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">Agency Overhead</span>
                            )}
                            {exp.project && (
                              <div className="text-[11px] text-muted-foreground">
                                {exp.project.name}
                              </div>
                            )}
                          </TableCell>

                          <TableCell className="text-xs text-right font-semibold tabular-nums">
                            {formatCurrency(exp.amount)}
                          </TableCell>

                          <TableCell className="text-xs text-center">
                            {exp.status === "APPROVED" && (
                              <Badge variant="success" className="text-[10px]">
                                Approved
                              </Badge>
                            )}
                            {exp.status === "PENDING" && (
                              <Badge variant="neutral" className="text-[10px]">
                                Pending
                              </Badge>
                            )}
                            {exp.status === "REIMBURSED" && (
                              <Badge variant="outline" className="text-[10px] text-emerald-600">
                                Reimbursed
                              </Badge>
                            )}
                            {exp.status === "REJECTED" && (
                              <Badge variant="destructive" className="text-[10px]">
                                Rejected
                              </Badge>
                            )}
                          </TableCell>

                          <TableCell className="text-xs text-center">
                            {exp.receiptUrl ? (
                              <a
                                href={getMediaUrl(exp.receiptUrl)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                              >
                                <FileText className="size-3" /> Receipt
                              </a>
                            ) : (
                              <span className="text-muted-foreground text-[11px]">—</span>
                            )}
                          </TableCell>

                          <TableCell className="text-xs text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="size-7"
                                title="Edit Expense"
                                onClick={() => {
                                  setSelectedExpense(exp);
                                  setDialogOpen(true);
                                }}
                              >
                                <Edit className="size-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="size-7 text-destructive hover:text-destructive"
                                title="Delete"
                                onClick={() => handleDeleteExpense(exp.id)}
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Project Profitability */}
        <TabsContent value="projects" className="space-y-4">
          <Card className="shadow-2xs">
            <CardHeader className="pb-3 border-b border-border/50">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <FolderKanban className="size-4 text-primary" />
                Project Margins & Profitability Breakdown
              </CardTitle>
              <CardDescription className="text-xs">
                Real-time gross margin per marketing campaign workspace based on billings vs direct contractor & tool costs.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              {reportLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : projectProfitability.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  No project billing or expense records available yet.
                </div>
              ) : (
                <div className="rounded-lg border border-border/60 overflow-hidden">
                  <Table>
                    <TableHeader className="bg-muted/40">
                      <TableRow>
                        <TableHead className="text-xs font-semibold">Project Name</TableHead>
                        <TableHead className="text-xs font-semibold">Client</TableHead>
                        <TableHead className="text-xs font-semibold text-right">Revenue (Invoiced)</TableHead>
                        <TableHead className="text-xs font-semibold text-right">Direct Expenses</TableHead>
                        <TableHead className="text-xs font-semibold text-right">Net Margin</TableHead>
                        <TableHead className="text-xs font-semibold text-center">Margin %</TableHead>
                        <TableHead className="text-xs font-semibold text-right">Workspace</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {projectProfitability.map((p) => (
                        <TableRow key={p.id} className="hover:bg-muted/30">
                          <TableCell className="text-xs font-semibold text-foreground">
                            {p.name}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {p.clientName}
                          </TableCell>
                          <TableCell className="text-xs text-right font-medium tabular-nums">
                            {formatCurrency(p.revenue)}
                          </TableCell>
                          <TableCell className="text-xs text-right font-medium text-muted-foreground tabular-nums">
                            {formatCurrency(p.expenses)}
                          </TableCell>
                          <TableCell
                            className={`text-xs text-right font-semibold tabular-nums ${
                              p.profit >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-600"
                            }`}
                          >
                            {formatCurrency(p.profit)}
                          </TableCell>
                          <TableCell className="text-xs text-center">
                            {getMarginBadge(p.margin, p.status)}
                          </TableCell>
                          <TableCell className="text-xs text-right">
                            <Button asChild variant="ghost" size="sm" className="h-7 text-xs">
                              <Link href={`/dashboard/projects/${p.id}`}>
                                View <ArrowUpRight className="size-3 ml-1" />
                              </Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Client Profitability */}
        <TabsContent value="clients" className="space-y-4">
          <Card className="shadow-2xs">
            <CardHeader className="pb-3 border-b border-border/50">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Building2 className="size-4 text-primary" />
                Client Account Margins & Lifetime Value
              </CardTitle>
              <CardDescription className="text-xs">
                Total commercial revenue vs delivery expenditure across each client's retainers and campaigns.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              {reportLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : clientProfitability.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  No client financial records available yet.
                </div>
              ) : (
                <div className="rounded-lg border border-border/60 overflow-hidden">
                  <Table>
                    <TableHeader className="bg-muted/40">
                      <TableRow>
                        <TableHead className="text-xs font-semibold">Client Company</TableHead>
                        <TableHead className="text-xs font-semibold text-right">Total Revenue</TableHead>
                        <TableHead className="text-xs font-semibold text-right">Total Expenses</TableHead>
                        <TableHead className="text-xs font-semibold text-right">Net Profit</TableHead>
                        <TableHead className="text-xs font-semibold text-center">Profitability</TableHead>
                        <TableHead className="text-xs font-semibold text-right">Profile</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {clientProfitability.map((c) => (
                        <TableRow key={c.id} className="hover:bg-muted/30">
                          <TableCell className="text-xs font-semibold text-foreground">
                            {c.company || c.name}
                          </TableCell>
                          <TableCell className="text-xs text-right font-medium tabular-nums">
                            {formatCurrency(c.revenue)}
                          </TableCell>
                          <TableCell className="text-xs text-right font-medium text-muted-foreground tabular-nums">
                            {formatCurrency(c.expenses)}
                          </TableCell>
                          <TableCell
                            className={`text-xs text-right font-semibold tabular-nums ${
                              c.profit >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-600"
                            }`}
                          >
                            {formatCurrency(c.profit)}
                          </TableCell>
                          <TableCell className="text-xs text-center">
                            {getMarginBadge(c.margin, c.status)}
                          </TableCell>
                          <TableCell className="text-xs text-right">
                            <Button asChild variant="ghost" size="sm" className="h-7 text-xs">
                              <Link href={`/dashboard/clients/${c.id}`}>
                                View <ArrowUpRight className="size-3 ml-1" />
                              </Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 4: Cost Distribution */}
        <TabsContent value="categories" className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {Object.entries(CATEGORY_NAMES).map(([key, label]) => {
              const amount = metrics.categoryBreakdown[key] || 0;
              const percent =
                metrics.totalExpenses > 0
                  ? Number(((amount / metrics.totalExpenses) * 100).toFixed(1))
                  : 0;

              return (
                <Card key={key} className="shadow-2xs">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-foreground">{label}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {percent}%
                      </Badge>
                    </div>
                    <div className="text-lg font-bold text-foreground">
                      {formatCurrency(amount)}
                    </div>
                    <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-primary h-1.5 rounded-full transition-all"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      {/* Expense Modal */}
      <ExpenseDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        expense={selectedExpense}
        onSaved={() => {
          mutateExpenses();
          mutateReport();
        }}
      />
    </div>
  );
}
