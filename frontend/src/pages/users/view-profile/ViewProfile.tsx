import ConfirmDialog from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/context/AuthContext";
import Breadcrumb from "@/layouts/Breadcrumb";
import { api, ApiError } from "@/lib/api";
import type { User } from "@/types/user";
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
import EmployeeProfileForm from "../components/EmployeeProfileForm";
import SkillsPanel from "../components/SkillsPanel";

const STATUS_STYLES: Record<User["status"], string> = {
    ACTIVE: "bg-green-600/15 text-green-600 border-green-600",
    INACTIVE: "bg-gray-600/15 text-gray-600 dark:text-white border-gray-400",
    SUSPENDED: "bg-red-600/15 text-red-600 border-red-600",
    INVITED: "bg-yellow-500/15 text-yellow-600 border-yellow-500",
};

const InfoTile = ({ icon: Icon, label, value }: { icon: typeof Phone; label: string; value: string }) => (
    <div className="flex items-start gap-3 min-w-0">
        <span className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary shrink-0">
            <Icon className="w-5 h-5" />
        </span>
        <div className="min-w-0">
            <span className="block text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">{label}</span>
            <span className="block text-sm font-semibold text-neutral-900 dark:text-white truncate">{value || "—"}</span>
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
            <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
            </div>
        );
    }

    if (!user) {
        return <p className="text-center text-neutral-500 py-16">User not found.</p>;
    }

    return (
        <>
            <Breadcrumb title={isOwnProfile ? "My Profile" : "User Profile"} text={`${user.firstName} ${user.lastName}`} />

            {!isOwnProfile && (
                <Link
                    to="/users-list"
                    className="inline-flex items-center gap-2 text-sm font-medium text-neutral-600 hover:text-primary dark:text-neutral-300 dark:hover:text-primary mb-4"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Users
                </Link>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div className="col-span-12 lg:col-span-4">
                    <Card className="card !p-0 !gap-0 overflow-hidden">
                        <div className="h-[100px] shrink-0 bg-gradient-to-r from-primary to-primary/40" />
                        <CardContent className="text-center px-6 pb-6">
                            <span className="flex items-center justify-center w-24 h-24 mx-auto -mt-12 rounded-full bg-white dark:bg-slate-800 border-4 border-white dark:border-slate-800 shadow-sm text-primary text-3xl font-semibold relative z-[1]">
                                {user.firstName[0]?.toUpperCase()}
                            </span>
                            <h5 className="mt-4 mb-1 truncate">{user.firstName} {user.lastName}</h5>
                            <p className="text-neutral-500 dark:text-neutral-300 mb-3 truncate">{user.role.displayName}</p>
                            <span className={`inline-block px-3 py-1.5 rounded text-sm font-medium border ${STATUS_STYLES[user.status]}`}>
                                {user.status}
                            </span>

                            <div className="text-left mt-6 space-y-4">
                                <InfoTile icon={Mail} label="Email" value={user.email} />
                                <InfoTile icon={Phone} label="Phone" value={user.phone ?? ""} />
                            </div>

                            <div className="flex items-center gap-3 mt-6">
                                <Button className="flex-1 h-11 min-w-0" onClick={() => navigate(`/users-list/${user.id}/edit`)}>
                                    <Edit className="w-4 h-4 shrink-0" />
                                    <span className="truncate">Edit</span>
                                </Button>
                                {!isOwnProfile && (
                                    <Button variant="destructive" className="flex-1 h-11 min-w-0" onClick={() => setConfirmDelete(true)}>
                                        <Trash2 className="w-4 h-4 shrink-0" />
                                        <span className="truncate">Delete</span>
                                    </Button>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="col-span-12 lg:col-span-8">
                    <Tabs defaultValue="overview">
                        <TabsList>
                            <TabsTrigger value="overview">Overview</TabsTrigger>
                            <TabsTrigger value="profile">Employee Profile</TabsTrigger>
                            <TabsTrigger value="bank">Bank Details</TabsTrigger>
                            <TabsTrigger value="skills">Skills</TabsTrigger>
                        </TabsList>

                        <TabsContent value="overview" className="space-y-6 mt-4">
                            <Card className="card">
                                <CardHeader>
                                    <CardTitle className="text-base">Employment Information</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid sm:grid-cols-2 gap-x-6 gap-y-5">
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

                            <Card className="card">
                                <CardHeader>
                                    <CardTitle className="text-base">Personal Information</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid sm:grid-cols-2 gap-x-6 gap-y-5">
                                        <InfoTile icon={UserIcon} label="Gender" value={user.gender?.replace(/_/g, " ") ?? ""} />
                                        <InfoTile icon={Cake} label="Date of Birth" value={user.dateOfBirth?.slice(0, 10) ?? ""} />
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="profile" className="mt-4">
                            <Card className="card">
                                <CardContent>
                                    <EmployeeProfileForm user={user} onSaved={setUser} />
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="bank" className="mt-4">
                            <Card className="card">
                                <CardContent>
                                    <BankDetailForm user={user} onSaved={setUser} />
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="skills" className="mt-4">
                            <Card className="card">
                                <CardContent>
                                    <SkillsPanel user={user} onSaved={setUser} />
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>
                </div>
            </div>

            <ConfirmDialog
                open={confirmDelete}
                onOpenChange={setConfirmDelete}
                title="Delete user"
                description={`Are you sure you want to delete ${user.firstName} ${user.lastName}? This action cannot be undone.`}
                isLoading={isDeleting}
                onConfirm={handleDelete}
            />
        </>
    );
};

export default ViewProfile;
