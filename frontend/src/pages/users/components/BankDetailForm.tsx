import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api";
import type { User } from "@/types/user";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "react-toastify";
import * as z from "zod";

const schema = z.object({
    accountHolderName: z.string().min(1, "Account holder name is required"),
    accountNumber: z.string().min(1, "Account number is required"),
    bankName: z.string().min(1, "Bank name is required"),
    ifscCode: z.string().min(1, "IFSC code is required"),
    branchName: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const inputClass = "h-11 rounded-lg";

interface BankDetailFormProps {
    user: User;
    onSaved: (user: User) => void;
}

const BankDetailForm = ({ user, onSaved }: BankDetailFormProps) => {
    const bankDetail = user.employeeProfile?.bankDetail;
    const hasProfile = !!user.employeeProfile;
    const [isSubmitting, setIsSubmitting] = useState(false);

    const form = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: {
            accountHolderName: bankDetail?.accountHolderName ?? "",
            accountNumber: bankDetail?.accountNumber ?? "",
            bankName: bankDetail?.bankName ?? "",
            ifscCode: bankDetail?.ifscCode ?? "",
            branchName: bankDetail?.branchName ?? "",
        },
    });

    const handleSubmit = async (values: FormValues) => {
        setIsSubmitting(true);
        const cleaned = Object.fromEntries(
            Object.entries(values).map(([key, value]) => [key, value === "" ? undefined : value]),
        );
        try {
            await api.patch(`/users/${user.id}/bank-detail`, cleaned);
            const updatedUser = await api.get<User>(`/users/${user.id}`);
            toast.success("Bank details updated.");
            onSaved(updatedUser);
        } catch (error) {
            toast.error(error instanceof ApiError ? error.message : "Failed to update bank details.");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!hasProfile) {
        return (
            <p className="text-sm text-neutral-500 dark:text-neutral-400 py-8 text-center">
                Save the employee profile first before adding bank details.
            </p>
        );
    }

    return (
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-6">
                <Field data-invalid={!!form.formState.errors.accountHolderName}>
                    <FieldLabel htmlFor="accountHolderName">Account Holder Name</FieldLabel>
                    <Input id="accountHolderName" className={inputClass} {...form.register("accountHolderName")} />
                    {form.formState.errors.accountHolderName && <FieldError errors={[form.formState.errors.accountHolderName]} />}
                </Field>

                <Field data-invalid={!!form.formState.errors.accountNumber}>
                    <FieldLabel htmlFor="accountNumber">Account Number</FieldLabel>
                    <Input id="accountNumber" className={inputClass} {...form.register("accountNumber")} />
                    {form.formState.errors.accountNumber && <FieldError errors={[form.formState.errors.accountNumber]} />}
                </Field>

                <Field data-invalid={!!form.formState.errors.bankName}>
                    <FieldLabel htmlFor="bankName">Bank Name</FieldLabel>
                    <Input id="bankName" className={inputClass} {...form.register("bankName")} />
                    {form.formState.errors.bankName && <FieldError errors={[form.formState.errors.bankName]} />}
                </Field>

                <Field data-invalid={!!form.formState.errors.ifscCode}>
                    <FieldLabel htmlFor="ifscCode">IFSC Code</FieldLabel>
                    <Input id="ifscCode" className={inputClass} {...form.register("ifscCode")} />
                    {form.formState.errors.ifscCode && <FieldError errors={[form.formState.errors.ifscCode]} />}
                </Field>

                <Field>
                    <FieldLabel htmlFor="branchName">Branch Name</FieldLabel>
                    <Input id="branchName" className={inputClass} {...form.register("branchName")} />
                </Field>
            </div>

            <div className="flex items-center justify-end border-t border-border pt-6">
                <Button type="submit" className="h-11 px-8 rounded-lg" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="animate-spin h-4.5 w-4.5 mr-2" />}
                    Save Bank Details
                </Button>
            </div>
        </form>
    );
};

export default BankDetailForm;
