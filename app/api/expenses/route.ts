import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireCan } from "@/lib/api-auth";
import { createExpenseSchema } from "@/lib/validation/expense";
import { ExpenseCategory, ExpenseStatus, PaymentMethod } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireCan("expenses", "read");
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const category = searchParams.get("category");
    const clientId = searchParams.get("clientId");
    const projectId = searchParams.get("projectId");
    const search = searchParams.get("search");

    const where: any = {};

    if (status && status !== "ALL") {
      where.status = status as ExpenseStatus;
    }

    if (category && category !== "ALL") {
      where.category = category as ExpenseCategory;
    }

    if (clientId) {
      where.clientId = clientId;
    }

    if (projectId) {
      where.projectId = projectId;
    }

    if (search) {
      where.OR = [
        { title: { contains: search } },
        { notes: { contains: search } },
        { client: { name: { contains: search } } },
        { project: { name: { contains: search } } },
      ];
    }

    const expenses = await prisma.expense.findMany({
      where,
      include: {
        client: {
          select: { id: true, name: true, company: true, avatar: true },
        },
        project: {
          select: { id: true, name: true },
        },
        user: {
          select: { id: true, name: true, email: true },
        },
        recordedBy: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { date: "desc" },
    });

    // Compute metrics
    let totalExpenses = 0;
    let billableExpenses = 0;
    let nonBillableExpenses = 0;
    let pendingCount = 0;
    const categoryBreakdown: Record<string, number> = {};

    for (const exp of expenses) {
      const amt = Number(exp.amount || 0);
      totalExpenses += amt;

      if (exp.isBillable) {
        billableExpenses += amt;
      } else {
        nonBillableExpenses += amt;
      }

      if (exp.status === "PENDING") {
        pendingCount += 1;
      }

      categoryBreakdown[exp.category] = (categoryBreakdown[exp.category] || 0) + amt;
    }

    return NextResponse.json({
      expenses,
      metrics: {
        totalExpenses,
        billableExpenses,
        nonBillableExpenses,
        pendingCount,
        categoryBreakdown,
      },
    });
  } catch (error: any) {
    console.error("Failed to load expenses:", error);
    return NextResponse.json(
      { error: "Failed to load expenses", details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireCan("expenses", "create");
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const body = await request.json();
    const parsed = createExpenseSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const recordedById = session.user.id ? Number(session.user.id) : null;

    const expense = await prisma.expense.create({
      data: {
        title: data.title,
        category: data.category as ExpenseCategory,
        amount: data.amount,
        currency: data.currency,
        date: new Date(data.date),
        isBillable: data.isBillable,
        status: data.status as ExpenseStatus,
        paymentMethod: data.paymentMethod as PaymentMethod,
        receiptUrl: data.receiptUrl || null,
        receiptName: data.receiptName || null,
        notes: data.notes || null,
        projectId: data.projectId || null,
        clientId: data.clientId || null,
        userId: data.userId || null,
        recordedById,
      },
      include: {
        client: { select: { id: true, name: true, company: true } },
        project: { select: { id: true, name: true } },
        user: { select: { id: true, name: true } },
      },
    });

    // Create Audit Log
    try {
      await prisma.auditLog.create({
        data: {
          action: "CREATE_EXPENSE",
          entityType: "Expense",
          entityId: expense.id,
          newValues: JSON.stringify({
            title: expense.title,
            amount: expense.amount,
            category: expense.category,
            client: expense.client?.name,
            project: expense.project?.name,
          }),
          userId: recordedById,
        },
      });
    } catch (e) {
      console.warn("Could not create audit log:", e);
    }

    return NextResponse.json(
      { message: "Expense recorded successfully", expense },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Failed to create expense:", error);
    return NextResponse.json(
      { error: "Failed to record expense", details: error.message },
      { status: 500 }
    );
  }
}
