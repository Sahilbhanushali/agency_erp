import LazyWrapper from "@/components/LazyWrapper";
import PageHeader from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import UserForm, { type UserFormValues } from "../components/UserForm";

const CreateUser = () => {
    const navigate = useNavigate();
    const { user: actor } = useAuth();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (values: UserFormValues) => {
        setIsSubmitting(true);
        try {
            const { firstName, lastName, email, phone, roleId, gender, dateOfBirth, employmentType, department, designation, joiningDate, isRemote } = values;
            await api.post("/users", {
                firstName, lastName, email, phone, roleId, gender, dateOfBirth,
                employmentType, department, designation, joiningDate, isRemote,
                companyId: actor?.roleName === "SUPER_ADMIN" ? values.companyId : undefined,
            });
            toast.success("Invite sent — the user will receive an email to set their password.");
            navigate("/users-list");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-6">
            <PageHeader
                title="Invite New User"
                description="Invite an employee, manager, or contractor to join your workspace."
                breadcrumbs={[
                    { label: "Team", href: "/users-list" },
                    { label: "Invite User" },
                ]}
            />

            <LazyWrapper>
                <Card className="p-6 rounded-xl border border-border shadow-xs">
                    <CardContent className="p-0">
                        <UserForm mode="create" onSubmit={handleSubmit} isSubmitting={isSubmitting} />
                    </CardContent>
                </Card>
            </LazyWrapper>
        </div>
    );
};

export default CreateUser;
