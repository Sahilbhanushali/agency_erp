import LazyWrapper from "@/components/LazyWrapper";
import { Card, CardContent } from "@/components/ui/card";
import Breadcrumb from "@/layouts/Breadcrumb";
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
