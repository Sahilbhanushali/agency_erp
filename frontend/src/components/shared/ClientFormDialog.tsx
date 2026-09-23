import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api";
import { phoneField } from "@/lib/zod";
import type { Client, CreateClientPayload } from "@/types/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "react-toastify";
import * as z from "zod";

const schema = z.object({
    name: z.string().min(1, "Name is required"),
    email: z.string().email("Enter a valid email address."),
    industry: z.string().optional(),
    phone: phoneField,
});

type FormValues = z.infer<typeof schema>;

interface ClientFormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    companyId: string;
    onCreated: (client: Client) => void;
    initialName?: string;
}

const ClientFormDialog = ({ open, onOpenChange, companyId, onCreated, initialName }: ClientFormDialogProps) => {
    const form = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: { name: "", email: "", industry: "", phone: "" },
    });

    useEffect(() => {
        if (open) form.reset({ name: initialName ?? "", email: "", industry: "", phone: "" });
    }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleSubmit = async (values: FormValues) => {
        try {
            const payload: CreateClientPayload = { ...values, companyId };
            const created = await api.post<Client>("/clients", payload);
            toast.success("Client created.");
            onCreated(created);
            onOpenChange(false);
        } catch (error) {
            toast.error(error instanceof ApiError ? error.message : "Failed to create client.");
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>New Client</DialogTitle>
                    <DialogDescription>Add a client for this company.</DialogDescription>
                </DialogHeader>

                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-5">
                    <Field data-invalid={!!form.formState.errors.name}>
                        <FieldLabel htmlFor="client-name">Name *</FieldLabel>
                        <Input id="client-name" className="h-11 rounded-lg" autoFocus {...form.register("name")} />
                        {form.formState.errors.name && <FieldError errors={[form.formState.errors.name]} />}
                    </Field>

                    <Field data-invalid={!!form.formState.errors.email}>
                        <FieldLabel htmlFor="client-email">Email *</FieldLabel>
                        <Input id="client-email" type="email" className="h-11 rounded-lg" {...form.register("email")} />
                        {form.formState.errors.email && <FieldError errors={[form.formState.errors.email]} />}
                    </Field>

                    <Field>
                        <FieldLabel htmlFor="client-industry">Industry</FieldLabel>
                        <Input id="client-industry" className="h-11 rounded-lg" {...form.register("industry")} />
                    </Field>

                    <Field data-invalid={!!form.formState.errors.phone}>
                        <FieldLabel htmlFor="client-phone">Phone</FieldLabel>
                        <Input id="client-phone" maxLength={10} inputMode="numeric" className="h-11 rounded-lg" {...form.register("phone")} />
                        {form.formState.errors.phone && <FieldError errors={[form.formState.errors.phone]} />}
                    </Field>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={form.formState.isSubmitting}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={form.formState.isSubmitting}>
                            {form.formState.isSubmitting && <Loader2 className="animate-spin h-4 w-4 mr-2" />}
                            Create Client
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default ClientFormDialog;
