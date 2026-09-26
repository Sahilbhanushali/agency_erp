import { ModeToggle } from "@/components/ModeToggle";
import { Button } from "@/components/ui/button";
import { Field, FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Eye, EyeOff, Loader2, Lock, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import * as z from "zod";

const schema = z
  .object({
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[a-zA-Z]/, "Include at least one letter")
      .regex(/[0-9]/, "Include at least one number"),
    confirmPassword: z.string().min(1, "Confirm your password"),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type FormValues = z.infer<typeof schema>;

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const handleSubmit = async (values: FormValues) => {
    if (!token) return;
    try {
      await api.post(
        "/auth/reset-password",
        { token, password: values.password },
        { skipAuth: true }
      );
      toast.success("Password updated. Sign in with your new password.");
      navigate("/auth/login");
    } catch (error) {
      toast.error(
        error instanceof ApiError
          ? error.message
          : "Could not reset the password."
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
        {!token ? (
          <div className="text-center space-y-3">
            <div className="w-11 h-11 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              This link is incomplete
            </h2>
            <p className="text-xs text-muted-foreground">
              Open the reset link from your email exactly as it was sent, or
              request a new one.
            </p>
            <Button asChild variant="outline" size="sm" className="mt-2">
              <Link to="/auth/forgot-password">Request a new link</Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="mb-8">
              <h2 className="text-2xl font-bold tracking-tight text-foreground">
                Set a new password
              </h2>
              <p className="text-xs text-muted-foreground mt-1.5">
                Choose something you haven't used here before. Signing in again
                will be required on your other devices.
              </p>
            </div>

            <form
              onSubmit={form.handleSubmit(handleSubmit)}
              className="space-y-4"
            >
              {(["password", "confirmPassword"] as const).map((name) => (
                <Controller
                  key={name}
                  name={name}
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid} className="gap-1.5">
                      <label
                        htmlFor={name}
                        className="text-xs font-medium text-foreground"
                      >
                        {name === "password" ? "New Password" : "Confirm Password"}
                      </label>
                      <div className="relative">
                        <Lock className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                        <Input
                          {...field}
                          id={name}
                          type={showPassword ? "text" : "password"}
                          autoComplete="new-password"
                          placeholder="••••••••"
                          aria-invalid={fieldState.invalid}
                          className="ps-9 pe-10 h-10 text-xs rounded-lg border-border bg-card shadow-xs"
                        />
                        {name === "password" && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={
                              showPassword ? "Hide password" : "Show password"
                            }
                            onClick={() => setShowPassword((prev) => !prev)}
                            className="absolute end-1 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground"
                          >
                            {showPassword ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </Button>
                        )}
                      </div>
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />
              ))}

              <Button
                type="submit"
                className="w-full h-10"
                disabled={form.formState.isSubmitting}
              >
                {form.formState.isSubmitting && (
                  <Loader2 className="w-4 h-4 animate-spin" />
                )}
                Update password
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
