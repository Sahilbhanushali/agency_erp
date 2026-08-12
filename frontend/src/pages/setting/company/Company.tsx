import LazyWrapper from "@/components/LazyWrapper";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import Breadcrumb from "@/layouts/Breadcrumb";
import { api, ApiError } from "@/lib/api";
import type { Company as CompanyType, CompanyPayload } from "@/types/company";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "react-toastify";
import * as z from "zod";

const schema = z.object({
    name: z.string().min(1, "Company name is required"),
    legalName: z.string().optional(),
    email: z.string().email("Enter a valid email address.").optional().or(z.literal("")),
    phone: z.string().optional(),
    website: z.string().optional(),
    gstNumber: z.string().optional(),
    panNumber: z.string().optional(),
    line1: z.string().optional(),
    line2: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    postalCode: z.string().optional(),
    country: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const inputClass = "h-11 rounded-lg";

const Company = () => {
    const { user: actor } = useAuth();
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const form = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: {
            name: "",
            legalName: "",
            email: "",
            phone: "",
            website: "",
            gstNumber: "",
            panNumber: "",
            line1: "",
            line2: "",
            city: "",
            state: "",
            postalCode: "",
            country: "",
        },
    });

    useEffect(() => {
        if (!actor?.companyId) {
            setIsLoading(false);
            return;
        }
        api
            .get<CompanyType>(`/companies/${actor.companyId}`)
            .then((data) => {
                form.reset({
                    name: data.name,
                    legalName: data.legalName ?? "",
                    email: data.email ?? "",
                    phone: data.phone ?? "",
                    website: data.website ?? "",
                    gstNumber: data.gstNumber ?? "",
                    panNumber: data.panNumber ?? "",
                    line1: data.registeredAddress?.line1 ?? "",
                    line2: data.registeredAddress?.line2 ?? "",
                    city: data.registeredAddress?.city ?? "",
                    state: data.registeredAddress?.state ?? "",
                    postalCode: data.registeredAddress?.postalCode ?? "",
                    country: data.registeredAddress?.country ?? "",
                });
            })
            .catch((error) => toast.error(error instanceof ApiError ? error.message : "Failed to load company."))
            .finally(() => setIsLoading(false));
    }, [actor?.companyId]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleSubmit = async (values: FormValues) => {
        if (!actor?.companyId) return;
        setIsSubmitting(true);
        const { line1, line2, city, state, postalCode, country, ...companyFields } = values;
        const payload: CompanyPayload = {
            ...companyFields,
            email: companyFields.email || undefined,
            registeredAddress: line1 && city ? { line1, line2, city, state, postalCode, country } : undefined,
        };
        try {
            await api.patch(`/companies/${actor.companyId}`, payload);
            toast.success("Company settings updated.");
        } catch (error) {
            toast.error(error instanceof ApiError ? error.message : "Failed to update company.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
            <Breadcrumb title="Company" text="Settings" />

            <LazyWrapper>
                <Card className="card rounded-lg border-0">
                    <CardContent>
                        {isLoading ? (
                            <div className="flex items-center justify-center py-16">
                                <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
                            </div>
                        ) : !actor?.companyId ? (
                            <p className="text-center text-neutral-500 dark:text-neutral-300 py-16">
                                Platform administrators are not scoped to a single company.
                            </p>
                        ) : (
                            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8">
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-6">
                                    <Field data-invalid={!!form.formState.errors.name}>
                                        <FieldLabel htmlFor="name">Company Name *</FieldLabel>
                                        <Input id="name" className={inputClass} {...form.register("name")} />
                                        {form.formState.errors.name && <FieldError errors={[form.formState.errors.name]} />}
                                    </Field>

                                    <Field>
                                        <FieldLabel htmlFor="legalName">Legal Name</FieldLabel>
                                        <Input id="legalName" className={inputClass} {...form.register("legalName")} />
                                    </Field>

                                    <Field data-invalid={!!form.formState.errors.email}>
                                        <FieldLabel htmlFor="email">Email</FieldLabel>
                                        <Input id="email" type="email" className={inputClass} {...form.register("email")} />
                                        {form.formState.errors.email && <FieldError errors={[form.formState.errors.email]} />}
                                    </Field>

                                    <Field>
                                        <FieldLabel htmlFor="phone">Phone</FieldLabel>
                                        <Input id="phone" className={inputClass} {...form.register("phone")} />
                                    </Field>

                                    <Field>
                                        <FieldLabel htmlFor="website">Website</FieldLabel>
                                        <Input id="website" type="url" className={inputClass} {...form.register("website")} />
                                    </Field>

                                    <Field>
                                        <FieldLabel htmlFor="gstNumber">GST Number</FieldLabel>
                                        <Input id="gstNumber" className={inputClass} {...form.register("gstNumber")} />
                                    </Field>

                                    <Field>
                                        <FieldLabel htmlFor="panNumber">PAN Number</FieldLabel>
                                        <Input id="panNumber" className={inputClass} {...form.register("panNumber")} />
                                    </Field>
                                </div>

                                <div>
                                    <h6 className="text-sm font-semibold text-neutral-700 dark:text-neutral-200 mb-4">Registered Address</h6>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-6">
                                        <Field>
                                            <FieldLabel htmlFor="line1">Address Line 1</FieldLabel>
                                            <Input id="line1" className={inputClass} {...form.register("line1")} />
                                        </Field>

                                        <Field>
                                            <FieldLabel htmlFor="line2">Address Line 2</FieldLabel>
                                            <Input id="line2" className={inputClass} {...form.register("line2")} />
                                        </Field>

                                        <Field>
                                            <FieldLabel htmlFor="city">City</FieldLabel>
                                            <Input id="city" className={inputClass} {...form.register("city")} />
                                        </Field>

                                        <Field>
                                            <FieldLabel htmlFor="state">State</FieldLabel>
                                            <Input id="state" className={inputClass} {...form.register("state")} />
                                        </Field>

                                        <Field>
                                            <FieldLabel htmlFor="postalCode">Postal Code</FieldLabel>
                                            <Input id="postalCode" className={inputClass} {...form.register("postalCode")} />
                                        </Field>

                                        <Field>
                                            <FieldLabel htmlFor="country">Country</FieldLabel>
                                            <Input id="country" className={inputClass} {...form.register("country")} />
                                        </Field>
                                    </div>
                                </div>

                                <div className="sticky bottom-0 -mx-6 flex items-center justify-end gap-3 border-t border-neutral-100 dark:border-slate-700 bg-card/95 backdrop-blur-sm px-6 py-4 mt-8">
                                    <Button type="button" variant="outline" className="h-11 px-8 rounded-lg" onClick={() => form.reset()} disabled={isSubmitting}>
                                        Reset
                                    </Button>
                                    <Button type="submit" className="h-11 px-8 rounded-lg" disabled={isSubmitting}>
                                        {isSubmitting && <Loader2 className="animate-spin h-4.5 w-4.5 mr-2" />}
                                        Save Changes
                                    </Button>
                                </div>
                            </form>
                        )}
                    </CardContent>
                </Card>
            </LazyWrapper>
        </>
    );
};

export default Company;
