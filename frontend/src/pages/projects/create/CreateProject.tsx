import LazyWrapper from "@/components/LazyWrapper";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
import Breadcrumb from "@/layouts/Breadcrumb";
import { api } from "@/lib/api";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import ProjectForm, { type ProjectFormValues } from "../components/ProjectForm";

const CreateProject = () => {
    const navigate = useNavigate();
    const { user: actor } = useAuth();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (values: ProjectFormValues) => {
        setIsSubmitting(true);
        try {
            const { title, description, clientId, managerId, status, startDate, deadline, budget, currency, clientApprovalEnabled, colorHex } = values;
            await api.post("/projects", {
                title, description, clientId, managerId, status, startDate, deadline, budget, currency, clientApprovalEnabled, colorHex,
                companyId: actor?.roleName === "SUPER_ADMIN" ? values.companyId : undefined,
            });
            toast.success("Project created successfully.");
            navigate("/projects-list");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
            <Breadcrumb title="Add New Project" text="Create Project" />

            <LazyWrapper>
                <Card className="card rounded-lg border-0">
                    <CardContent>
                        <ProjectForm mode="create" onSubmit={handleSubmit} isSubmitting={isSubmitting} />
                    </CardContent>
                </Card>
            </LazyWrapper>
        </>
    );
};

export default CreateProject;
