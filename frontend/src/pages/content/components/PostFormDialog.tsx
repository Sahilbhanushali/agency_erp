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
import type { Campaign } from "@/types/campaign";
import { humanizeEnum } from "@/types/campaign";
import type { Client } from "@/types/client";
import {
  INITIAL_POST_STATUSES,
  POST_TYPES,
  type CreatePostPayload,
  type Post,
  type UpdatePostPayload,
} from "@/types/post";
import { zodResolver } from "@hookform/resolvers/zod";
import { FileText, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "react-toastify";
import * as z from "zod";

interface MinimalUser {
  id: string;
  firstName: string;
  lastName: string;
}

const schema = z.object({
  clientId: z.string().min(1, "Client is required"),
  campaignId: z.string().optional(),
  title: z.string().min(1, "Title is required"),
  caption: z.string().optional(),
  postType: z.enum(POST_TYPES as [string, ...string[]]),
  status: z.enum(INITIAL_POST_STATUSES as [string, ...string[]]),
  scheduledDate: z.string().optional(),
  assigneeId: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const emptyValues: FormValues = {
  clientId: "",
  campaignId: "",
  title: "",
  caption: "",
  postType: "STATIC",
  status: "IDEA",
  scheduledDate: "",
  assigneeId: "",
};

interface PostFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present for edit, absent for create. */
  post?: Post | null;
  onSaved: () => void;
}

/** datetime-local wants "yyyy-MM-ddTHH:mm" in local time, not a UTC ISO string. */
function toLocalInput(iso: string | null | undefined) {
  if (!iso) return "";
  const date = new Date(iso);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export default function PostFormDialog({
  open,
  onOpenChange,
  post,
  onSaved,
}: PostFormDialogProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [users, setUsers] = useState<MinimalUser[]>([]);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: emptyValues,
  });

  useEffect(() => {
    if (!open) return;
    form.reset(
      post
        ? {
            clientId: post.clientId,
            campaignId: post.campaignId ?? "",
            title: post.title,
            caption: post.caption ?? "",
            postType: post.postType,
            // Status is moved through the workflow on the detail sheet, not here.
            status: INITIAL_POST_STATUSES.includes(post.status)
              ? post.status
              : "DRAFT",
            scheduledDate: toLocalInput(post.scheduledDate),
            assigneeId: post.assignee?.id ?? "",
          }
        : emptyValues
    );
  }, [open, post, form]);

  useEffect(() => {
    if (!open) return;
    api.list<Client>("/clients").then(setClients).catch(() => undefined);
    api.list<Campaign>("/campaigns").then(setCampaigns).catch(() => undefined);
    api.list<MinimalUser>("/users").then(setUsers).catch(() => undefined);
  }, [open]);

  const selectedClientId = form.watch("clientId");
  // The server rejects a campaign belonging to another client, so mirror that here.
  const campaignOptions = campaigns
    .filter((campaign) => campaign.clientId === selectedClientId)
    .map((campaign) => ({ value: campaign.id, label: campaign.name }));

  const handleSubmit = async (values: FormValues) => {
    const shared = {
      campaignId: values.campaignId || null,
      title: values.title,
      caption: values.caption || undefined,
      postType: values.postType as CreatePostPayload["postType"],
      scheduledDate: values.scheduledDate
        ? new Date(values.scheduledDate).toISOString()
        : null,
      assigneeId: values.assigneeId || null,
    };

    try {
      if (post) {
        await api.patch(
          `/posts/${post.id}`,
          shared satisfies UpdatePostPayload
        );
      } else {
        await api.post("/posts", {
          clientId: values.clientId,
          status: values.status as CreatePostPayload["status"],
          ...shared,
        } satisfies CreatePostPayload);
      }
      toast.success(post ? "Content updated." : "Content created.");
      onSaved();
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Failed to save content."
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <DialogTitle className="text-base">
                {post ? "Edit Content" : "New Content"}
              </DialogTitle>
              <DialogDescription className="text-xs mt-0.5">
                {post
                  ? "Update the brief, caption and schedule."
                  : "Raise a content idea, then move it through the production workflow."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit(handleSubmit)}
          className="space-y-4 pt-2"
        >
          <Field data-invalid={!!form.formState.errors.title}>
            <FieldLabel htmlFor="post-title" className="text-xs font-medium">
              Title *
            </FieldLabel>
            <Input
              id="post-title"
              placeholder="Diwali carousel — 5 slides"
              {...form.register("title")}
            />
            {form.formState.errors.title && (
              <FieldError>{form.formState.errors.title.message}</FieldError>
            )}
          </Field>

          <Field data-invalid={!!form.formState.errors.clientId}>
            <FieldLabel htmlFor="post-client" className="text-xs font-medium">
              Client *
            </FieldLabel>
            <Controller
              control={form.control}
              name="clientId"
              render={({ field }) => (
                <Combobox
                  id="post-client"
                  value={field.value}
                  onChange={(value) => {
                    field.onChange(value);
                    form.setValue("campaignId", "");
                  }}
                  options={clients.map((client) => ({
                    value: client.id,
                    label: client.name,
                  }))}
                  placeholder="Select a client"
                  disabled={!!post}
                  emptyText="No clients found"
                />
              )}
            />
            {form.formState.errors.clientId && (
              <FieldError>{form.formState.errors.clientId.message}</FieldError>
            )}
          </Field>

          <Field>
            <FieldLabel htmlFor="post-campaign" className="text-xs font-medium">
              Campaign
            </FieldLabel>
            <Controller
              control={form.control}
              name="campaignId"
              render={({ field }) => (
                <Combobox
                  id="post-campaign"
                  value={field.value}
                  onChange={field.onChange}
                  options={campaignOptions}
                  placeholder={
                    selectedClientId
                      ? "Not part of a campaign"
                      : "Select a client first"
                  }
                  disabled={!selectedClientId}
                  emptyText="No campaigns for this client"
                />
              )}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor="post-type" className="text-xs font-medium">
                Content Type
              </FieldLabel>
              <Controller
                control={form.control}
                name="postType"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="post-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {POST_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {humanizeEnum(type)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>

            {!post && (
              <Field>
                <FieldLabel
                  htmlFor="post-status"
                  className="text-xs font-medium"
                >
                  Starting Status
                </FieldLabel>
                <Controller
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="post-status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {INITIAL_POST_STATUSES.map((status) => (
                          <SelectItem key={status} value={status}>
                            {humanizeEnum(status)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel
                htmlFor="post-scheduled"
                className="text-xs font-medium"
              >
                Scheduled For
              </FieldLabel>
              <Input
                id="post-scheduled"
                type="datetime-local"
                {...form.register("scheduledDate")}
              />
            </Field>

            <Field>
              <FieldLabel
                htmlFor="post-assignee"
                className="text-xs font-medium"
              >
                Owner
              </FieldLabel>
              <Controller
                control={form.control}
                name="assigneeId"
                render={({ field }) => (
                  <Combobox
                    id="post-assignee"
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
          </div>

          <Field>
            <FieldLabel htmlFor="post-caption" className="text-xs font-medium">
              Caption
            </FieldLabel>
            <Textarea
              id="post-caption"
              rows={4}
              placeholder="The caption as it will be published..."
              {...form.register("caption")}
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
              {post ? "Save Changes" : "Create Content"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
