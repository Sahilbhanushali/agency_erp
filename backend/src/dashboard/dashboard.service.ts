import { Injectable } from '@nestjs/common';
import { Prisma, ProjectStatus, TaskStatus } from '@prisma/client';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import {
  hasPermission,
  taskScopeFilter,
} from '../common/utils/tenant-scope.util';
import { PrismaService } from '../prisma/prisma.service';
import { DashboardQueryDto } from './dto/dashboard-query.dto';

const OPEN_TASK_STATUSES = [
  TaskStatus.TODO,
  TaskStatus.IN_PROGRESS,
  TaskStatus.IN_REVIEW,
  TaskStatus.NEEDS_REVISION,
  TaskStatus.ADMIN_APPROVED,
  TaskStatus.CLIENT_PENDING,
];

const REVENUE_MONTHS = 6;

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Every figure here is aggregated in the database. The dashboard must never
   * derive totals from a page of rows — that silently under-reports money.
   */
  async summary(actor: CurrentUserPayload, query: DashboardQueryDto) {
    const companyId =
      actor.roleName === 'SUPER_ADMIN' ? query.companyId : actor.companyId;
    const companyFilter = companyId ? { companyId } : {};

    const canSeeInvoices = hasPermission(actor, 'invoices:read');
    const canSeeProjects = hasPermission(actor, 'projects:read');

    const [invoices, projects, tasks, myTasks] = await Promise.all([
      canSeeInvoices ? this.invoiceSummary(companyId) : null,
      canSeeProjects ? this.projectSummary(companyFilter) : null,
      this.taskSummary(actor, query.companyId),
      this.myTaskSummary(actor),
    ]);

    // A null section means "not permitted", which the UI must hide rather than
    // render as a zero — an employee seeing "invoiced 0" would be told a falsehood.
    return { invoices, projects, tasks, myTasks };
  }

  private async invoiceSummary(companyId: string | null | undefined) {
    const where: Prisma.InvoiceWhereInput = {
      deletedAt: null,
      ...(companyId ? { companyId } : {}),
    };

    const [totals, outstanding, revenueByMonth] = await Promise.all([
      this.prisma.invoice.aggregate({
        where,
        _sum: { totalAmount: true },
        _count: true,
      }),
      this.outstandingTotal(companyId),
      this.revenueByMonth(where),
    ]);

    return {
      totalBilled: Number(totals._sum.totalAmount ?? 0),
      totalOutstanding: outstanding,
      count: totals._count,
      revenueByMonth,
    };
  }

  /**
   * Balance is clamped per invoice, matching how a row renders in the list, so an
   * overpayment on one invoice cannot mask another's arrears. MySQL-specific.
   */
  private async outstandingTotal(companyId: string | null | undefined) {
    const rows = await this.prisma.$queryRaw<{ outstanding: number | null }[]>`
      SELECT SUM(GREATEST(0, i.totalAmount - COALESCE(p.paid, 0))) AS outstanding
      FROM itsme_invoices i
      LEFT JOIN (
        SELECT invoiceId, SUM(amount) AS paid
        FROM itsme_payments
        WHERE deletedAt IS NULL
        GROUP BY invoiceId
      ) p ON p.invoiceId = i.id
      WHERE i.deletedAt IS NULL
        AND (${companyId ?? null} IS NULL OR i.companyId = ${companyId ?? null})
    `;
    return Number(rows[0]?.outstanding ?? 0);
  }

  private async revenueByMonth(where: Prisma.InvoiceWhereInput) {
    const start = new Date();
    start.setMonth(start.getMonth() - (REVENUE_MONTHS - 1));
    start.setDate(1);
    start.setHours(0, 0, 0, 0);

    // Bounded by the window, so this stays a small read rather than the whole table.
    const invoices = await this.prisma.invoice.findMany({
      where: { ...where, issueDate: { gte: start } },
      select: { issueDate: true, totalAmount: true },
    });

    const buckets = new Map<string, number>();
    for (let i = 0; i < REVENUE_MONTHS; i++) {
      const month = new Date(start);
      month.setMonth(start.getMonth() + i);
      buckets.set(this.monthKey(month), 0);
    }

    for (const invoice of invoices) {
      const key = this.monthKey(invoice.issueDate);
      if (buckets.has(key)) {
        buckets.set(key, buckets.get(key)! + Number(invoice.totalAmount));
      }
    }

    return [...buckets].map(([label, value]) => ({ label, value }));
  }

  private monthKey(date: Date) {
    return date.toLocaleString('en-US', { month: 'short', year: '2-digit' });
  }

  private async projectSummary(companyFilter: { companyId?: string }) {
    const where: Prisma.ProjectWhereInput = {
      deletedAt: null,
      ...companyFilter,
    };

    const [total, active] = await this.prisma.$transaction([
      this.prisma.project.count({ where }),
      this.prisma.project.count({
        where: {
          ...where,
          status: { in: [ProjectStatus.ACTIVE, ProjectStatus.IN_REVIEW] },
        },
      }),
    ]);

    return { total, active };
  }

  /**
   * Work assigned to the person asking, whatever their permissions. This is the
   * part of the dashboard that is always theirs, and for most staff it is the
   * only part that matters.
   */
  private async myTaskSummary(actor: CurrentUserPayload) {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const inSevenDays = new Date(startOfToday);
    inSevenDays.setDate(inSevenDays.getDate() + 7);

    const assignedToMe: Prisma.TaskWhereInput = {
      deletedAt: null,
      parentTaskId: null,
      assigneeId: actor.id,
    };
    const stillOpen = { status: { in: OPEN_TASK_STATUSES } };

    const [open, overdue, dueSoon, completed] = await this.prisma.$transaction([
      this.prisma.task.count({ where: { ...assignedToMe, ...stillOpen } }),
      this.prisma.task.count({
        where: {
          ...assignedToMe,
          ...stillOpen,
          dueDate: { lt: startOfToday },
        },
      }),
      this.prisma.task.count({
        where: {
          ...assignedToMe,
          ...stillOpen,
          dueDate: { gte: startOfToday, lte: inSevenDays },
        },
      }),
      this.prisma.task.count({
        where: { ...assignedToMe, status: TaskStatus.DONE },
      }),
    ]);

    return { open, overdue, dueSoon, completed };
  }

  private async taskSummary(
    actor: CurrentUserPayload,
    requestedCompanyId?: string,
  ) {
    const where: Prisma.TaskWhereInput = {
      deletedAt: null,
      parentTaskId: null,
      ...taskScopeFilter(actor, requestedCompanyId),
    };

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [byStatus, overdue] = await Promise.all([
      this.prisma.task.groupBy({
        by: ['status'],
        where,
        _count: { _all: true },
      }),
      this.prisma.task.count({
        where: {
          ...where,
          dueDate: { lt: today },
          status: { in: OPEN_TASK_STATUSES },
        },
      }),
    ]);

    const counts = Object.fromEntries(
      byStatus.map((row) => [row.status, row._count._all]),
    ) as Record<TaskStatus, number | undefined>;

    const total = byStatus.reduce((sum, row) => sum + row._count._all, 0);
    const pending = OPEN_TASK_STATUSES.reduce(
      (sum, status) => sum + (counts[status] ?? 0),
      0,
    );

    return { total, pending, overdue, byStatus: counts };
  }
}
