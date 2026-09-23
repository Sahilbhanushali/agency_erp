import EmptyState from "@/components/shared/EmptyState";
import PageHeader from "@/components/shared/PageHeader";
import StatusBadge from "@/components/shared/StatusBadge";
import WorkspaceMembersTable from "@/components/tables/WorkspaceMembersTable";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api";
import TasksPanel from "@/pages/tasks/components/TasksPanel";
import type { Project } from "@/types/project";
import type { AddMemberPayload, Workspace, WorkspaceMember } from "@/types/workspace";
import { ArrowLeft, FolderKanban, Loader2, Pencil, Search, UserPlus, Users, X } from "lucide-react";
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
                member.user.email.toLowerCase().includes(query) ||
                (member.memberRole && member.memberRole.toLowerCase().includes(query))
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
            setShowAddPanel(false);
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
            setWorkspace((current) =>
                current ? { ...current, members: current.members.filter((m) => m.userId !== member.userId) } : current
            );
        } catch (error) {
            toast.error(error instanceof ApiError ? error.message : "Failed to remove member.");
        } finally {
            setRemovingId(null);
        }
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-24 space-y-3">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Loading workspace details...</p>
            </div>
        );
    }

    if (!workspace) {
        return (
            <EmptyState
                icon={FolderKanban}
                title="Workspace not found"
                description="The workspace you are looking for does not exist or has been deleted."
                action={{
                    label: "Back to Workspaces",
                    onClick: () => navigate("/workspaces-list"),
                }}
            />
        );
    }

    return (
        <div className="space-y-6">
            <PageHeader
                title={workspace.name}
                description={workspace.description || "Workspace overview, assigned team members, and task management."}
                breadcrumbs={[
                    { label: "Workspaces", href: "/workspaces-list" },
                    { label: workspace.name },
                ]}
                actions={
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" asChild>
                            <Link to="/workspaces-list">
                                <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
                                Back
                            </Link>
                        </Button>
                        <Button size="sm" asChild>
                            <Link to={`/workspaces-list/${workspace.id}/edit`}>
                                <Pencil className="w-3.5 h-3.5 mr-1.5" />
                                Edit Workspace
                            </Link>
                        </Button>
                    </div>
                }
            />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                {/* Workspace Info Card */}
                <Card className="lg:col-span-1 rounded-xl border border-border shadow-xs">
                    <CardHeader className="pb-3 border-b border-border">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <span
                                    className="w-3 h-3 rounded-full shrink-0 ring-2 ring-background"
                                    style={{ backgroundColor: workspace.colorHex ?? "var(--primary)" }}
                                />
                                <span className="font-semibold text-sm text-foreground">Workspace Info</span>
                            </div>
                            <StatusBadge status={workspace.isActive ? "ACTIVE" : "INACTIVE"} />
                        </div>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-4 text-xs">
                        {project && (
                            <div>
                                <span className="text-muted-foreground block text-[11px] mb-1 uppercase tracking-wide font-medium">
                                    Parent Project
                                </span>
                                <Link
                                    to={`/projects-list/${project.id}`}
                                    className="inline-flex items-center gap-2 font-medium text-foreground hover:text-primary transition-colors p-2 rounded-lg bg-muted/40 hover:bg-muted/70 w-full"
                                >
                                    <FolderKanban className="w-4 h-4 text-primary shrink-0" />
                                    <span className="truncate">{project.title}</span>
                                </Link>
                            </div>
                        )}

                        <div>
                            <span className="text-muted-foreground block text-[11px] mb-1 uppercase tracking-wide font-medium">
                                Description
                            </span>
                            <p className="text-muted-foreground leading-relaxed text-xs">
                                {workspace.description || "No description provided for this workspace."}
                            </p>
                        </div>

                        <div className="pt-2 border-t border-border flex items-center justify-between text-muted-foreground">
                            <span>Total Members</span>
                            <span className="font-mono font-medium text-foreground">{workspace.members.length}</span>
                        </div>
                    </CardContent>
                </Card>

                {/* Workspace Members Card */}
                <Card className="lg:col-span-2 rounded-xl border border-border shadow-xs overflow-hidden">
                    <CardHeader className="border-b border-border py-3 px-5 flex flex-row items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                                <Users className="w-4 h-4 text-muted-foreground" />
                                <span className="text-sm font-semibold text-foreground">Members</span>
                                <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-mono">
                                    {workspace.members.length}
                                </span>
                            </div>

                            <div className="relative">
                                <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                                <Input
                                    placeholder="Filter members..."
                                    value={search}
                                    onChange={(event) => setSearch(event.target.value)}
                                    className="ps-8 h-8 text-xs w-[170px] sm:w-[200px]"
                                />
                            </div>
                        </div>

                        <Button
                            size="sm"
                            variant={showAddPanel ? "secondary" : "outline"}
                            className="h-8 text-xs"
                            onClick={() => setShowAddPanel((current) => !current)}
                        >
                            {showAddPanel ? <X className="w-3.5 h-3.5 mr-1" /> : <UserPlus className="w-3.5 h-3.5 mr-1" />}
                            {showAddPanel ? "Cancel" : "Add Member"}
                        </Button>
                    </CardHeader>

                    <CardContent className="p-4 sm:p-5">
                        {showAddPanel && (
                            <div className="mb-4 pb-4 border-b border-border">
                                <span className="text-xs font-semibold text-foreground block mb-2">
                                    Add Member to Workspace
                                </span>
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
                            <div className="py-10 text-center">
                                <p className="text-xs text-muted-foreground">
                                    {workspace.members.length === 0
                                        ? "No members assigned yet. Use the 'Add Member' button above to assign team members."
                                        : "No members matched your search filter."}
                                </p>
                            </div>
                        ) : (
                            <WorkspaceMembersTable
                                members={filteredMembers}
                                onView={(member) => navigate(`/users-list/${member.userId}`)}
                                onRemove={handleRemoveMember}
                            />
                        )}

                        {removingId && (
                            <div className="flex items-center justify-center gap-2 pt-3 text-xs text-muted-foreground">
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span>Updating membership...</span>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Embedded Tasks Board */}
            <div className="pt-2">
                <div className="mb-4">
                    <h3 className="text-base font-semibold text-foreground tracking-tight">Workspace Task Board</h3>
                    <p className="text-xs text-muted-foreground">
                        Drag and drop tasks across pipeline columns to manage progress.
                    </p>
                </div>
                <TasksPanel
                    projectId={workspace.projectId}
                    workspaceId={workspace.id}
                    emptyText="No tasks on this workspace board yet."
                />
            </div>
        </div>
    );
};

export default WorkspaceDetails;
