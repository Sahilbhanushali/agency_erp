import LazyWrapper from "@/components/LazyWrapper";
import { Card, CardContent } from "@/components/ui/card";
import Breadcrumb from "@/layouts/Breadcrumb";
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
            navigate("/workspaces-list");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
            <Breadcrumb title="Edit Workspace" text="Edit Workspace" />

            <LazyWrapper>
                <Card className="card rounded-lg border-0">
                    <CardContent>
                        {isLoading ? (
                            <div className="flex items-center justify-center py-16">
                                <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
                            </div>
                        ) : workspace ? (
                            <WorkspaceForm mode="edit" initialValues={workspace} onSubmit={handleSubmit} isSubmitting={isSubmitting} />
                        ) : (
                            <p className="text-center text-neutral-500 py-16">Workspace not found.</p>
                        )}
                    </CardContent>
                </Card>
            </LazyWrapper>
        </>
    );
};

export default EditWorkspace;
