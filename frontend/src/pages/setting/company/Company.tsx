import FormActions from "@/components/shared/FormActions";
import PageHeader from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import { api, ApiError } from "@/lib/api";
import { gstNumberField, panNumberField, phoneField, websiteField } from "@/lib/zod";
import type { Company as CompanyType, CompanyPayload } from "@/types/company";
import { zodResolver } from "@hookform/resolvers/zod";
import { Building2, FileText, Loader2, MapPin } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "react-toastify";
import * as z from "zod";

const schema = z.object({
    name: z.string().min(1, "Company name is required"),
    legalName: z.string().optional(),
    email: z.string().email("Enter a valid email address.").optional().or(z.literal("")),
    phone: phoneField,
    website: websiteField,
    gstNumber: gstNumberField,
    panNumber: panNumberField,
    hsnNumber: z.string().optional(),
    line1: z.string().optional(),
    line2: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    postalCode: z.string().optional(),
    country: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const inputClass = "h-9 text-xs rounded-lg";

const Company = () => {
    const { user: actor } = useAuth();
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const form = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: {
            name: "",
            legalName: "",
            email: "",
            phone: "",
            website: "",
            gstNumber: "",
            panNumber: "",
            hsnNumber: "",
            line1: "",
            line2: "",
            city: "",
            state: "",
            postalCode: "",
            country: "",
        },
    });

    useEffect(() => {
        if (!actor?.companyId) {
            setIsLoading(false);
            return;
        }
        api
            .get<CompanyType>(`/companies/${actor.companyId}`)
            .then((data) => {
                form.reset({
                    name: data.name,
                    legalName: data.legalName ?? "",
                    email: data.email ?? "",
                    phone: data.phone ?? "",
                    website: data.website ?? "",
                    gstNumber: data.gstNumber ?? "",
                    panNumber: data.panNumber ?? "",
                    hsnNumber: data.hsnNumber ?? "",
                    line1: data.registeredAddress?.line1 ?? "",
                    line2: data.registeredAddress?.line2 ?? "",
                    city: data.registeredAddress?.city ?? "",
                    state: data.registeredAddress?.state ?? "",
                    postalCode: data.registeredAddress?.postalCode ?? "",
                    country: data.registeredAddress?.country ?? "",
                });
            })
            .catch((error) => toast.error(error instanceof ApiError ? error.message : "Failed to load company."))
            .finally(() => setIsLoading(false));
    }, [actor?.companyId]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleSubmit = async (values: FormValues) => {
        if (!actor?.companyId) return;
        setIsSubmitting(true);
        const { line1, line2, city, state, postalCode, country, ...companyFields } = values;
        const payload: CompanyPayload = {
            ...companyFields,
            email: companyFields.email || undefined,
            registeredAddress: line1 && city ? { line1, line2, city, state, postalCode, country } : undefined,
        };
        try {
            await api.patch(`/companies/${actor.companyId}`, payload);
            toast.success("Company settings updated.");
        } catch (error) {
            toast.error(error instanceof ApiError ? error.message : "Failed to update company.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-6">
            <PageHeader
                title="Company Settings"
                description="Manage your organization profile, legal tax credentials, and official invoicing address."
                breadcrumbs={[
                    { label: "Settings" },
                    { label: "Company Settings" },
                ]}
            />

            {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-3">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">Loading company profile...</p>
                </div>
            ) : !actor?.companyId ? (
                <Card className="rounded-xl border border-border">
                    <CardContent className="py-16 text-center text-muted-foreground text-sm">
                        Platform administrators are not scoped to a single organization.
                    </CardContent>
                </Card>
            ) : (
                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
                    {/* General Profile Section */}
                    <Card className="rounded-xl border border-border shadow-xs overflow-hidden">
                        <CardHeader className="border-b border-border/70 py-4 px-6">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                    <Building2 className="w-4 h-4" />
                                </div>
                                <div>
                                    <CardTitle className="text-sm font-semibold">General Information</CardTitle>
                                    <CardDescription className="text-xs mt-0.5">
                                        Basic profile and contact details used across your client documents.
                                    </CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-6">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                                <Field data-invalid={!!form.formState.errors.name}>
                                    <FieldLabel htmlFor="name" className="text-xs font-medium">Company Name *</FieldLabel>
                                    <Input id="name" placeholder="Acme Studio" className={inputClass} {...form.register("name")} />
                                    {form.formState.errors.name && <FieldError errors={[form.formState.errors.name]} />}
                                </Field>

                                <Field>
                                    <FieldLabel htmlFor="legalName" className="text-xs font-medium">Legal Name</FieldLabel>
                                    <Input id="legalName" placeholder="Acme Technologies Pvt Ltd" className={inputClass} {...form.register("legalName")} />
                                </Field>

                                <Field data-invalid={!!form.formState.errors.email}>
                                    <FieldLabel htmlFor="email" className="text-xs font-medium">Official Email</FieldLabel>
                                    <Input id="email" type="email" placeholder="contact@acme.com" className={inputClass} {...form.register("email")} />
                                    {form.formState.errors.email && <FieldError errors={[form.formState.errors.email]} />}
                                </Field>

                                <Field data-invalid={!!form.formState.errors.phone}>
                                    <FieldLabel htmlFor="phone" className="text-xs font-medium">Phone</FieldLabel>
                                    <Input id="phone" maxLength={10} inputMode="numeric" placeholder="+91 98765 43210" className={inputClass} {...form.register("phone")} />
                                    {form.formState.errors.phone && <FieldError errors={[form.formState.errors.phone]} />}
                                </Field>

                                <Field data-invalid={!!form.formState.errors.website}>
                                    <FieldLabel htmlFor="website" className="text-xs font-medium">Website</FieldLabel>
                                    <Input id="website" type="url" placeholder="https://acme.com" className={inputClass} {...form.register("website")} />
                                    {form.formState.errors.website && <FieldError errors={[form.formState.errors.website]} />}
                                </Field>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Tax & Financial Identifiers */}
                    <Card className="rounded-xl border border-border shadow-xs overflow-hidden">
                        <CardHeader className="border-b border-border/70 py-4 px-6">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                    <FileText className="w-4 h-4" />
                                </div>
                                <div>
                                    <CardTitle className="text-sm font-semibold">Tax & Identifiers</CardTitle>
                                    <CardDescription className="text-xs mt-0.5">
                                        Tax numbers printed on invoices and quotations.
                                    </CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-6">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                                <Field data-invalid={!!form.formState.errors.gstNumber}>
                                    <FieldLabel htmlFor="gstNumber" className="text-xs font-medium">GST Number (GSTIN)</FieldLabel>
                                    <Input id="gstNumber" placeholder="27AAPCA1234F1Z5" className={inputClass} {...form.register("gstNumber")} />
                                    {form.formState.errors.gstNumber && <FieldError errors={[form.formState.errors.gstNumber]} />}
                                </Field>

                                <Field data-invalid={!!form.formState.errors.panNumber}>
                                    <FieldLabel htmlFor="panNumber" className="text-xs font-medium">PAN Number</FieldLabel>
                                    <Input id="panNumber" placeholder="ABCDE1234F" className={inputClass} {...form.register("panNumber")} />
                                    {form.formState.errors.panNumber && <FieldError errors={[form.formState.errors.panNumber]} />}
                                </Field>

                                <Field>
                                    <FieldLabel htmlFor="hsnNumber" className="text-xs font-medium">HSN/SAC Number</FieldLabel>
                                    <Input id="hsnNumber" placeholder="998314 | 998391" className={inputClass} {...form.register("hsnNumber")} />
                                </Field>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Registered Address */}
                    <Card className="rounded-xl border border-border shadow-xs overflow-hidden">
                        <CardHeader className="border-b border-border/70 py-4 px-6">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                    <MapPin className="w-4 h-4" />
                                </div>
                                <div>
                                    <CardTitle className="text-sm font-semibold">Registered Address</CardTitle>
                                    <CardDescription className="text-xs mt-0.5">
                                        Official physical address displayed on billing documentation.
                                    </CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-6">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                                <Field className="sm:col-span-2">
                                    <FieldLabel htmlFor="line1" className="text-xs font-medium">Address Line 1</FieldLabel>
                                    <Input id="line1" placeholder="Building, Street name" className={inputClass} {...form.register("line1")} />
                                </Field>

                                <Field>
                                    <FieldLabel htmlFor="line2" className="text-xs font-medium">Address Line 2</FieldLabel>
                                    <Input id="line2" placeholder="Suite, floor (optional)" className={inputClass} {...form.register("line2")} />
                                </Field>

                                <Field>
                                    <FieldLabel htmlFor="city" className="text-xs font-medium">City</FieldLabel>
                                    <Input id="city" placeholder="Mumbai" className={inputClass} {...form.register("city")} />
                                </Field>

                                <Field>
                                    <FieldLabel htmlFor="state" className="text-xs font-medium">State / Province</FieldLabel>
                                    <Input id="state" placeholder="Maharashtra" className={inputClass} {...form.register("state")} />
                                </Field>

                                <Field>
                                    <FieldLabel htmlFor="postalCode" className="text-xs font-medium">Postal Code / PIN</FieldLabel>
                                    <Input id="postalCode" placeholder="400001" className={inputClass} {...form.register("postalCode")} />
                                </Field>

                                <Field>
                                    <FieldLabel htmlFor="country" className="text-xs font-medium">Country</FieldLabel>
                                    <Input id="country" placeholder="India" className={inputClass} {...form.register("country")} />
                                </Field>
                            </div>
                        </CardContent>
                    </Card>

                    <FormActions
                        isSubmitting={isSubmitting}
                        submitLabel="Save Changes"
                        onCancel={() => form.reset()}
                    />
                </form>
            )}
        </div>
    );
};

export default Company;
