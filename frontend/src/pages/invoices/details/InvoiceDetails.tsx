import DocumentPreview from "@/components/shared/DocumentPreview";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { api, ApiError } from "@/lib/api";
import { exportElementToPdf } from "@/lib/exportPdf";
import type { Client } from "@/types/client";
import type { Company } from "@/types/company";
import type { Invoice, InvoiceStatus } from "@/types/invoice";
import { ArrowLeft, Download, Loader2, PenLine } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import PaymentsPanel from "../components/PaymentsPanel";

const STATUS_STYLES: Record<InvoiceStatus, string> = {
    DRAFT: "bg-neutral-500/15 text-neutral-500 dark:text-neutral-300 border-neutral-400/30",
    SENT: "bg-info/15 text-info border-info/30",
    VIEWED: "bg-info/15 text-info border-info/30",
    PARTIAL: "bg-warning/20 text-warning-foreground dark:text-warning border-warning/40",
    PAID: "bg-success/15 text-success border-success/30",
    OVERDUE: "bg-destructive/15 text-destructive border-destructive/30",
    CANCELLED: "bg-neutral-500/15 text-neutral-500 dark:text-neutral-300 border-neutral-400/30",
    REFUNDED: "bg-primary/15 text-primary border-primary/30",
};

const InvoiceDetails = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(true);
    const [isExporting, setIsExporting] = useState(false);
    const [invoice, setInvoice] = useState<Invoice | null>(null);
    const [companyDetails, setCompanyDetails] = useState<Company | null>(null);
    const [client, setClient] = useState<Client | null>(null);

    const handleExport = async () => {
        if (!invoice) return;
        setIsExporting(true);
        try {
            await exportElementToPdf("doc-print-area", invoice.invoiceNumber);
        } catch {
            toast.error("Failed to export PDF.");
        } finally {
            setIsExporting(false);
        }
    };

    useEffect(() => {
        if (!id) return;
        api
            .get<Invoice>(`/invoices/${id}`)
            .then(setInvoice)
            .catch((error) => {
                toast.error(error instanceof ApiError ? error.message : "Failed to load invoice.");
                navigate("/invoices-list", { replace: true });
            })
            .finally(() => setIsLoading(false));
    }, [id, navigate]);

    useEffect(() => {
        if (!invoice) return;
        api.get<Company>(`/companies/${invoice.companyId}`).then(setCompanyDetails).catch(() => undefined);
        api.get<Client>(`/clients/${invoice.clientId}`).then(setClient).catch(() => undefined);
    }, [invoice]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-24">
                <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
            </div>
        );
    }

    if (!invoice) return null;

    const lines = invoice.lineItems.map((line) => ({
        description: line.description,
        quantity: Number(line.quantity),
        unit: line.unit ?? "",
        unitPrice: Number(line.unitPrice),
    }));

    return (
        <div className="space-y-6 pb-4">
            <div className="flex items-center justify-between flex-wrap gap-3 sticky top-0 z-10 bg-background/95 backdrop-blur-sm -mx-1 px-1 py-2">
                <div>
                    <Link
                        to="/invoices-list"
                        className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-primary dark:text-neutral-400 mb-1"
                    >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        Back to Billing
                    </Link>
                    <div className="flex items-center gap-3">
                        <h4 className="text-xl font-semibold text-neutral-900 dark:text-white">{invoice.invoiceNumber}</h4>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${STATUS_STYLES[invoice.status]}`}>
                            {invoice.status}
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" className="h-11 rounded-lg" onClick={handleExport} disabled={isExporting}>
                        {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                        Export PDF
                    </Button>
                    <Button type="button" className="h-11 rounded-lg" asChild>
                        <Link to={`/invoices-list/${invoice.id}/edit`}>
                            <PenLine className="w-4 h-4" />
                            Edit Invoice
                        </Link>
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,360px)_1fr] gap-6 items-start">
                <div className="space-y-6">
                    <Card>
                        <CardHeader className="border-b border-border !pb-4">
                            <h6 className="text-sm font-semibold text-neutral-900 dark:text-white">Details</h6>
                        </CardHeader>
                        <CardContent className="space-y-3 pt-5 text-sm">
                            <div className="flex justify-between">
                                <span className="text-neutral-500 dark:text-neutral-400">Client</span>
                                <span className="font-medium text-neutral-900 dark:text-white">{invoice.client.name}</span>
                            </div>
                            {invoice.project && (
                                <div className="flex justify-between">
                                    <span className="text-neutral-500 dark:text-neutral-400">Project</span>
                                    <span className="font-medium text-neutral-900 dark:text-white">{invoice.project.title}</span>
                                </div>
                            )}
                            <div className="flex justify-between">
                                <span className="text-neutral-500 dark:text-neutral-400">Issue Date</span>
                                <span className="font-medium text-neutral-900 dark:text-white">{invoice.issueDate.slice(0, 10)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-neutral-500 dark:text-neutral-400">Due Date</span>
                                <span className="font-medium text-neutral-900 dark:text-white">{invoice.dueDate.slice(0, 10)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-neutral-500 dark:text-neutral-400">GST Type</span>
                                <span className="font-medium text-neutral-900 dark:text-white">
                                    {invoice.taxType === "IGST" ? "IGST (Inter-state)" : "CGST + SGST (Intra-state)"}
                                </span>
                            </div>
                            <div className="flex justify-between pt-3 border-t border-border">
                                <span className="text-neutral-500 dark:text-neutral-400">Total</span>
                                <span className="font-semibold text-neutral-900 dark:text-white">{invoice.currency} {Number(invoice.totalAmount).toFixed(2)}</span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="border-b border-border !pb-4">
                            <h6 className="text-sm font-semibold text-neutral-900 dark:text-white">Payments</h6>
                        </CardHeader>
                        <CardContent className="pt-5">
                            <PaymentsPanel invoice={invoice} onChange={setInvoice} />
                        </CardContent>
                    </Card>
                </div>

                <div className="xl:sticky xl:top-24">
                    <DocumentPreview
                        kind="Invoice"
                        documentNumber={invoice.invoiceNumber}
                        documentDate={invoice.issueDate.slice(0, 10)}
                        companyName={companyDetails?.name ?? ""}
                        companyLogoUrl={companyDetails?.logoUrl ?? undefined}
                        companyEmail={companyDetails?.email ?? undefined}
                        companyPhone={companyDetails?.phone ?? undefined}
                        companyWebsite={companyDetails?.website ?? undefined}
                        companyGstNumber={companyDetails?.gstNumber ?? undefined}
                        companyPanNumber={companyDetails?.panNumber ?? undefined}
                        companyHsnNumber={companyDetails?.hsnNumber ?? undefined}
                        bankName={companyDetails?.bankName ?? undefined}
                        bankAccountName={companyDetails?.bankAccountName ?? undefined}
                        bankAccountNumber={companyDetails?.bankAccountNumber ?? undefined}
                        bankIfsc={companyDetails?.bankIfsc ?? undefined}
                        companyAddress={
                            companyDetails?.registeredAddress
                                ? [companyDetails.registeredAddress.line1, companyDetails.registeredAddress.city, companyDetails.registeredAddress.country]
                                      .filter(Boolean)
                                      .join(", ")
                                : undefined
                        }
                        clientName={invoice.client.name}
                        clientEmail={invoice.client.email}
                        clientGstNumber={client?.gstNumber ?? undefined}
                        title={invoice.title}
                        dateLabel="Due Date"
                        dateValue={invoice.dueDate.slice(0, 10)}
                        lines={lines}
                        currency={invoice.currency}
                        discountPercent={Number(invoice.discountPercent)}
                        taxPercent={Number(invoice.taxPercent)}
                        taxType={invoice.taxType}
                        terms={invoice.terms ?? undefined}
                        note={invoice.note ?? undefined}
                        signatureUrl={invoice.signatureUrl ?? undefined}
                    />
                </div>
            </div>
        </div>
    );
};

export default InvoiceDetails;
