import { z } from "zod";

export const expenseCategoryEnum = z.enum([
  "SOFTWARE_TOOL",
  "CONTRACTOR_FREELANCER",
  "AD_SPEND",
  "SHOOT_PRODUCTION",
  "OFFICE_TRAVEL",
  "HARDWARE_EQUIPMENT",
  "OTHER",
]);

export const expenseStatusEnum = z.enum([
  "PENDING",
  "APPROVED",
  "REJECTED",
  "REIMBURSED",
]);

export const paymentMethodEnum = z.enum([
  "BANK_TRANSFER",
  "UPI",
  "CASH",
  "CHEQUE",
  "CARD",
  "OTHER",
]);

export const createExpenseSchema = z.object({
  title: z.string().min(1, "Expense title is required"),
  category: expenseCategoryEnum.default("OTHER"),
  amount: z.union([z.number().positive("Amount must be positive"), z.string()]).transform((val) => Number(val)),
  currency: z.string().default("INR"),
  date: z.string().min(1, "Date is required"),
  isBillable: z.boolean().default(false),
  status: expenseStatusEnum.default("APPROVED"),
  paymentMethod: paymentMethodEnum.default("BANK_TRANSFER"),
  receiptUrl: z.string().optional().nullable(),
  receiptName: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  projectId: z.string().optional().nullable(),
  clientId: z.string().optional().nullable(),
  userId: z.number().optional().nullable(),
});

export const updateExpenseSchema = createExpenseSchema.partial();

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;
