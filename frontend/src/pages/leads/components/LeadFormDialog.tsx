import Combobox from "@/components/shared/Combobox";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError } from "@/lib/api";
import { humanizeEnum } from "@/types/campaign";
import {
  LEAD_SOURCES,
  PIPELINE_STAGES,
  type CreateLeadPayload,
  type Lead,
  type UpdateLeadPayload,
} from "@/types/lead";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "react-toastify";
import * as z from "zod";

interface MinimalUser {
  id: string;
  firstName: string;
  lastName: string;
}

const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;

const schema = z
  .object({
    name: z.string().min(1, "Contact name is required"),
    companyName: z.string().optional(),
    email: z
      .string()
      .email("Enter a valid email")
      .optional()
      .or(z.literal("")),
    phone: z.string().optional(),
    source: z.enum(LEAD_SOURCES as [string, ...string[]]),
    industry: z.string().optional(),
    estimatedValue: z.string().optional(),
    status: z.enum(PIPELINE_STAGES as [string, ...string[]]),
    priority: z.enum(PRIORITIES),
    ownerId: z.string().optional(),
    nextFollowUpAt: z.string().optional(),
    notes: z.string().optional(),
    lostReason: z.string().optional(),
  })
  .refine(
    (values) => values.status !== "LOST" || !!values.lostReason?.trim(),
    { message: "Say why it was lost", path: ["lostReason"] }
  )
  .refine(
    (values) => !values.estimatedValue || Number(values.estimatedValue) >= 0,
    { message: "Value cannot be negative", path: ["estimatedValue"] }
  );

type FormValues = z.infer<typeof schema>;

const emptyValues: FormValues = {
  name: "",
  companyName: "",
  email: "",
  phone: "",
  source: "OTHER",
  industry: "",
  estimatedValue: "",
  status: "NEW",
  priority: "MEDIUM",
  ownerId: "",
  nextFollowUpAt: "",
  notes: "",
  lostReason: "",
};

interface LeadFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead?: Lead | null;
  onSaved: () => void;
}

export default function LeadFormDialog({
  open,
  onOpenChange,
  lead,
  onSaved,
}: LeadFormDialogProps) {
  const [users, setUsers] = useState<MinimalUser[]>([]);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: emptyValues,
  });

  useEffect(() => {
    if (!open) return;
    form.reset(
      lead
        ? {
            name: lead.name,
            companyName: lead.companyName ?? "",
            email: lead.email ?? "",
            phone: lead.phone ?? "",
            source: lead.source,
            industry: lead.industry ?? "",
            estimatedValue: lead.estimatedValue ?? "",
            status: lead.status,
            priority: lead.priority,
            ownerId: lead.ownerId ?? "",
            nextFollowUpAt: lead.nextFollowUpAt?.slice(0, 10) ?? "",
            notes: lead.notes ?? "",
            lostReason: lead.lostReason ?? "",
          }
        : emptyValues
    );
  }, [open, lead, form]);

  useEffect(() => {
    if (!open) return;
    api.list<MinimalUser>("/users").then(setUsers).catch(() => undefined);
  }, [open]);

  const status = form.watch("status");

  const handleSubmit = async (values: FormValues) => {
    const payload = {
      name: values.name,
      companyName: values.companyName || undefined,
      email: values.email || undefined,
      phone: values.phone || undefined,
      source: values.source as CreateLeadPayload["source"],
      industry: values.industry || undefined,
      estimatedValue: values.estimatedValue
        ? Number(values.estimatedValue)
        : undefined,
      status: values.status as CreateLeadPayload["status"],
      priority: values.priority as CreateLeadPayload["priority"],
      ownerId: values.ownerId || null,
      nextFollowUpAt: values.nextFollowUpAt
        ? new Date(values.nextFollowUpAt).toISOString()
        : null,
      notes: values.notes || undefined,
      lostReason: values.lostReason || undefined,
    };

    try {
      if (lead) {
        await api.patch(`/leads/${lead.id}`, payload satisfies UpdateLeadPayload);
      } else {
        await api.post("/leads", payload satisfies CreateLeadPayload);
      }
      toast.success(lead ? "Lead updated." : "Lead added.");
      onSaved();
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Failed to save lead."
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <UserPlus className="w-4 h-4" />
            </div>
            <div>
              <DialogTitle className="text-base">
                {lead ? "Edit Lead" : "New Lead"}
              </DialogTitle>
              <DialogDescription className="text-xs mt-0.5">
                {lead
                  ? "Update the details, stage or next follow-up."
                  : "Capture a prospect and work it through the pipeline."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit(handleSubmit)}
          className="space-y-4 pt-2"
        >
          <div className="grid grid-cols-2 gap-3">
            <Field data-invalid={!!form.formState.errors.name}>
              <FieldLabel htmlFor="lead-name" className="text-xs font-medium">
                Contact Name *
              </FieldLabel>
              <Input id="lead-name" {...form.register("name")} />
              {form.formState.errors.name && (
                <FieldError>{form.formState.errors.name.message}</FieldError>
              )}
            </Field>
            <Field>
              <FieldLabel htmlFor="lead-company" className="text-xs font-medium">
                Company
              </FieldLabel>
              <Input id="lead-company" {...form.register("companyName")} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field data-invalid={!!form.formState.errors.email}>
              <FieldLabel htmlFor="lead-email" className="text-xs font-medium">
                Email
              </FieldLabel>
              <Input id="lead-email" {...form.register("email")} />
              {form.formState.errors.email && (
                <FieldError>{form.formState.errors.email.message}</FieldError>
              )}
            </Field>
            <Field>
              <FieldLabel htmlFor="lead-phone" className="text-xs font-medium">
                Phone
              </FieldLabel>
              <Input id="lead-phone" {...form.register("phone")} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor="lead-source" className="text-xs font-medium">
                Source
              </FieldLabel>
              <Controller
                control={form.control}
                name="source"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="lead-source">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LEAD_SOURCES.map((option) => (
                        <SelectItem key={option} value={option}>
                          {humanizeEnum(option)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="lead-industry" className="text-xs font-medium">
                Industry
              </FieldLabel>
              <Input id="lead-industry" {...form.register("industry")} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor="lead-stage" className="text-xs font-medium">
                Stage
              </FieldLabel>
              <Controller
                control={form.control}
                name="status"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="lead-stage">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PIPELINE_STAGES.map((option) => (
                        <SelectItem key={option} value={option}>
                          {humanizeEnum(option)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="lead-priority" className="text-xs font-medium">
                Priority
              </FieldLabel>
              <Controller
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="lead-priority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITIES.map((option) => (
                        <SelectItem key={option} value={option}>
                          {humanizeEnum(option)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
          </div>

          {status === "LOST" && (
            <Field data-invalid={!!form.formState.errors.lostReason}>
              <FieldLabel htmlFor="lead-lost" className="text-xs font-medium">
                Why was it lost? *
              </FieldLabel>
              <Input
                id="lead-lost"
                placeholder="Went with an in-house team"
                {...form.register("lostReason")}
              />
              {form.formState.errors.lostReason && (
                <FieldError>
                  {form.formState.errors.lostReason.message}
                </FieldError>
              )}
            </Field>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field data-invalid={!!form.formState.errors.estimatedValue}>
              <FieldLabel htmlFor="lead-value" className="text-xs font-medium">
                Estimated Value
              </FieldLabel>
              <Input
                id="lead-value"
                type="number"
                min={0}
                step="0.01"
                {...form.register("estimatedValue")}
              />
              {form.formState.errors.estimatedValue && (
                <FieldError>
                  {form.formState.errors.estimatedValue.message}
                </FieldError>
              )}
            </Field>
            <Field>
              <FieldLabel htmlFor="lead-followup" className="text-xs font-medium">
                Next Follow-up
              </FieldLabel>
              <Input
                id="lead-followup"
                type="date"
                {...form.register("nextFollowUpAt")}
              />
            </Field>
          </div>

          <Field>
            <FieldLabel htmlFor="lead-owner" className="text-xs font-medium">
              Owner
            </FieldLabel>
            <Controller
              control={form.control}
              name="ownerId"
              render={({ field }) => (
                <Combobox
                  id="lead-owner"
                  value={field.value}
                  onChange={field.onChange}
                  options={users.map((user) => ({
                    value: user.id,
                    label: `${user.firstName} ${user.lastName}`,
                  }))}
                  placeholder="Unassigned"
                  emptyText="No people found"
                />
              )}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="lead-notes" className="text-xs font-medium">
              Notes
            </FieldLabel>
            <Textarea id="lead-notes" rows={3} {...form.register("notes")} />
          </Field>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && (
                <Loader2 className="w-4 h-4 animate-spin" />
              )}
              {lead ? "Save Changes" : "Add Lead"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
