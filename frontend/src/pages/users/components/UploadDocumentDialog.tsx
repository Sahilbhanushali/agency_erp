import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, ApiError } from "@/lib/api";
import type { DocumentCategory, EmployeeDocument } from "@/types/user";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "react-toastify";
import * as z from "zod";

const CATEGORIES: DocumentCategory[] = [
    "ID_PROOF", "RESUME", "OFFER_LETTER", "EXPERIENCE_LETTER", "CERTIFICATE",
    "BANK_DETAIL", "CONTRACT", "PROPOSAL", "CREATIVE_ASSET", "REPORT", "BRAND_GUIDELINE", "OTHER",
];

const schema = z.object({
    name: z.string().min(1, "Name is required"),
    category: z.string().optional(),
    isClientVisible: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

interface UploadDocumentDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    userId: string;
    onUploaded: (document: EmployeeDocument) => void;
}

const UploadDocumentDialog = ({ open, onOpenChange, userId, onUploaded }: UploadDocumentDialogProps) => {
    const [file, setFile] = useState<File | null>(null);
    const [fileError, setFileError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const form = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: { name: "", category: "OTHER", isClientVisible: false },
    });

    useEffect(() => {
        if (open) {
            form.reset({ name: "", category: "OTHER", isClientVisible: false });
            setFile(null);
            setFileError(null);
        }
    }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleSubmit = async (values: FormValues) => {
        if (!file) {
            setFileError("Select a file to upload.");
            return;
        }
        setIsSubmitting(true);
        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("name", values.name);
            if (values.category) formData.append("category", values.category);
            formData.append("isClientVisible", String(values.isClientVisible));

            const document = await api.post<EmployeeDocument>(`/users/${userId}/documents`, formData, { isFormData: true });
            toast.success("Document uploaded.");
            onUploaded(document);
            onOpenChange(false);
        } catch (error) {
            toast.error(error instanceof ApiError ? error.message : "Failed to upload document.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Upload Document</DialogTitle>
                    <DialogDescription>Attach a document to this employee's profile.</DialogDescription>
                </DialogHeader>

                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-5">
                    <Field data-invalid={!!fileError}>
                        <FieldLabel htmlFor="doc-file">File *</FieldLabel>
                        <Input
                            id="doc-file"
                            type="file"
                            className="h-11 rounded-lg pt-2"
                            onChange={(event) => {
                                const selected = event.target.files?.[0] ?? null;
                                setFile(selected);
                                setFileError(null);
                                if (selected && !form.getValues("name")) {
                                    form.setValue("name", selected.name.replace(/\.[^.]+$/, ""));
                                }
                            }}
                        />
                        {fileError && <p className="text-sm text-destructive mt-1">{fileError}</p>}
                    </Field>

                    <Field data-invalid={!!form.formState.errors.name}>
                        <FieldLabel htmlFor="doc-name">Name *</FieldLabel>
                        <Input id="doc-name" className="h-11 rounded-lg" {...form.register("name")} />
                        {form.formState.errors.name && <FieldError errors={[form.formState.errors.name]} />}
                    </Field>

                    <Field>
                        <FieldLabel htmlFor="doc-category">Category</FieldLabel>
                        <Controller
                            name="category"
                            control={form.control}
                            render={({ field }) => (
                                <Select value={field.value} onValueChange={field.onChange}>
                                    <SelectTrigger id="doc-category" className="h-11 rounded-lg !w-full">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {CATEGORIES.map((category) => (
                                            <SelectItem key={category} value={category}>
                                                {category.replace(/_/g, " ")}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        />
                    </Field>

                    <Field orientation="horizontal" className="items-center">
                        <Controller
                            name="isClientVisible"
                            control={form.control}
                            render={({ field }) => (
                                <Checkbox id="doc-client-visible" checked={field.value} onCheckedChange={field.onChange} />
                            )}
                        />
                        <FieldLabel htmlFor="doc-client-visible" className="mb-0">Visible to client</FieldLabel>
                    </Field>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting && <Loader2 className="animate-spin h-4 w-4 mr-2" />}
                            Upload
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default UploadDocumentDialog;
