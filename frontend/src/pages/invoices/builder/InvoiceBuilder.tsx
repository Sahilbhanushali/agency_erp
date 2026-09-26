import Combobox from "@/components/shared/Combobox";
import DatePicker from "@/components/shared/DatePicker";
import DocumentPreview from "@/components/shared/DocumentPreview";
import ImageUploadButton from "@/components/shared/ImageUploadButton";
import LineItemsEditor, { emptyLine, type EditableLine } from "@/components/shared/LineItemsEditor";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import { api, ApiError } from "@/lib/api";
import { exportElementToPdf } from "@/lib/exportPdf";
import type { Client } from "@/types/client";
import type { Company } from "@/types/company";
import type { CreateInvoicePayload, Invoice, InvoiceStatus, TaxType, UpdateInvoicePayload } from "@/types/invoice";
import type { Project } from "@/types/project";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Download, Loader2, PenLine, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import * as z from "zod";
import PaymentsPanel from "../components/PaymentsPanel";

const STATUS_OPTIONS = ["DRAFT", "SENT", "VIEWED", "PARTIAL", "PAID", "OVERDUE", "CANCELLED", "REFUNDED"] as const;

const invoiceSchema = z
    .object({
        companyId: z.string().optional(),
        clientId: z.string().min(1, "Client is required"),
        projectId: z.string().optional(),
        title: z.string().trim().min(1, "Title is required").max(200, "Title must be under 200 characters"),
        currency: z
            .string()
            .trim()
            .min(1, "Currency is required")
            .regex(/^[A-Za-z]{3}$/, "Use a 3-letter currency code (e.g. INR)"),
        discountPercent: z.number().min(0, "Cannot be negative").max(100, "Cannot exceed 100"),
        taxPercent: z.number().min(0, "Cannot be negative").max(100, "Cannot exceed 100"),
        taxType: z.enum(["CGST_SGST", "IGST"]),
        issueDate: z.string().min(1, "Issue date is required"),
        dueDate: z.string().min(1, "Due date is required"),
        portalVisible: z.boolean(),
        status: z.enum(STATUS_OPTIONS),
    })
    .refine((data) => data.dueDate >= data.issueDate, {
        message: "Due date cannot be before the issue date",
        path: ["dueDate"],
    });

type InvoiceFormValues = z.infer<typeof invoiceSchema>;

const InvoiceBuilder = () => {
    const { id } = useParams<{ id: string }>();
    const [searchParams] = useSearchParams();
    const isEdit = !!id;
    const navigate = useNavigate();
    const { user: actor } = useAuth();
    const isSuperAdmin = actor?.roleName === "SUPER_ADMIN";

    const [isLoading, setIsLoading] = useState(isEdit);
    const [isSaving, setIsSaving] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [invoice, setInvoice] = useState<Invoice | null>(null);

    const [companies, setCompanies] = useState<Company[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);

    const [terms, setTerms] = useState("");
    const [note, setNote] = useState("");
    const [lines, setLines] = useState<EditableLine[]>([emptyLine()]);
    const [linesError, setLinesError] = useState<string | undefined>(undefined);
    const [invoiceNumber, setInvoiceNumber] = useState("");
    const [signatureUrl, setSignatureUrl] = useState<string | undefined>(undefined);

    const [companyDetails, setCompanyDetails] = useState<Company | null>(null);

    const form = useForm<InvoiceFormValues>({
        resolver: zodResolver(invoiceSchema),
        defaultValues: {
            companyId: actor?.companyId ?? undefined,
            clientId: searchParams.get("clientId") ?? "",
            projectId: undefined,
            title: "",
            currency: "INR",
            discountPercent: 0,
            taxPercent: 18,
            taxType: "CGST_SGST",
            issueDate: new Date().toISOString().slice(0, 10),
            dueDate: "",
            portalVisible: true,
            status: "DRAFT",
        },
    });

    const companyId = form.watch("companyId");
    const clientId = form.watch("clientId");
    const currency = form.watch("currency");
    const discountPercent = form.watch("discountPercent");
    const taxPercent = form.watch("taxPercent");
    const taxType = form.watch("taxType");
    const issueDate = form.watch("issueDate");
    const dueDate = form.watch("dueDate");
    const title = form.watch("title");
    const targetCompanyId = isSuperAdmin ? companyId : (actor?.companyId ?? undefined);

    useEffect(() => {
        if (isSuperAdmin) {
            api.list<Company>("/companies").then(setCompanies).catch(() => toast.error("Failed to load companies."));
        }
    }, [isSuperAdmin]);

    useEffect(() => {
        if (!targetCompanyId) {
            setCompanyDetails(null);
            return;
        }
        api.get<Company>(`/companies/${targetCompanyId}`).then(setCompanyDetails).catch(() => undefined);
    }, [targetCompanyId]);

    useEffect(() => {
        if (!targetCompanyId) {
            setClients([]);
            return;
        }
        api.list<Client>(`/clients?companyId=${targetCompanyId}`).then(setClients).catch(() => toast.error("Failed to load clients."));
    }, [targetCompanyId]);

    useEffect(() => {
        if (!targetCompanyId || !clientId) {
            setProjects([]);
            return;
        }
        api
            .list<Project>(`/projects?companyId=${targetCompanyId}&clientId=${clientId}`)
            .then(setProjects)
            .catch(() => toast.error("Failed to load projects."));
    }, [targetCompanyId, clientId]);

    useEffect(() => {
        if (!id) return;
        api
            .get<Invoice>(`/invoices/${id}`)
            .then((data) => {
                setInvoice(data);
                form.reset({
                    companyId: data.companyId,
                    clientId: data.clientId,
                    projectId: data.projectId ?? undefined,
                    title: data.title,
                    currency: data.currency,
                    discountPercent: Number(data.discountPercent),
                    taxPercent: Number(data.taxPercent),
                    taxType: data.taxType,
                    issueDate: data.issueDate.slice(0, 10),
                    dueDate: data.dueDate.slice(0, 10),
                    portalVisible: data.portalVisible,
                    status: data.status,
                });
                setTerms(data.terms ?? "");
                setNote(data.note ?? "");
                setInvoiceNumber(data.invoiceNumber);
                setSignatureUrl(data.signatureUrl ?? undefined);
                setLines(
                    data.lineItems.length
                        ? data.lineItems.map((line) => ({
                              description: line.description,
                              quantity: Number(line.quantity),
                              unit: line.unit ?? "",
                              unitPrice: Number(line.unitPrice),
                          }))
                        : [emptyLine()],
                );
            })
            .catch((error) => toast.error(error instanceof ApiError ? error.message : "Failed to load invoice."))
            .finally(() => setIsLoading(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    const selectedClient = clients.find((client) => client.id === clientId);

    const handleExport = async () => {
        setIsExporting(true);
        try {
            await exportElementToPdf("doc-print-area", invoiceNumber || "invoice");
        } catch {
            toast.error("Failed to export PDF.");
        } finally {
            setIsExporting(false);
        }
    };

    const onSubmit = async (values: InvoiceFormValues) => {
        if (isSuperAdmin && !isEdit && !values.companyId) {
            toast.error("Company is required.");
            return;
        }

        const includedLines = lines.filter((line) => line.description.trim());
        if (includedLines.length === 0) {
            setLinesError("Add at least one line item with a description.");
            return;
        }
        if (includedLines.some((line) => line.quantity <= 0)) {
            setLinesError("Each line item must have a quantity greater than 0.");
            return;
        }
        if (includedLines.some((line) => line.unitPrice < 0)) {
            setLinesError("Unit price cannot be negative.");
            return;
        }
        setLinesError(undefined);

        setIsSaving(true);
        try {
            const lineItems = includedLines.map((line) => ({ ...line, unit: line.unit || undefined }));
            const currency = values.currency.toUpperCase();

            if (isEdit && id) {
                const payload: UpdateInvoicePayload = {
                    projectId: values.projectId, title: values.title, currency, discountPercent: values.discountPercent,
                    taxPercent: values.taxPercent, taxType: values.taxType, issueDate: values.issueDate, dueDate: values.dueDate,
                    terms: terms || undefined, note: note || undefined, portalVisible: values.portalVisible,
                    signatureUrl, status: values.status, lineItems,
                };
                await api.patch(`/invoices/${id}`, payload);
                toast.success("Invoice updated.");
            } else {
                const payload: CreateInvoicePayload = {
                    clientId: values.clientId, projectId: values.projectId, companyId: targetCompanyId, title: values.title, currency,
                    discountPercent: values.discountPercent, taxPercent: values.taxPercent, taxType: values.taxType,
                    issueDate: values.issueDate, dueDate: values.dueDate, terms: terms || undefined, note: note || undefined,
                    portalVisible: values.portalVisible, signatureUrl, lineItems,
                };
                const created = await api.post<Invoice>("/invoices", payload);
                toast.success("Invoice created.");
                navigate(`/invoices-list/${created.id}`, { replace: true });
                return;
            }
        } catch (error) {
            toast.error(error instanceof ApiError ? error.message : "Failed to save invoice.");
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-24">
                <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
            </div>
        );
    }

    return (
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pb-4">
            <div className="flex items-center justify-between flex-wrap gap-3 sticky top-0 z-10 bg-background/95 backdrop-blur-sm -mx-1 px-1 py-2">
                <div>
                    <Link
                        to="/invoices-list"
                        className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-primary dark:text-neutral-400 mb-1"
                    >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        Back to Billing
                    </Link>
                    <h4 className="text-xl font-semibold text-neutral-900 dark:text-white">
                        {isEdit ? invoiceNumber : "New Invoice"}
                    </h4>
                </div>
                <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" className="h-11 rounded-lg" onClick={handleExport} disabled={isExporting}>
                        {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                        Export PDF
                    </Button>
                    <Button type="submit" className="h-11 rounded-lg" disabled={isSaving}>
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        {isEdit ? "Save Changes" : "Create Invoice"}
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,400px)_1fr] gap-6 items-start">
                <div className="space-y-6">
                    <Card>
                        <CardHeader className="border-b border-border !pb-4">
                            <h6 className="text-sm font-semibold text-neutral-900 dark:text-white">Invoice Details</h6>
                        </CardHeader>
                        <CardContent className="space-y-5 pt-5">
                            {isSuperAdmin && (
                                <Field>
                                    <FieldLabel>Company *</FieldLabel>
                                    <Controller
                                        name="companyId"
                                        control={form.control}
                                        render={({ field }) => (
                                            <Combobox
                                                value={field.value}
                                                onChange={(value) => { field.onChange(value); form.setValue("clientId", ""); }}
                                                disabled={isEdit}
                                                options={companies.map((company) => ({ value: company.id, label: company.name }))}
                                                placeholder="Select company"
                                                searchPlaceholder="Search companies..."
                                                emptyText="No companies found."
                                            />
                                        )}
                                    />
                                </Field>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <Field data-invalid={!!form.formState.errors.clientId}>
                                    <FieldLabel>Client *</FieldLabel>
                                    <Controller
                                        name="clientId"
                                        control={form.control}
                                        render={({ field }) => (
                                            <Combobox
                                                value={field.value}
                                                onChange={(value) => { field.onChange(value); form.setValue("projectId", undefined); }}
                                                disabled={isEdit || !targetCompanyId}
                                                options={clients.map((client) => ({ value: client.id, label: client.name }))}
                                                placeholder={targetCompanyId ? "Select client" : "Select a company first"}
                                                searchPlaceholder="Search clients..."
                                                emptyText="No clients found."
                                                createHref="/clients-list/create"
                                                createLabel="Add new client"
                                            />
                                        )}
                                    />
                                    {form.formState.errors.clientId && <FieldError errors={[form.formState.errors.clientId]} />}
                                </Field>

                                <Field>
                                    <FieldLabel>Project</FieldLabel>
                                    <Controller
                                        name="projectId"
                                        control={form.control}
                                        render={({ field }) => (
                                            <Combobox
                                                value={field.value}
                                                onChange={field.onChange}
                                                disabled={!clientId}
                                                options={projects.map((project) => ({ value: project.id, label: project.title }))}
                                                placeholder={clientId ? "Optional" : "Select a client first"}
                                                searchPlaceholder="Search projects..."
                                                emptyText="No projects found."
                                            />
                                        )}
                                    />
                                </Field>
                            </div>

                            <Field data-invalid={!!form.formState.errors.title}>
                                <FieldLabel htmlFor="title">Title *</FieldLabel>
                                <Input id="title" className="h-11 rounded-lg" {...form.register("title")} />
                                {form.formState.errors.title && <FieldError errors={[form.formState.errors.title]} />}
                            </Field>

                            <div className="grid grid-cols-3 gap-4">
                                <Field data-invalid={!!form.formState.errors.currency}>
                                    <FieldLabel htmlFor="currency">Currency</FieldLabel>
                                    <Input id="currency" className="h-11 rounded-lg" {...form.register("currency")} />
                                    {form.formState.errors.currency && <FieldError errors={[form.formState.errors.currency]} />}
                                </Field>
                                <Field data-invalid={!!form.formState.errors.discountPercent}>
                                    <FieldLabel htmlFor="discountPercent">Discount %</FieldLabel>
                                    <Input id="discountPercent" type="number" min={0} max={100} step="0.01" className="h-11 rounded-lg" {...form.register("discountPercent", { valueAsNumber: true })} />
                                    {form.formState.errors.discountPercent && <FieldError errors={[form.formState.errors.discountPercent]} />}
                                </Field>
                                <Field data-invalid={!!form.formState.errors.taxPercent}>
                                    <FieldLabel htmlFor="taxPercent">Tax %</FieldLabel>
                                    <Input id="taxPercent" type="number" min={0} max={100} step="0.01" className="h-11 rounded-lg" {...form.register("taxPercent", { valueAsNumber: true })} />
                                    {form.formState.errors.taxPercent && <FieldError errors={[form.formState.errors.taxPercent]} />}
                                </Field>
                            </div>

                            <Field>
                                <FieldLabel>GST Type</FieldLabel>
                                <Controller
                                    name="taxType"
                                    control={form.control}
                                    render={({ field }) => (
                                        <Select value={field.value} onValueChange={(value) => field.onChange(value as TaxType)}>
                                            <SelectTrigger className="h-11 rounded-lg !w-full">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="CGST_SGST">CGST + SGST (Intra-state)</SelectItem>
                                                <SelectItem value="IGST">IGST (Inter-state)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    )}
                                />
                            </Field>

                            <div className="grid grid-cols-2 gap-4">
                                <Field data-invalid={!!form.formState.errors.issueDate}>
                                    <FieldLabel>Issue Date *</FieldLabel>
                                    <Controller
                                        name="issueDate"
                                        control={form.control}
                                        render={({ field }) => <DatePicker value={field.value} onChange={field.onChange} />}
                                    />
                                    {form.formState.errors.issueDate && <FieldError errors={[form.formState.errors.issueDate]} />}
                                </Field>
                                <Field data-invalid={!!form.formState.errors.dueDate}>
                                    <FieldLabel>Due Date *</FieldLabel>
                                    <Controller
                                        name="dueDate"
                                        control={form.control}
                                        render={({ field }) => <DatePicker value={field.value} onChange={field.onChange} />}
                                    />
                                    {form.formState.errors.dueDate && <FieldError errors={[form.formState.errors.dueDate]} />}
                                </Field>
                            </div>

                            {isEdit && (
                                <Field>
                                    <FieldLabel>Status</FieldLabel>
                                    <Controller
                                        name="status"
                                        control={form.control}
                                        render={({ field }) => (
                                            <Select value={field.value} onValueChange={(value) => field.onChange(value as InvoiceStatus)}>
                                                <SelectTrigger className="h-11 rounded-lg !w-full">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {STATUS_OPTIONS.map((option) => (
                                                        <SelectItem key={option} value={option}>{option}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        )}
                                    />
                                </Field>
                            )}

                            <Field orientation="horizontal" className="items-center justify-between">
                                <FieldLabel className="mb-0">Visible to client on portal</FieldLabel>
                                <Controller
                                    name="portalVisible"
                                    control={form.control}
                                    render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />}
                                />
                            </Field>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="border-b border-border !pb-4">
                            <h6 className="text-sm font-semibold text-neutral-900 dark:text-white">Notes & Signature</h6>
                        </CardHeader>
                        <CardContent className="space-y-5 pt-5">
                            <Field>
                                <FieldLabel htmlFor="terms">Terms</FieldLabel>
                                <Textarea id="terms" rows={2} value={terms} onChange={(event) => setTerms(event.target.value)} />
                            </Field>

                            <Field>
                                <FieldLabel htmlFor="note">Internal Note</FieldLabel>
                                <Textarea id="note" rows={2} value={note} onChange={(event) => setNote(event.target.value)} />
                            </Field>

                            <Field>
                                <FieldLabel>Signature</FieldLabel>
                                <ImageUploadButton label="Upload Signature" icon={PenLine} value={signatureUrl} onChange={setSignatureUrl} />
                            </Field>
                        </CardContent>
                    </Card>

                    {isEdit && invoice && (
                        <Card>
                            <CardHeader className="border-b border-border !pb-4">
                                <h6 className="text-sm font-semibold text-neutral-900 dark:text-white">Payments</h6>
                            </CardHeader>
                            <CardContent className="pt-5">
                                <PaymentsPanel invoice={invoice} onChange={setInvoice} />
                            </CardContent>
                        </Card>
                    )}
                </div>

                <div className="space-y-6">
                    <Card>
                        <CardHeader className="border-b border-border !pb-4">
                            <h6 className="text-sm font-semibold text-neutral-900 dark:text-white">Line Items</h6>
                        </CardHeader>
                        <CardContent className="pt-5">
                            <LineItemsEditor
                                lines={lines}
                                onChange={(next) => { setLines(next); setLinesError(undefined); }}
                                currency={currency}
                                discountPercent={discountPercent}
                                taxPercent={taxPercent}
                            />
                            {linesError && <p className="text-sm text-destructive mt-2">{linesError}</p>}
                        </CardContent>
                    </Card>

                    <div className="xl:sticky xl:top-24">
                        <DocumentPreview
                            kind="Invoice"
                            documentNumber={invoiceNumber || "DRAFT"}
                            documentDate={issueDate}
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
                            clientName={selectedClient?.name ?? ""}
                            clientEmail={selectedClient?.email ?? ""}
                            clientGstNumber={selectedClient?.gstNumber ?? undefined}
                            title={title}
                            dateLabel="Due Date"
                            dateValue={dueDate}
                            lines={lines}
                            currency={currency}
                            discountPercent={discountPercent}
                            taxPercent={taxPercent}
                            taxType={taxType}
                            terms={terms}
                            note={note}
                            signatureUrl={signatureUrl}
                        />
                    </div>
                </div>
            </div>
        </form>
    );
};

export default InvoiceBuilder;
