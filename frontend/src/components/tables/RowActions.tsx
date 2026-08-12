import { Button } from "@/components/ui/button";
import { Edit, Eye, Trash2 } from "lucide-react";

interface RowActionsProps {
    label: string;
    onView?: () => void;
    onEdit: () => void;
    onDelete: () => void;
}

const iconButtonClass =
    "rounded-full transition-transform duration-150 hover:scale-110 active:scale-95";

/** Shared view/edit/delete icon-button cluster used by every list table. */
export default function RowActions({ label, onView, onEdit, onDelete }: RowActionsProps) {
    return (
        <div className="flex justify-center gap-2" onClick={(event) => event.stopPropagation()}>
            {onView && (
                <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`View ${label}`}
                    className={`${iconButtonClass} text-blue-500 bg-blue-500/10 hover:bg-blue-500/15`}
                    onClick={onView}
                >
                    <Eye className="w-4.5 h-4.5" />
                </Button>
            )}
            <Button
                size="icon"
                variant="ghost"
                aria-label={`Edit ${label}`}
                className={`${iconButtonClass} text-green-600 bg-green-600/10 hover:bg-green-600/15`}
                onClick={onEdit}
            >
                <Edit className="w-4.5 h-4.5" />
            </Button>
            <Button
                size="icon"
                variant="ghost"
                aria-label={`Delete ${label}`}
                className={`${iconButtonClass} text-red-500 bg-red-500/10 hover:bg-red-500/15`}
                onClick={onDelete}
            >
                <Trash2 className="w-4.5 h-4.5" />
            </Button>
        </div>
    );
}
