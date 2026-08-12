import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface FormActionsProps {
    isSubmitting: boolean;
    submitLabel: string;
    onCancel?: () => void;
}

/** Sticks to the bottom of the viewport while a long form scrolls, so Save/Cancel stay reachable. */
const FormActions = ({ isSubmitting, submitLabel, onCancel }: FormActionsProps) => {
    const navigate = useNavigate();

    return (
        <div className="sticky bottom-0 -mx-6 mt-8 flex items-center justify-end gap-3 border-t border-border bg-card/95 backdrop-blur-sm px-6 py-4">
            <Button
                type="button"
                variant="outline"
                className="h-11 px-8 rounded-lg"
                onClick={onCancel ?? (() => navigate(-1))}
                disabled={isSubmitting}
            >
                Cancel
            </Button>
            <Button type="submit" className="h-11 px-8 rounded-lg" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="animate-spin h-4.5 w-4.5 mr-2" />}
                {submitLabel}
            </Button>
        </div>
    );
};

export default FormActions;
