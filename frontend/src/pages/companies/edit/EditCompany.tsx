import LazyWrapper from "@/components/LazyWrapper";
import { Card, CardContent } from "@/components/ui/card";
import Breadcrumb from "@/layouts/Breadcrumb";
import { api, ApiError } from "@/lib/api";
import type { Company, CompanyPayload } from "@/types/company";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import CompanyForm, { type CompanyFormValues } from "../components/CompanyForm";

const EditCompany = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [company, setCompany] = useState<Company | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (!id) return;
        api
            .get<Company>(`/companies/${id}`)
            .then(setCompany)
            .catch((error) => toast.error(error instanceof ApiError ? error.message : "Failed to load company."))
            .finally(() => setIsLoading(false));
    }, [id]);

    const handleSubmit = async (values: CompanyFormValues) => {
        if (!id) return;
        setIsSubmitting(true);
        const {
            name, legalName, logoUrl, email, phone, website, gstNumber, panNumber,
            bankName, bankAccountName, bankAccountNumber, bankIfsc,
            currency, timezone, isActive, line1, line2, city, state, postalCode, country,
        } = values;
        const payload: CompanyPayload = {
            name, legalName, logoUrl, phone, website, gstNumber, panNumber,
            bankName, bankAccountName, bankAccountNumber, bankIfsc, currency, timezone, isActive,
            email: email || undefined,
            registeredAddress: line1 && city ? { line1, line2, city, state, postalCode, country } : undefined,
        };
        try {
            await api.patch(`/companies/${id}`, payload);
            toast.success("Company updated successfully.");
            navigate("/companies-list");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
            <Breadcrumb title="Edit Company" text="Edit Company" />

            <LazyWrapper>
                <Card className="card rounded-lg border-0">
                    <CardContent>
                        {isLoading ? (
                            <div className="flex items-center justify-center py-16">
                                <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
                            </div>
                        ) : company ? (
                            <CompanyForm mode="edit" initialValues={company} onSubmit={handleSubmit} isSubmitting={isSubmitting} />
                        ) : (
                            <p className="text-center text-neutral-500 py-16">Company not found.</p>
                        )}
                    </CardContent>
                </Card>
            </LazyWrapper>
        </>
    );
};

export default EditCompany;
