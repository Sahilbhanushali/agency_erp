import LazyWrapper from "@/components/LazyWrapper";
import PageHeader from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import UserForm, { type UserFormValues } from "../components/UserForm";

const CreateUser = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { user: actor } = useAuth();
    // Set when invited from a company's Team tab, so the company is not re-picked.
    const fromCompanyId = searchParams.get("companyId") ?? undefined;
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (values: UserFormValues) => {
        setIsSubmitting(true);
        try {
            const { firstName, lastName, email, phone, roleId, gender, dateOfBirth, employmentType, department, designation, joiningDate, isRemote } = values;
            const created = await api.post<{ inviteEmailSent?: boolean }>("/users", {
                firstName, lastName, email, phone, roleId, gender, dateOfBirth,
                employmentType, department, designation, joiningDate, isRemote,
                companyId: actor?.roleName === "SUPER_ADMIN" ? values.companyId : undefined,
            });
            // The member is created either way; only the email can fail, so say which.
            if (created?.inviteEmailSent === false) {
                toast.warning(
                    "Member created, but the invite email could not be sent. Use Resend invite from their profile.",
                );
            } else {
                toast.success("Invite sent — the user will receive an email to set their password.");
            }
            navigate(fromCompanyId ? `/companies-list/${fromCompanyId}` : "/users-list");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-6">
            <PageHeader
                title="Invite New User"
                description="Invite an employee, manager, or contractor to join your workspace."
                breadcrumbs={
                    fromCompanyId
                        ? [
                              { label: "Companies", href: "/companies-list" },
                              { label: "Company", href: `/companies-list/${fromCompanyId}` },
                              { label: "Invite User" },
                          ]
                        : [
                              { label: "Team", href: "/users-list" },
                              { label: "Invite User" },
                          ]
                }
            />

            <LazyWrapper>
                <Card className="p-6 rounded-xl border border-border shadow-xs">
                    <CardContent className="p-0">
                        <UserForm
                            mode="create"
                            defaultCompanyId={fromCompanyId}
                            onSubmit={handleSubmit}
                            isSubmitting={isSubmitting}
                        />
                    </CardContent>
                </Card>
            </LazyWrapper>
        </div>
    );
};

export default CreateUser;
