import Combobox from "@/components/shared/Combobox";
import DatePicker from "@/components/shared/DatePicker";
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
import { useAuth } from "@/context/AuthContext";
import { api, ApiError } from "@/lib/api";
import {
  CAMPAIGN_OBJECTIVES,
  CAMPAIGN_STATUSES,
  humanizeEnum,
  type Campaign,
  type CreateCampaignPayload,
  type UpdateCampaignPayload,
} from "@/types/campaign";
import type { Client } from "@/types/client";
import type { Project } from "@/types/project";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Megaphone } from "lucide-react";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "react-toastify";
import * as z from "zod";

const schema = z
  .object({
    clientId: z.string().min(1, "Client is required"),
    projectId: z.string().optional(),
    name: z.string().min(1, "Campaign name is required"),
    description: z.string().optional(),
    objective: z.enum(CAMPAIGN_OBJECTIVES as [string, ...string[]]),
    status: z.enum(CAMPAIGN_STATUSES as [string, ...string[]]),
    budget: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  })
  .refine(
    (values) =>
      !values.startDate ||
      !values.endDate ||
      values.endDate >= values.startDate,
    { message: "End date cannot be before the start date", path: ["endDate"] }
  )
  .refine(
    (values) => !values.budget || Number(values.budget) >= 0,
    { message: "Budget cannot be negative", path: ["budget"] }
  );

type FormValues = z.infer<typeof schema>;

const emptyValues: FormValues = {
  clientId: "",
  projectId: "",
  name: "",
  description: "",
  objective: "AWARENESS",
  status: "DRAFT",
  budget: "",
  startDate: "",
  endDate: "",
};

interface CampaignFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present for edit, absent for create. */
  campaign?: Campaign | null;
  onSaved: () => void;
}

export default function CampaignFormDialog({
  open,
  onOpenChange,
  campaign,
  onSaved,
}: CampaignFormDialogProps) {
  const { user: actor } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: emptyValues,
  });

  useEffect(() => {
    if (!open) return;
    form.reset(
      campaign
        ? {
            clientId: campaign.clientId,
            projectId: campaign.projectId ?? "",
            name: campaign.name,
            description: campaign.description ?? "",
            objective: campaign.objective,
            status: campaign.status,
            budget: campaign.budget ?? "",
            startDate: campaign.startDate?.slice(0, 10) ?? "",
            endDate: campaign.endDate?.slice(0, 10) ?? "",
          }
        : emptyValues
    );
  }, [open, campaign, form]);

  useEffect(() => {
    if (!open) return;
    api
      .list<Client>("/clients")
      .then(setClients)
      .catch(() => toast.error("Failed to load clients."));
    api
      .list<Project>("/projects")
      .then(setProjects)
      .catch(() => toast.error("Failed to load projects."));
  }, [open]);

  const selectedClientId = form.watch("clientId");
  // A campaign's project must belong to the same client, so the list narrows with it.
  const projectOptions = projects
    .filter((project) => !selectedClientId || project.clientId === selectedClientId)
    .map((project) => ({ value: project.id, label: project.title }));

  const handleSubmit = async (values: FormValues) => {
    const payload = {
      clientId: values.clientId,
      projectId: values.projectId || null,
      name: values.name,
      description: values.description || undefined,
      objective: values.objective as CreateCampaignPayload["objective"],
      status: values.status as CreateCampaignPayload["status"],
      budget: values.budget ? Number(values.budget) : undefined,
      startDate: values.startDate || undefined,
      endDate: values.endDate || undefined,
    };

    try {
      if (campaign) {
        await api.patch(
          `/campaigns/${campaign.id}`,
          payload satisfies UpdateCampaignPayload
        );
      } else {
        await api.post("/campaigns", {
          ...payload,
          ...(actor?.roleName === "SUPER_ADMIN" && actor.companyId
            ? { companyId: actor.companyId }
            : {}),
        } satisfies CreateCampaignPayload);
      }
      toast.success(campaign ? "Campaign updated." : "Campaign created.");
      onSaved();
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Failed to save campaign."
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Megaphone className="w-4 h-4" />
            </div>
            <div>
              <DialogTitle className="text-base">
                {campaign ? "Edit Campaign" : "Create New Campaign"}
              </DialogTitle>
              <DialogDescription className="text-xs mt-0.5">
                {campaign
                  ? "Update the campaign brief, budget and schedule."
                  : "Campaigns group content, budget and performance for one client push."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit(handleSubmit)}
          className="space-y-4 pt-2"
        >
          <Field data-invalid={!!form.formState.errors.name}>
            <FieldLabel htmlFor="campaign-name" className="text-xs font-medium">
              Campaign Name *
            </FieldLabel>
            <Input
              id="campaign-name"
              placeholder="Diwali Always-On — Instagram"
              {...form.register("name")}
            />
            {form.formState.errors.name && (
              <FieldError>{form.formState.errors.name.message}</FieldError>
            )}
          </Field>

          <Field data-invalid={!!form.formState.errors.clientId}>
            <FieldLabel
              htmlFor="campaign-client"
              className="text-xs font-medium"
            >
              Client *
            </FieldLabel>
            <Controller
              control={form.control}
              name="clientId"
              render={({ field }) => (
                <Combobox
                  id="campaign-client"
                  value={field.value}
                  onChange={(value) => {
                    field.onChange(value);
                    form.setValue("projectId", "");
                  }}
                  options={clients.map((client) => ({
                    value: client.id,
                    label: client.name,
                  }))}
                  placeholder="Select a client"
                  emptyText="No clients found"
                />
              )}
            />
            {form.formState.errors.clientId && (
              <FieldError>{form.formState.errors.clientId.message}</FieldError>
            )}
          </Field>

          <Field>
            <FieldLabel
              htmlFor="campaign-project"
              className="text-xs font-medium"
            >
              Project
            </FieldLabel>
            <Controller
              control={form.control}
              name="projectId"
              render={({ field }) => (
                <Combobox
                  id="campaign-project"
                  value={field.value}
                  onChange={field.onChange}
                  options={projectOptions}
                  placeholder={
                    selectedClientId
                      ? "Not tied to a project"
                      : "Select a client first"
                  }
                  disabled={!selectedClientId}
                  emptyText="No projects for this client"
                />
              )}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel
                htmlFor="campaign-objective"
                className="text-xs font-medium"
              >
                Objective
              </FieldLabel>
              <Controller
                control={form.control}
                name="objective"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="campaign-objective">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CAMPAIGN_OBJECTIVES.map((objective) => (
                        <SelectItem key={objective} value={objective}>
                          {humanizeEnum(objective)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>

            <Field>
              <FieldLabel
                htmlFor="campaign-status"
                className="text-xs font-medium"
              >
                Status
              </FieldLabel>
              <Controller
                control={form.control}
                name="status"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="campaign-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CAMPAIGN_STATUSES.map((status) => (
                        <SelectItem key={status} value={status}>
                          {humanizeEnum(status)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field data-invalid={!!form.formState.errors.startDate}>
              <FieldLabel
                htmlFor="campaign-start"
                className="text-xs font-medium"
              >
                Start Date
              </FieldLabel>
              <Controller
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <DatePicker
                    id="campaign-start"
                    value={field.value}
                    onChange={(value) => field.onChange(value ?? "")}
                  />
                )}
              />
            </Field>

            <Field data-invalid={!!form.formState.errors.endDate}>
              <FieldLabel htmlFor="campaign-end" className="text-xs font-medium">
                End Date
              </FieldLabel>
              <Controller
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <DatePicker
                    id="campaign-end"
                    value={field.value}
                    onChange={(value) => field.onChange(value ?? "")}
                  />
                )}
              />
              {form.formState.errors.endDate && (
                <FieldError>{form.formState.errors.endDate.message}</FieldError>
              )}
            </Field>
          </div>

          <Field data-invalid={!!form.formState.errors.budget}>
            <FieldLabel htmlFor="campaign-budget" className="text-xs font-medium">
              Budget
            </FieldLabel>
            <Input
              id="campaign-budget"
              type="number"
              min={0}
              step="0.01"
              placeholder="250000"
              {...form.register("budget")}
            />
            {form.formState.errors.budget && (
              <FieldError>{form.formState.errors.budget.message}</FieldError>
            )}
          </Field>

          <Field>
            <FieldLabel htmlFor="campaign-brief" className="text-xs font-medium">
              Brief
            </FieldLabel>
            <Textarea
              id="campaign-brief"
              rows={3}
              placeholder="Audience, key message, deliverables..."
              {...form.register("description")}
            />
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
              {campaign ? "Save Changes" : "Create Campaign"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
