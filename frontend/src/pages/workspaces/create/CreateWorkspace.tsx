import LazyWrapper from "@/components/LazyWrapper";
import PageHeader from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { api, ApiError } from "@/lib/api";
import type { AddMemberPayload, Workspace } from "@/types/workspace";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import WorkspaceForm, { type WorkspaceFormValues } from "../components/WorkspaceForm";
import type { PickedMember } from "../components/WorkspaceMemberPicker";

const CreateWorkspace = () => {
    const navigate = useNavigate();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (values: WorkspaceFormValues, pendingMembers: PickedMember[] = []) => {
        setIsSubmitting(true);
        try {
            const { projectId, name, description, colorHex } = values;
            const workspace = await api.post<Workspace>("/workspaces", { projectId, name, description, colorHex });

            for (const member of pendingMembers) {
                const payload: AddMemberPayload = { userId: member.userId, memberRole: member.memberRole };
                await api.post(`/workspaces/${workspace.id}/members`, payload).catch((error) => {
                    toast.error(error instanceof ApiError ? `${member.label}: ${error.message}` : `Failed to add ${member.label}.`);
                });
            }

            toast.success("Workspace created successfully.");
            navigate("/workspaces-list");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-6">
            <PageHeader
                title="Create Workspace"
                description="Organize a project board, assign dedicated members, and structure workflows."
                breadcrumbs={[
                    { label: "Workspaces", href: "/workspaces-list" },
                    { label: "New Workspace" },
                ]}
            />

            <LazyWrapper>
                <Card className="p-6 rounded-xl border border-border shadow-xs">
                    <CardContent className="p-0">
                        <WorkspaceForm mode="create" onSubmit={handleSubmit} isSubmitting={isSubmitting} />
                    </CardContent>
                </Card>
            </LazyWrapper>
        </div>
    );
};

export default CreateWorkspace;
