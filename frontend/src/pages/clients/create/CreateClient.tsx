import LazyWrapper from "@/components/LazyWrapper";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
import Breadcrumb from "@/layouts/Breadcrumb";
import { api } from "@/lib/api";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import ClientForm, { type ClientFormValues } from "../components/ClientForm";

const CreateClient = () => {
    const navigate = useNavigate();
    const { user: actor } = useAuth();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (values: ClientFormValues) => {
        setIsSubmitting(true);
        try {
            const { name, email, industry, website, phone, gstNumber, panNumber, accountManagerId, note } = values;
            await api.post("/clients", {
                name, email, industry, website, phone, gstNumber, panNumber, accountManagerId, note,
                companyId: actor?.roleName === "SUPER_ADMIN" ? values.companyId : undefined,
            });
            toast.success("Client created successfully.");
            navigate("/clients-list");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
            <Breadcrumb title="Add New Client" text="Create Client" />

            <LazyWrapper>
                <Card className="card rounded-lg border-0">
                    <CardContent>
                        <ClientForm mode="create" onSubmit={handleSubmit} isSubmitting={isSubmitting} />
                    </CardContent>
                </Card>
            </LazyWrapper>
        </>
    );
};

export default CreateClient;
