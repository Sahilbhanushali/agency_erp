import Combobox from "@/components/shared/Combobox";
import DatePicker from "@/components/shared/DatePicker";
import DocumentPreview from "@/components/shared/DocumentPreview";
import ImageUploadButton from "@/components/shared/ImageUploadButton";
import LineItemsEditor, { emptyLine, type EditableLine } from "@/components/shared/LineItemsEditor";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import { api, ApiError } from "@/lib/api";
import type { Client } from "@/types/client";
import type { Company } from "@/types/company";
import type { CreateInvoicePayload, Invoice, InvoiceStatus, UpdateInvoicePayload } from "@/types/invoice";
import type { Project } from "@/types/project";
import { ArrowLeft, Download, Loader2, PenLine, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import PaymentsPanel from "../components/PaymentsPanel";

const STATUS_OPTIONS: InvoiceStatus[] = ["DRAFT", "SENT", "VIEWED", "PARTIAL", "PAID", "OVERDUE", "CANCELLED", "REFUNDED"];

const InvoiceBuilder = () => {
    const { id } = useParams<{ id: string }>();
    const [searchParams] = useSearchParams();
    const isEdit = !!id;
    const navigate = useNavigate();
    const { user: actor } = useAuth();
    const isSuperAdmin = actor?.roleName === "SUPER_ADMIN";

    const [isLoading, setIsLoading] = useState(isEdit);
    const [isSaving, setIsSaving] = useState(false);
    const [invoice, setInvoice] = useState<Invoice | null>(null);

    const [companies, setCompanies] = useState<Company[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);

    const [companyId, setCompanyId] = useState<string | undefined>(actor?.companyId ?? undefined);
    const [clientId, setClientId] = useState(searchParams.get("clientId") ?? "");
    const [projectId, setProjectId] = useState<string | undefined>(undefined);
    const [title, setTitle] = useState("");
    const [currency, setCurrency] = useState("INR");
    const [discountPercent, setDiscountPercent] = useState(0);
    const [taxPercent, setTaxPercent] = useState(18);
    const [issueDate, setIssueDate] = useState<string | undefined>(new Date().toISOString().slice(0, 10));
    const [dueDate, setDueDate] = useState<string | undefined>(undefined);
    const [terms, setTerms] = useState("");
    const [note, setNote] = useState("");
    const [portalVisible, setPortalVisible] = useState(true);
    const [status, setStatus] = useState<InvoiceStatus>("DRAFT");
    const [lines, setLines] = useState<EditableLine[]>([emptyLine()]);
    const [invoiceNumber, setInvoiceNumber] = useState("");
    const [signatureUrl, setSignatureUrl] = useState<string | undefined>(undefined);

    const [companyDetails, setCompanyDetails] = useState<Company | null>(null);
    const targetCompanyId = isSuperAdmin ? companyId : (actor?.companyId ?? undefined);

    useEffect(() => {
        if (isSuperAdmin) {
            api.get<Company[]>("/companies").then(setCompanies).catch(() => toast.error("Failed to load companies."));
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
        api.get<Client[]>(`/clients?companyId=${targetCompanyId}`).then(setClients).catch(() => toast.error("Failed to load clients."));
    }, [targetCompanyId]);

    useEffect(() => {
        if (!targetCompanyId || !clientId) {
            setProjects([]);
            return;
        }
        api
            .get<Project[]>(`/projects?companyId=${targetCompanyId}&clientId=${clientId}`)
            .then(setProjects)
            .catch(() => toast.error("Failed to load projects."));
    }, [targetCompanyId, clientId]);

    useEffect(() => {
        if (!id) return;
        api
            .get<Invoice>(`/invoices/${id}`)
            .then((data) => {
                setInvoice(data);
                setCompanyId(data.companyId);
                setClientId(data.clientId);
                setProjectId(data.projectId ?? undefined);
                setTitle(data.title);
                setCurrency(data.currency);
                setDiscountPercent(Number(data.discountPercent));
                setTaxPercent(Number(data.taxPercent));
                setIssueDate(data.issueDate.slice(0, 10));
                setDueDate(data.dueDate.slice(0, 10));
                setTerms(data.terms ?? "");
                setNote(data.note ?? "");
                setPortalVisible(data.portalVisible);
                setStatus(data.status);
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
    }, [id]);

    const selectedClient = clients.find((client) => client.id === clientId);

    const handleSave = async () => {
        if (!clientId || !title.trim() || !issueDate || !dueDate) {
            toast.error("Client, title, issue date and due date are required.");
            return;
        }
        setIsSaving(true);
        try {
            const lineItems = lines
                .filter((line) => line.description.trim())
                .map((line) => ({ ...line, unit: line.unit || undefined }));
            if (lineItems.length === 0) {
                toast.error("Add at least one line item.");
                return;
            }

            if (isEdit && id) {
                const payload: UpdateInvoicePayload = {
                    projectId, title, currency, discountPercent, taxPercent, issueDate, dueDate,
                    terms: terms || undefined, note: note || undefined, portalVisible, signatureUrl, status, lineItems,
                };
                await api.patch(`/invoices/${id}`, payload);
                toast.success("Invoice updated.");
            } else {
                const payload: CreateInvoicePayload = {
                    clientId, projectId, companyId: targetCompanyId, title, currency, discountPercent,
                    taxPercent, issueDate, dueDate, terms: terms || undefined, note: note || undefined,
                    portalVisible, signatureUrl, lineItems,
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
                    <h4 className="text-xl font-semibold text-neutral-900 dark:text-white">
                        {isEdit ? invoiceNumber : "New Invoice"}
                    </h4>
                </div>
                <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" className="h-11 rounded-lg" onClick={() => window.print()}>
                        <Download className="w-4 h-4" />
                        Export PDF
                    </Button>
                    <Button type="button" className="h-11 rounded-lg" onClick={handleSave} disabled={isSaving}>
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
                                    <Combobox
                                        value={companyId}
                                        onChange={(value) => { setCompanyId(value); setClientId(""); }}
                                        disabled={isEdit}
                                        options={companies.map((company) => ({ value: company.id, label: company.name }))}
                                        placeholder="Select company"
                                        searchPlaceholder="Search companies..."
                                        emptyText="No companies found."
                                    />
                                </Field>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <Field>
                                    <FieldLabel>Client *</FieldLabel>
                                    <Combobox
                                        value={clientId}
                                        onChange={(value) => { setClientId(value); setProjectId(undefined); }}
                                        disabled={isEdit || !targetCompanyId}
                                        options={clients.map((client) => ({ value: client.id, label: client.name }))}
                                        placeholder={targetCompanyId ? "Select client" : "Select a company first"}
                                        searchPlaceholder="Search clients..."
                                        emptyText="No clients found."
                                        createHref="/clients-list/create"
                                        createLabel="Add new client"
                                    />
                                </Field>

                                <Field>
                                    <FieldLabel>Project</FieldLabel>
                                    <Combobox
                                        value={projectId}
                                        onChange={setProjectId}
                                        disabled={!clientId}
                                        options={projects.map((project) => ({ value: project.id, label: project.title }))}
                                        placeholder={clientId ? "Optional" : "Select a client first"}
                                        searchPlaceholder="Search projects..."
                                        emptyText="No projects found."
                                    />
                                </Field>
                            </div>

                            <Field>
                                <FieldLabel htmlFor="title">Title *</FieldLabel>
                                <Input id="title" className="h-11 rounded-lg" value={title} onChange={(event) => setTitle(event.target.value)} />
                            </Field>

                            <div className="grid grid-cols-3 gap-4">
                                <Field>
                                    <FieldLabel htmlFor="currency">Currency</FieldLabel>
                                    <Input id="currency" className="h-11 rounded-lg" value={currency} onChange={(event) => setCurrency(event.target.value)} />
                                </Field>
                                <Field>
                                    <FieldLabel htmlFor="discountPercent">Discount %</FieldLabel>
                                    <Input id="discountPercent" type="number" min={0} max={100} className="h-11 rounded-lg" value={discountPercent} onChange={(event) => setDiscountPercent(Number(event.target.value))} />
                                </Field>
                                <Field>
                                    <FieldLabel htmlFor="taxPercent">Tax %</FieldLabel>
                                    <Input id="taxPercent" type="number" min={0} max={100} className="h-11 rounded-lg" value={taxPercent} onChange={(event) => setTaxPercent(Number(event.target.value))} />
                                </Field>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <Field>
                                    <FieldLabel>Issue Date *</FieldLabel>
                                    <DatePicker value={issueDate} onChange={setIssueDate} />
                                </Field>
                                <Field>
                                    <FieldLabel>Due Date *</FieldLabel>
                                    <DatePicker value={dueDate} onChange={setDueDate} />
                                </Field>
                            </div>

                            {isEdit && (
                                <Field>
                                    <FieldLabel>Status</FieldLabel>
                                    <Select value={status} onValueChange={(value) => setStatus(value as InvoiceStatus)}>
                                        <SelectTrigger className="h-11 rounded-lg !w-full">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {STATUS_OPTIONS.map((option) => (
                                                <SelectItem key={option} value={option}>{option}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </Field>
                            )}

                            <Field orientation="horizontal" className="items-center justify-between">
                                <FieldLabel className="mb-0">Visible to client on portal</FieldLabel>
                                <Switch checked={portalVisible} onCheckedChange={setPortalVisible} />
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
                            <LineItemsEditor lines={lines} onChange={setLines} currency={currency} discountPercent={discountPercent} taxPercent={taxPercent} />
                        </CardContent>
                    </Card>

                    <div className="xl:sticky xl:top-24">
                        <DocumentPreview
                            kind="Invoice"
                            documentNumber={invoiceNumber || "DRAFT"}
                            documentDate={issueDate}
                            status={status}
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
                            terms={terms}
                            note={note}
                            signatureUrl={signatureUrl}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default InvoiceBuilder;
