import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can, requireCan } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireCan("reports", "read");
    if (!auth.ok) return auth.response;

    // This report aggregates invoice totals and expense figures, so seeing it means
    // seeing the money. Reports access alone is not enough.
    if (!(await can(auth.session, "invoices", "read"))) {
      return NextResponse.json(
        { error: "Forbidden: this report exposes invoice and expense figures" },
        { status: 403 },
      );
    }
    const session = auth.session as any;
    // Load all approved/reimbursed expenses
    const expenses = await prisma.expense.findMany({
      where: {
        status: { in: ["APPROVED", "REIMBURSED"] },
      },
      include: {
        project: { select: { id: true, name: true, clientId: true } },
        client: { select: { id: true, name: true, company: true } },
      },
    });

    // Load all invoices (excluding cancelled)
    const invoices = await prisma.invoice.findMany({
      where: {
        status: { not: "CANCELLED" },
      },
      include: {
        project: { select: { id: true, name: true } },
        client: { select: { id: true, name: true, company: true } },
      },
    });

    // Load all projects
    const projects = await prisma.project.findMany({
      select: {
        id: true,
        name: true,
        client: { select: { id: true, name: true, company: true } },
      },
    });

    // Load all clients
    const clients = await prisma.client.findMany({
      select: {
        id: true,
        name: true,
        company: true,
      },
    });

    // 1. Overall Agency Metrics
    let agencyRevenue = 0;
    for (const inv of invoices) {
      agencyRevenue += Number(inv.totalAmount || 0);
    }

    let agencyExpenses = 0;
    const categoryBreakdown: Record<string, number> = {};
    for (const exp of expenses) {
      const amt = Number(exp.amount || 0);
      agencyExpenses += amt;
      categoryBreakdown[exp.category] = (categoryBreakdown[exp.category] || 0) + amt;
    }

    const agencyProfit = agencyRevenue - agencyExpenses;
    const agencyMargin =
      agencyRevenue > 0 ? Number(((agencyProfit / agencyRevenue) * 100).toFixed(1)) : 0;

    // 2. Per-Project Profitability
    const projectRevenueMap: Record<string, number> = {};
    for (const inv of invoices) {
      if (inv.projectId) {
        projectRevenueMap[inv.projectId] =
          (projectRevenueMap[inv.projectId] || 0) + Number(inv.totalAmount || 0);
      }
    }

    const projectExpenseMap: Record<string, number> = {};
    for (const exp of expenses) {
      if (exp.projectId) {
        projectExpenseMap[exp.projectId] =
          (projectExpenseMap[exp.projectId] || 0) + Number(exp.amount || 0);
      }
    }

    const projectProfitability = projects
      .map((proj) => {
        const rev = projectRevenueMap[proj.id] || 0;
        const exp = projectExpenseMap[proj.id] || 0;
        const profit = rev - exp;
        const margin = rev > 0 ? Number(((profit / rev) * 100).toFixed(1)) : exp > 0 ? -100 : 0;

        let status = "HEALTHY";
        if (profit < 0) status = "DEFICIT";
        else if (margin < 20) status = "LOW_MARGIN";
        else if (margin < 40) status = "MODERATE";

        return {
          id: proj.id,
          name: proj.name,
          clientName: proj.client?.company || proj.client?.name || "Independent",
          revenue: rev,
          expenses: exp,
          profit,
          margin,
          status,
        };
      })
      .filter((p) => p.revenue > 0 || p.expenses > 0)
      .sort((a, b) => b.profit - a.profit);

    // 3. Per-Client Profitability
    const clientRevenueMap: Record<string, number> = {};
    for (const inv of invoices) {
      if (inv.clientId) {
        clientRevenueMap[inv.clientId] =
          (clientRevenueMap[inv.clientId] || 0) + Number(inv.totalAmount || 0);
      }
    }

    const clientExpenseMap: Record<string, number> = {};
    for (const exp of expenses) {
      const cId = exp.clientId || exp.project?.clientId;
      if (cId) {
        clientExpenseMap[cId] = (clientExpenseMap[cId] || 0) + Number(exp.amount || 0);
      }
    }

    const clientProfitability = clients
      .map((cl) => {
        const rev = clientRevenueMap[cl.id] || 0;
        const exp = clientExpenseMap[cl.id] || 0;
        const profit = rev - exp;
        const margin = rev > 0 ? Number(((profit / rev) * 100).toFixed(1)) : exp > 0 ? -100 : 0;

        let status = "HEALTHY";
        if (profit < 0) status = "DEFICIT";
        else if (margin < 20) status = "LOW_MARGIN";
        else if (margin < 40) status = "MODERATE";

        return {
          id: cl.id,
          name: cl.name,
          company: cl.company || cl.name,
          revenue: rev,
          expenses: exp,
          profit,
          margin,
          status,
        };
      })
      .filter((c) => c.revenue > 0 || c.expenses > 0)
      .sort((a, b) => b.profit - a.profit);

    return NextResponse.json({
      agencyMetrics: {
        totalRevenue: agencyRevenue,
        totalExpenses: agencyExpenses,
        netProfit: agencyProfit,
        marginPercent: agencyMargin,
        categoryBreakdown,
      },
      projectProfitability,
      clientProfitability,
    });
  } catch (error: any) {
    console.error("Failed to calculate profitability:", error);
    return NextResponse.json(
      { error: "Failed to calculate profitability", details: error.message },
      { status: 500 }
    );
  }
}
