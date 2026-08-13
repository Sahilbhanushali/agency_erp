import DocumentPreview from "@/components/shared/DocumentPreview";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { api, ApiError } from "@/lib/api";
import { exportElementToPdf } from "@/lib/exportPdf";
import type { Client } from "@/types/client";
import type { Company } from "@/types/company";
import type { Quotation, QuotationStatus } from "@/types/quotation";
import { ArrowLeft, Download, Loader2, PenLine } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";

const STATUS_STYLES: Record<QuotationStatus, string> = {
    DRAFT: "bg-neutral-500/15 text-neutral-500 dark:text-neutral-300 border-neutral-400/30",
    SENT: "bg-info/15 text-info border-info/30",
    ACCEPTED: "bg-success/15 text-success border-success/30",
    REJECTED: "bg-destructive/15 text-destructive border-destructive/30",
    EXPIRED: "bg-warning/20 text-warning-foreground dark:text-warning border-warning/40",
    CONVERTED: "bg-primary/15 text-primary border-primary/30",
};

const QuotationDetails = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(true);
    const [isExporting, setIsExporting] = useState(false);
    const [quotation, setQuotation] = useState<Quotation | null>(null);
    const [companyDetails, setCompanyDetails] = useState<Company | null>(null);
    const [client, setClient] = useState<Client | null>(null);

    const handleExport = async () => {
        if (!quotation) return;
        setIsExporting(true);
        try {
            await exportElementToPdf("doc-print-area", quotation.quotationNumber);
        } catch {
            toast.error("Failed to export PDF.");
        } finally {
            setIsExporting(false);
        }
    };

    useEffect(() => {
        if (!id) return;
        api
            .get<Quotation>(`/quotations/${id}`)
            .then(setQuotation)
            .catch((error) => {
                toast.error(error instanceof ApiError ? error.message : "Failed to load quotation.");
                navigate("/quotations-list", { replace: true });
            })
            .finally(() => setIsLoading(false));
    }, [id, navigate]);

    useEffect(() => {
        if (!quotation) return;
        api.get<Company>(`/companies/${quotation.companyId}`).then(setCompanyDetails).catch(() => undefined);
        api.get<Client>(`/clients/${quotation.clientId}`).then(setClient).catch(() => undefined);
    }, [quotation]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-24">
                <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
            </div>
        );
    }

    if (!quotation) return null;

    const lines = quotation.lineItems.map((line) => ({
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
                        to="/quotations-list"
                        className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-primary dark:text-neutral-400 mb-1"
                    >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        Back to Quotations
                    </Link>
                    <div className="flex items-center gap-3">
                        <h4 className="text-xl font-semibold text-neutral-900 dark:text-white">{quotation.quotationNumber}</h4>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${STATUS_STYLES[quotation.status]}`}>
                            {quotation.status}
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" className="h-11 rounded-lg" onClick={handleExport} disabled={isExporting}>
                        {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                        Export PDF
                    </Button>
                    <Button type="button" className="h-11 rounded-lg" asChild>
                        <Link to={`/quotations-list/${quotation.id}/edit`}>
                            <PenLine className="w-4 h-4" />
                            Edit Quotation
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
                                <span className="font-medium text-neutral-900 dark:text-white">{quotation.client.name}</span>
                            </div>
                            {quotation.project && (
                                <div className="flex justify-between">
                                    <span className="text-neutral-500 dark:text-neutral-400">Project</span>
                                    <span className="font-medium text-neutral-900 dark:text-white">{quotation.project.title}</span>
                                </div>
                            )}
                            <div className="flex justify-between">
                                <span className="text-neutral-500 dark:text-neutral-400">Valid Until</span>
                                <span className="font-medium text-neutral-900 dark:text-white">{quotation.validUntil.slice(0, 10)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-neutral-500 dark:text-neutral-400">GST Type</span>
                                <span className="font-medium text-neutral-900 dark:text-white">
                                    {quotation.taxType === "IGST" ? "IGST (Inter-state)" : "CGST + SGST (Intra-state)"}
                                </span>
                            </div>
                            <div className="flex justify-between pt-3 border-t border-border">
                                <span className="text-neutral-500 dark:text-neutral-400">Total</span>
                                <span className="font-semibold text-neutral-900 dark:text-white">{quotation.currency} {Number(quotation.totalAmount).toFixed(2)}</span>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="xl:sticky xl:top-24">
                    <DocumentPreview
                        kind="Quotation"
                        documentNumber={quotation.quotationNumber}
                        documentDate={quotation.createdAt.slice(0, 10)}
                        status={quotation.status}
                        companyName={companyDetails?.name ?? ""}
                        companyLogoUrl={companyDetails?.logoUrl ?? undefined}
                        companyEmail={companyDetails?.email ?? undefined}
                        companyPhone={companyDetails?.phone ?? undefined}
                        companyWebsite={companyDetails?.website ?? undefined}
                        companyGstNumber={companyDetails?.gstNumber ?? undefined}
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
                        clientName={quotation.client.name}
                        clientEmail={quotation.client.email}
                        clientGstNumber={client?.gstNumber ?? undefined}
                        title={quotation.title}
                        dateLabel="Valid Until"
                        dateValue={quotation.validUntil.slice(0, 10)}
                        lines={lines}
                        currency={quotation.currency}
                        discountPercent={Number(quotation.discountPercent)}
                        taxPercent={Number(quotation.taxPercent)}
                        taxType={quotation.taxType}
                        terms={quotation.terms ?? undefined}
                        note={quotation.note ?? undefined}
                        signatureUrl={quotation.signatureUrl ?? undefined}
                    />
                </div>
            </div>
        </div>
    );
};

export default QuotationDetails;
