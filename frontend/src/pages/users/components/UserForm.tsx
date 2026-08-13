import Combobox from "@/components/shared/Combobox";
import DatePicker from "@/components/shared/DatePicker";
import FormActions from "@/components/shared/FormActions";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/context/AuthContext";
import { api, ApiError } from "@/lib/api";
import { phoneField } from "@/lib/zod";
import type { Role, User } from "@/types/user";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState, type ReactNode } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "react-toastify";
import * as z from "zod";

interface Company {
    id: string;
    name: string;
}

const baseFields = {
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    email: z.string().email("Enter a valid email address."),
    phone: phoneField,
    roleId: z.string().min(1, "Role is required"),
    companyId: z.string().optional(),
    gender: z.enum(["MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY"]).optional(),
    dateOfBirth: z.string().optional(),
    employmentType: z.enum(["FULL_TIME", "PART_TIME", "CONTRACT", "INTERN", "FREELANCER"]).optional(),
    department: z.string().optional(),
    designation: z.string().optional(),
    joiningDate: z.string().optional(),
    isRemote: z.boolean(),
};

const schema = z.object({
    ...baseFields,
    status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED", "INVITED"]).optional(),
});

export type UserFormValues = z.infer<typeof schema>;

interface UserFormProps {
    mode: "create" | "edit";
    initialValues?: User;
    onSubmit: (values: UserFormValues) => Promise<void>;
    isSubmitting: boolean;
}

const inputClass = "h-11 rounded-lg";
const selectTriggerClass = "h-11 rounded-lg !w-full";

const FormSection = ({ title, description, children }: { title: string; description?: string; children: ReactNode }) => (
    <section className="border-b border-border last:border-0 pb-8 last:pb-0">
        <div className="mb-5">
            <h6 className="text-base font-semibold text-neutral-900 dark:text-white">{title}</h6>
            {description && <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">{description}</p>}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-6">{children}</div>
    </section>
);

const UserForm = ({ mode, initialValues, onSubmit, isSubmitting }: UserFormProps) => {
    const { user: actor } = useAuth();
    const isSuperAdmin = actor?.roleName === "SUPER_ADMIN";
    const [companies, setCompanies] = useState<Company[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);

    const form = useForm<UserFormValues>({
        resolver: zodResolver(schema),
        defaultValues: {
            firstName: initialValues?.firstName ?? "",
            lastName: initialValues?.lastName ?? "",
            email: initialValues?.email ?? "",
            phone: initialValues?.phone ?? "",
            roleId: initialValues?.roleId ?? "",
            companyId: initialValues?.companyId ?? undefined,
            gender: initialValues?.gender ?? undefined,
            dateOfBirth: initialValues?.dateOfBirth?.slice(0, 10) ?? "",
            employmentType: initialValues?.employmentType ?? undefined,
            department: initialValues?.department ?? "",
            designation: initialValues?.designation ?? "",
            joiningDate: initialValues?.joiningDate?.slice(0, 10) ?? "",
            isRemote: initialValues?.isRemote ?? false,
            status: initialValues?.status ?? "ACTIVE",
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
            setRoles([]);
            return;
        }
        api
            .get<Role[]>(`/roles?companyId=${targetCompanyId}`)
            .then(setRoles)
            .catch(() => toast.error("Failed to load roles."));
    }, [targetCompanyId]);

    const handleSubmit = async (values: UserFormValues) => {
        // Optional text/date fields default to "" in the form; the backend rejects "" for @IsDateString and prefers omitted keys.
        const cleaned = Object.fromEntries(
            Object.entries(values).map(([key, value]) => [key, value === "" ? undefined : value]),
        ) as UserFormValues;
        try {
            await onSubmit(cleaned);
        } catch (error) {
            toast.error(error instanceof ApiError ? error.message : "Something went wrong. Please try again.");
        }
    };

    return (
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8">
            <FormSection title="Basic Information" description="Name and contact details for this user.">
                <Field data-invalid={!!form.formState.errors.firstName}>
                    <FieldLabel htmlFor="firstName">First Name *</FieldLabel>
                    <Input id="firstName" className={inputClass} {...form.register("firstName")} />
                    {form.formState.errors.firstName && <FieldError errors={[form.formState.errors.firstName]} />}
                </Field>

                <Field data-invalid={!!form.formState.errors.lastName}>
                    <FieldLabel htmlFor="lastName">Last Name *</FieldLabel>
                    <Input id="lastName" className={inputClass} {...form.register("lastName")} />
                    {form.formState.errors.lastName && <FieldError errors={[form.formState.errors.lastName]} />}
                </Field>

                <Field data-invalid={!!form.formState.errors.email}>
                    <FieldLabel htmlFor="email">Email *</FieldLabel>
                    <Input id="email" type="email" className={inputClass} {...form.register("email")} />
                    {form.formState.errors.email && <FieldError errors={[form.formState.errors.email]} />}
                </Field>

                <Field data-invalid={!!form.formState.errors.phone}>
                    <FieldLabel htmlFor="phone">Phone</FieldLabel>
                    <Input id="phone" maxLength={10} inputMode="numeric" className={inputClass} {...form.register("phone")} />
                    {form.formState.errors.phone && <FieldError errors={[form.formState.errors.phone]} />}
                </Field>
            </FormSection>

            {mode === "create" && (
                <p className="text-sm text-neutral-500 dark:text-neutral-400 -mt-4">
                    An invite email will be sent to this address with a link to set their password.
                </p>
            )}

            <FormSection title="Account & Role" description="Which company and role this user belongs to.">
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

                <Field data-invalid={!!form.formState.errors.roleId}>
                    <FieldLabel htmlFor="roleId">Role *</FieldLabel>
                    <Controller
                        name="roleId"
                        control={form.control}
                        render={({ field }) => (
                            <Combobox
                                id="roleId"
                                value={field.value}
                                onChange={field.onChange}
                                disabled={!targetCompanyId}
                                options={roles.map((role) => ({ value: role.id, label: role.displayName }))}
                                placeholder={targetCompanyId ? "Select role" : "Select a company first"}
                                searchPlaceholder="Search roles..."
                                emptyText="No roles found."
                                createLabel="Go create a role"
                                createHref="/roles-list"
                            />
                        )}
                    />
                    {form.formState.errors.roleId && <FieldError errors={[form.formState.errors.roleId]} />}
                </Field>

                {mode === "edit" && (
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
                                        {["ACTIVE", "INACTIVE", "SUSPENDED", "INVITED"].map((option) => (
                                            <SelectItem key={option} value={option}>
                                                {option}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        />
                    </Field>
                )}
            </FormSection>

            <FormSection title="Employment Details" description="Role within the organization.">
                <Field>
                    <FieldLabel htmlFor="department">Department</FieldLabel>
                    <Input id="department" className={inputClass} {...form.register("department")} />
                </Field>

                <Field>
                    <FieldLabel htmlFor="designation">Designation</FieldLabel>
                    <Input id="designation" className={inputClass} {...form.register("designation")} />
                </Field>

                <Field>
                    <FieldLabel htmlFor="employmentType">Employment Type</FieldLabel>
                    <Controller
                        name="employmentType"
                        control={form.control}
                        render={({ field }) => (
                            <Select value={field.value} onValueChange={field.onChange}>
                                <SelectTrigger id="employmentType" className={selectTriggerClass}>
                                    <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                                <SelectContent>
                                    {["FULL_TIME", "PART_TIME", "CONTRACT", "INTERN", "FREELANCER"].map((option) => (
                                        <SelectItem key={option} value={option}>
                                            {option.replace("_", " ")}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    />
                </Field>

                <Field>
                    <FieldLabel htmlFor="joiningDate">Joining Date</FieldLabel>
                    <Controller
                        name="joiningDate"
                        control={form.control}
                        render={({ field }) => <DatePicker id="joiningDate" value={field.value} onChange={field.onChange} />}
                    />
                </Field>

                <Field orientation="horizontal" className="items-center self-end pb-2.5">
                    <Controller
                        name="isRemote"
                        control={form.control}
                        render={({ field }) => (
                            <Checkbox id="isRemote" checked={field.value} onCheckedChange={field.onChange} />
                        )}
                    />
                    <FieldLabel htmlFor="isRemote" className="mb-0">Remote employee</FieldLabel>
                </Field>
            </FormSection>

            <FormSection title="Personal Information" description="Optional demographic details.">
                <Field>
                    <FieldLabel htmlFor="gender">Gender</FieldLabel>
                    <Controller
                        name="gender"
                        control={form.control}
                        render={({ field }) => (
                            <Select value={field.value} onValueChange={field.onChange}>
                                <SelectTrigger id="gender" className={selectTriggerClass}>
                                    <SelectValue placeholder="Select gender" />
                                </SelectTrigger>
                                <SelectContent>
                                    {["MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY"].map((option) => (
                                        <SelectItem key={option} value={option}>
                                            {option.replace(/_/g, " ")}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    />
                </Field>

                <Field>
                    <FieldLabel htmlFor="dateOfBirth">Date of Birth</FieldLabel>
                    <Controller
                        name="dateOfBirth"
                        control={form.control}
                        render={({ field }) => (
                            <DatePicker id="dateOfBirth" value={field.value} onChange={field.onChange} toYear={new Date().getFullYear()} />
                        )}
                    />
                </Field>
            </FormSection>

            <FormActions isSubmitting={isSubmitting} submitLabel={mode === "create" ? "Create User" : "Save Changes"} />
        </form>
    );
};

export default UserForm;
