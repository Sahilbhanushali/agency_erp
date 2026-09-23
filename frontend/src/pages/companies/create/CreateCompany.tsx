import LazyWrapper from "@/components/LazyWrapper";
import PageHeader from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api";
import type { CompanyPayload } from "@/types/company";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import CompanyForm, { type CompanyFormValues } from "../components/CompanyForm";

const CreateCompany = () => {
    const navigate = useNavigate();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (values: CompanyFormValues) => {
        setIsSubmitting(true);
        const {
            name, legalName, logoUrl, email, phone, website, gstNumber, panNumber,
            bankName, bankAccountName, bankAccountNumber, bankIfsc,
            currency, timezone, line1, line2, city, state, postalCode, country,
        } = values;
        const payload: CompanyPayload = {
            name, legalName, logoUrl, phone, website, gstNumber, panNumber,
            bankName, bankAccountName, bankAccountNumber, bankIfsc, currency, timezone,
            email: email || undefined,
            registeredAddress: line1 && city ? { line1, line2, city, state, postalCode, country } : undefined,
        };
        try {
            await api.post("/companies", payload);
            toast.success("Company created successfully.");
            navigate("/companies-list");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-6">
            <PageHeader
                title="Create Company"
                description="Register a new agency organization or operating company profile."
                breadcrumbs={[
                    { label: "Companies", href: "/companies-list" },
                    { label: "New Company" },
                ]}
            />

            <LazyWrapper>
                <Card className="p-6 rounded-xl border border-border shadow-xs">
                    <CardContent className="p-0">
                        <CompanyForm mode="create" onSubmit={handleSubmit} isSubmitting={isSubmitting} />
                    </CardContent>
                </Card>
            </LazyWrapper>
        </div>
    );
};

export default CreateCompany;
