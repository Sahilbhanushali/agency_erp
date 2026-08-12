import Combobox from "@/components/shared/Combobox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { Loader2, Plus, Trash2, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";

interface MinimalUser {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
}

export interface PickedMember {
    userId: string;
    label: string;
    memberRole?: string;
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

/**
 * Inline (non-modal) member picker — deliberately not a Combobox-in-Dialog, since Radix's
 * Dialog focus trap steals focus from a nested Popover before a click can register.
 */
const WorkspaceMemberPicker = ({ companyId, excludeUserIds, members, onAdd, onRemove, isBusy, showList = true }: WorkspaceMemberPickerProps) => {
    const [companyUsers, setCompanyUsers] = useState<MinimalUser[]>([]);
    const [selectedUserId, setSelectedUserId] = useState("");
    const [memberRole, setMemberRole] = useState("");

    useEffect(() => {
        if (!companyId) {
            setCompanyUsers([]);
            return;
        }
        api.get<MinimalUser[]>(`/users?companyId=${companyId}`).then(setCompanyUsers).catch(() => toast.error("Failed to load users."));
    }, [companyId]);

    const availableUsers = companyUsers.filter((user) => !excludeUserIds.includes(user.id));

    const handleAdd = () => {
        const user = availableUsers.find((candidate) => candidate.id === selectedUserId);
        if (!user) return;
        onAdd({ userId: user.id, label: `${user.firstName} ${user.lastName}`, memberRole: memberRole.trim() || undefined });
        setSelectedUserId("");
        setMemberRole("");
    };

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
                <div className="w-full sm:w-[220px]">
                    <Combobox
                        value={selectedUserId}
                        onChange={setSelectedUserId}
                        disabled={!companyId || !availableUsers.length}
                        options={availableUsers.map((user) => ({ value: user.id, label: `${user.firstName} ${user.lastName}` }))}
                        placeholder={companyId ? "Select a user" : "Select a company first"}
                        searchPlaceholder="Search users..."
                        emptyText="No users found."
                        createLabel="Go invite a user"
                        createHref="/users-list/create"
                    />
                </div>
                <Input
                    placeholder="Role label (optional)"
                    value={memberRole}
                    onChange={(event) => setMemberRole(event.target.value)}
                    className="h-11 rounded-lg w-full sm:w-[180px]"
                />
                <Button type="button" className="h-11 rounded-lg shrink-0" onClick={handleAdd} disabled={!selectedUserId || isBusy}>
                    {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    Add
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
                                    {member.memberRole && <p className="text-xs text-neutral-500 dark:text-neutral-400">{member.memberRole}</p>}
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
