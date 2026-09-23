import LazyWrapper from "@/components/LazyWrapper";
import PageHeader from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { api, ApiError } from "@/lib/api";
import type { Project } from "@/types/project";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import ProjectForm, { type ProjectFormValues } from "../components/ProjectForm";

export default function EditProject() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!id) return;
    api
      .get<Project>(`/projects/${id}`)
      .then(setProject)
      .catch((error) =>
        toast.error(error instanceof ApiError ? error.message : "Failed to load project.")
      )
      .finally(() => setIsLoading(false));
  }, [id]);

  const handleSubmit = async (values: ProjectFormValues) => {
    if (!id) return;
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
      await api.patch(`/projects/${id}`, {
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
      });
      toast.success("Project updated successfully.");
      navigate("/projects-list");
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Failed to update project."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={project ? `Edit ${project.title}` : "Edit Project"}
        description="Update project milestones, assigned manager, budget, or engagement status."
        breadcrumbs={[
          { label: "Projects", href: "/projects-list" },
          {
            label: project ? project.title : "Project",
            href: project ? `/projects-list/${project.id}` : undefined,
          },
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
            ) : project ? (
              <ProjectForm
                mode="edit"
                initialValues={project}
                onSubmit={handleSubmit}
                isSubmitting={isSubmitting}
              />
            ) : (
              <p className="text-center text-sm text-muted-foreground py-16">
                Project not found.
              </p>
            )}
          </CardContent>
        </Card>
      </LazyWrapper>
    </div>
  );
}
