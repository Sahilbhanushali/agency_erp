import LazyWrapper from "@/components/LazyWrapper";
import PageHeader from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
import { api, ApiError } from "@/lib/api";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import ProjectForm, { type ProjectFormValues } from "../components/ProjectForm";

export default function CreateProject() {
  const navigate = useNavigate();
  const { user: actor } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (values: ProjectFormValues) => {
    setIsSubmitting(true);
    try {
      const {
        title,
        description,
        clientId,
        managerId,
        status,
        startDate,
        deadline,
        budget,
        currency,
        clientApprovalEnabled,
        colorHex,
      } = values;
      await api.post("/projects", {
        title,
        description,
        clientId,
        managerId,
        status,
        startDate,
        deadline,
        budget,
        currency,
        clientApprovalEnabled,
        colorHex,
        companyId:
          actor?.roleName === "SUPER_ADMIN" ? values.companyId : undefined,
      });
      toast.success("Project created successfully.");
      navigate("/projects-list");
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Failed to create project."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Add New Project"
        description="Initiate a client campaign, retainer, or engagement with target dates and budget."
        breadcrumbs={[
          { label: "Projects", href: "/projects-list" },
          { label: "New Project" },
        ]}
      />

      <LazyWrapper>
        <Card className="p-6">
          <CardContent className="p-0">
            <ProjectForm
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
