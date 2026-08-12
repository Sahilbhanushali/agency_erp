export type InvoiceStatus = "DRAFT" | "SENT" | "VIEWED" | "PARTIAL" | "PAID" | "OVERDUE" | "CANCELLED" | "REFUNDED";
export type PaymentMethod = "BANK_TRANSFER" | "CASH" | "CHEQUE" | "STRIPE" | "RAZORPAY" | "UPI" | "OTHER";

export interface InvoiceLine {
    id: string;
    description: string;
    quantity: string;
    unit: string | null;
    unitPrice: string;
    position: number;
}

export interface Payment {
    id: string;
    invoiceId: string;
    recordedById: string;
    amount: string;
    currency: string;
    method: PaymentMethod;
    transactionRef: string | null;
    note: string | null;
    paidAt: string;
    createdAt: string;
}

export interface Invoice {
    id: string;
    companyId: string;
    clientId: string;
    projectId: string | null;
    quotationId: string | null;
    createdById: string;
    invoiceNumber: string;
    title: string;
    status: InvoiceStatus;
    currency: string;
    subTotal: string;
    discountPercent: string;
    taxPercent: string;
    totalAmount: string;
    issueDate: string;
    dueDate: string;
    terms: string | null;
    note: string | null;
    portalVisible: boolean;
    signatureUrl: string | null;
    sentAt: string | null;
    createdAt: string;
    updatedAt: string;
    lineItems: InvoiceLine[];
    payments: Payment[];
    amountPaid: number;
    balanceDue: number;
    client: { id: string; name: string; email: string };
    project: { id: string; title: string } | null;
    createdBy: { id: string; firstName: string; lastName: string };
}

export interface InvoiceLineInput {
    description: string;
    quantity: number;
    unit?: string;
    unitPrice: number;
}

export interface CreateInvoicePayload {
    clientId: string;
    projectId?: string;
    quotationId?: string;
    companyId?: string;
    title: string;
    currency?: string;
    discountPercent?: number;
    taxPercent?: number;
    issueDate: string;
    dueDate: string;
    terms?: string;
    note?: string;
    portalVisible?: boolean;
    signatureUrl?: string;
    lineItems: InvoiceLineInput[];
}

export type UpdateInvoicePayload = Partial<Omit<CreateInvoicePayload, "companyId" | "clientId">> & {
    status?: InvoiceStatus;
};

export interface RecordPaymentPayload {
    amount: number;
    currency?: string;
    method: PaymentMethod;
    transactionRef?: string;
    note?: string;
    paidAt: string;
}
