export type QuotationStatus = "DRAFT" | "SENT" | "ACCEPTED" | "REJECTED" | "EXPIRED" | "CONVERTED";
export type TaxType = "CGST_SGST" | "IGST";

export interface QuotationLine {
    id: string;
    description: string;
    quantity: string;
    unit: string | null;
    unitPrice: string;
    position: number;
}

export interface Quotation {
    id: string;
    companyId: string;
    clientId: string;
    projectId: string | null;
    createdById: string;
    quotationNumber: string;
    title: string;
    description: string | null;
    status: QuotationStatus;
    currency: string;
    subTotal: string;
    discountPercent: string;
    taxPercent: string;
    taxType: TaxType;
    totalAmount: string;
    validUntil: string;
    terms: string | null;
    note: string | null;
    portalVisible: boolean;
    signatureUrl: string | null;
    sentAt: string | null;
    convertedAt: string | null;
    createdAt: string;
    updatedAt: string;
    lineItems: QuotationLine[];
    client: { id: string; name: string; email: string };
    project: { id: string; title: string } | null;
    createdBy: { id: string; firstName: string; lastName: string };
}

export interface QuotationLineInput {
    description: string;
    quantity: number;
    unit?: string;
    unitPrice: number;
}

export interface CreateQuotationPayload {
    clientId: string;
    projectId?: string;
    companyId?: string;
    title: string;
    description?: string;
    currency?: string;
    discountPercent?: number;
    taxPercent?: number;
    taxType?: TaxType;
    validUntil: string;
    terms?: string;
    note?: string;
    portalVisible?: boolean;
    signatureUrl?: string;
    lineItems: QuotationLineInput[];
}

export type UpdateQuotationPayload = Partial<Omit<CreateQuotationPayload, "companyId" | "clientId">> & {
    status?: QuotationStatus;
};
