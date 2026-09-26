import { ModeToggle } from "@/components/ModeToggle";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError, FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import { useIsSubmitting } from "@/context/isSubmittingContext";
import { ApiError } from "@/lib/api";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Eye, EyeOff, FolderKanban, Loader2, Lock, Mail, Receipt, Sparkles } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import * as z from "zod";

const formSchema = z.object({
    email: z.string().email("Enter a valid email address."),
    password: z
        .string()
        .min(6, "Password must be at least 6 characters.")
        .max(64, "Password must be at most 64 characters."),
});

type FormValues = z.infer<typeof formSchema>;

const Login = () => {
    const navigate = useNavigate();
    const { login } = useAuth();
    const { isSubmitting, setIsSubmitting } = useIsSubmitting();
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            email: "",
            password: "",
        },
    });

    const handleLogin = async (data: FormValues) => {
        setIsSubmitting(true);
        setIsLoading(true);

        try {
            await login(data.email, data.password);
            toast.success("Welcome back!");
            navigate("/dashboard");
        } catch (error) {
            toast.error(error instanceof ApiError ? error.message : "Invalid credentials. Please try again.");
        } finally {
            setIsSubmitting(false);
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full grid grid-cols-1 lg:grid-cols-2 bg-background">
            {/* Left brand showcase panel - Desktop only */}
            <div className="hidden lg:flex flex-col justify-between p-12 bg-zinc-950 text-zinc-100 relative overflow-hidden border-r border-zinc-800">
                {/* Background decorative glow */}
                <div className="absolute top-0 right-0 -mr-24 -mt-24 w-96 h-96 rounded-full bg-primary/15 blur-3xl pointer-events-none" />
                <div className="absolute bottom-0 left-0 -ml-24 -mb-24 w-96 h-96 rounded-full bg-blue-600/10 blur-3xl pointer-events-none" />

                {/* Brand header */}
                <div className="relative z-10 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-bold text-lg shadow-lg shadow-primary/25">
                        A
                    </div>
                    <div>
                        <span className="font-bold text-base tracking-tight text-white">AgencyOS</span>
                        <span className="block text-[11px] text-zinc-400 font-mono">Operations Platform</span>
                    </div>
                </div>

                {/* Hero message & feature pills */}
                <div className="relative z-10 max-w-md space-y-6 my-auto">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900/80 border border-zinc-800 text-xs text-zinc-300">
                        <Sparkles className="w-3.5 h-3.5 text-primary" />
                        <span>The operating system for modern agencies</span>
                    </div>

                    <h1 className="text-3xl font-bold tracking-tight text-white leading-tight">
                        Streamline your agency's clients, projects, tasks, and billing.
                    </h1>

                    <p className="text-sm text-zinc-400 leading-relaxed">
                        A unified workspace built for high-performance creative and technical teams. Monitor financial health, manage deliveries, and collaborate seamlessly.
                    </p>

                    <div className="space-y-3 pt-2">
                        <div className="flex items-center gap-3 text-xs text-zinc-300 bg-zinc-900/50 p-2.5 rounded-lg border border-zinc-800/60">
                            <FolderKanban className="w-4 h-4 text-primary shrink-0" />
                            <span>Workspace boards with real-time task pipelines</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-zinc-300 bg-zinc-900/50 p-2.5 rounded-lg border border-zinc-800/60">
                            <Receipt className="w-4 h-4 text-emerald-400 shrink-0" />
                            <span>GST-compliant invoicing & multi-currency quotations</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-zinc-300 bg-zinc-900/50 p-2.5 rounded-lg border border-zinc-800/60">
                            <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" />
                            <span>Role-based access control with granular permissions</span>
                        </div>
                    </div>
                </div>

                {/* Footer status indicator */}
                <div className="relative z-10 flex items-center justify-between text-xs text-zinc-500 pt-6 border-t border-zinc-900">
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span>All systems operational</span>
                    </div>
                    <span>v2.0.0 Enterprise</span>
                </div>
            </div>

            {/* Right login form panel */}
            <div className="flex flex-col justify-between p-6 sm:p-10 relative">
                {/* Header with theme toggle */}
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

                {/* Centered Form */}
                <div className="max-w-[380px] w-full mx-auto my-auto py-8">
                    <div className="mb-8">
                        <h2 className="text-2xl font-bold tracking-tight text-foreground">Welcome back</h2>
                        <p className="text-xs text-muted-foreground mt-1.5">
                            Enter your email and password to access your agency dashboard.
                        </p>
                    </div>

                    <form onSubmit={form.handleSubmit(handleLogin)} className="space-y-4">
                        <FieldGroup>
                            <Controller
                                name="email"
                                control={form.control}
                                render={({ field, fieldState }) => (
                                    <Field data-invalid={fieldState.invalid} className="gap-1.5">
                                        <label htmlFor="email" className="text-xs font-medium text-foreground">
                                            Email Address
                                        </label>
                                        <div className="relative">
                                            <Mail className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                                            <Input
                                                {...field}
                                                id="email"
                                                type="email"
                                                aria-invalid={fieldState.invalid}
                                                disabled={isSubmitting}
                                                placeholder="name@agency.com"
                                                autoComplete="email"
                                                className="ps-9 h-10 text-xs rounded-lg border-border bg-card focus-visible:ring-1 focus-visible:ring-primary shadow-xs"
                                            />
                                        </div>
                                        {fieldState.invalid && (
                                            <FieldError errors={[fieldState.error]} />
                                        )}
                                    </Field>
                                )}
                            />
                        </FieldGroup>

                        <FieldGroup>
                            <Controller
                                name="password"
                                control={form.control}
                                render={({ field, fieldState }) => (
                                    <Field data-invalid={fieldState.invalid} className="gap-1.5">
                                        <div className="flex items-center justify-between">
                                            <label htmlFor="password" className="text-xs font-medium text-foreground">
                                                Password
                                            </label>
                                            <Link
                                                to="/auth/forgot-password"
                                                className="text-[11px] text-muted-foreground hover:text-primary transition-colors"
                                            >
                                                Forgot password?
                                            </Link>
                                        </div>
                                        <div className="relative">
                                            <Lock className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                                            <Input
                                                {...field}
                                                id="password"
                                                type={showPassword ? "text" : "password"}
                                                aria-invalid={fieldState.invalid}
                                                disabled={isSubmitting}
                                                placeholder="••••••••"
                                                autoComplete="current-password"
                                                className="ps-9 pe-10 h-10 text-xs rounded-lg border-border bg-card focus-visible:ring-1 focus-visible:ring-primary shadow-xs"
                                            />
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => setShowPassword((prev) => !prev)}
                                                className="absolute end-1 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-transparent"
                                            >
                                                {showPassword ? (
                                                    <EyeOff className="w-3.5 h-3.5" />
                                                ) : (
                                                    <Eye className="w-3.5 h-3.5" />
                                                )}
                                            </Button>
                                        </div>
                                        {fieldState.invalid && (
                                            <FieldError errors={[fieldState.error]} />
                                        )}
                                    </Field>
                                )}
                            />
                        </FieldGroup>

                        <div className="flex items-center justify-between pt-1">
                            <div className="flex items-center gap-2">
                                <Checkbox id="remember" className="h-4 w-4 rounded border-border" />
                                <label htmlFor="remember" className="text-xs text-muted-foreground cursor-pointer select-none">
                                    Remember this device
                                </label>
                            </div>
                        </div>

                        <Button
                            type="submit"
                            className="w-full h-10 text-xs font-medium rounded-lg mt-6 shadow-xs"
                            disabled={isSubmitting}
                        >
                            {isLoading && <Loader2 className="animate-spin h-3.5 w-3.5 mr-2" />}
                            {isLoading ? "Signing in..." : "Sign in to Dashboard"}
                        </Button>
                    </form>
                </div>

                {/* Footer copyright */}
                <div className="text-center text-[11px] text-muted-foreground py-2">
                    Protected by enterprise-grade encryption & security standards.
                </div>
            </div>
        </div>
    );
};

export default Login;