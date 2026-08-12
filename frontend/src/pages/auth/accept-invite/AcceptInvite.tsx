import AuthImage from "@/assets/images/auth/auth-img.png";
import ThemeLogo from "@/components/shared/ThemeLogo";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2, Lock } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import * as z from "zod";

const formSchema = z
    .object({
        password: z
            .string()
            .min(8, "Password must be more than 8 characters")
            .max(20, "Password must be at most 20 characters")
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
            toast.success("Password set. You can now sign in.");
            navigate("/auth/login");
        } catch (error) {
            toast.error(error instanceof ApiError ? error.message : "Something went wrong. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <section className="bg-white dark:bg-slate-900 lg:flex flex-wrap min-h-[100vh]">
            <div className="lg:w-1/2 lg:block hidden">
                <div className="flex items-center flex-col h-full justify-center">
                    <img src={AuthImage} alt="Image" />
                </div>
            </div>
            <div className="lg:w-1/2 py-8 px-6 flex flex-col justify-center">
                <div className="lg:max-w-[464px] mx-auto w-full">
                    <div>
                        <Link to="/auth/login" className="mb-2.5 max-w-[290px] inline-block">
                            <ThemeLogo />
                        </Link>
                        <h4 className="mb-3">Set Your Password</h4>
                        <p className="mb-8 text-secondary-light text-lg">Choose a password to activate your account.</p>
                    </div>

                    {!token ? (
                        <p className="text-red-500">This invite link is missing a token. Please use the link from your email.</p>
                    ) : (
                        <form onSubmit={form.handleSubmit(handleSubmit)}>
                            <FieldGroup className="mb-4">
                                <Controller
                                    name="password"
                                    control={form.control}
                                    render={({ field, fieldState }) => (
                                        <Field data-invalid={fieldState.invalid} className={cn("gap-1")}>
                                            <div className="icon-field relative">
                                                <Lock className="absolute start-5 top-1/2 transform -translate-y-1/2 w-5 h-5 text-neutral-700 dark:text-neutral-200" />
                                                <Input
                                                    {...field}
                                                    type={showPassword ? "text" : "password"}
                                                    aria-invalid={fieldState.invalid}
                                                    disabled={isSubmitting}
                                                    placeholder="New password"
                                                    autoComplete="new-password"
                                                    className="ps-13 pe-12 h-14 rounded-xl bg-neutral-100 dark:bg-slate-800 border border-neutral-300 dark:border-slate-700 focus:border-primary dark:focus:border-primary focus-visible:border-primary !shadow-none !ring-0"
                                                />
                                                <Button
                                                    type="button"
                                                    onClick={() => setShowPassword(!showPassword)}
                                                    className="absolute right-4 top-1/2 transform -translate-y-1/2 !p-0 bg-transparent hover:bg-transparent text-muted-foreground h-[unset]"
                                                >
                                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                                </Button>
                                            </div>
                                            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                                        </Field>
                                    )}
                                />
                            </FieldGroup>

                            <FieldGroup className="mb-4">
                                <Controller
                                    name="confirmPassword"
                                    control={form.control}
                                    render={({ field, fieldState }) => (
                                        <Field data-invalid={fieldState.invalid} className={cn("gap-1")}>
                                            <div className="icon-field relative">
                                                <Lock className="absolute start-5 top-1/2 transform -translate-y-1/2 w-5 h-5 text-neutral-700 dark:text-neutral-200" />
                                                <Input
                                                    {...field}
                                                    type={showPassword ? "text" : "password"}
                                                    aria-invalid={fieldState.invalid}
                                                    disabled={isSubmitting}
                                                    placeholder="Confirm password"
                                                    autoComplete="new-password"
                                                    className="ps-13 pe-12 h-14 rounded-xl bg-neutral-100 dark:bg-slate-800 border border-neutral-300 dark:border-slate-700 focus:border-primary dark:focus:border-primary focus-visible:border-primary !shadow-none !ring-0"
                                                />
                                            </div>
                                            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                                        </Field>
                                    )}
                                />
                            </FieldGroup>

                            <Button type="submit" className="w-full rounded-lg h-[52px] text-sm mt-8" disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="animate-spin h-4.5 w-4.5 mr-2" />}
                                {isSubmitting ? "Setting password..." : "Set Password & Activate"}
                            </Button>
                        </form>
                    )}
                </div>
            </div>
        </section>
    );
};

export default AcceptInvite;
