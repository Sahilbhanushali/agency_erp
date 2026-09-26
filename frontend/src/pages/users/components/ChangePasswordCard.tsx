import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api";
import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "react-toastify";
import * as z from "zod";

const schema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[a-zA-Z]/, "Include at least one letter")
      .regex(/[0-9]/, "Include at least one number"),
    confirmPassword: z.string().min(1, "Confirm your new password"),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })
  .refine((values) => values.currentPassword !== values.newPassword, {
    message: "The new password must be different",
    path: ["newPassword"],
  });

type FormValues = z.infer<typeof schema>;

export default function ChangePasswordCard() {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const handleSubmit = async (values: FormValues) => {
    try {
      await api.patch("/auth/change-password", {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      toast.success("Password changed. Other sessions have been signed out.");
      form.reset();
    } catch (error) {
      toast.error(
        error instanceof ApiError
          ? error.message
          : "Could not change the password."
      );
    }
  };

  return (
    <Card className="rounded-xl border border-border shadow-xs max-w-lg">
      <CardHeader className="pb-3 border-b border-border">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-muted-foreground" />
          Change Password
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <p className="text-xs text-muted-foreground mb-4">
          Changing your password signs you out of every other device. This one
          stays signed in.
        </p>
        <form
          onSubmit={form.handleSubmit(handleSubmit)}
          className="space-y-3.5"
        >
          {(
            [
              ["currentPassword", "Current Password", "current-password"],
              ["newPassword", "New Password", "new-password"],
              ["confirmPassword", "Confirm New Password", "new-password"],
            ] as const
          ).map(([name, label, autoComplete]) => (
            <Field
              key={name}
              data-invalid={!!form.formState.errors[name]}
              className="gap-1.5"
            >
              <FieldLabel htmlFor={name} className="text-xs font-medium">
                {label}
              </FieldLabel>
              <Input
                id={name}
                type="password"
                autoComplete={autoComplete}
                placeholder="••••••••"
                className="h-9 text-xs"
                {...form.register(name)}
              />
              {form.formState.errors[name] && (
                <FieldError>{form.formState.errors[name]?.message}</FieldError>
              )}
            </Field>
          ))}

          <Button
            type="submit"
            size="sm"
            className="h-9"
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting && (
              <Loader2 className="w-4 h-4 animate-spin" />
            )}
            Update password
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
