import DatePicker from "@/components/shared/DatePicker";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError } from "@/lib/api";
import type { AddressInput, EmployeeProfilePayload, MaritalStatus, User } from "@/types/user";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "react-toastify";
import * as z from "zod";

const MARITAL_STATUSES: MaritalStatus[] = ["SINGLE", "MARRIED", "DIVORCED", "WIDOWED", "OTHER"];

const addressSchema = z.object({
    line1: z.string().min(1, "Address line 1 is required"),
    line2: z.string().optional(),
    city: z.string().min(1, "City is required"),
    state: z.string().optional(),
    postalCode: z.string().optional(),
    country: z.string().optional(),
});

const optionalAddressSchema = z
    .object({
        line1: z.string().optional(),
        line2: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        postalCode: z.string().optional(),
        country: z.string().optional(),
    })
    .refine((value) => !value.line1 && !value.city ? true : addressSchema.safeParse(value).success, {
        message: "Address line 1 and city are required once an address is started",
        path: ["line1"],
    });

const schema = z.object({
    reportingManagerId: z.string().optional(),
    employeeCode: z.string().optional(),
    bloodGroup: z.string().optional(),
    maritalStatus: z.enum(["SINGLE", "MARRIED", "DIVORCED", "WIDOWED", "OTHER"]).optional(),
    nationality: z.string().optional(),
    personalEmail: z.string().email("Enter a valid email address.").optional().or(z.literal("")),
    alternatePhone: z.string().optional(),
    emergencyContactName: z.string().optional(),
    emergencyContactPhone: z.string().optional(),
    emergencyContactRelation: z.string().optional(),
    panNumber: z.string().optional(),
    aadhaarNumber: z.string().optional(),
    passportNumber: z.string().optional(),
    probationEndDate: z.string().optional(),
    confirmationDate: z.string().optional(),
    note: z.string().optional(),
    currentAddress: optionalAddressSchema,
    permanentAddress: optionalAddressSchema,
});

type FormValues = z.infer<typeof schema>;

const inputClass = "h-11 rounded-lg";
const selectTriggerClass = "h-11 rounded-lg !w-full";

interface EmployeeProfileFormProps {
    user: User;
    onSaved: (user: User) => void;
}

const AddressFields = ({ prefix, label, form }: { prefix: "currentAddress" | "permanentAddress"; label: string; form: ReturnType<typeof useForm<FormValues>> }) => (
    <div className="col-span-full">
        <h6 className="text-sm font-semibold text-neutral-700 dark:text-neutral-200 mb-3">{label}</h6>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-6">
            <Field data-invalid={!!form.formState.errors[prefix]?.line1}>
                <FieldLabel htmlFor={`${prefix}.line1`}>Address Line 1</FieldLabel>
                <Input id={`${prefix}.line1`} className={inputClass} {...form.register(`${prefix}.line1`)} />
                {form.formState.errors[prefix]?.line1 && <FieldError errors={[form.formState.errors[prefix]?.line1]} />}
            </Field>
            <Field>
                <FieldLabel htmlFor={`${prefix}.line2`}>Address Line 2</FieldLabel>
                <Input id={`${prefix}.line2`} className={inputClass} {...form.register(`${prefix}.line2`)} />
            </Field>
            <Field data-invalid={!!form.formState.errors[prefix]?.city}>
                <FieldLabel htmlFor={`${prefix}.city`}>City</FieldLabel>
                <Input id={`${prefix}.city`} className={inputClass} {...form.register(`${prefix}.city`)} />
                {form.formState.errors[prefix]?.city && <FieldError errors={[form.formState.errors[prefix]?.city]} />}
            </Field>
            <Field>
                <FieldLabel htmlFor={`${prefix}.state`}>State</FieldLabel>
                <Input id={`${prefix}.state`} className={inputClass} {...form.register(`${prefix}.state`)} />
            </Field>
            <Field>
                <FieldLabel htmlFor={`${prefix}.postalCode`}>Postal Code</FieldLabel>
                <Input id={`${prefix}.postalCode`} className={inputClass} {...form.register(`${prefix}.postalCode`)} />
            </Field>
            <Field>
                <FieldLabel htmlFor={`${prefix}.country`}>Country</FieldLabel>
                <Input id={`${prefix}.country`} className={inputClass} {...form.register(`${prefix}.country`)} />
            </Field>
        </div>
    </div>
);

const EmployeeProfileForm = ({ user, onSaved }: EmployeeProfileFormProps) => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [colleagues, setColleagues] = useState<User[]>([]);
    const profile = user.employeeProfile;

    const form = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: {
            reportingManagerId: profile?.reportingManagerId ?? undefined,
            employeeCode: profile?.employeeCode ?? "",
            bloodGroup: profile?.bloodGroup ?? "",
            maritalStatus: profile?.maritalStatus ?? undefined,
            nationality: profile?.nationality ?? "",
            personalEmail: profile?.personalEmail ?? "",
            alternatePhone: profile?.alternatePhone ?? "",
            emergencyContactName: profile?.emergencyContactName ?? "",
            emergencyContactPhone: profile?.emergencyContactPhone ?? "",
            emergencyContactRelation: profile?.emergencyContactRelation ?? "",
            panNumber: profile?.panNumber ?? "",
            aadhaarNumber: profile?.aadhaarNumber ?? "",
            passportNumber: profile?.passportNumber ?? "",
            probationEndDate: profile?.probationEndDate?.slice(0, 10) ?? "",
            confirmationDate: profile?.confirmationDate?.slice(0, 10) ?? "",
            note: profile?.note ?? "",
            currentAddress: {
                line1: profile?.currentAddress?.line1 ?? "",
                line2: profile?.currentAddress?.line2 ?? "",
                city: profile?.currentAddress?.city ?? "",
                state: profile?.currentAddress?.state ?? "",
                postalCode: profile?.currentAddress?.postalCode ?? "",
                country: profile?.currentAddress?.country ?? "",
            },
            permanentAddress: {
                line1: profile?.permanentAddress?.line1 ?? "",
                line2: profile?.permanentAddress?.line2 ?? "",
                city: profile?.permanentAddress?.city ?? "",
                state: profile?.permanentAddress?.state ?? "",
                postalCode: profile?.permanentAddress?.postalCode ?? "",
                country: profile?.permanentAddress?.country ?? "",
            },
        },
    });

    useEffect(() => {
        if (!user.companyId) return;
        api
            .get<User[]>(`/users?companyId=${user.companyId}`)
            .then((users) => setColleagues(users.filter((u) => u.id !== user.id)))
            .catch(() => toast.error("Failed to load managers."));
    }, [user.companyId, user.id]);

    const stripEmptyAddress = (address?: FormValues["currentAddress"]): AddressInput | undefined =>
        address?.line1 && address?.city ? { ...address, line1: address.line1, city: address.city } : undefined;

    const handleSubmit = async (values: FormValues) => {
        setIsSubmitting(true);
        const cleaned: EmployeeProfilePayload = Object.fromEntries(
            Object.entries(values).map(([key, value]) => [key, value === "" ? undefined : value]),
        ) as EmployeeProfilePayload;
        cleaned.currentAddress = stripEmptyAddress(values.currentAddress);
        cleaned.permanentAddress = stripEmptyAddress(values.permanentAddress);

        try {
            await api.patch(`/users/${user.id}/profile`, cleaned);
            const updatedUser = await api.get<User>(`/users/${user.id}`);
            toast.success("Employee profile updated.");
            onSaved(updatedUser);
        } catch (error) {
            toast.error(error instanceof ApiError ? error.message : "Failed to update employee profile.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-6">
                <Field>
                    <FieldLabel htmlFor="reportingManagerId">Reporting Manager</FieldLabel>
                    <Controller
                        name="reportingManagerId"
                        control={form.control}
                        render={({ field }) => (
                            <Select value={field.value} onValueChange={field.onChange}>
                                <SelectTrigger id="reportingManagerId" className={selectTriggerClass}>
                                    <SelectValue placeholder="Select manager" />
                                </SelectTrigger>
                                <SelectContent>
                                    {colleagues.map((colleague) => (
                                        <SelectItem key={colleague.id} value={colleague.id}>
                                            {colleague.firstName} {colleague.lastName}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    />
                </Field>

                <Field>
                    <FieldLabel htmlFor="employeeCode">Employee Code</FieldLabel>
                    <Input id="employeeCode" className={inputClass} {...form.register("employeeCode")} />
                </Field>

                <Field>
                    <FieldLabel htmlFor="bloodGroup">Blood Group</FieldLabel>
                    <Input id="bloodGroup" className={inputClass} {...form.register("bloodGroup")} />
                </Field>

                <Field>
                    <FieldLabel htmlFor="maritalStatus">Marital Status</FieldLabel>
                    <Controller
                        name="maritalStatus"
                        control={form.control}
                        render={({ field }) => (
                            <Select value={field.value} onValueChange={field.onChange}>
                                <SelectTrigger id="maritalStatus" className={selectTriggerClass}>
                                    <SelectValue placeholder="Select status" />
                                </SelectTrigger>
                                <SelectContent>
                                    {MARITAL_STATUSES.map((option) => (
                                        <SelectItem key={option} value={option}>
                                            {option}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    />
                </Field>

                <Field>
                    <FieldLabel htmlFor="nationality">Nationality</FieldLabel>
                    <Input id="nationality" className={inputClass} {...form.register("nationality")} />
                </Field>

                <Field data-invalid={!!form.formState.errors.personalEmail}>
                    <FieldLabel htmlFor="personalEmail">Personal Email</FieldLabel>
                    <Input id="personalEmail" type="email" className={inputClass} {...form.register("personalEmail")} />
                    {form.formState.errors.personalEmail && <FieldError errors={[form.formState.errors.personalEmail]} />}
                </Field>

                <Field>
                    <FieldLabel htmlFor="alternatePhone">Alternate Phone</FieldLabel>
                    <Input id="alternatePhone" className={inputClass} {...form.register("alternatePhone")} />
                </Field>

                <Field>
                    <FieldLabel htmlFor="emergencyContactName">Emergency Contact Name</FieldLabel>
                    <Input id="emergencyContactName" className={inputClass} {...form.register("emergencyContactName")} />
                </Field>

                <Field>
                    <FieldLabel htmlFor="emergencyContactPhone">Emergency Contact Phone</FieldLabel>
                    <Input id="emergencyContactPhone" className={inputClass} {...form.register("emergencyContactPhone")} />
                </Field>

                <Field>
                    <FieldLabel htmlFor="emergencyContactRelation">Emergency Contact Relation</FieldLabel>
                    <Input id="emergencyContactRelation" className={inputClass} {...form.register("emergencyContactRelation")} />
                </Field>

                <Field>
                    <FieldLabel htmlFor="panNumber">PAN Number</FieldLabel>
                    <Input id="panNumber" className={inputClass} {...form.register("panNumber")} />
                </Field>

                <Field>
                    <FieldLabel htmlFor="aadhaarNumber">Aadhaar Number</FieldLabel>
                    <Input id="aadhaarNumber" className={inputClass} {...form.register("aadhaarNumber")} />
                </Field>

                <Field>
                    <FieldLabel htmlFor="passportNumber">Passport Number</FieldLabel>
                    <Input id="passportNumber" className={inputClass} {...form.register("passportNumber")} />
                </Field>

                <Field>
                    <FieldLabel htmlFor="probationEndDate">Probation End Date</FieldLabel>
                    <Controller
                        name="probationEndDate"
                        control={form.control}
                        render={({ field }) => <DatePicker id="probationEndDate" value={field.value} onChange={field.onChange} />}
                    />
                </Field>

                <Field>
                    <FieldLabel htmlFor="confirmationDate">Confirmation Date</FieldLabel>
                    <Controller
                        name="confirmationDate"
                        control={form.control}
                        render={({ field }) => <DatePicker id="confirmationDate" value={field.value} onChange={field.onChange} />}
                    />
                </Field>

                <Field className="col-span-full">
                    <FieldLabel htmlFor="note">Note</FieldLabel>
                    <Textarea id="note" rows={3} {...form.register("note")} />
                </Field>
            </div>

            <AddressFields prefix="currentAddress" label="Current Address" form={form} />
            <AddressFields prefix="permanentAddress" label="Permanent Address" form={form} />

            <div className="flex items-center justify-end border-t border-border pt-6">
                <Button type="submit" className="h-11 px-8 rounded-lg" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="animate-spin h-4.5 w-4.5 mr-2" />}
                    Save Profile
                </Button>
            </div>
        </form>
    );
};

export default EmployeeProfileForm;
