import LazyWrapper from "@/components/LazyWrapper";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
import Breadcrumb from "@/layouts/Breadcrumb";
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
        <>
            <Breadcrumb title="Add New User" text="Create User" />

            <LazyWrapper>
                <Card className="card rounded-lg border-0">
                    <CardContent>
                        <UserForm mode="create" onSubmit={handleSubmit} isSubmitting={isSubmitting} />
                    </CardContent>
                </Card>
            </LazyWrapper>
        </>
    );
};

export default CreateUser;
