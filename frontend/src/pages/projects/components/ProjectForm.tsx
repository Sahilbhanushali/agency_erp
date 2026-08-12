import FormActions from "@/components/shared/FormActions";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import { api, ApiError } from "@/lib/api";
import type { Client } from "@/types/client";
import type { Company } from "@/types/company";
import type { Project, ProjectStatus } from "@/types/project";
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

const STATUS_OPTIONS: ProjectStatus[] = ["DRAFT", "ACTIVE", "ON_HOLD", "IN_REVIEW", "COMPLETED", "ARCHIVED", "CANCELLED"];

const schema = z.object({
    title: z.string().min(1, "Title is required"),
    description: z.string().optional(),
    clientId: z.string().min(1, "Client is required"),
    managerId: z.string().min(1, "Manager is required"),
    companyId: z.string().optional(),
    status: z.enum(["DRAFT", "ACTIVE", "ON_HOLD", "IN_REVIEW", "COMPLETED", "ARCHIVED", "CANCELLED"]).optional(),
    startDate: z.string().optional(),
    deadline: z.string().optional(),
    budget: z.union([z.number(), z.nan()]).optional(),
    currency: z.string().optional(),
    clientApprovalEnabled: z.boolean(),
    colorHex: z.string().optional(),
});

export type ProjectFormValues = z.infer<typeof schema>;

interface ProjectFormProps {
    mode: "create" | "edit";
    initialValues?: Project;
    onSubmit: (values: ProjectFormValues) => Promise<void>;
    isSubmitting: boolean;
}

const inputClass = "h-11 rounded-lg";
const selectTriggerClass = "h-11 rounded-lg !w-full";

const FormSection = ({ title, description, children }: { title: string; description?: string; children: ReactNode }) => (
    <section className="border-b border-neutral-100 dark:border-slate-700 last:border-0 pb-8 last:pb-0">
        <div className="mb-5">
            <h6 className="text-base font-semibold text-neutral-900 dark:text-white">{title}</h6>
            {description && <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">{description}</p>}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-6">{children}</div>
    </section>
);

const ProjectForm = ({ mode, initialValues, onSubmit, isSubmitting }: ProjectFormProps) => {
    const { user: actor } = useAuth();
    const isSuperAdmin = actor?.roleName === "SUPER_ADMIN";
    const [companies, setCompanies] = useState<Company[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [managers, setManagers] = useState<MinimalUser[]>([]);

    const form = useForm<ProjectFormValues>({
        resolver: zodResolver(schema),
        defaultValues: {
            title: initialValues?.title ?? "",
            description: initialValues?.description ?? "",
            clientId: initialValues?.clientId ?? "",
            managerId: initialValues?.managerId ?? "",
            companyId: initialValues?.companyId ?? undefined,
            status: initialValues?.status ?? "DRAFT",
            startDate: initialValues?.startDate?.slice(0, 10) ?? "",
            deadline: initialValues?.deadline?.slice(0, 10) ?? "",
            budget: initialValues?.budget ? Number(initialValues.budget) : undefined,
            currency: initialValues?.currency ?? "INR",
            clientApprovalEnabled: initialValues?.clientApprovalEnabled ?? false,
            colorHex: initialValues?.colorHex ?? "",
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
            setClients([]);
            setManagers([]);
            return;
        }
        api.get<Client[]>(`/clients?companyId=${targetCompanyId}`).then(setClients).catch(() => toast.error("Failed to load clients."));
        api.get<MinimalUser[]>(`/users?companyId=${targetCompanyId}`).then(setManagers).catch(() => toast.error("Failed to load users."));
    }, [targetCompanyId]);

    const handleSubmit = async (values: ProjectFormValues) => {
        const cleaned = Object.fromEntries(
            Object.entries(values).map(([key, value]) => [key, value === "" || (typeof value === "number" && Number.isNaN(value)) ? undefined : value]),
        ) as ProjectFormValues;
        try {
            await onSubmit(cleaned);
        } catch (error) {
            toast.error(error instanceof ApiError ? error.message : "Something went wrong. Please try again.");
        }
    };

    return (
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8">
            <FormSection title="Basic Information" description="Core details for this project.">
                <Field data-invalid={!!form.formState.errors.title}>
                    <FieldLabel htmlFor="title">Title *</FieldLabel>
                    <Input id="title" className={inputClass} {...form.register("title")} />
                    {form.formState.errors.title && <FieldError errors={[form.formState.errors.title]} />}
                </Field>

                {isSuperAdmin && (
                    <Field data-invalid={!!form.formState.errors.companyId}>
                        <FieldLabel htmlFor="companyId">Company *</FieldLabel>
                        <Controller
                            name="companyId"
                            control={form.control}
                            render={({ field }) => (
                                <Select value={field.value} onValueChange={field.onChange} disabled={mode === "edit"}>
                                    <SelectTrigger id="companyId" className={selectTriggerClass}>
                                        <SelectValue placeholder="Select company" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {companies.map((company) => (
                                            <SelectItem key={company.id} value={company.id}>
                                                {company.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        />
                    </Field>
                )}

                <Field data-invalid={!!form.formState.errors.clientId}>
                    <FieldLabel htmlFor="clientId">Client *</FieldLabel>
                    <Controller
                        name="clientId"
                        control={form.control}
                        render={({ field }) => (
                            <Select value={field.value} onValueChange={field.onChange} disabled={!targetCompanyId}>
                                <SelectTrigger id="clientId" className={selectTriggerClass}>
                                    <SelectValue placeholder={targetCompanyId ? "Select client" : "Select a company first"} />
                                </SelectTrigger>
                                <SelectContent>
                                    {clients.map((client) => (
                                        <SelectItem key={client.id} value={client.id}>
                                            {client.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    />
                    {form.formState.errors.clientId && <FieldError errors={[form.formState.errors.clientId]} />}
                </Field>

                <Field data-invalid={!!form.formState.errors.managerId}>
                    <FieldLabel htmlFor="managerId">Manager *</FieldLabel>
                    <Controller
                        name="managerId"
                        control={form.control}
                        render={({ field }) => (
                            <Select value={field.value} onValueChange={field.onChange} disabled={!targetCompanyId}>
                                <SelectTrigger id="managerId" className={selectTriggerClass}>
                                    <SelectValue placeholder={targetCompanyId ? "Select manager" : "Select a company first"} />
                                </SelectTrigger>
                                <SelectContent>
                                    {managers.map((manager) => (
                                        <SelectItem key={manager.id} value={manager.id}>
                                            {manager.firstName} {manager.lastName}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    />
                    {form.formState.errors.managerId && <FieldError errors={[form.formState.errors.managerId]} />}
                </Field>

                <Field>
                    <FieldLabel htmlFor="status">Status</FieldLabel>
                    <Controller
                        name="status"
                        control={form.control}
                        render={({ field }) => (
                            <Select value={field.value} onValueChange={field.onChange}>
                                <SelectTrigger id="status" className={selectTriggerClass}>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {STATUS_OPTIONS.map((option) => (
                                        <SelectItem key={option} value={option}>
                                            {option.replace("_", " ")}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    />
                </Field>
            </FormSection>

            <FormSection title="Schedule & Budget" description="Timeline and financials.">
                <Field>
                    <FieldLabel htmlFor="startDate">Start Date</FieldLabel>
                    <Input id="startDate" type="date" className={inputClass} {...form.register("startDate")} />
                </Field>

                <Field>
                    <FieldLabel htmlFor="deadline">Deadline</FieldLabel>
                    <Input id="deadline" type="date" className={inputClass} {...form.register("deadline")} />
                </Field>

                <Field>
                    <FieldLabel htmlFor="budget">Budget</FieldLabel>
                    <Input id="budget" type="number" step="0.01" className={inputClass} {...form.register("budget", { valueAsNumber: true })} />
                </Field>

                <Field>
                    <FieldLabel htmlFor="currency">Currency</FieldLabel>
                    <Input id="currency" className={inputClass} {...form.register("currency")} />
                </Field>

                <Field>
                    <FieldLabel htmlFor="colorHex">Color</FieldLabel>
                    <Input id="colorHex" type="color" className={`${inputClass} p-1`} {...form.register("colorHex")} />
                </Field>

                <Field orientation="horizontal" className="items-center self-end pb-2.5">
                    <Controller
                        name="clientApprovalEnabled"
                        control={form.control}
                        render={({ field }) => (
                            <Checkbox id="clientApprovalEnabled" checked={field.value} onCheckedChange={field.onChange} />
                        )}
                    />
                    <FieldLabel htmlFor="clientApprovalEnabled" className="mb-0">Client approval enabled</FieldLabel>
                </Field>
            </FormSection>

            <FormSection title="Description" description="Optional project brief.">
                <div className="sm:col-span-2 lg:col-span-3">
                    <Field>
                        <FieldLabel htmlFor="description">Description</FieldLabel>
                        <Textarea id="description" rows={3} {...form.register("description")} />
                    </Field>
                </div>
            </FormSection>

            <FormActions isSubmitting={isSubmitting} submitLabel={mode === "create" ? "Create Project" : "Save Changes"} />
        </form>
    );
};

export default ProjectForm;
