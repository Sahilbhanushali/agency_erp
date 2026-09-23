import { Button } from "@/components/ui/button";
import { fileToDataUrl } from "@/lib/image";
import { Loader2, Upload, X, type LucideIcon } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "react-toastify";

interface ImageUploadButtonProps {
    label: string;
    icon: LucideIcon;
    value?: string;
    onChange: (dataUrl: string | undefined) => void;
}

const MAX_SIZE_BYTES = 2 * 1024 * 1024;

const ImageUploadButton = ({ label, icon: Icon, value, onChange }: ImageUploadButtonProps) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const [isReading, setIsReading] = useState(false);

    const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        if (file.size > MAX_SIZE_BYTES) {
            toast.error("Image must be under 2MB.");
            event.target.value = "";
            return;
        }
        setIsReading(true);
        try {
            onChange(await fileToDataUrl(file));
        } catch {
            toast.error("Failed to read image.");
        } finally {
            setIsReading(false);
            event.target.value = "";
        }
    };

    return (
        <div className="flex items-center gap-2">
            <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
            {value ? (
                <div className="flex items-center gap-2 border border-border rounded-lg p-1.5 pr-2">
                    <img src={value} alt={label} className="h-8 w-auto max-w-[100px] object-contain rounded" />
                    <button type="button" aria-label={`Remove ${label}`} className="text-neutral-400 hover:text-destructive" onClick={() => onChange(undefined)}>
                        <X className="w-4 h-4" />
                    </button>
                </div>
            ) : (
                <Button type="button" size="sm" variant="outline" className="h-9 rounded-lg" onClick={() => inputRef.current?.click()} disabled={isReading}>
                    {isReading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Icon className="w-3.5 h-3.5" />}
                    {label}
                </Button>
            )}
            {value && (
                <Button type="button" size="sm" variant="ghost" className="h-9" onClick={() => inputRef.current?.click()}>
                    <Upload className="w-3.5 h-3.5" />
                    Replace
                </Button>
            )}
        </div>
    );
};

export default ImageUploadButton;
