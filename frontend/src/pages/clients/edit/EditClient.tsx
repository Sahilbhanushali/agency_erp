import LazyWrapper from "@/components/LazyWrapper";
import PageHeader from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { api, ApiError } from "@/lib/api";
import type { Client } from "@/types/client";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import ClientForm, { type ClientFormValues } from "../components/ClientForm";

export default function EditClient() {
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
      .catch((error) =>
        toast.error(error instanceof ApiError ? error.message : "Failed to load client.")
      )
      .finally(() => setIsLoading(false));
  }, [id]);

  const handleSubmit = async (values: ClientFormValues) => {
    if (!id) return;
    setIsSubmitting(true);
    try {
      const {
        name,
        email,
        industry,
        website,
        phone,
        gstNumber,
        panNumber,
        accountManagerId,
        note,
        isActive,
      } = values;
      await api.patch(`/clients/${id}`, {
        name,
        email,
        industry,
        website,
        phone,
        gstNumber,
        panNumber,
        accountManagerId,
        note,
        isActive,
      });
      toast.success("Client updated successfully.");
      navigate("/clients-list");
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Failed to update client."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={client ? `Edit ${client.name}` : "Edit Client"}
        description="Update contact information, business details, or account manager assignment."
        breadcrumbs={[
          { label: "Clients", href: "/clients-list" },
          { label: client ? client.name : "Client", href: client ? `/clients-list/${client.id}` : undefined },
          { label: "Edit" },
        ]}
      />

      <LazyWrapper>
        <Card className="p-6">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : client ? (
              <ClientForm
                mode="edit"
                initialValues={client}
                onSubmit={handleSubmit}
                isSubmitting={isSubmitting}
              />
            ) : (
              <p className="text-center text-sm text-muted-foreground py-16">
                Client not found.
              </p>
            )}
          </CardContent>
        </Card>
      </LazyWrapper>
    </div>
  );
}
