import Combobox from "@/components/shared/Combobox";
import FormActions from "@/components/shared/FormActions";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import { api, ApiError } from "@/lib/api";
import type { Client } from "@/types/client";
import type { Company } from "@/types/company";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState, type ReactNode } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "react-toastify";
import * as z from "zod";

interface MinimalUser {
    id: string;
    firstName: string;
    lastName: string;
}

const schema = z.object({
    name: z.string().min(1, "Name is required"),
    email: z.string().email("Enter a valid email address."),
    companyId: z.string().optional(),
    industry: z.string().optional(),
    website: z.string().optional(),
    phone: z.string().optional(),
    gstNumber: z.string().optional(),
    panNumber: z.string().optional(),
    accountManagerId: z.string().optional(),
    note: z.string().optional(),
    isActive: z.boolean().optional(),
});

export type ClientFormValues = z.infer<typeof schema>;

interface ClientFormProps {
    mode: "create" | "edit";
    initialValues?: Client;
    onSubmit: (values: ClientFormValues) => Promise<void>;
    isSubmitting: boolean;
}

const inputClass = "h-9 text-xs rounded-lg";
const selectTriggerClass = "h-9 text-xs rounded-lg !w-full";

const FormSection = ({ title, description, children }: { title: string; description?: string; children: ReactNode }) => (
    <section className="border-b border-border last:border-0 pb-8 last:pb-0">
        <div className="mb-5">
            <h6 className="text-base font-semibold text-neutral-900 dark:text-white">{title}</h6>
            {description && <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">{description}</p>}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-6">{children}</div>
    </section>
);

const ClientForm = ({ mode, initialValues, onSubmit, isSubmitting }: ClientFormProps) => {
    const { user: actor } = useAuth();
    const isSuperAdmin = actor?.roleName === "SUPER_ADMIN";
    const [companies, setCompanies] = useState<Company[]>([]);
    const [managers, setManagers] = useState<MinimalUser[]>([]);

    const form = useForm<ClientFormValues>({
        resolver: zodResolver(schema),
        defaultValues: {
            name: initialValues?.name ?? "",
            email: initialValues?.email ?? "",
            companyId: initialValues?.companyId ?? undefined,
            industry: initialValues?.industry ?? "",
            website: initialValues?.website ?? "",
            phone: initialValues?.phone ?? "",
            gstNumber: initialValues?.gstNumber ?? "",
            panNumber: initialValues?.panNumber ?? "",
            accountManagerId: initialValues?.accountManagerId ?? undefined,
            note: initialValues?.note ?? "",
            isActive: initialValues?.isActive ?? true,
        },
    });

    const selectedCompanyId = form.watch("companyId");
    const targetCompanyId = isSuperAdmin ? selectedCompanyId : actor?.companyId;

    useEffect(() => {
        if (isSuperAdmin) {
            api.get<Company[]>("/companies").then(setCompanies).catch(() => toast.error("Failed to load companies."));
        }
    }, [isSuperAdmin]);

    useEffect(() => {
        if (!targetCompanyId) {
            setManagers([]);
            return;
        }
        api
            .get<MinimalUser[]>(`/users?companyId=${targetCompanyId}`)
            .then(setManagers)
            .catch(() => toast.error("Failed to load users."));
    }, [targetCompanyId]);

    const handleSubmit = async (values: ClientFormValues) => {
        const cleaned = Object.fromEntries(
            Object.entries(values).map(([key, value]) => [key, value === "" ? undefined : value]),
        ) as ClientFormValues;
        try {
            await onSubmit(cleaned);
        } catch (error) {
            toast.error(error instanceof ApiError ? error.message : "Something went wrong. Please try again.");
        }
    };

    return (
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8">
            <FormSection title="Basic Information" description="Core details for this client.">
                <Field data-invalid={!!form.formState.errors.name}>
                    <FieldLabel htmlFor="name">Name *</FieldLabel>
                    <Input id="name" className={inputClass} {...form.register("name")} />
                    {form.formState.errors.name && <FieldError errors={[form.formState.errors.name]} />}
                </Field>

                <Field data-invalid={!!form.formState.errors.email}>
                    <FieldLabel htmlFor="email">Email *</FieldLabel>
                    <Input id="email" type="email" className={inputClass} {...form.register("email")} />
                    {form.formState.errors.email && <FieldError errors={[form.formState.errors.email]} />}
                </Field>

                <Field>
                    <FieldLabel htmlFor="phone">Phone</FieldLabel>
                    <Input id="phone" className={inputClass} {...form.register("phone")} />
                </Field>

                <Field>
                    <FieldLabel htmlFor="industry">Industry</FieldLabel>
                    <Input id="industry" className={inputClass} {...form.register("industry")} />
                </Field>

                <Field>
                    <FieldLabel htmlFor="website">Website</FieldLabel>
                    <Input id="website" className={inputClass} {...form.register("website")} />
                </Field>

                {isSuperAdmin && (
                    <Field data-invalid={!!form.formState.errors.companyId}>
                        <FieldLabel htmlFor="companyId">Company *</FieldLabel>
                        <Controller
                            name="companyId"
                            control={form.control}
                            render={({ field }) => (
                                <Combobox
                                    id="companyId"
                                    value={field.value}
                                    onChange={field.onChange}
                                    disabled={mode === "edit"}
                                    options={companies.map((company) => ({ value: company.id, label: company.name }))}
                                    placeholder="Select company"
                                    searchPlaceholder="Search companies..."
                                    emptyText="No companies found."
                                    createLabel="Add new company"
                                    createHref="/companies-list/create"
                                />
                            )}
                        />
                    </Field>
                )}
            </FormSection>

            <FormSection title="Account Details" description="Compliance and internal ownership.">
                <Field>
                    <FieldLabel htmlFor="gstNumber">GST Number</FieldLabel>
                    <Input id="gstNumber" className={inputClass} {...form.register("gstNumber")} />
                </Field>

                <Field>
                    <FieldLabel htmlFor="panNumber">PAN Number</FieldLabel>
                    <Input id="panNumber" className={inputClass} {...form.register("panNumber")} />
                </Field>

                <Field>
                    <FieldLabel htmlFor="accountManagerId">Account Manager</FieldLabel>
                    <Controller
                        name="accountManagerId"
                        control={form.control}
                        render={({ field }) => (
                            <Combobox
                                id="accountManagerId"
                                value={field.value}
                                onChange={field.onChange}
                                disabled={!targetCompanyId}
                                options={managers.map((manager) => ({ value: manager.id, label: `${manager.firstName} ${manager.lastName}` }))}
                                placeholder={targetCompanyId ? "Select manager" : "Select a company first"}
                                searchPlaceholder="Search users..."
                                emptyText="No users found."
                                createLabel="Go invite a user"
                                createHref="/users-list/create"
                            />
                        )}
                    />
                </Field>

                {mode === "edit" && (
                    <Field>
                        <FieldLabel htmlFor="isActive">Status</FieldLabel>
                        <Controller
                            name="isActive"
                            control={form.control}
                            render={({ field }) => (
                                <Select value={field.value ? "true" : "false"} onValueChange={(value) => field.onChange(value === "true")}>
                                    <SelectTrigger id="isActive" className={selectTriggerClass}>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="true">Active</SelectItem>
                                        <SelectItem value="false">Inactive</SelectItem>
                                    </SelectContent>
                                </Select>
                            )}
                        />
                    </Field>
                )}
            </FormSection>

            <FormSection title="Notes" description="Optional internal notes about this client.">
                <div className="sm:col-span-2 lg:col-span-3">
                    <Field>
                        <FieldLabel htmlFor="note">Note</FieldLabel>
                        <Textarea id="note" rows={3} {...form.register("note")} />
                    </Field>
                </div>
            </FormSection>

            <FormActions isSubmitting={isSubmitting} submitLabel={mode === "create" ? "Create Client" : "Save Changes"} />
        </form>
    );
};

export default ClientForm;
