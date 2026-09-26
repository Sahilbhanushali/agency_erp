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
import { api, ApiError } from "@/lib/api";
import { humanizeEnum } from "@/types/campaign";
import type { Client } from "@/types/client";
import { SOCIAL_PLATFORMS } from "@/types/social-account";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link2, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "react-toastify";
import * as z from "zod";

const schema = z.object({
  clientId: z.string().min(1, "Client is required"),
  platform: z.enum(SOCIAL_PLATFORMS as [string, ...string[]]),
  externalId: z.string().min(1, "Handle or profile id is required"),
  accountName: z.string().min(1, "A display name is required"),
});

type FormValues = z.infer<typeof schema>;

interface SocialAccountFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export default function SocialAccountFormDialog({
  open,
  onOpenChange,
  onSaved,
}: SocialAccountFormDialogProps) {
  const [clients, setClients] = useState<Client[]>([]);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      clientId: "",
      platform: "INSTAGRAM",
      externalId: "",
      accountName: "",
    },
  });

  useEffect(() => {
    if (!open) return;
    form.reset();
    api.list<Client>("/clients").then(setClients).catch(() => undefined);
  }, [open, form]);

  const handleSubmit = async (values: FormValues) => {
    try {
      await api.post("/social-accounts", values);
      toast.success("Profile registered.");
      onSaved();
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Failed to register profile."
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Link2 className="w-4 h-4" />
            </div>
            <div>
              <DialogTitle className="text-base">Register Profile</DialogTitle>
              <DialogDescription className="text-xs mt-0.5">
                Records which profile belongs to a client. Connecting it for
                publishing is a separate step.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit(handleSubmit)}
          className="space-y-4 pt-2"
        >
          <Field data-invalid={!!form.formState.errors.clientId}>
            <FieldLabel htmlFor="sa-client" className="text-xs font-medium">
              Client *
            </FieldLabel>
            <Controller
              control={form.control}
              name="clientId"
              render={({ field }) => (
                <Combobox
                  id="sa-client"
                  value={field.value}
                  onChange={field.onChange}
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
            <FieldLabel htmlFor="sa-platform" className="text-xs font-medium">
              Platform
            </FieldLabel>
            <Controller
              control={form.control}
              name="platform"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="sa-platform">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SOCIAL_PLATFORMS.map((platform) => (
                      <SelectItem key={platform} value={platform}>
                        {humanizeEnum(platform)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>

          <Field data-invalid={!!form.formState.errors.externalId}>
            <FieldLabel htmlFor="sa-handle" className="text-xs font-medium">
              Handle or Profile ID *
            </FieldLabel>
            <Input
              id="sa-handle"
              placeholder="@kairorealty"
              {...form.register("externalId")}
            />
            {form.formState.errors.externalId && (
              <FieldError>{form.formState.errors.externalId.message}</FieldError>
            )}
          </Field>

          <Field data-invalid={!!form.formState.errors.accountName}>
            <FieldLabel htmlFor="sa-name" className="text-xs font-medium">
              Display Name *
            </FieldLabel>
            <Input
              id="sa-name"
              placeholder="Kairo Realty — Instagram"
              {...form.register("accountName")}
            />
            {form.formState.errors.accountName && (
              <FieldError>
                {form.formState.errors.accountName.message}
              </FieldError>
            )}
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
              Register
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
