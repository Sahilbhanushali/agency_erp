import FormActions from "@/components/shared/FormActions";
import ImageUploadButton from "@/components/shared/ImageUploadButton";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ApiError } from "@/lib/api";
import { bankAccountNumberField, gstNumberField, ifscField, panNumberField, phoneField, websiteField } from "@/lib/zod";
import type { Company } from "@/types/company";
import { zodResolver } from "@hookform/resolvers/zod";
import { Image as ImageIcon } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "react-toastify";
import * as z from "zod";

const schema = z.object({
    name: z.string().min(1, "Company name is required"),
    legalName: z.string().optional(),
    logoUrl: z.string().optional(),
    email: z.string().email("Enter a valid email address.").optional().or(z.literal("")),
    phone: phoneField,
    website: websiteField,
    gstNumber: gstNumberField,
    panNumber: panNumberField,
    hsnNumber: z.string().optional(),
    bankName: z.string().optional(),
    bankAccountName: z.string().optional(),
    bankAccountNumber: bankAccountNumberField,
    bankIfsc: ifscField,
    currency: z.string().optional(),
    timezone: z.string().optional(),
    isActive: z.boolean().optional(),
    line1: z.string().optional(),
    line2: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    postalCode: z.string().optional(),
    country: z.string().optional(),
});

export type CompanyFormValues = z.infer<typeof schema>;

interface CompanyFormProps {
    mode: "create" | "edit";
    initialValues?: Company;
    onSubmit: (values: CompanyFormValues) => Promise<void>;
    isSubmitting: boolean;
}

const inputClass = "h-11 rounded-lg";
const selectTriggerClass = "h-11 rounded-lg !w-full";

const CompanyForm = ({ mode, initialValues, onSubmit, isSubmitting }: CompanyFormProps) => {
    const form = useForm<CompanyFormValues>({
        resolver: zodResolver(schema),
        defaultValues: {
            name: initialValues?.name ?? "",
            legalName: initialValues?.legalName ?? "",
            logoUrl: initialValues?.logoUrl ?? undefined,
            email: initialValues?.email ?? "",
            phone: initialValues?.phone ?? "",
            website: initialValues?.website ?? "",
            gstNumber: initialValues?.gstNumber ?? "",
            panNumber: initialValues?.panNumber ?? "",
            hsnNumber: initialValues?.hsnNumber ?? "",
            bankName: initialValues?.bankName ?? "",
            bankAccountName: initialValues?.bankAccountName ?? "",
            bankAccountNumber: initialValues?.bankAccountNumber ?? "",
            bankIfsc: initialValues?.bankIfsc ?? "",
            currency: initialValues?.currency ?? "INR",
            timezone: initialValues?.timezone ?? "Asia/Kolkata",
            isActive: initialValues?.isActive ?? true,
            line1: initialValues?.registeredAddress?.line1 ?? "",
            line2: initialValues?.registeredAddress?.line2 ?? "",
            city: initialValues?.registeredAddress?.city ?? "",
            state: initialValues?.registeredAddress?.state ?? "",
            postalCode: initialValues?.registeredAddress?.postalCode ?? "",
            country: initialValues?.registeredAddress?.country ?? "",
        },
    });

    const handleSubmit = async (values: CompanyFormValues) => {
        try {
            await onSubmit(values);
        } catch (error) {
            toast.error(error instanceof ApiError ? error.message : "Something went wrong. Please try again.");
        }
    };

    return (
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-6">
                <Field data-invalid={!!form.formState.errors.name}>
                    <FieldLabel htmlFor="name">Company Name *</FieldLabel>
                    <Input id="name" className={inputClass} {...form.register("name")} />
                    {form.formState.errors.name && <FieldError errors={[form.formState.errors.name]} />}
                </Field>

                <Field>
                    <FieldLabel htmlFor="legalName">Legal Name</FieldLabel>
                    <Input id="legalName" className={inputClass} {...form.register("legalName")} />
                </Field>

                <Field>
                    <FieldLabel>Logo</FieldLabel>
                    <Controller
                        name="logoUrl"
                        control={form.control}
                        render={({ field }) => (
                            <ImageUploadButton label="Upload Logo" icon={ImageIcon} value={field.value} onChange={field.onChange} />
                        )}
                    />
                </Field>

                <Field data-invalid={!!form.formState.errors.email}>
                    <FieldLabel htmlFor="email">Email</FieldLabel>
                    <Input id="email" type="email" className={inputClass} {...form.register("email")} />
                    {form.formState.errors.email && <FieldError errors={[form.formState.errors.email]} />}
                </Field>

                <Field data-invalid={!!form.formState.errors.phone}>
                    <FieldLabel htmlFor="phone">Phone</FieldLabel>
                    <Input id="phone" maxLength={10} inputMode="numeric" className={inputClass} {...form.register("phone")} />
                    {form.formState.errors.phone && <FieldError errors={[form.formState.errors.phone]} />}
                </Field>

                <Field data-invalid={!!form.formState.errors.website}>
                    <FieldLabel htmlFor="website">Website</FieldLabel>
                    <Input id="website" type="url" className={inputClass} {...form.register("website")} />
                    {form.formState.errors.website && <FieldError errors={[form.formState.errors.website]} />}
                </Field>

                <Field data-invalid={!!form.formState.errors.gstNumber}>
                    <FieldLabel htmlFor="gstNumber">GST Number</FieldLabel>
                    <Input id="gstNumber" className={inputClass} {...form.register("gstNumber")} />
                    {form.formState.errors.gstNumber && <FieldError errors={[form.formState.errors.gstNumber]} />}
                </Field>

                <Field data-invalid={!!form.formState.errors.panNumber}>
                    <FieldLabel htmlFor="panNumber">PAN Number</FieldLabel>
                    <Input id="panNumber" className={inputClass} {...form.register("panNumber")} />
                    {form.formState.errors.panNumber && <FieldError errors={[form.formState.errors.panNumber]} />}
                </Field>

                <Field>
                    <FieldLabel htmlFor="hsnNumber">HSN/SAC Number</FieldLabel>
                    <Input id="hsnNumber" placeholder="998314 | 998391" className={inputClass} {...form.register("hsnNumber")} />
                </Field>

                <Field>
                    <FieldLabel htmlFor="currency">Currency</FieldLabel>
                    <Input id="currency" className={inputClass} {...form.register("currency")} />
                </Field>

                <Field>
                    <FieldLabel htmlFor="timezone">Timezone</FieldLabel>
                    <Input id="timezone" className={inputClass} {...form.register("timezone")} />
                </Field>

                {mode === "edit" && (
                    <Field>
                        <FieldLabel htmlFor="isActive">Status</FieldLabel>
                        <Select
                            value={form.watch("isActive") ? "true" : "false"}
                            onValueChange={(value) => form.setValue("isActive", value === "true")}
                        >
                            <SelectTrigger id="isActive" className={selectTriggerClass}>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="true">Active</SelectItem>
                                <SelectItem value="false">Inactive</SelectItem>
                            </SelectContent>
                        </Select>
                    </Field>
                )}
            </div>

            <div>
                <h6 className="text-sm font-semibold text-neutral-700 dark:text-neutral-200 mb-4">Bank Details</h6>
                <p className="text-xs text-neutral-500 mb-4">Shown in the "Bank Info" section of quotations and invoices.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-6">
                    <Field>
                        <FieldLabel htmlFor="bankName">Bank Name</FieldLabel>
                        <Input id="bankName" className={inputClass} {...form.register("bankName")} />
                    </Field>

                    <Field>
                        <FieldLabel htmlFor="bankAccountName">Account Name</FieldLabel>
                        <Input id="bankAccountName" className={inputClass} {...form.register("bankAccountName")} />
                    </Field>

                    <Field>
                        <FieldLabel htmlFor="bankAccountNumber">Account Number</FieldLabel>
                        <Input id="bankAccountNumber" className={inputClass} {...form.register("bankAccountNumber")} />
                    </Field>

                    <Field>
                        <FieldLabel htmlFor="bankIfsc">IFSC Code</FieldLabel>
                        <Input id="bankIfsc" className={inputClass} {...form.register("bankIfsc")} />
                    </Field>
                </div>
            </div>

            <div>
                <h6 className="text-sm font-semibold text-neutral-700 dark:text-neutral-200 mb-4">Registered Address</h6>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-6">
                    <Field>
                        <FieldLabel htmlFor="line1">Address Line 1</FieldLabel>
                        <Input id="line1" className={inputClass} {...form.register("line1")} />
                    </Field>

                    <Field>
                        <FieldLabel htmlFor="line2">Address Line 2</FieldLabel>
                        <Input id="line2" className={inputClass} {...form.register("line2")} />
                    </Field>

                    <Field>
                        <FieldLabel htmlFor="city">City</FieldLabel>
                        <Input id="city" className={inputClass} {...form.register("city")} />
                    </Field>

                    <Field>
                        <FieldLabel htmlFor="state">State</FieldLabel>
                        <Input id="state" className={inputClass} {...form.register("state")} />
                    </Field>

                    <Field>
                        <FieldLabel htmlFor="postalCode">Postal Code</FieldLabel>
                        <Input id="postalCode" className={inputClass} {...form.register("postalCode")} />
                    </Field>

                    <Field>
                        <FieldLabel htmlFor="country">Country</FieldLabel>
                        <Input id="country" className={inputClass} {...form.register("country")} />
                    </Field>
                </div>
            </div>

            <FormActions isSubmitting={isSubmitting} submitLabel={mode === "create" ? "Create Company" : "Save Changes"} />
        </form>
    );
};

export default CompanyForm;
