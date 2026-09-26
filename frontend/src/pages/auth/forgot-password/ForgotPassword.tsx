import { ModeToggle } from "@/components/ModeToggle";
import { Button } from "@/components/ui/button";
import { Field, FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api";
import { forgotPasswordSchema } from "@/lib/zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Loader2, Mail, MailCheck } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import type * as z from "zod";

type FormValues = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPassword() {
  const [sent, setSent] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const handleSubmit = async (values: FormValues) => {
    try {
      await api.post("/auth/forgot-password", values, { skipAuth: true });
      // The server answers the same way whether or not the account exists, and so
      // does this screen — otherwise it becomes a way to test which emails are real.
      setSent(true);
    } catch (error) {
      toast.error(
        error instanceof ApiError
          ? error.message
          : "Could not start the reset. Try again."
      );
    }
  };

  return (
    <div className="min-h-svh flex flex-col p-6 sm:p-10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm shadow-xs">
            A
          </div>
          <span className="font-bold text-sm tracking-tight">AgencyOS</span>
        </div>
        <ModeToggle />
      </div>

      <div className="max-w-[380px] w-full mx-auto my-auto py-8">
        {sent ? (
          <div className="text-center space-y-3">
            <div className="w-11 h-11 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
              <MailCheck className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              Check your inbox
            </h2>
            <p className="text-xs text-muted-foreground">
              If <span className="font-medium text-foreground">{form.getValues("email")}</span>{" "}
              belongs to an account, a reset link is on its way. It expires in an
              hour.
            </p>
            <Button asChild variant="outline" size="sm" className="mt-2">
              <Link to="/auth/login">
                <ArrowLeft className="w-4 h-4" />
                Back to sign in
              </Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="mb-8">
              <h2 className="text-2xl font-bold tracking-tight text-foreground">
                Forgot your password?
              </h2>
              <p className="text-xs text-muted-foreground mt-1.5">
                Enter the email you sign in with and we'll send a link to set a
                new password.
              </p>
            </div>

            <form
              onSubmit={form.handleSubmit(handleSubmit)}
              className="space-y-4"
            >
              <Controller
                name="email"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid} className="gap-1.5">
                    <label
                      htmlFor="email"
                      className="text-xs font-medium text-foreground"
                    >
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                      <Input
                        {...field}
                        id="email"
                        type="email"
                        autoComplete="email"
                        placeholder="name@agency.com"
                        aria-invalid={fieldState.invalid}
                        className="ps-9 h-10 text-xs rounded-lg border-border bg-card shadow-xs"
                      />
                    </div>
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />

              <Button
                type="submit"
                className="w-full h-10"
                disabled={form.formState.isSubmitting}
              >
                {form.formState.isSubmitting && (
                  <Loader2 className="w-4 h-4 animate-spin" />
                )}
                Send reset link
              </Button>

              <Button asChild variant="ghost" size="sm" className="w-full">
                <Link to="/auth/login">
                  <ArrowLeft className="w-4 h-4" />
                  Back to sign in
                </Link>
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
