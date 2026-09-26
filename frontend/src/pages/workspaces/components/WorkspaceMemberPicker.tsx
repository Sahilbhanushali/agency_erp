import Combobox from "@/components/shared/Combobox";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";
import type { MemberCompanyRole, WorkspaceMemberRole } from "@/types/workspace";
import { Loader2, Plus, Trash2, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";

interface MinimalUser {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role?: MemberCompanyRole | null;
}

export interface PickedMember {
    userId: string;
    label: string;
    memberRole?: WorkspaceMemberRole;
    /** The user's company role, shown for context — it is not what gets saved. */
    companyRole?: string;
}

interface WorkspaceMemberPickerProps {
    companyId?: string;
    excludeUserIds: string[];
    members: PickedMember[];
    onAdd: (member: PickedMember) => void;
    onRemove: (userId: string) => void;
    isBusy?: boolean;
    /** Hide the picker's own pending-members list — set false when the caller already renders the real member list elsewhere. */
    showList?: boolean;
}

/** What the member does on this board. Their company role comes from their user account. */
const WORKSPACE_ROLES: { value: WorkspaceMemberRole; label: string; hint: string }[] = [
    { value: "LEAD", label: "Lead", hint: "Runs the board" },
    { value: "MEMBER", label: "Member", hint: "Works on tasks" },
    { value: "VIEWER", label: "Viewer", hint: "Read-only" },
];

/**
 * Inline (non-modal) member picker — deliberately not a Combobox-in-Dialog, since Radix's
 * Dialog focus trap steals focus from a nested Popover before a click can register.
 */
const WorkspaceMemberPicker = ({ companyId, excludeUserIds, members, onAdd, onRemove, isBusy, showList = true }: WorkspaceMemberPickerProps) => {
    const [companyUsers, setCompanyUsers] = useState<MinimalUser[]>([]);
    const [selectedUserId, setSelectedUserId] = useState("");
    const [memberRole, setMemberRole] = useState<WorkspaceMemberRole>("MEMBER");
    const [usersUnavailable, setUsersUnavailable] = useState(false);

    useEffect(() => {
        if (!companyId) {
            setCompanyUsers([]);
            return;
        }
        api
            .list<MinimalUser>(`/users?companyId=${companyId}`)
            .then((list) => {
                setCompanyUsers(list);
                setUsersUnavailable(false);
            })
            .catch(() => {
                setCompanyUsers([]);
                setUsersUnavailable(true);
                toast.error("Could not load users — you may not have permission to list them.");
            });
    }, [companyId]);

    const availableUsers = companyUsers.filter((user) => !excludeUserIds.includes(user.id));

    const userPlaceholder = () => {
        if (!companyId) return "Select a company first";
        if (usersUnavailable) return "Users unavailable (needs users:read)";
        if (companyUsers.length === 0) return "No users in this company";
        if (availableUsers.length === 0) return "Everyone is already a member";
        return "Select a user";
    };

    const handleAdd = () => {
        const user = availableUsers.find((candidate) => candidate.id === selectedUserId);
        if (!user) return;
        onAdd({
            userId: user.id,
            label: `${user.firstName} ${user.lastName}`,
            memberRole,
            companyRole: user.role?.displayName,
        });
        setSelectedUserId("");
        setMemberRole("MEMBER");
    };

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-end gap-2">
                <div className="w-full sm:w-[260px]">
                    <label htmlFor="workspace-member-user" className="block text-xs font-medium text-muted-foreground mb-1.5">
                        User
                    </label>
                    <Combobox
                        id="workspace-member-user"
                        value={selectedUserId}
                        onChange={setSelectedUserId}
                        disabled={!companyId || !availableUsers.length}
                        visibleCount={8}
                        options={availableUsers.map((user) => ({
                            value: user.id,
                            label: user.role
                                ? `${user.firstName} ${user.lastName} · ${user.role.displayName}`
                                : `${user.firstName} ${user.lastName}`,
                        }))}
                        placeholder={userPlaceholder()}
                        searchPlaceholder="Search by name or role..."
                        emptyText="No users found."
                        createLabel="Go invite a user"
                        createHref="/users-list/create"
                    />
                </div>

                <div className="w-full sm:w-[180px]">
                    <label htmlFor="workspace-member-role" className="block text-xs font-medium text-muted-foreground mb-1.5">
                        Workspace role
                    </label>
                    <Select value={memberRole} onValueChange={(value) => setMemberRole(value as WorkspaceMemberRole)}>
                        <SelectTrigger id="workspace-member-role" className="h-9 text-xs rounded-lg !w-full">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {WORKSPACE_ROLES.map((role) => (
                                <SelectItem key={role.value} value={role.value}>
                                    <span className="flex items-baseline gap-2">
                                        {role.label}
                                        <span className="text-[11px] text-muted-foreground">{role.hint}</span>
                                    </span>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <Button type="button" size="sm" className="h-9 rounded-lg shrink-0 text-xs" onClick={handleAdd} disabled={!selectedUserId || isBusy}>
                    {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Plus className="w-3.5 h-3.5 mr-1.5" />}
                    Add Member
                </Button>
            </div>

            {showList && (
                members.length === 0 ? (
                    <p className="text-sm text-neutral-400 flex items-center gap-2">
                        <UserPlus className="w-4 h-4" />
                        No members added yet.
                    </p>
                ) : (
                    <ul className="divide-y divide-border rounded-lg border border-border">
                        {members.map((member) => (
                            <li key={member.userId} className="flex items-center justify-between px-3 py-2">
                                <div className="min-w-0">
                                    <p className="text-sm font-medium text-neutral-900 dark:text-white truncate">{member.label}</p>
                                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                                        {WORKSPACE_ROLES.find((role) => role.value === member.memberRole)?.label ?? "Member"}
                                        {member.companyRole ? ` · ${member.companyRole}` : ""}
                                    </p>
                                </div>
                                <Button
                                    type="button"
                                    size="icon-sm"
                                    variant="ghost"
                                    aria-label={`Remove ${member.label}`}
                                    className="text-destructive shrink-0"
                                    onClick={() => onRemove(member.userId)}
                                    disabled={isBusy}
                                >
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </li>
                        ))}
                    </ul>
                )
            )}
        </div>
    );
};

export default WorkspaceMemberPicker;
