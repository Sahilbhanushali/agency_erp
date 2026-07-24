import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/context/AuthContext";
import { api, ApiError } from "@/lib/api";
import type { Role, User } from "@/types/user";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Controller, useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
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
    phone: z.string().optional(),
    roleId: z.string().min(1, "Role is required"),
    companyId: z.string().optional(),
    gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
    dateOfBirth: z.string().optional(),
    employmentType: z.enum(["FULL_TIME", "PART_TIME", "CONTRACT", "INTERN", "FREELANCER"]).optional(),
    department: z.string().optional(),
    designation: z.string().optional(),
    joiningDate: z.string().optional(),
    isRemote: z.boolean(),
};

const schema = z.object({
    ...baseFields,
    password: z.string().optional(),
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
    <section className="border-b border-neutral-100 dark:border-slate-700 last:border-0 pb-8 last:pb-0">
        <div className="mb-5">
            <h6 className="text-base font-semibold text-neutral-900 dark:text-white">{title}</h6>
            {description && <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">{description}</p>}
        </div>
        <div className="grid sm:grid-cols-2 gap-x-5 gap-y-5">{children}</div>
    </section>
);

const UserForm = ({ mode, initialValues, onSubmit, isSubmitting }: UserFormProps) => {
    const navigate = useNavigate();
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
            password: "",
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
        if (mode === "create" && (!values.password || values.password.length < 6)) {
            form.setError("password", { message: "Password must be at least 6 characters." });
            return;
        }
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
                <FieldGroup className="min-w-0">
                    <Field data-invalid={!!form.formState.errors.firstName}>
                        <FieldLabel htmlFor="firstName">First Name *</FieldLabel>
                        <Input id="firstName" className={inputClass} {...form.register("firstName")} />
                        {form.formState.errors.firstName && <FieldError errors={[form.formState.errors.firstName]} />}
                    </Field>
                </FieldGroup>

                <FieldGroup className="min-w-0">
                    <Field data-invalid={!!form.formState.errors.lastName}>
                        <FieldLabel htmlFor="lastName">Last Name *</FieldLabel>
                        <Input id="lastName" className={inputClass} {...form.register("lastName")} />
                        {form.formState.errors.lastName && <FieldError errors={[form.formState.errors.lastName]} />}
                    </Field>
                </FieldGroup>

                <FieldGroup className="min-w-0">
                    <Field data-invalid={!!form.formState.errors.email}>
                        <FieldLabel htmlFor="email">Email *</FieldLabel>
                        <Input id="email" type="email" className={inputClass} {...form.register("email")} />
                        {form.formState.errors.email && <FieldError errors={[form.formState.errors.email]} />}
                    </Field>
                </FieldGroup>

                <FieldGroup className="min-w-0">
                    <Field>
                        <FieldLabel htmlFor="phone">Phone</FieldLabel>
                        <Input id="phone" className={inputClass} {...form.register("phone")} />
                    </Field>
                </FieldGroup>

                {mode === "create" && (
                    <FieldGroup className="min-w-0">
                        <Field data-invalid={!!form.formState.errors.password}>
                            <FieldLabel htmlFor="password">Password *</FieldLabel>
                            <Input id="password" type="password" className={inputClass} {...form.register("password")} />
                            {form.formState.errors.password && <FieldError errors={[form.formState.errors.password]} />}
                        </Field>
                    </FieldGroup>
                )}
            </FormSection>

            <FormSection title="Account & Role" description="Which company and role this user belongs to.">
                {isSuperAdmin && (
                    <FieldGroup className="min-w-0">
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
                    </FieldGroup>
                )}

                <FieldGroup className="min-w-0">
                    <Field data-invalid={!!form.formState.errors.roleId}>
                        <FieldLabel htmlFor="roleId">Role *</FieldLabel>
                        <Controller
                            name="roleId"
                            control={form.control}
                            render={({ field }) => (
                                <Select value={field.value} onValueChange={field.onChange} disabled={!targetCompanyId}>
                                    <SelectTrigger id="roleId" className={selectTriggerClass}>
                                        <SelectValue placeholder={targetCompanyId ? "Select role" : "Select a company first"} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {roles.map((role) => (
                                            <SelectItem key={role.id} value={role.id}>
                                                {role.displayName}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        />
                        {form.formState.errors.roleId && <FieldError errors={[form.formState.errors.roleId]} />}
                    </Field>
                </FieldGroup>

                {mode === "edit" && (
                    <FieldGroup className="min-w-0">
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
                    </FieldGroup>
                )}
            </FormSection>

            <FormSection title="Employment Details" description="Role within the organization.">
                <FieldGroup className="min-w-0">
                    <Field>
                        <FieldLabel htmlFor="department">Department</FieldLabel>
                        <Input id="department" className={inputClass} {...form.register("department")} />
                    </Field>
                </FieldGroup>

                <FieldGroup className="min-w-0">
                    <Field>
                        <FieldLabel htmlFor="designation">Designation</FieldLabel>
                        <Input id="designation" className={inputClass} {...form.register("designation")} />
                    </Field>
                </FieldGroup>

                <FieldGroup className="min-w-0">
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
                </FieldGroup>

                <FieldGroup className="min-w-0">
                    <Field>
                        <FieldLabel htmlFor="joiningDate">Joining Date</FieldLabel>
                        <Input id="joiningDate" type="date" className={inputClass} {...form.register("joiningDate")} />
                    </Field>
                </FieldGroup>

                <FieldGroup className="min-w-0 flex-row items-center gap-2 self-start pt-7">
                    <Controller
                        name="isRemote"
                        control={form.control}
                        render={({ field }) => (
                            <Checkbox id="isRemote" checked={field.value} onCheckedChange={field.onChange} />
                        )}
                    />
                    <FieldLabel htmlFor="isRemote" className="mb-0">Remote employee</FieldLabel>
                </FieldGroup>
            </FormSection>

            <FormSection title="Personal Information" description="Optional demographic details.">
                <FieldGroup className="min-w-0">
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
                                        {["MALE", "FEMALE", "OTHER"].map((option) => (
                                            <SelectItem key={option} value={option}>
                                                {option}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        />
                    </Field>
                </FieldGroup>

                <FieldGroup className="min-w-0">
                    <Field>
                        <FieldLabel htmlFor="dateOfBirth">Date of Birth</FieldLabel>
                        <Input id="dateOfBirth" type="date" className={inputClass} {...form.register("dateOfBirth")} />
                    </Field>
                </FieldGroup>
            </FormSection>

            <div className="flex items-center justify-end gap-3 border-t border-neutral-100 dark:border-slate-700 pt-6">
                <Button type="button" variant="outline" className="h-11 px-8 rounded-lg" onClick={() => navigate(-1)} disabled={isSubmitting}>
                    Cancel
                </Button>
                <Button type="submit" className="h-11 px-8 rounded-lg" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="animate-spin h-4.5 w-4.5 mr-2" />}
                    {mode === "create" ? "Create User" : "Save Changes"}
                </Button>
            </div>
        </form>
    );
};

export default UserForm;
