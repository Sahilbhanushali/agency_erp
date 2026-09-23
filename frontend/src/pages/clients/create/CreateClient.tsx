import LazyWrapper from "@/components/LazyWrapper";
import PageHeader from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
import { api, ApiError } from "@/lib/api";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import ClientForm, { type ClientFormValues } from "../components/ClientForm";

export default function CreateClient() {
  const navigate = useNavigate();
  const { user: actor } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (values: ClientFormValues) => {
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
      } = values;
      await api.post("/clients", {
        name,
        email,
        industry,
        website,
        phone,
        gstNumber,
        panNumber,
        accountManagerId,
        note,
        companyId:
          actor?.roleName === "SUPER_ADMIN" ? values.companyId : undefined,
      });
      toast.success("Client created successfully.");
      navigate("/clients-list");
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Failed to create client."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Add New Client"
        description="Create a client profile for workspaces, project management, and invoice billing."
        breadcrumbs={[
          { label: "Clients", href: "/clients-list" },
          { label: "New Client" },
        ]}
      />

      <LazyWrapper>
        <Card className="p-6">
          <CardContent className="p-0">
            <ClientForm
              mode="create"
              onSubmit={handleSubmit}
              isSubmitting={isSubmitting}
            />
          </CardContent>
        </Card>
      </LazyWrapper>
    </div>
  );
}
