import LazyWrapper from "@/components/LazyWrapper";
import { Card, CardContent } from "@/components/ui/card";
import Breadcrumb from "@/layouts/Breadcrumb";
import { api } from "@/lib/api";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import WorkspaceForm, { type WorkspaceFormValues } from "../components/WorkspaceForm";

const CreateWorkspace = () => {
    const navigate = useNavigate();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (values: WorkspaceFormValues) => {
        setIsSubmitting(true);
        try {
            const { projectId, name, description, colorHex } = values;
            await api.post("/workspaces", { projectId, name, description, colorHex });
            toast.success("Workspace created successfully.");
            navigate("/workspaces-list");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
            <Breadcrumb title="Add New Workspace" text="Create Workspace" />

            <LazyWrapper>
                <Card className="card rounded-lg border-0">
                    <CardContent>
                        <WorkspaceForm mode="create" onSubmit={handleSubmit} isSubmitting={isSubmitting} />
                    </CardContent>
                </Card>
            </LazyWrapper>
        </>
    );
};

export default CreateWorkspace;
