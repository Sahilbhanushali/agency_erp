import LazyWrapper from "@/components/LazyWrapper";
import { Card, CardContent } from "@/components/ui/card";
import Breadcrumb from "@/layouts/Breadcrumb";
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
        const { name, legalName, email, phone, website, gstNumber, panNumber, currency, timezone, line1, line2, city, state, postalCode, country } = values;
        const payload: CompanyPayload = {
            name, legalName, phone, website, gstNumber, panNumber, currency, timezone,
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
        <>
            <Breadcrumb title="Add New Company" text="Create Company" />

            <LazyWrapper>
                <Card className="card rounded-lg border-0">
                    <CardContent>
                        <CompanyForm mode="create" onSubmit={handleSubmit} isSubmitting={isSubmitting} />
                    </CardContent>
                </Card>
            </LazyWrapper>
        </>
    );
};

export default CreateCompany;
