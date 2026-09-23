import ConfirmDialog from "@/components/shared/ConfirmDialog";
import EmptyState from "@/components/shared/EmptyState";
import PageHeader from "@/components/shared/PageHeader";
import StatusBadge from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/context/AuthContext";
import { api, ApiError } from "@/lib/api";
import type { User } from "@/types/user";
import { motion } from "framer-motion";
import {
    ArrowLeft,
    Briefcase,
    Building2,
    Cake,
    CalendarCheck,
    Clock,
    Edit,
    History,
    Loader2,
    Mail,
    MapPin,
    Phone,
    Shield,
    Trash2,
    User as UserIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import BankDetailForm from "../components/BankDetailForm";
import DocumentsPanel from "../components/DocumentsPanel";
import EmployeeProfileForm from "../components/EmployeeProfileForm";
import SkillsPanel from "../components/SkillsPanel";

const InfoTile = ({ icon: Icon, label, value }: { icon: typeof Phone; label: string; value: string }) => (
    <div className="flex items-start gap-3 p-3 rounded-lg border border-border/60 bg-muted/20 hover:bg-muted/40 transition-colors">
        <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary shrink-0 mt-0.5">
            <Icon className="w-4 h-4" />
        </span>
        <div className="min-w-0">
            <span className="block text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
            <span className="block text-xs font-semibold text-foreground truncate mt-0.5">{value || "—"}</span>
        </div>
    </div>
);

const ViewProfile = () => {
    const { id: routeId } = useParams<{ id: string }>();
    const { user: actor } = useAuth();
    const isOwnProfile = !routeId;
    const id = routeId ?? actor?.id;
    const navigate = useNavigate();
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        if (!id) return;
        api
            .get<User>(`/users/${id}`)
            .then(setUser)
            .catch((error) => toast.error(error instanceof ApiError ? error.message : "Failed to load user."))
            .finally(() => setIsLoading(false));
    }, [id]);

    const handleDelete = async () => {
        if (!id) return;
        setIsDeleting(true);
        try {
            await api.delete(`/users/${id}`);
            toast.success("User deleted.");
            navigate("/users-list");
        } catch (error) {
            toast.error(error instanceof ApiError ? error.message : "Failed to delete user.");
            setIsDeleting(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-24 space-y-3">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Loading profile...</p>
            </div>
        );
    }

    if (!user) {
        return (
            <EmptyState
                icon={UserIcon}
                title="User not found"
                description="The profile you are trying to view does not exist or has been removed."
                action={{
                    label: "Back to Team",
                    onClick: () => navigate("/users-list"),
                }}
            />
        );
    }

    return (
        <div className="space-y-6">
            <PageHeader
                title={isOwnProfile ? "My Profile" : `${user.firstName} ${user.lastName}`}
                description={user.designation || user.role.displayName || "User profile, credentials, and employment details."}
                breadcrumbs={[
                    { label: "Team", href: "/users-list" },
                    { label: isOwnProfile ? "My Profile" : `${user.firstName} ${user.lastName}` },
                ]}
                actions={
                    <div className="flex items-center gap-2">
                        {!isOwnProfile && (
                            <Button variant="outline" size="sm" asChild>
                                <Link to="/users-list">
                                    <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
                                    Back to Team
                                </Link>
                            </Button>
                        )}
                        <Button size="sm" onClick={() => navigate(`/users-list/${user.id}/edit`)}>
                            <Edit className="w-3.5 h-3.5 mr-1.5" />
                            Edit Profile
                        </Button>
                    </div>
                }
            />

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                    className="col-span-12 lg:col-span-4 lg:sticky lg:top-20"
                >
                    <Card className="rounded-xl border border-border shadow-xs overflow-hidden">
                        <div className="h-20 shrink-0 bg-muted/60 border-b border-border/80 relative" />
                        <CardContent className="text-center px-6 pb-6">
                            <span className="flex items-center justify-center w-20 h-20 mx-auto -mt-10 rounded-full bg-card border-4 border-card shadow-sm text-primary text-2xl font-bold relative z-[1]">
                                {user.firstName[0]?.toUpperCase()}
                            </span>
                            <h3 className="mt-3 font-semibold text-base text-foreground truncate">
                                {user.firstName} {user.lastName}
                            </h3>
                            <p className="text-xs text-muted-foreground mb-3 truncate">{user.role.displayName}</p>
                            <StatusBadge status={user.status} />

                            <div className="text-left mt-5 space-y-2 pt-4 border-t border-border">
                                <InfoTile icon={Mail} label="Email" value={user.email} />
                                <InfoTile icon={Phone} label="Phone" value={user.phone ?? ""} />
                            </div>

                            {!isOwnProfile && (
                                <div className="mt-5 pt-4 border-t border-border">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="w-full text-xs text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/20"
                                        onClick={() => setConfirmDelete(true)}
                                    >
                                        <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                                        Delete User
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: 0.05, ease: "easeOut" }}
                    className="col-span-12 lg:col-span-8"
                >
                    <Tabs defaultValue="overview" className="w-full">
                        <TabsList className="h-9 p-1 bg-muted rounded-lg w-full sm:w-auto flex flex-wrap gap-1">
                            <TabsTrigger value="overview" className="text-xs px-3 py-1.5">Overview</TabsTrigger>
                            <TabsTrigger value="profile" className="text-xs px-3 py-1.5">Employee Profile</TabsTrigger>
                            <TabsTrigger value="bank" className="text-xs px-3 py-1.5">Bank Details</TabsTrigger>
                            <TabsTrigger value="skills" className="text-xs px-3 py-1.5">Skills</TabsTrigger>
                            <TabsTrigger value="documents" className="text-xs px-3 py-1.5">Documents</TabsTrigger>
                        </TabsList>

                        <TabsContent value="overview" className="space-y-5 mt-4">
                            <Card className="rounded-xl border border-border shadow-xs">
                                <CardHeader className="py-3 px-5 border-b border-border">
                                    <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                        Employment Information
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-5">
                                    <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
                                        <InfoTile icon={Shield} label="Role" value={user.role.displayName} />
                                        <InfoTile icon={Building2} label="Department" value={user.department ?? ""} />
                                        <InfoTile icon={Briefcase} label="Designation" value={user.designation ?? ""} />
                                        <InfoTile icon={Clock} label="Employment Type" value={user.employmentType?.replace("_", " ") ?? ""} />
                                        <InfoTile icon={CalendarCheck} label="Joining Date" value={user.joiningDate?.slice(0, 10) ?? ""} />
                                        <InfoTile icon={MapPin} label="Work Mode" value={user.isRemote ? "Remote" : "On-site"} />
                                        <InfoTile
                                            icon={History}
                                            label="Last Login"
                                            value={user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : "Never"}
                                        />
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="rounded-xl border border-border shadow-xs">
                                <CardHeader className="py-3 px-5 border-b border-border">
                                    <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                        Personal Information
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-5">
                                    <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
                                        <InfoTile icon={UserIcon} label="Gender" value={user.gender?.replace(/_/g, " ") ?? ""} />
                                        <InfoTile icon={Cake} label="Date of Birth" value={user.dateOfBirth?.slice(0, 10) ?? ""} />
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="profile" className="mt-4">
                            <Card className="rounded-xl border border-border shadow-xs">
                                <CardContent className="p-6">
                                    <EmployeeProfileForm user={user} onSaved={setUser} />
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="bank" className="mt-4">
                            <Card className="rounded-xl border border-border shadow-xs">
                                <CardContent className="p-6">
                                    <BankDetailForm user={user} onSaved={setUser} />
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="skills" className="mt-4">
                            <Card className="rounded-xl border border-border shadow-xs">
                                <CardContent className="p-6">
                                    <SkillsPanel user={user} onSaved={setUser} />
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="documents" className="mt-4">
                            <Card className="rounded-xl border border-border shadow-xs overflow-hidden">
                                <CardContent className="p-6">
                                    <DocumentsPanel userId={user.id} />
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>
                </motion.div>
            </div>

            <ConfirmDialog
                open={confirmDelete}
                onOpenChange={setConfirmDelete}
                title="Delete user"
                description={`Are you sure you want to delete ${user.firstName} ${user.lastName}? This action cannot be undone.`}
                isLoading={isDeleting}
                onConfirm={handleDelete}
            />
        </div>
    );
};

export default ViewProfile;
