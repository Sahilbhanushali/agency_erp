import { ModeToggle } from "@/components/ModeToggle";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Eye, EyeOff, KeyRound, Loader2, Lock, Sparkles, UserCheck } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import * as z from "zod";

const formSchema = z
    .object({
        password: z
            .string()
            .min(8, "Password must be at least 8 characters")
            .max(64, "Password must be at most 64 characters")
            .regex(/[a-zA-Z]/, "Contain at least one letter.")
            .regex(/[0-9]/, "Contain at least one number.")
            .regex(/[^a-zA-Z0-9]/, "Contain at least one special character."),
        confirmPassword: z.string().min(1, "Confirm your password"),
    })
    .refine((data) => data.password === data.confirmPassword, {
        message: "Passwords do not match",
        path: ["confirmPassword"],
    });

type FormValues = z.infer<typeof formSchema>;

const AcceptInvite = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const token = searchParams.get("token");
    const [showPassword, setShowPassword] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: { password: "", confirmPassword: "" },
    });

    const handleSubmit = async (values: FormValues) => {
        if (!token) return;
        setIsSubmitting(true);
        try {
            await api.post("/auth/accept-invite", { token, password: values.password }, { skipAuth: true });
            toast.success("Password set successfully. You can now sign in.");
            navigate("/auth/login");
        } catch (error) {
            toast.error(error instanceof ApiError ? error.message : "Failed to set password. Link may be expired.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen w-full grid grid-cols-1 lg:grid-cols-2 bg-background">
            {/* Left brand showcase panel */}
            <div className="hidden lg:flex flex-col justify-between p-12 bg-zinc-950 text-zinc-100 relative overflow-hidden border-r border-zinc-800">
                <div className="absolute top-0 right-0 -mr-24 -mt-24 w-96 h-96 rounded-full bg-primary/15 blur-3xl pointer-events-none" />
                <div className="absolute bottom-0 left-0 -ml-24 -mb-24 w-96 h-96 rounded-full bg-purple-600/10 blur-3xl pointer-events-none" />

                <div className="relative z-10 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-bold text-lg shadow-lg shadow-primary/25">
                        A
                    </div>
                    <div>
                        <span className="font-bold text-base tracking-tight text-white">AgencyOS</span>
                        <span className="block text-[11px] text-zinc-400 font-mono">Workspace Invitation</span>
                    </div>
                </div>

                <div className="relative z-10 max-w-md space-y-6 my-auto">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900/80 border border-zinc-800 text-xs text-zinc-300">
                        <Sparkles className="w-3.5 h-3.5 text-primary" />
                        <span>Team Onboarding</span>
                    </div>

                    <h1 className="text-3xl font-bold tracking-tight text-white leading-tight">
                        You've been invited to join your team on AgencyOS.
                    </h1>

                    <p className="text-sm text-zinc-400 leading-relaxed">
                        Set your personal password to activate your account and start collaborating on client projects, tracking tasks, and viewing shared workspaces.
                    </p>

                    <div className="space-y-3 pt-2">
                        <div className="flex items-center gap-3 text-xs text-zinc-300 bg-zinc-900/50 p-2.5 rounded-lg border border-zinc-800/60">
                            <KeyRound className="w-4 h-4 text-primary shrink-0" />
                            <span>Encrypted single-tenant account security</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-zinc-300 bg-zinc-900/50 p-2.5 rounded-lg border border-zinc-800/60">
                            <UserCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                            <span>Instant team workspace provisioning</span>
                        </div>
                    </div>
                </div>

                <div className="relative z-10 flex items-center justify-between text-xs text-zinc-500 pt-6 border-t border-zinc-900">
                    <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Secure onboarding gateway</span>
                    </div>
                    <span>AgencyOS Enterprise</span>
                </div>
            </div>

            {/* Right form panel */}
            <div className="flex flex-col justify-between p-6 sm:p-10 relative">
                <div className="flex items-center justify-between">
                    <div className="flex lg:hidden items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm shadow-xs">
                            A
                        </div>
                        <span className="font-bold text-sm tracking-tight">AgencyOS</span>
                    </div>
                    <div className="ml-auto">
                        <ModeToggle />
                    </div>
                </div>

                <div className="max-w-[380px] w-full mx-auto my-auto py-8">
                    <div className="mb-8">
                        <h2 className="text-2xl font-bold tracking-tight text-foreground">Set Your Password</h2>
                        <p className="text-xs text-muted-foreground mt-1.5">
                            Create a secure password to activate your agency account.
                        </p>
                    </div>

                    {!token ? (
                        <div className="p-4 rounded-xl border border-destructive/30 bg-destructive/5 text-destructive space-y-3">
                            <p className="text-xs font-medium">
                                This invitation link is invalid or missing a security token. Please use the exact link provided in your email invitation.
                            </p>
                            <Button variant="outline" size="sm" asChild className="w-full text-xs">
                                <Link to="/auth/login">Return to Sign In</Link>
                            </Button>
                        </div>
                    ) : (
                        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                            <FieldGroup>
                                <Controller
                                    name="password"
                                    control={form.control}
                                    render={({ field, fieldState }) => (
                                        <Field data-invalid={fieldState.invalid} className="gap-1.5">
                                            <label htmlFor="password" className="text-xs font-medium text-foreground">
                                                New Password
                                            </label>
                                            <div className="relative">
                                                <Lock className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                                                <Input
                                                    {...field}
                                                    id="password"
                                                    type={showPassword ? "text" : "password"}
                                                    aria-invalid={fieldState.invalid}
                                                    disabled={isSubmitting}
                                                    placeholder="Min. 8 characters"
                                                    autoComplete="new-password"
                                                    className="ps-9 pe-10 h-10 text-xs rounded-lg border-border bg-card focus-visible:ring-1 focus-visible:ring-primary shadow-xs"
                                                />
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => setShowPassword((prev) => !prev)}
                                                    className="absolute end-1 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-transparent"
                                                >
                                                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                                </Button>
                                            </div>
                                            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                                        </Field>
                                    )}
                                />
                            </FieldGroup>

                            <FieldGroup>
                                <Controller
                                    name="confirmPassword"
                                    control={form.control}
                                    render={({ field, fieldState }) => (
                                        <Field data-invalid={fieldState.invalid} className="gap-1.5">
                                            <label htmlFor="confirmPassword" className="text-xs font-medium text-foreground">
                                                Confirm Password
                                            </label>
                                            <div className="relative">
                                                <Lock className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                                                <Input
                                                    {...field}
                                                    id="confirmPassword"
                                                    type={showPassword ? "text" : "password"}
                                                    aria-invalid={fieldState.invalid}
                                                    disabled={isSubmitting}
                                                    placeholder="Confirm new password"
                                                    autoComplete="new-password"
                                                    className="ps-9 pe-10 h-10 text-xs rounded-lg border-border bg-card focus-visible:ring-1 focus-visible:ring-primary shadow-xs"
                                                />
                                            </div>
                                            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                                        </Field>
                                    )}
                                />
                            </FieldGroup>

                            <div className="p-3 rounded-lg bg-muted/50 border border-border/60 text-[11px] text-muted-foreground space-y-1">
                                <p className="font-medium text-foreground">Password requirements:</p>
                                <p>• Minimum 8 characters in length</p>
                                <p>• At least one letter, number, and special character</p>
                            </div>

                            <Button
                                type="submit"
                                className="w-full h-10 text-xs font-medium rounded-lg mt-6 shadow-xs"
                                disabled={isSubmitting}
                            >
                                {isSubmitting && <Loader2 className="animate-spin h-3.5 w-3.5 mr-2" />}
                                {isSubmitting ? "Activating account..." : "Set Password & Activate"}
                            </Button>
                        </form>
                    )}
                </div>

                <div className="text-center text-[11px] text-muted-foreground py-2">
                    Already have an active account?{" "}
                    <Link to="/auth/login" className="text-primary hover:underline font-medium">
                        Sign In
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default AcceptInvite;
