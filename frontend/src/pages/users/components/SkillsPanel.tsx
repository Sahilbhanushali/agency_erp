import ConfirmDialog from "@/components/shared/ConfirmDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, ApiError } from "@/lib/api";
import type { EmployeeSkillPayload, User } from "@/types/user";
import { Loader2, Plus, X } from "lucide-react";
import { useState } from "react";
import { toast } from "react-toastify";

interface SkillsPanelProps {
    user: User;
    onSaved: (user: User) => void;
}

const SkillsPanel = ({ user, onSaved }: SkillsPanelProps) => {
    const skills = user.employeeProfile?.skills ?? [];
    const hasProfile = !!user.employeeProfile;
    const [name, setName] = useState("");
    const [proficiency, setProficiency] = useState<string>("");
    const [isAdding, setIsAdding] = useState(false);
    const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const refresh = async () => {
        const updatedUser = await api.get<User>(`/users/${user.id}`);
        onSaved(updatedUser);
    };

    const handleAdd = async () => {
        if (!name.trim()) return;
        setIsAdding(true);
        const payload: EmployeeSkillPayload = {
            name: name.trim(),
            proficiency: proficiency ? Number(proficiency) : undefined,
        };
        try {
            await api.post(`/users/${user.id}/skills`, payload);
            setName("");
            setProficiency("");
            await refresh();
            toast.success("Skill added.");
        } catch (error) {
            toast.error(error instanceof ApiError ? error.message : "Failed to add skill.");
        } finally {
            setIsAdding(false);
        }
    };

    const handleDelete = async () => {
        if (!pendingDeleteId) return;
        setIsDeleting(true);
        try {
            await api.delete(`/users/${user.id}/skills/${pendingDeleteId}`);
            await refresh();
            toast.success("Skill removed.");
        } catch (error) {
            toast.error(error instanceof ApiError ? error.message : "Failed to remove skill.");
        } finally {
            setIsDeleting(false);
            setPendingDeleteId(null);
        }
    };

    if (!hasProfile) {
        return (
            <p className="text-sm text-neutral-500 dark:text-neutral-400 py-8 text-center">
                Save the employee profile first before adding skills.
            </p>
        );
    }

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px_auto] gap-4 items-end">
                <Field>
                    <FieldLabel htmlFor="skill-name">Skill</FieldLabel>
                    <Input
                        id="skill-name"
                        className="h-11 rounded-lg"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        placeholder="e.g. Meta Ads"
                    />
                </Field>

                <Field>
                    <FieldLabel htmlFor="skill-proficiency">Proficiency</FieldLabel>
                    <Select value={proficiency} onValueChange={setProficiency}>
                        <SelectTrigger id="skill-proficiency" className="h-11 rounded-lg !w-full">
                            <SelectValue placeholder="1-5" />
                        </SelectTrigger>
                        <SelectContent>
                            {[1, 2, 3, 4, 5].map((level) => (
                                <SelectItem key={level} value={String(level)}>
                                    {level}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </Field>

                <Button type="button" className="h-11 rounded-lg" onClick={handleAdd} disabled={isAdding || !name.trim()}>
                    {isAdding ? <Loader2 className="animate-spin h-4 w-4" /> : <Plus className="h-4 w-4" />}
                    Add Skill
                </Button>
            </div>

            <div className="flex flex-wrap gap-2">
                {skills.length === 0 && <p className="text-sm text-neutral-500 dark:text-neutral-400">No skills added yet.</p>}
                {skills.map((skill) => (
                    <Badge key={skill.id} variant="secondary" className="h-9 pl-3 pr-1.5 rounded-lg text-sm gap-2">
                        {skill.name}
                        {skill.proficiency && <span className="text-neutral-400">· {skill.proficiency}/5</span>}
                        <button
                            type="button"
                            aria-label={`Remove ${skill.name}`}
                            className="ml-1 rounded-full p-0.5 hover:bg-neutral-200 dark:hover:bg-slate-700 cursor-pointer"
                            onClick={() => setPendingDeleteId(skill.id)}
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                    </Badge>
                ))}
            </div>

            <ConfirmDialog
                open={!!pendingDeleteId}
                onOpenChange={(open) => !open && setPendingDeleteId(null)}
                title="Remove skill"
                description="Are you sure you want to remove this skill?"
                isLoading={isDeleting}
                onConfirm={handleDelete}
            />
        </div>
    );
};

export default SkillsPanel;
