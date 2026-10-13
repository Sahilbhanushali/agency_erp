"use client";

import React, { useState, useRef, useCallback, useMemo } from "react";
import useSWR from "swr";
import { toast } from "react-hot-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FileText,
  Upload,
  Download,
  Eye,
  Trash2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Folder,
  Shield,
  GraduationCap,
  Briefcase,
  Landmark,
  FileSignature,
  Plus,
  Search,
  ExternalLink,
  X,
  FileCheck2,
  ChevronRight,
  Sparkles,
} from "lucide-react";

export interface HrDocument {
  id: string;
  userId: number;
  title: string;
  category: "IDENTITY" | "EDUCATION" | "EMPLOYMENT" | "BANK_TAX" | "CONTRACTS" | "OTHER" | string;
  fileUrl: string;
  fileName: string;
  fileSize?: number;
  fileType?: string;
  status: "PENDING" | "VERIFIED" | "REJECTED" | "EXPIRED";
  expiryDate?: string | null;
  notes?: string | null;
  uploadedAt: string;
  uploadedBy?: { id: number; name: string; email: string } | null;
  verifiedAt?: string | null;
  verifiedBy?: { id: number; name: string; email: string } | null;
  rejectionReason?: string | null;
}

interface HrUser {
  id: string | number;
  name: string;
  email: string;
  role?: string | { id?: number; name?: string } | null;
  avatar?: string | null;
  designation?: string | null;
  department?: string | null;
}

interface HrDocumentsModalProps {
  userId: string | number | null;
  isOpen: boolean;
  onClose: () => void;
  user?: HrUser | null;
  onUpdate?: () => void;
}

const CATEGORIES = [
  { id: "ALL", label: "All Documents", icon: Folder },
  { id: "IDENTITY", label: "Identity Proofs", icon: Shield, desc: "Aadhaar, PAN, Passport, Driving License" },
  { id: "EDUCATION", label: "Education", icon: GraduationCap, desc: "Degrees, Transcripts, Certifications" },
  { id: "EMPLOYMENT", label: "Employment", icon: Briefcase, desc: "Offer Letters, Relieving, Resumes" },
  { id: "BANK_TAX", label: "Bank & Tax", icon: Landmark, desc: "Cancelled Cheques, Bank Statements, Form 16" },
  { id: "CONTRACTS", label: "Contracts", icon: FileSignature, desc: "Employment Agreements, NDAs, Service Bonds" },
  { id: "OTHER", label: "Other", icon: FileText, desc: "Miscellaneous records and receipts" },
] as const;

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
const ALLOWED_EXTENSIONS = [".pdf", ".png", ".jpg", ".jpeg", ".webp", ".doc", ".docx"];

function formatFileSize(bytes?: number): string {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "-";
  try {
    return new Date(dateStr).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function HrDocumentsModal({
  userId,
  isOpen,
  onClose,
  user: passedUser,
  onUpdate,
}: HrDocumentsModalProps) {
  // SWR fetches
  const { data: userData } = useSWR<HrUser>(
    isOpen && userId && !passedUser ? `/api/users/${userId}` : null,
    fetcher
  );
  const activeUser = passedUser || userData;

  const roleName = useMemo(() => {
    if (!activeUser?.role) return null;
    if (typeof activeUser.role === "string") return activeUser.role;
    if (typeof activeUser.role === "object" && activeUser.role !== null) {
      return (activeUser.role as { name?: string }).name || null;
    }
    return null;
  }, [activeUser?.role]);

  const {
    data: docsResponse,
    error: docsError,
    isLoading: docsLoading,
    mutate: mutateDocs,
  } = useSWR<{ documents: HrDocument[]; counts: Record<string, number> }>(
    isOpen && userId ? `/api/users/${userId}/documents` : null,
    fetcher
  );

  const documents = docsResponse?.documents || [];
  const counts = docsResponse?.counts || {
    ALL: documents.length,
    IDENTITY: 0,
    EDUCATION: 0,
    EMPLOYMENT: 0,
    BANK_TAX: 0,
    CONTRACTS: 0,
    OTHER: 0,
  };

  // State
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Upload Box State
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadCategory, setUploadCategory] = useState<string>("IDENTITY");
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadExpiry, setUploadExpiry] = useState("");
  const [uploadNotes, setUploadNotes] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Preview Lightbox State
  const [previewDoc, setPreviewDoc] = useState<HrDocument | null>(null);

  // Rejection Reason Modal State
  const [rejectingDoc, setRejectingDoc] = useState<HrDocument | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [isSubmittingReject, setIsSubmittingReject] = useState(false);

  // Replace Document Modal State
  const [replacingDoc, setReplacingDoc] = useState<HrDocument | null>(null);
  const [replaceFile, setReplaceFile] = useState<File | null>(null);
  const [replaceExpiry, setReplaceExpiry] = useState("");
  const [replaceNotes, setReplaceNotes] = useState("");
  const [isSubmittingReplace, setIsSubmittingReplace] = useState(false);
  const replaceFileInputRef = useRef<HTMLInputElement>(null);

  // Delete Confirm State
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);

  // Filtered Documents
  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      // Category match
      if (selectedCategory !== "ALL" && doc.category !== selectedCategory) {
        return false;
      }
      // Status match
      if (statusFilter !== "ALL" && doc.status !== statusFilter) {
        return false;
      }
      // Search match
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const titleMatch = doc.title.toLowerCase().includes(q);
        const fileNameMatch = doc.fileName.toLowerCase().includes(q);
        const notesMatch = doc.notes?.toLowerCase().includes(q);
        const uploaderMatch = doc.uploadedBy?.name.toLowerCase().includes(q);
        if (!titleMatch && !fileNameMatch && !notesMatch && !uploaderMatch) {
          return false;
        }
      }
      return true;
    });
  }, [documents, selectedCategory, statusFilter, searchQuery]);

  // Drag and drop handlers
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const validateFiles = (files: File[]): boolean => {
    setValidationError(null);
    for (const f of files) {
      if (f.size > MAX_FILE_SIZE) {
        setValidationError(`"${f.name}" exceeds the 25MB limit (${formatFileSize(f.size)}).`);
        return false;
      }
      const ext = "." + f.name.split(".").pop()?.toLowerCase();
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        setValidationError(
          `"${f.name}" has an unsupported format. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}`
        );
        return false;
      }
    }
    return true;
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFiles = Array.from(e.dataTransfer.files);
      if (validateFiles(droppedFiles)) {
        setSelectedFiles((prev) => [...prev, ...droppedFiles]);
        setIsUploadOpen(true);
      }
    }
  }, []);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const pickedFiles = Array.from(e.target.files);
      if (validateFiles(pickedFiles)) {
        setSelectedFiles((prev) => [...prev, ...pickedFiles]);
      }
    }
  };

  const removeSelectedFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    if (selectedFiles.length <= 1) {
      setValidationError(null);
    }
  };

  // Upload Submission
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    if (selectedFiles.length === 0) {
      toast.error("Please select at least one document to upload.");
      return;
    }

    try {
      setUploadProgress(15);
      const formData = new FormData();
      formData.append("category", uploadCategory);
      if (uploadTitle) formData.append("title", uploadTitle);
      if (uploadExpiry) formData.append("expiryDate", uploadExpiry);
      if (uploadNotes) formData.append("notes", uploadNotes);

      selectedFiles.forEach((file) => {
        formData.append("files", file);
      });

      setUploadProgress(45);
      const res = await fetch(`/api/users/${userId}/documents`, {
        method: "POST",
        body: formData,
      });

      setUploadProgress(85);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to upload documents");
      }

      setUploadProgress(100);
      toast.success(
        selectedFiles.length === 1
          ? "Document uploaded successfully!"
          : `${selectedFiles.length} documents uploaded successfully!`
      );

      // Reset state
      setSelectedFiles([]);
      setUploadTitle("");
      setUploadExpiry("");
      setUploadNotes("");
      setUploadProgress(null);
      setIsUploadOpen(false);

      await mutateDocs();
      onUpdate?.();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to upload documents");
      setUploadProgress(null);
    }
  };

  // Document Actions: Verify
  const handleVerify = async (doc: HrDocument) => {
    if (!userId) return;
    try {
      const res = await fetch(`/api/users/${userId}/documents/${doc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "VERIFIED" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to verify document");

      toast.success(`"${doc.title}" verified successfully!`);
      mutateDocs();
      onUpdate?.();
    } catch (err: any) {
      toast.error(err.message || "Verification failed");
    }
  };

  // Document Actions: Reject
  const handleRejectSubmit = async () => {
    if (!userId || !rejectingDoc) return;
    if (!rejectionReason.trim()) {
      toast.error("Please provide a rejection reason.");
      return;
    }

    try {
      setIsSubmittingReject(true);
      const res = await fetch(`/api/users/${userId}/documents/${rejectingDoc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "REJECTED",
          rejectionReason: rejectionReason.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reject document");

      toast.success(`"${rejectingDoc.title}" marked as rejected.`);
      setRejectingDoc(null);
      setRejectionReason("");
      mutateDocs();
      onUpdate?.();
    } catch (err: any) {
      toast.error(err.message || "Rejection failed");
    } finally {
      setIsSubmittingReject(false);
    }
  };

  // Document Actions: Replace File
  const handleReplaceSubmit = async () => {
    if (!userId || !replacingDoc) return;
    if (!replaceFile) {
      toast.error("Please select a replacement file.");
      return;
    }

    try {
      setIsSubmittingReplace(true);
      const formData = new FormData();
      formData.append("file", replaceFile);
      if (replaceExpiry) formData.append("expiryDate", replaceExpiry);
      if (replaceNotes) formData.append("notes", replaceNotes);

      const res = await fetch(`/api/users/${userId}/documents/${replacingDoc.id}`, {
        method: "PATCH",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to replace document file");

      toast.success(`"${replacingDoc.title}" updated with new file.`);
      setReplacingDoc(null);
      setReplaceFile(null);
      setReplaceExpiry("");
      setReplaceNotes("");
      mutateDocs();
      onUpdate?.();
    } catch (err: any) {
      toast.error(err.message || "File replacement failed");
    } finally {
      setIsSubmittingReplace(false);
    }
  };

  // Document Actions: Delete
  const handleDelete = async (docId: string) => {
    if (!userId) return;
    try {
      const res = await fetch(`/api/users/${userId}/documents/${docId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete document");

      toast.success("Document deleted permanently.");
      setDeletingDocId(null);
      mutateDocs();
      onUpdate?.();
    } catch (err: any) {
      toast.error(err.message || "Deletion failed");
    }
  };

  // Quick preset reasons for rejection
  const PRESET_REASONS = [
    "Document image is blurry or illegible",
    "Document has expired / Invalid validity date",
    "Incomplete document pages / Missing back side",
    "Document name does not match user profile",
    "Missing required official stamp / signature",
  ];

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="w-full max-w-5xl h-[92vh] max-h-[92vh] p-0 flex flex-col gap-0 rounded-2xl overflow-hidden border border-border/80 bg-background shadow-2xl"
      >
        {/* Sticky Header with Employee Info */}
        <div className="shrink-0 bg-card/95 backdrop-blur-md border-b border-border/80 px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <Avatar className="size-11 border-2 border-primary/20 shadow-xs">
              <AvatarImage src={activeUser?.avatar || "/placeholder.svg"} />
              <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm">
                {activeUser?.name?.charAt(0).toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-foreground truncate">
                  {activeUser?.name || "Employee"}
                </h2>
                {roleName && (
                  <Badge variant="outline" className="text-[10px] uppercase font-mono tracking-wider py-0 px-1.5">
                    {roleName}
                  </Badge>
                )}
                {activeUser?.designation && (
                  <span className="text-xs text-muted-foreground hidden md:inline">
                    • {activeUser.designation}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate">
                {activeUser?.email}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <Button
              variant={isUploadOpen ? "secondary" : "default"}
              size="sm"
              onClick={() => {
                setIsUploadOpen(!isUploadOpen);
                if (!isUploadOpen && selectedCategory !== "ALL") {
                  setUploadCategory(selectedCategory);
                }
              }}
              className="gap-1.5 shadow-2xs font-medium text-xs"
            >
              {isUploadOpen ? (
                <>
                  <X className="size-3.5" /> Close Upload
                </>
              ) : (
                <>
                  <Plus className="size-3.5" /> Upload Document
                </>
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="rounded-full size-8 text-muted-foreground hover:text-foreground"
              title="Close (Esc)"
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>

        {/* Collapsible / Floating Upload Panel */}
        {isUploadOpen && (
          <div className="shrink-0 bg-muted/30 border-b border-border/80 px-6 py-4 animate-in slide-in-from-top-2 duration-200">
            <form onSubmit={handleUploadSubmit} className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="size-6 rounded-md bg-primary/10 text-primary flex items-center justify-center">
                    <Upload className="size-3.5" />
                  </div>
                  <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                    Add New Documents to Vault
                  </h3>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => setIsUploadOpen(false)}
                  className="text-muted-foreground text-xs"
                >
                  Cancel
                </Button>
              </div>

              {/* Upload Drag & Drop Zone */}
              <div
                onDragEnter={handleDragEnter}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${
                  isDragging
                    ? "border-primary bg-primary/5 scale-[0.99]"
                    : "border-border hover:border-primary/50 hover:bg-muted/40"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept={ALLOWED_EXTENSIONS.join(",")}
                  onChange={handleFileInputChange}
                  className="hidden"
                />
                <div className="flex flex-col items-center justify-center gap-1.5">
                  <div className="size-10 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-1">
                    <Upload className="size-5" />
                  </div>
                  <p className="text-xs font-medium text-foreground">
                    <span className="text-primary hover:underline">Click to browse</span> or drag and drop files here
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Supports PDF, PNG, JPG, WEBP, DOC, DOCX up to 25MB each (multi-file supported)
                  </p>
                </div>
              </div>

              {/* Validation Error Alert */}
              {validationError && (
                <div className="p-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive flex items-center gap-2">
                  <AlertTriangle className="size-4 shrink-0" />
                  <span>{validationError}</span>
                </div>
              )}

              {/* Selected Files Chips */}
              {selectedFiles.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[11px] font-medium text-muted-foreground">
                    Ready to Upload ({selectedFiles.length} file{selectedFiles.length > 1 ? "s" : ""}):
                  </span>
                  <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto p-1">
                    {selectedFiles.map((file, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-1.5 bg-background border border-border/80 px-2.5 py-1 rounded-md text-xs text-foreground shadow-2xs"
                      >
                        <FileText className="size-3.5 text-primary shrink-0" />
                        <span className="truncate max-w-[160px] font-medium">{file.name}</span>
                        <span className="text-[10px] text-muted-foreground">
                          ({formatFileSize(file.size)})
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeSelectedFile(idx);
                          }}
                          className="text-muted-foreground hover:text-destructive ml-1"
                        >
                          <X className="size-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Form Metadata Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label htmlFor="upload-cat" className="text-xs font-medium">
                    Category *
                  </Label>
                  <Select value={uploadCategory} onValueChange={setUploadCategory}>
                    <SelectTrigger id="upload-cat" className="mt-1 h-8 text-xs bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.filter((c) => c.id !== "ALL").map((cat) => (
                        <SelectItem key={cat.id} value={cat.id} className="text-xs">
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="upload-title" className="text-xs font-medium">
                    Title / Custom Label (Optional)
                  </Label>
                  <Input
                    id="upload-title"
                    placeholder="e.g. Aadhaar Front & Back, Offer Letter 2024"
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                    className="mt-1 h-8 text-xs bg-background"
                  />
                </div>
                <div>
                  <Label htmlFor="upload-expiry" className="text-xs font-medium">
                    Expiry Date (if applicable)
                  </Label>
                  <Input
                    id="upload-expiry"
                    type="date"
                    value={uploadExpiry}
                    onChange={(e) => setUploadExpiry(e.target.value)}
                    className="mt-1 h-8 text-xs bg-background"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="upload-notes" className="text-xs font-medium">
                  Notes / Verification Remarks (Optional)
                </Label>
                <Input
                  id="upload-notes"
                  placeholder="e.g. Verified against original in person, Valid till 2029"
                  value={uploadNotes}
                  onChange={(e) => setUploadNotes(e.target.value)}
                  className="mt-1 h-8 text-xs bg-background"
                />
              </div>

              {/* Progress Bar */}
              {uploadProgress !== null && (
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-muted-foreground">
                    <span>Uploading...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <Progress value={uploadProgress} className="h-1.5" />
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={() => {
                    setSelectedFiles([]);
                    setIsUploadOpen(false);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="xs"
                  disabled={selectedFiles.length === 0 || uploadProgress !== null}
                  className="gap-1.5"
                >
                  <Upload className="size-3" />
                  {uploadProgress !== null
                    ? "Uploading..."
                    : `Upload ${selectedFiles.length > 0 ? `(${selectedFiles.length})` : ""}`}
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* Category Tabs & Quick Stats Bar */}
        <div className="shrink-0 bg-card border-b border-border/80 px-6 pt-3 pb-0">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-2">
            {/* Search and Status Filters */}
            <div className="flex items-center gap-2 flex-1 max-w-lg">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search by title, file name, or notes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-8 text-xs bg-muted/40"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-3" />
                  </button>
                )}
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32 h-8 text-xs bg-muted/40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL" className="text-xs">All Statuses</SelectItem>
                  <SelectItem value="VERIFIED" className="text-xs">Verified</SelectItem>
                  <SelectItem value="PENDING" className="text-xs">Pending</SelectItem>
                  <SelectItem value="REJECTED" className="text-xs">Rejected</SelectItem>
                  <SelectItem value="EXPIRED" className="text-xs">Expired</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Document counts overview pill */}
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground self-end sm:self-auto">
              <span className="font-semibold text-foreground">{documents.length}</span> Total
              <span>•</span>
              <span className="text-emerald-600 font-medium">
                {documents.filter((d) => d.status === "VERIFIED").length} Verified
              </span>
              <span>•</span>
              <span className="text-amber-600 font-medium">
                {documents.filter((d) => d.status === "PENDING").length} Pending
              </span>
            </div>
          </div>

          {/* Navigation Category Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar border-t border-border/50 pt-2 -mx-6 px-6">
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const count = counts[cat.id] ?? 0;
              const isActive = selectedCategory === cat.id;

              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`flex items-center gap-2 py-2 px-3 border-b-2 text-xs font-medium whitespace-nowrap transition-colors ${
                    isActive
                      ? "border-primary text-primary font-semibold"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                  }`}
                >
                  <Icon className="size-3.5" />
                  <span>{cat.label}</span>
                  <span
                    className={`ml-0.5 text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                      isActive
                        ? "bg-primary text-primary-foreground font-bold"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {docsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="p-4 rounded-xl border border-border/70 bg-card space-y-2">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-5 w-20" />
                  </div>
                  <Skeleton className="h-3 w-64" />
                </div>
              ))}
            </div>
          ) : docsError ? (
            <div className="text-center py-12 rounded-xl border border-destructive/20 bg-destructive/5 p-6">
              <AlertTriangle className="size-8 text-destructive mx-auto mb-2" />
              <p className="text-sm font-medium text-destructive">Failed to load documents</p>
              <p className="text-xs text-muted-foreground mt-1 mb-3">
                {docsError.message || "Could not retrieve employee document vault."}
              </p>
              <Button size="xs" variant="outline" onClick={() => mutateDocs()}>
                <RefreshCw className="size-3.5 mr-1" /> Retry
              </Button>
            </div>
          ) : filteredDocuments.length === 0 ? (
            /* Empty State */
            <div className="text-center py-16 rounded-xl border border-dashed border-border/80 bg-muted/10 p-8">
              <div className="size-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3 text-muted-foreground">
                <FileText className="size-6" />
              </div>
              <h4 className="text-sm font-semibold text-foreground">
                {selectedCategory === "ALL"
                  ? "No Documents in Vault"
                  : `No ${CATEGORIES.find((c) => c.id === selectedCategory)?.label || "Documents"} Found`}
              </h4>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1 mb-4">
                {searchQuery || statusFilter !== "ALL"
                  ? "No documents match your active search or status filter."
                  : "Upload employee identity proofs, contracts, offer letters, or compliance files to keep records verified."}
              </p>
              <Button
                size="sm"
                onClick={() => {
                  setIsUploadOpen(true);
                  if (selectedCategory !== "ALL") setUploadCategory(selectedCategory);
                }}
                className="gap-1.5 shadow-2xs"
              >
                <Plus className="size-3.5" />
                Upload Document Now
              </Button>
            </div>
          ) : (
            /* Document Cards / Rows List */
            <div className="grid grid-cols-1 gap-3">
              {filteredDocuments.map((doc) => {
                const isImage =
                  doc.fileType?.startsWith("image/") ||
                  /\.(png|jpg|jpeg|webp)$/i.test(doc.fileName);
                const isPdf =
                  doc.fileType === "application/pdf" || /\.pdf$/i.test(doc.fileName);

                // Expiry calculation
                const isExpiringSoon =
                  doc.expiryDate &&
                  new Date(doc.expiryDate) > new Date() &&
                  new Date(doc.expiryDate).getTime() - Date.now() < 30 * 24 * 60 * 60 * 1000;
                const isExpired = doc.status === "EXPIRED";

                return (
                  <div
                    key={doc.id}
                    className="group rounded-xl border border-border/70 bg-card p-4 hover:border-primary/40 hover:shadow-2xs transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    {/* Left: File Icon & Metadata */}
                    <div className="flex items-start gap-3.5 min-w-0 flex-1">
                      {/* Document Type Badge / Icon */}
                      <div
                        onClick={() => setPreviewDoc(doc)}
                        className="size-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 cursor-pointer hover:bg-primary/20 transition-colors"
                        title="Click to preview"
                      >
                        {isImage ? (
                          <div className="relative size-full rounded-xl overflow-hidden flex items-center justify-center bg-muted">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={doc.fileUrl}
                              alt={doc.title}
                              className="size-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = "none";
                              }}
                            />
                            <Eye className="size-4 text-foreground/70 absolute inset-0 m-auto opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" />
                          </div>
                        ) : isPdf ? (
                          <FileText className="size-5 text-red-500" />
                        ) : (
                          <FileCheck2 className="size-5 text-primary" />
                        )}
                      </div>

                      {/* Main Details */}
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4
                            onClick={() => setPreviewDoc(doc)}
                            className="text-xs font-bold text-foreground hover:text-primary transition-colors cursor-pointer truncate max-w-md"
                          >
                            {doc.title}
                          </h4>
                          <Badge variant="neutral" className="text-[10px] font-mono px-1.5 py-0 uppercase">
                            {doc.category.replace(/_/g, " ")}
                          </Badge>
                          {/* Status Badge */}
                          {doc.status === "VERIFIED" && (
                            <Badge variant="success" className="text-[10px] gap-1 py-0">
                              <CheckCircle2 className="size-2.5" /> Verified
                            </Badge>
                          )}
                          {doc.status === "PENDING" && (
                            <Badge variant="warning" className="text-[10px] gap-1 py-0">
                              <Clock className="size-2.5" /> Pending Review
                            </Badge>
                          )}
                          {doc.status === "REJECTED" && (
                            <Badge variant="destructive" className="text-[10px] gap-1 py-0">
                              <XCircle className="size-2.5" /> Rejected
                            </Badge>
                          )}
                          {isExpired && (
                            <Badge variant="destructive" className="text-[10px] gap-1 py-0 font-mono">
                              <AlertTriangle className="size-2.5" /> Expired
                            </Badge>
                          )}
                          {isExpiringSoon && (
                            <Badge variant="warning" className="text-[10px] gap-1 py-0">
                              <Clock className="size-2.5" /> Expiring Soon
                            </Badge>
                          )}
                        </div>

                        {/* File Name & Size & Uploader Info */}
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono text-foreground/80 truncate max-w-[200px]">
                            {doc.fileName}
                          </span>
                          <span>•</span>
                          <span>{formatFileSize(doc.fileSize)}</span>
                          <span>•</span>
                          <span>Uploaded {formatDate(doc.uploadedAt)}</span>
                          {doc.uploadedBy && (
                            <>
                              <span>by</span>
                              <span className="font-medium text-foreground/80">
                                {doc.uploadedBy.name}
                              </span>
                            </>
                          )}
                        </p>

                        {/* Expiry Date / Notes / Rejection Callout */}
                        {(doc.expiryDate || doc.notes || doc.rejectionReason) && (
                          <div className="pt-0.5 space-y-1">
                            {doc.expiryDate && (
                              <p className="text-[10px] text-muted-foreground">
                                <span className="font-semibold">Expiry Date:</span> {formatDate(doc.expiryDate)}
                              </p>
                            )}
                            {doc.notes && (
                              <p className="text-[11px] text-muted-foreground italic line-clamp-1">
                                &ldquo;{doc.notes}&rdquo;
                              </p>
                            )}
                            {doc.status === "REJECTED" && doc.rejectionReason && (
                              <div className="p-1.5 rounded-md bg-destructive/10 border border-destructive/20 text-[11px] text-destructive flex items-start gap-1.5">
                                <AlertTriangle className="size-3.5 shrink-0 mt-0.5" />
                                <span>
                                  <strong>Rejection Reason:</strong> {doc.rejectionReason}
                                </span>
                              </div>
                            )}
                            {doc.status === "VERIFIED" && doc.verifiedBy && (
                              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                                Verified by {doc.verifiedBy.name} on {formatDate(doc.verifiedAt)}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: Actions Button Toolbar */}
                    <div className="flex items-center gap-1 self-end md:self-center shrink-0 border-t md:border-t-0 pt-2 md:pt-0 w-full md:w-auto justify-end">
                      {/* Preview Button */}
                      <Button
                        variant="outline"
                        size="xs"
                        onClick={() => setPreviewDoc(doc)}
                        className="gap-1 text-xs"
                        title="Preview inline"
                      >
                        <Eye className="size-3.5 text-muted-foreground" />
                        <span>Preview</span>
                      </Button>

                      {/* Download Button */}
                      <a
                        href={doc.fileUrl}
                        download={doc.fileName}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center"
                      >
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          title="Download file"
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <Download className="size-3.5" />
                        </Button>
                      </a>

                      {/* Replace File Button */}
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => {
                          setReplacingDoc(doc);
                          setReplaceExpiry(doc.expiryDate ? doc.expiryDate.split("T")[0] : "");
                          setReplaceNotes(doc.notes || "");
                        }}
                        title="Replace with updated file"
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <RefreshCw className="size-3.5" />
                      </Button>

                      {/* Verification Controls (For HR / Admin) */}
                      {doc.status !== "VERIFIED" && (
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => handleVerify(doc)}
                          title="Verify document"
                          className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
                        >
                          <CheckCircle2 className="size-3.5" />
                        </Button>
                      )}

                      {doc.status !== "REJECTED" && (
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => {
                            setRejectingDoc(doc);
                            setRejectionReason("");
                          }}
                          title="Reject document"
                          className="text-amber-600 hover:text-amber-700 hover:bg-amber-500/10"
                        >
                          <XCircle className="size-3.5" />
                        </Button>
                      )}

                      {/* Delete Button */}
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => setDeletingDocId(doc.id)}
                        title="Delete permanently"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Sticky Footer with Summary */}
        <div className="shrink-0 bg-card border-t border-border/80 px-6 py-3 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Shield className="size-3.5 text-primary" />
            <span>All documents are securely stored and verified in compliance with HR policies.</span>
          </div>
          <Button variant="outline" size="xs" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>

      {/* ================= INLINE PREVIEW LIGHTBOX ================= */}
      {previewDoc && (
        <Dialog open={!!previewDoc} onOpenChange={() => setPreviewDoc(null)}>
          <DialogContent
            showCloseButton={false}
            className="w-full max-w-4xl h-[88vh] max-h-[88vh] p-0 flex flex-col gap-0 rounded-2xl overflow-hidden border border-border bg-background shadow-2xl"
          >
            {/* Lightbox Header */}
            <div className="shrink-0 bg-card border-b border-border/80 px-5 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <FileText className="size-4 text-primary shrink-0" />
                <div className="min-w-0">
                  <h3 className="text-xs font-bold text-foreground truncate">
                    {previewDoc.title}
                  </h3>
                  <p className="text-[11px] text-muted-foreground truncate font-mono">
                    {previewDoc.fileName} • {formatFileSize(previewDoc.fileSize)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={previewDoc.fileUrl}
                  download={previewDoc.fileName}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Button variant="outline" size="xs" className="gap-1 text-xs">
                    <Download className="size-3.5" /> Download
                  </Button>
                </a>
                <a
                  href={previewDoc.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Button variant="outline" size="xs" className="gap-1 text-xs">
                    <ExternalLink className="size-3.5" /> Open Tab
                  </Button>
                </a>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setPreviewDoc(null)}
                  className="rounded-full size-7"
                >
                  <X className="size-4" />
                </Button>
              </div>
            </div>

            {/* Lightbox Viewer Body */}
            <div className="flex-1 bg-muted/20 overflow-hidden flex items-center justify-center p-4">
              {previewDoc.fileType?.startsWith("image/") ||
              /\.(png|jpg|jpeg|webp)$/i.test(previewDoc.fileName) ? (
                // Image Lightbox
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewDoc.fileUrl}
                  alt={previewDoc.title}
                  className="max-h-full max-w-full object-contain rounded-lg shadow-lg border border-border"
                />
              ) : previewDoc.fileType === "application/pdf" ||
                /\.pdf$/i.test(previewDoc.fileName) ? (
                // PDF Viewer
                <iframe
                  src={`${previewDoc.fileUrl}#toolbar=1`}
                  className="w-full h-full rounded-lg border border-border bg-white"
                  title={previewDoc.title}
                />
              ) : (
                // Word / DOC / Other File Type
                <div className="text-center p-8 bg-card rounded-xl border border-border shadow-xs max-w-sm">
                  <FileText className="size-12 text-primary mx-auto mb-3" />
                  <h4 className="text-sm font-bold text-foreground mb-1">
                    {previewDoc.fileName}
                  </h4>
                  <p className="text-xs text-muted-foreground mb-4">
                    Direct browser preview is not supported for this file format. You can download or view it in your local application.
                  </p>
                  <a
                    href={previewDoc.fileUrl}
                    download={previewDoc.fileName}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Button size="sm" className="gap-1.5">
                      <Download className="size-3.5" /> Download File
                    </Button>
                  </a>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* ================= REJECTION REASON MODAL ================= */}
      {rejectingDoc && (
        <Dialog open={!!rejectingDoc} onOpenChange={() => setRejectingDoc(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base flex items-center gap-2 text-destructive">
                <XCircle className="size-5" /> Reject Document
              </DialogTitle>
              <DialogDescription className="text-xs">
                Provide a reason why &ldquo;{rejectingDoc.title}&rdquo; is rejected. The employee will be asked to re-upload.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Quick Presets:</Label>
                <div className="space-y-1">
                  {PRESET_REASONS.map((reason, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setRejectionReason(reason)}
                      className="w-full text-left text-xs p-2 rounded-md border border-border/80 hover:bg-muted/50 transition-colors flex items-center justify-between group"
                    >
                      <span className="truncate">{reason}</span>
                      <ChevronRight className="size-3.5 text-muted-foreground group-hover:text-foreground shrink-0" />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label htmlFor="reject-reason" className="text-xs font-semibold">
                  Custom Rejection Remarks *
                </Label>
                <Textarea
                  id="reject-reason"
                  placeholder="Specify what's wrong with this document..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="mt-1 text-xs min-h-[80px]"
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRejectingDoc(null)}
                disabled={isSubmittingReject}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleRejectSubmit}
                loading={isSubmittingReject}
                disabled={!rejectionReason.trim()}
              >
                Reject Document
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ================= REPLACE FILE MODAL ================= */}
      {replacingDoc && (
        <Dialog open={!!replacingDoc} onOpenChange={() => setReplacingDoc(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base flex items-center gap-2">
                <RefreshCw className="size-5 text-primary" /> Replace Document File
              </DialogTitle>
              <DialogDescription className="text-xs">
                Upload a new replacement file for &ldquo;{replacingDoc.title}&rdquo;. The previous file will be securely removed.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2">
              <div
                onClick={() => replaceFileInputRef.current?.click()}
                className="border-2 border-dashed rounded-xl p-4 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
              >
                <input
                  ref={replaceFileInputRef}
                  type="file"
                  accept={ALLOWED_EXTENSIONS.join(",")}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      if (validateFiles([f])) {
                        setReplaceFile(f);
                      }
                    }
                  }}
                  className="hidden"
                />
                <Upload className="size-6 text-primary mx-auto mb-1.5" />
                <p className="text-xs font-medium text-foreground">
                  {replaceFile ? replaceFile.name : "Click to select replacement file"}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {replaceFile ? formatFileSize(replaceFile.size) : "PDF, PNG, JPG, WEBP, DOC up to 25MB"}
                </p>
              </div>

              <div>
                <Label htmlFor="replace-expiry" className="text-xs">
                  Updated Expiry Date (Optional)
                </Label>
                <Input
                  id="replace-expiry"
                  type="date"
                  value={replaceExpiry}
                  onChange={(e) => setReplaceExpiry(e.target.value)}
                  className="mt-1 h-8 text-xs"
                />
              </div>

              <div>
                <Label htmlFor="replace-notes" className="text-xs">
                  Revision Notes (Optional)
                </Label>
                <Input
                  id="replace-notes"
                  placeholder="e.g. Replaced with renewed passport copy"
                  value={replaceNotes}
                  onChange={(e) => setReplaceNotes(e.target.value)}
                  className="mt-1 h-8 text-xs"
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setReplacingDoc(null);
                  setReplaceFile(null);
                }}
                disabled={isSubmittingReplace}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleReplaceSubmit}
                loading={isSubmittingReplace}
                disabled={!replaceFile}
              >
                Upload & Replace
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ================= DELETE CONFIRM MODAL ================= */}
      {deletingDocId && (
        <Dialog open={!!deletingDocId} onOpenChange={() => setDeletingDocId(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-base flex items-center gap-2 text-destructive">
                <Trash2 className="size-5" /> Delete Document
              </DialogTitle>
              <DialogDescription className="text-xs">
                Are you sure you want to permanently delete this document? The physical file will be removed and cannot be recovered.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0 mt-2">
              <Button variant="outline" size="sm" onClick={() => setDeletingDocId(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => deletingDocId && handleDelete(deletingDocId)}
              >
                Delete Permanently
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Dialog>
  );
}
