import LazyWrapper from "@/components/LazyWrapper";
import { Card, CardContent } from "@/components/ui/card";
import Breadcrumb from "@/layouts/Breadcrumb";
import { api, ApiError } from "@/lib/api";
import type { User } from "@/types/user";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import UserForm, { type UserFormValues } from "../components/UserForm";

const EditUser = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (!id) return;
        api
            .get<User>(`/users/${id}`)
            .then(setUser)
            .catch((error) => toast.error(error instanceof ApiError ? error.message : "Failed to load user."))
            .finally(() => setIsLoading(false));
    }, [id]);

    const handleSubmit = async (values: UserFormValues) => {
        if (!id) return;
        setIsSubmitting(true);
        try {
            const { firstName, lastName, email, phone, roleId, gender, dateOfBirth, employmentType, department, designation, joiningDate, isRemote, status } = values;
            await api.patch(`/users/${id}`, { firstName, lastName, email, phone, roleId, gender, dateOfBirth, employmentType, department, designation, joiningDate, isRemote, status });
            toast.success("User updated successfully.");
            navigate(`/users-list/${id}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
            <Breadcrumb title="Edit User" text="Edit User" />

            <LazyWrapper>
                <Card className="card rounded-lg border-0">
                    <CardContent>
                        {isLoading ? (
                            <div className="flex items-center justify-center py-16">
                                <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
                            </div>
                        ) : user ? (
                            <UserForm mode="edit" initialValues={user} onSubmit={handleSubmit} isSubmitting={isSubmitting} />
                        ) : (
                            <p className="text-center text-neutral-500 py-16">User not found.</p>
                        )}
                    </CardContent>
                </Card>
            </LazyWrapper>
        </>
    );
};

export default EditUser;
