import ConfirmDialog from "@/components/shared/ConfirmDialog";
import DocumentsTable from "@/components/tables/DocumentsTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api";
import type { EmployeeDocument } from "@/types/user";
import { Loader2, Plus, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import UploadDocumentDialog from "./UploadDocumentDialog";

interface DocumentsPanelProps {
    userId: string;
}

const DocumentsPanel = ({ userId }: DocumentsPanelProps) => {
    const [documents, setDocuments] = useState<EmployeeDocument[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [formOpen, setFormOpen] = useState(false);
    const [documentToDelete, setDocumentToDelete] = useState<EmployeeDocument | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        api
            .get<EmployeeDocument[]>(`/users/${userId}/documents`)
            .then(setDocuments)
            .catch((error) => toast.error(error instanceof ApiError ? error.message : "Failed to load documents."))
            .finally(() => setIsLoading(false));
    }, [userId]);

    const filteredDocuments = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) return documents;
        return documents.filter((document) => document.name.toLowerCase().includes(query));
    }, [documents, search]);

    const handleDownload = async (document: EmployeeDocument) => {
        try {
            await api.download(`/users/${userId}/documents/${document.id}/download`, document.file.originalName);
        } catch (error) {
            toast.error(error instanceof ApiError ? error.message : "Failed to download document.");
        }
    };

    const handleDelete = async () => {
        if (!documentToDelete) return;
        setIsDeleting(true);
        try {
            await api.delete(`/users/${userId}/documents/${documentToDelete.id}`);
            toast.success("Document deleted.");
            setDocuments((current) => current.filter((document) => document.id !== documentToDelete.id));
            setDocumentToDelete(null);
        } catch (error) {
            toast.error(error instanceof ApiError ? error.message : "Failed to delete document.");
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center flex-wrap gap-3 justify-between">
                <div className="relative">
                    <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                    <Input
                        placeholder="Search documents..."
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        className="ps-9 h-10 w-[220px]"
                    />
                </div>
                <Button className="w-auto h-10" onClick={() => setFormOpen(true)}>
                    <Plus className="w-4 h-4" />
                    Upload Document
                </Button>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
                </div>
            ) : filteredDocuments.length === 0 ? (
                <p className="text-center text-neutral-500 dark:text-neutral-300 py-16">
                    {documents.length === 0 ? "No documents yet. Upload the first one." : "No documents match your search."}
                </p>
            ) : (
                <DocumentsTable documents={filteredDocuments} onDownload={handleDownload} onDelete={setDocumentToDelete} />
            )}

            <UploadDocumentDialog
                open={formOpen}
                onOpenChange={setFormOpen}
                userId={userId}
                onUploaded={(document) => setDocuments((current) => [document, ...current])}
            />

            <ConfirmDialog
                open={!!documentToDelete}
                onOpenChange={(open) => !open && setDocumentToDelete(null)}
                title="Delete document"
                description={`Are you sure you want to delete ${documentToDelete?.name}? This action cannot be undone.`}
                isLoading={isDeleting}
                onConfirm={handleDelete}
            />
        </div>
    );
};

export default DocumentsPanel;
