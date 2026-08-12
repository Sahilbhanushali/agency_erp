import WorkspaceMembersTable from "@/components/tables/WorkspaceMembersTable";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import Breadcrumb from "@/layouts/Breadcrumb";
import { api, ApiError } from "@/lib/api";
import type { AddMemberPayload } from "@/types/workspace";
import type { Project } from "@/types/project";
import type { Workspace, WorkspaceMember } from "@/types/workspace";
import { FolderKanban, Loader2, Pencil, Search, UserPlus, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import WorkspaceMemberPicker, { type PickedMember } from "../components/WorkspaceMemberPicker";

const WorkspaceDetails = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const [workspace, setWorkspace] = useState<Workspace | null>(null);
    const [project, setProject] = useState<Project | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const [search, setSearch] = useState("");
    const [showAddPanel, setShowAddPanel] = useState(false);
    const [isAddingMember, setIsAddingMember] = useState(false);
    const [removingId, setRemovingId] = useState<string | null>(null);

    useEffect(() => {
        if (!id) return;
        api
            .get<Workspace>(`/workspaces/${id}`)
            .then((data) => {
                setWorkspace(data);
                api.get<Project>(`/projects/${data.projectId}`).then(setProject).catch(() => undefined);
            })
            .catch((error) => toast.error(error instanceof ApiError ? error.message : "Failed to load workspace."))
            .finally(() => setIsLoading(false));
    }, [id]);

    const filteredMembers = useMemo(() => {
        if (!workspace) return [];
        const query = search.trim().toLowerCase();
        if (!query) return workspace.members;
        return workspace.members.filter(
            (member) =>
                `${member.user.firstName} ${member.user.lastName}`.toLowerCase().includes(query) ||
                member.user.email.toLowerCase().includes(query),
        );
    }, [workspace, search]);

    const handleAddMember = async (picked: PickedMember) => {
        if (!workspace) return;
        setIsAddingMember(true);
        try {
            const payload: AddMemberPayload = { userId: picked.userId, memberRole: picked.memberRole };
            const member = await api.post<WorkspaceMember>(`/workspaces/${workspace.id}/members`, payload);
            toast.success("Member added.");
            setWorkspace((current) => (current ? { ...current, members: [...current.members, member] } : current));
        } catch (error) {
            toast.error(error instanceof ApiError ? error.message : "Failed to add member.");
        } finally {
            setIsAddingMember(false);
        }
    };

    const handleRemoveMember = async (member: WorkspaceMember) => {
        if (!workspace) return;
        setRemovingId(member.userId);
        try {
            await api.delete(`/workspaces/${workspace.id}/members/${member.userId}`);
            toast.success("Member removed.");
            setWorkspace((current) => (current ? { ...current, members: current.members.filter((m) => m.userId !== member.userId) } : current));
        } catch (error) {
            toast.error(error instanceof ApiError ? error.message : "Failed to remove member.");
        } finally {
            setRemovingId(null);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-24">
                <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
            </div>
        );
    }

    if (!workspace) {
        return <p className="text-center text-neutral-500 py-24">Workspace not found.</p>;
    }

    return (
        <>
            <Breadcrumb title={workspace.name} text="Workspace Details" />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                <Card className="lg:col-span-1 h-fit">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: workspace.colorHex ?? "#94a3b8" }} />
                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${workspace.isActive ? "bg-success/15 text-success border-success/30" : "bg-neutral-500/15 text-neutral-500 dark:text-neutral-300 border-neutral-400/30"}`}>
                                {workspace.isActive ? "ACTIVE" : "INACTIVE"}
                            </span>
                        </div>
                        <Button variant="outline" size="sm" className="h-9 rounded-lg" asChild>
                            <Link to={`/workspaces-list/${workspace.id}/edit`}>
                                <Pencil className="w-3.5 h-3.5" />
                                Edit
                            </Link>
                        </Button>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                        {project && (
                            <Link
                                to={`/projects-list/${project.id}`}
                                className="flex items-center gap-2.5 text-primary hover:underline"
                            >
                                <FolderKanban className="w-4 h-4 shrink-0" />
                                <span>{project.title}</span>
                            </Link>
                        )}
                        {workspace.description && (
                            <p className="text-neutral-500 dark:text-neutral-400 pt-1 border-t border-border mt-3">
                                {workspace.description}
                            </p>
                        )}
                    </CardContent>
                </Card>

                <Card className="lg:col-span-2 !p-0 !block border-0 overflow-hidden">
                    <CardHeader className="border-b border-border !py-4 px-6 flex items-center flex-wrap gap-3 justify-between">
                        <div className="flex items-center flex-wrap gap-3">
                            <h6 className="text-base font-semibold text-neutral-900 dark:text-white shrink-0">
                                Members ({workspace.members.length})
                            </h6>
                            <div className="relative">
                                <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                                <Input
                                    placeholder="Search members..."
                                    value={search}
                                    onChange={(event) => setSearch(event.target.value)}
                                    className="ps-9 h-10 w-[200px]"
                                />
                            </div>
                        </div>

                        <Button className="w-auto h-10" variant={showAddPanel ? "outline" : "default"} onClick={() => setShowAddPanel((current) => !current)}>
                            {showAddPanel ? <X className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                            {showAddPanel ? "Close" : "Add Member"}
                        </Button>
                    </CardHeader>

                    <CardContent className="p-6">
                        {showAddPanel && (
                            <div className="mb-6 pb-6 border-b border-border">
                                <WorkspaceMemberPicker
                                    companyId={workspace.companyId}
                                    excludeUserIds={workspace.members.map((member) => member.userId)}
                                    members={[]}
                                    onAdd={handleAddMember}
                                    onRemove={() => undefined}
                                    isBusy={isAddingMember}
                                    showList={false}
                                />
                            </div>
                        )}
                        {filteredMembers.length === 0 ? (
                            <p className="text-center text-neutral-500 dark:text-neutral-300 py-16">
                                {workspace.members.length === 0 ? "No members yet. Add the first one." : "No members match your search."}
                            </p>
                        ) : (
                            <WorkspaceMembersTable
                                members={filteredMembers}
                                onView={(member) => navigate(`/users-list/${member.userId}`)}
                                onRemove={handleRemoveMember}
                            />
                        )}
                        {removingId && (
                            <div className="flex justify-center pt-4">
                                <Loader2 className="w-4 h-4 animate-spin text-neutral-400" />
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </>
    );
};

export default WorkspaceDetails;
