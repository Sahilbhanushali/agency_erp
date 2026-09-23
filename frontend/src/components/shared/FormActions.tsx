import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface FormActionsProps {
  isSubmitting: boolean;
  submitLabel: string;
  onCancel?: () => void;
}

/** Sticky bottom actions bar with backdrop blur and responsive layout */
export default function FormActions({
  isSubmitting,
  submitLabel,
  onCancel,
}: FormActionsProps) {
  const navigate = useNavigate();

  return (
    <div className="sticky bottom-0 -mx-6 mt-8 flex items-center justify-end gap-3 border-t border-border bg-card/90 backdrop-blur-md px-6 py-3.5 z-10 shadow-xs">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-9 px-4 rounded-lg text-xs"
        onClick={onCancel ?? (() => navigate(-1))}
        disabled={isSubmitting}
      >
        Cancel
      </Button>
      <Button
        type="submit"
        size="sm"
        className="h-9 px-5 rounded-lg text-xs font-medium shadow-xs"
        disabled={isSubmitting}
      >
        {isSubmitting && <Loader2 className="animate-spin h-3.5 w-3.5 mr-1.5" />}
        {submitLabel}
      </Button>
    </div>
  );
}
