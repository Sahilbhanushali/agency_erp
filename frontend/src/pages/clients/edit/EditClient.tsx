import LazyWrapper from "@/components/LazyWrapper";
import { Card, CardContent } from "@/components/ui/card";
import Breadcrumb from "@/layouts/Breadcrumb";
import { api, ApiError } from "@/lib/api";
import type { Client } from "@/types/client";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import ClientForm, { type ClientFormValues } from "../components/ClientForm";

const EditClient = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [client, setClient] = useState<Client | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (!id) return;
        api
            .get<Client>(`/clients/${id}`)
            .then(setClient)
            .catch((error) => toast.error(error instanceof ApiError ? error.message : "Failed to load client."))
            .finally(() => setIsLoading(false));
    }, [id]);

    const handleSubmit = async (values: ClientFormValues) => {
        if (!id) return;
        setIsSubmitting(true);
        try {
            const { name, email, industry, website, phone, gstNumber, panNumber, accountManagerId, note, isActive } = values;
            await api.patch(`/clients/${id}`, { name, email, industry, website, phone, gstNumber, panNumber, accountManagerId, note, isActive });
            toast.success("Client updated successfully.");
            navigate("/clients-list");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
            <Breadcrumb title="Edit Client" text="Edit Client" />

            <LazyWrapper>
                <Card className="card rounded-lg border-0">
                    <CardContent>
                        {isLoading ? (
                            <div className="flex items-center justify-center py-16">
                                <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
                            </div>
                        ) : client ? (
                            <ClientForm mode="edit" initialValues={client} onSubmit={handleSubmit} isSubmitting={isSubmitting} />
                        ) : (
                            <p className="text-center text-neutral-500 py-16">Client not found.</p>
                        )}
                    </CardContent>
                </Card>
            </LazyWrapper>
        </>
    );
};

export default EditClient;
