import FormActions from "@/components/shared/FormActions";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import { api, ApiError } from "@/lib/api";
import type { Company } from "@/types/company";
import type { Project } from "@/types/project";
import type { Workspace } from "@/types/workspace";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState, type ReactNode } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "react-toastify";
import * as z from "zod";

const schema = z.object({
    projectId: z.string().min(1, "Project is required"),
    name: z.string().min(1, "Name is required"),
    description: z.string().optional(),
    colorHex: z.string().optional(),
    isActive: z.boolean().optional(),
    companyId: z.string().optional(),
});

export type WorkspaceFormValues = z.infer<typeof schema>;

interface WorkspaceFormProps {
    mode: "create" | "edit";
    initialValues?: Workspace;
    onSubmit: (values: WorkspaceFormValues) => Promise<void>;
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

const WorkspaceForm = ({ mode, initialValues, onSubmit, isSubmitting }: WorkspaceFormProps) => {
    const { user: actor } = useAuth();
    const isSuperAdmin = actor?.roleName === "SUPER_ADMIN";
    const [companies, setCompanies] = useState<Company[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);

    const form = useForm<WorkspaceFormValues>({
        resolver: zodResolver(schema),
        defaultValues: {
            projectId: initialValues?.projectId ?? "",
            name: initialValues?.name ?? "",
            description: initialValues?.description ?? "",
            colorHex: initialValues?.colorHex ?? "",
            isActive: initialValues?.isActive ?? true,
            companyId: initialValues?.companyId ?? undefined,
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
            setProjects([]);
            return;
        }
        api.get<Project[]>(`/projects?companyId=${targetCompanyId}`).then(setProjects).catch(() => toast.error("Failed to load projects."));
    }, [targetCompanyId]);

    const handleSubmit = async (values: WorkspaceFormValues) => {
        const cleaned = Object.fromEntries(
            Object.entries(values).map(([key, value]) => [key, value === "" ? undefined : value]),
        ) as WorkspaceFormValues;
        try {
            await onSubmit(cleaned);
        } catch (error) {
            toast.error(error instanceof ApiError ? error.message : "Something went wrong. Please try again.");
        }
    };

    return (
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8">
            <FormSection title="Basic Information" description="Core details for this workspace.">
                <Field data-invalid={!!form.formState.errors.name}>
                    <FieldLabel htmlFor="name">Name *</FieldLabel>
                    <Input id="name" className={inputClass} {...form.register("name")} />
                    {form.formState.errors.name && <FieldError errors={[form.formState.errors.name]} />}
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

                <Field data-invalid={!!form.formState.errors.projectId}>
                    <FieldLabel htmlFor="projectId">Project *</FieldLabel>
                    <Controller
                        name="projectId"
                        control={form.control}
                        render={({ field }) => (
                            <Select value={field.value} onValueChange={field.onChange} disabled={!targetCompanyId || mode === "edit"}>
                                <SelectTrigger id="projectId" className={selectTriggerClass}>
                                    <SelectValue placeholder={targetCompanyId ? "Select project" : "Select a company first"} />
                                </SelectTrigger>
                                <SelectContent>
                                    {projects.map((project) => (
                                        <SelectItem key={project.id} value={project.id}>
                                            {project.title}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    />
                    {form.formState.errors.projectId && <FieldError errors={[form.formState.errors.projectId]} />}
                </Field>

                <Field>
                    <FieldLabel htmlFor="colorHex">Color</FieldLabel>
                    <Input id="colorHex" type="color" className={`${inputClass} p-1`} {...form.register("colorHex")} />
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

            <FormSection title="Description" description="Optional workspace brief.">
                <div className="sm:col-span-2 lg:col-span-3">
                    <Field>
                        <FieldLabel htmlFor="description">Description</FieldLabel>
                        <Textarea id="description" rows={3} {...form.register("description")} />
                    </Field>
                </div>
            </FormSection>

            <FormActions isSubmitting={isSubmitting} submitLabel={mode === "create" ? "Create Workspace" : "Save Changes"} />
        </form>
    );
};

export default WorkspaceForm;
