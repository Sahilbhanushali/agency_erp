import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireCan } from "@/lib/api-auth";
import { updateExpenseSchema } from "@/lib/validation/expense";
import { deleteLocalFile } from "@/lib/storage";
import { ExpenseCategory, ExpenseStatus, PaymentMethod } from "@prisma/client";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireCan("expenses", "read");
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const params = await context.params;
    const expense = await prisma.expense.findUnique({
      where: { id: params.id },
      include: {
        client: true,
        project: true,
        user: { select: { id: true, name: true, email: true } },
        recordedBy: { select: { id: true, name: true, email: true } },
      },
    });

    if (!expense) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }

    return NextResponse.json({ expense });
  } catch (error: any) {
    console.error("Failed to fetch expense:", error);
    return NextResponse.json(
      { error: "Failed to fetch expense", details: error.message },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireCan("expenses", "update");
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const params = await context.params;
    const existing = await prisma.expense.findUnique({
      where: { id: params.id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }

    const body = await request.json();
    const parsed = updateExpenseSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Clean up replaced receipt file
    if (data.receiptUrl && existing.receiptUrl && data.receiptUrl !== existing.receiptUrl) {
      await deleteLocalFile(existing.receiptUrl);
    }

    const updateData: any = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.category !== undefined) updateData.category = data.category as ExpenseCategory;
    if (data.amount !== undefined) updateData.amount = data.amount;
    if (data.currency !== undefined) updateData.currency = data.currency;
    if (data.date !== undefined) updateData.date = new Date(data.date);
    if (data.isBillable !== undefined) updateData.isBillable = data.isBillable;
    if (data.status !== undefined) updateData.status = data.status as ExpenseStatus;
    if (data.paymentMethod !== undefined) updateData.paymentMethod = data.paymentMethod as PaymentMethod;
    if (data.receiptUrl !== undefined) updateData.receiptUrl = data.receiptUrl;
    if (data.receiptName !== undefined) updateData.receiptName = data.receiptName;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.projectId !== undefined) updateData.projectId = data.projectId;
    if (data.clientId !== undefined) updateData.clientId = data.clientId;
    if (data.userId !== undefined) updateData.userId = data.userId;

    const updated = await prisma.expense.update({
      where: { id: params.id },
      data: updateData,
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
          action: "UPDATE_EXPENSE",
          entityType: "Expense",
          entityId: updated.id,
          oldValues: JSON.stringify(existing),
          newValues: JSON.stringify(updated),
          userId: session.user.id ? Number(session.user.id) : null,
        },
      });
    } catch (e) {
      console.warn("Could not create audit log:", e);
    }

    return NextResponse.json({
      message: "Expense updated successfully",
      expense: updated,
    });
  } catch (error: any) {
    console.error("Failed to update expense:", error);
    return NextResponse.json(
      { error: "Failed to update expense", details: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireCan("expenses", "delete");
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const params = await context.params;
    const existing = await prisma.expense.findUnique({
      where: { id: params.id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }

    // Clean up local receipt file
    if (existing.receiptUrl) {
      await deleteLocalFile(existing.receiptUrl);
    }

    await prisma.expense.delete({
      where: { id: params.id },
    });

    // Create Audit Log
    try {
      await prisma.auditLog.create({
        data: {
          action: "DELETE_EXPENSE",
          entityType: "Expense",
          entityId: params.id,
          oldValues: JSON.stringify(existing),
          userId: session.user.id ? Number(session.user.id) : null,
        },
      });
    } catch (e) {
      console.warn("Could not create audit log:", e);
    }

    return NextResponse.json({ message: "Expense deleted successfully" });
  } catch (error: any) {
    console.error("Failed to delete expense:", error);
    return NextResponse.json(
      { error: "Failed to delete expense", details: error.message },
      { status: 500 }
    );
  }
}
