import LazyWrapper from "@/components/LazyWrapper";
import PageHeader from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { api, ApiError } from "@/lib/api";
import type { Workspace } from "@/types/workspace";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import WorkspaceForm, { type WorkspaceFormValues } from "../components/WorkspaceForm";

const EditWorkspace = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [workspace, setWorkspace] = useState<Workspace | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (!id) return;
        api
            .get<Workspace>(`/workspaces/${id}`)
            .then(setWorkspace)
            .catch((error) => toast.error(error instanceof ApiError ? error.message : "Failed to load workspace."))
            .finally(() => setIsLoading(false));
    }, [id]);

    const handleSubmit = async (values: WorkspaceFormValues) => {
        if (!id) return;
        setIsSubmitting(true);
        try {
            const { name, description, colorHex, isActive } = values;
            await api.patch(`/workspaces/${id}`, { name, description, colorHex, isActive });
            toast.success("Workspace updated successfully.");
            navigate(`/workspaces-list/${id}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-6">
            <PageHeader
                title={workspace ? `Edit ${workspace.name}` : "Edit Workspace"}
                description="Update workspace configuration, status, and theme accent color."
                breadcrumbs={[
                    { label: "Workspaces", href: "/workspaces-list" },
                    { label: workspace ? workspace.name : "Workspace", href: id ? `/workspaces-list/${id}` : undefined },
                    { label: "Edit" },
                ]}
            />

            <LazyWrapper>
                <Card className="p-6 rounded-xl border border-border shadow-xs">
                    <CardContent className="p-0">
                        {isLoading ? (
                            <div className="flex items-center justify-center py-16">
                                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                            </div>
                        ) : workspace ? (
                            <WorkspaceForm mode="edit" initialValues={workspace} onSubmit={handleSubmit} isSubmitting={isSubmitting} />
                        ) : (
                            <p className="text-center text-muted-foreground py-16 text-sm">Workspace not found.</p>
                        )}
                    </CardContent>
                </Card>
            </LazyWrapper>
        </div>
    );
};

export default EditWorkspace;
