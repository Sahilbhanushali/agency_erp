"use client";

import { jsonFetcher } from "@/lib/fetcher";
import { useState, useEffect } from "react";
import useSWR from "swr";
import toast from "react-hot-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import DeleteConfirmationDialog from "@/components/dialogs/DeleteConfirmationDialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  User,
  Briefcase,
  DollarSign,
  FileText,
  Upload,
  Trash2,
  Download,
  Calendar,
  Phone,
  Mail,
  Shield,
  FileCheck,
  Building,
  CreditCard,
  AlertCircle,
  ExternalLink,
  Plus,
  Sparkles,
} from "lucide-react";
import HrDocumentsModal from "./hr-documents-modal";

interface UserDocument {
  id: string;
  userId: number;
  title: string;
  category: string;
  fileUrl: string;
  fileName: string;
  fileSize?: number;
  fileType?: string;
  uploadedAt: string;
  notes?: string;
}

interface UserProfileModalProps {
  userId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onUserUpdated?: () => void;
}

// Throws on non-2xx, so a failed load is an error state, not an empty list.
const fetcher = (url: string) => jsonFetcher(url);

export default function UserProfileModal({
  userId,
  isOpen,
  onClose,
  onUserUpdated,
}: UserProfileModalProps) {
  const [activeTab, setActiveTab] = useState("employment");
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [isDocsModalOpen, setIsDocsModalOpen] = useState(false);

  // New doc upload form state
  const [docTitle, setDocTitle] = useState("");
  const [docCategory, setDocCategory] = useState("OFFER_LETTER");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const { data: user, mutate } = useSWR(
    isOpen && userId ? `/api/users/${userId}` : null,
    fetcher
  );

  // Form states
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    designation: "",
    department: "",
    joiningDate: "",
    currentSalary: "",
    salaryFrequency: "MONTHLY",
    employmentType: "FULL_TIME",
    phone: "",
    personalEmail: "",
    address: "",
    panNumber: "",
    aadhaarNumber: "",
    bankName: "",
    bankAccountNumber: "",
    bankIfsc: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    emergencyContactRelation: "",
  });

  useEffect(() => {
    if (user && !user.error) {
      setFormData({
        name: user.name || "",
        email: user.email || "",
        designation: user.designation || "",
        department: user.department || "",
        joiningDate: user.joiningDate ? user.joiningDate.slice(0, 10) : "",
        currentSalary: user.currentSalary ? String(user.currentSalary) : "",
        salaryFrequency: user.salaryFrequency || "MONTHLY",
        employmentType: user.employmentType || "FULL_TIME",
        phone: user.phone || "",
        personalEmail: user.personalEmail || "",
        address: user.address || "",
        panNumber: user.panNumber || "",
        aadhaarNumber: user.aadhaarNumber || "",
        bankName: user.bankName || "",
        bankAccountNumber: user.bankAccountNumber || "",
        bankIfsc: user.bankIfsc || "",
        emergencyContactName: user.emergencyContactName || "",
        emergencyContactPhone: user.emergencyContactPhone || "",
        emergencyContactRelation: user.emergencyContactRelation || "",
      });
    }
  }, [user]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update employee details");

      toast.success("Employee details saved successfully");
      if (data.salaryNotice) toast.error(data.salaryNotice, { duration: 8000 });
      mutate();
      if (onUserUpdated) onUserUpdated();
    } catch (err: any) {
      toast.error(err.message || "Failed to save profile");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUploadDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !selectedFile) {
      toast.error("Please select a file to upload");
      return;
    }

    setUploadingDoc(true);
    try {
      const uploadData = new FormData();
      uploadData.append("file", selectedFile);
      uploadData.append("title", docTitle || selectedFile.name);
      uploadData.append("category", docCategory);

      const res = await fetch(`/api/users/${userId}/documents`, {
        method: "POST",
        body: uploadData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");

      toast.success("Document uploaded successfully");
      setSelectedFile(null);
      setDocTitle("");
      mutate();
    } catch (err: any) {
      toast.error(err.message || "Failed to upload document");
    } finally {
      setUploadingDoc(false);
    }
  };

  const [docToDelete, setDocToDelete] = useState<{ id: string; name: string } | null>(null);
  const [isDeletingDoc, setIsDeletingDoc] = useState(false);

  const confirmDeleteDocument = async () => {
    if (!docToDelete) return;
    setIsDeletingDoc(true);
    try {
      const res = await fetch(`/api/users/${userId}/documents/${docToDelete.id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to delete document");

      toast.success(data.message || "Document and local file deleted");
      setDocToDelete(null);
      mutate();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete document");
    } finally {
      setIsDeletingDoc(false);
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "";
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  };

  const documents: UserDocument[] = user?.documents || [];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <User className="size-5 text-primary" />
                {user?.name || "Employee Profile"}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                {user?.email} • Role: {typeof user?.role === "object" ? user?.role?.name : (user?.role || "User")}
              </DialogDescription>
            </div>
            {user?.designation && (
              <Badge variant="neutral" className="text-xs">
                {user.designation}
              </Badge>
            )}
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-2">
          <TabsList className="grid grid-cols-4 w-full h-9">
            <TabsTrigger value="employment" className="text-xs flex items-center gap-1.5">
              <Briefcase className="size-3.5" />
              Employment
            </TabsTrigger>
            <TabsTrigger value="compensation" className="text-xs flex items-center gap-1.5">
              <DollarSign className="size-3.5" />
              Compensation
            </TabsTrigger>
            <TabsTrigger value="personal" className="text-xs flex items-center gap-1.5">
              <Shield className="size-3.5" />
              Personal & Bank
            </TabsTrigger>
            <TabsTrigger value="documents" className="text-xs flex items-center gap-1.5">
              <FileText className="size-3.5" />
              Documents ({documents.length})
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: Employment */}
          <TabsContent value="employment" className="space-y-4 pt-3">
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="emp-designation" className="text-xs">Designation / Job Title</Label>
                  <Input
                    id="emp-designation"
                    placeholder="e.g. Senior Graphic Designer, Video Editor"
                    value={formData.designation}
                    onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="emp-department" className="text-xs">Department</Label>
                  <Input
                    id="emp-department"
                    placeholder="e.g. Creative, Marketing, Operations"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="emp-joining" className="text-xs">Joining Date</Label>
                  <Input
                    id="emp-joining"
                    type="date"
                    value={formData.joiningDate}
                    onChange={(e) => setFormData({ ...formData, joiningDate: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="emp-type" className="text-xs">Employment Type</Label>
                  <Select
                    value={formData.employmentType}
                    onValueChange={(val) => setFormData({ ...formData, employmentType: val })}
                  >
                    <SelectTrigger id="emp-type" className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FULL_TIME">Full Time</SelectItem>
                      <SelectItem value="PART_TIME">Part Time</SelectItem>
                      <SelectItem value="CONTRACT">Contract / Freelance</SelectItem>
                      <SelectItem value="INTERN">Intern</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Offer Letter Quick Glance */}
              <div className="rounded-lg border border-border p-3.5 bg-muted/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileCheck className="size-4 text-primary" />
                    <div>
                      <p className="text-xs font-semibold text-foreground">Joining Offer Letter</p>
                      <p className="text-xs text-muted-foreground">
                        {user?.offerLetterUrl ? "Offer letter is attached to profile" : "No offer letter uploaded yet"}
                      </p>
                    </div>
                  </div>
                  {user?.offerLetterUrl ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-xs gap-1"
                      onClick={() => window.open(user.offerLetterUrl, "_blank")}
                    >
                      <ExternalLink className="size-3" />
                      View Letter
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-xs gap-1"
                      onClick={() => setActiveTab("documents")}
                    >
                      <Upload className="size-3" />
                      Upload Now
                    </Button>
                  )}
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button type="submit" loading={isSaving} size="sm">
                  Save Employment Details
                </Button>
              </div>
            </form>
          </TabsContent>

          {/* Tab 2: Compensation */}
          <TabsContent value="compensation" className="space-y-4 pt-3">
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="emp-salary" className="text-xs">Current Salary / Compensation (INR / Month)</Label>
                  <div className="relative mt-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-mono">₹</span>
                    <Input
                      id="emp-salary"
                      type="number"
                      placeholder="e.g. 50000"
                      value={formData.currentSalary}
                      onChange={(e) => setFormData({ ...formData, currentSalary: e.target.value })}
                      className="pl-7"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="emp-freq" className="text-xs">Payment Frequency</Label>
                  <Select
                    value={formData.salaryFrequency}
                    onValueChange={(val) => setFormData({ ...formData, salaryFrequency: val })}
                  >
                    <SelectTrigger id="emp-freq" className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MONTHLY">Monthly</SelectItem>
                      <SelectItem value="YEARLY">Yearly (Annual CTC)</SelectItem>
                      <SelectItem value="HOURLY">Hourly</SelectItem>
                      <SelectItem value="PROJECT_BASED">Project Based</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="emp-pan" className="text-xs">PAN Number</Label>
                  <Input
                    id="emp-pan"
                    placeholder="e.g. ABCDE1234F"
                    value={formData.panNumber}
                    onChange={(e) => setFormData({ ...formData, panNumber: e.target.value.toUpperCase() })}
                    className="mt-1 uppercase"
                  />
                </div>
                <div>
                  <Label htmlFor="emp-aadhaar" className="text-xs">Aadhaar Number</Label>
                  <Input
                    id="emp-aadhaar"
                    placeholder="e.g. 1234 5678 9012"
                    value={formData.aadhaarNumber}
                    onChange={(e) => setFormData({ ...formData, aadhaarNumber: e.target.value })}
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button type="submit" loading={isSaving} size="sm">
                  Save Compensation Info
                </Button>
              </div>
            </form>
          </TabsContent>

          {/* Tab 3: Personal & Banking */}
          <TabsContent value="personal" className="space-y-4 pt-3">
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="emp-phone" className="text-xs">Phone Number</Label>
                  <Input
                    id="emp-phone"
                    placeholder="+91 98765 43210"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="emp-personal-email" className="text-xs">Personal Email</Label>
                  <Input
                    id="emp-personal-email"
                    type="email"
                    placeholder="personal@gmail.com"
                    value={formData.personalEmail}
                    onChange={(e) => setFormData({ ...formData, personalEmail: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="emp-address" className="text-xs">Residential Address</Label>
                  <Input
                    id="emp-address"
                    placeholder="Flat / Street, City, State, PIN"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="border-t border-border/70 pt-3">
                <h4 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
                  <CreditCard className="size-3.5 text-primary" />
                  Bank Account Details (for Payroll)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <Label htmlFor="bank-name" className="text-xs">Bank Name</Label>
                    <Input
                      id="bank-name"
                      placeholder="e.g. HDFC Bank, ICICI"
                      value={formData.bankName}
                      onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="bank-acc" className="text-xs">Account Number</Label>
                    <Input
                      id="bank-acc"
                      placeholder="e.g. 5010023456789"
                      value={formData.bankAccountNumber}
                      onChange={(e) => setFormData({ ...formData, bankAccountNumber: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="bank-ifsc" className="text-xs">IFSC Code</Label>
                    <Input
                      id="bank-ifsc"
                      placeholder="e.g. HDFC0001234"
                      value={formData.bankIfsc}
                      onChange={(e) => setFormData({ ...formData, bankIfsc: e.target.value.toUpperCase() })}
                      className="mt-1 uppercase"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-border/70 pt-3">
                <h4 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
                  <AlertCircle className="size-3.5 text-amber-500" />
                  Emergency Contact
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <Label htmlFor="em-name" className="text-xs">Contact Name</Label>
                    <Input
                      id="em-name"
                      placeholder="Contact person"
                      value={formData.emergencyContactName}
                      onChange={(e) => setFormData({ ...formData, emergencyContactName: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="em-relation" className="text-xs">Relationship</Label>
                    <Input
                      id="em-relation"
                      placeholder="e.g. Father, Spouse"
                      value={formData.emergencyContactRelation}
                      onChange={(e) => setFormData({ ...formData, emergencyContactRelation: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="em-phone" className="text-xs">Emergency Phone</Label>
                    <Input
                      id="em-phone"
                      placeholder="+91 98765 00000"
                      value={formData.emergencyContactPhone}
                      onChange={(e) => setFormData({ ...formData, emergencyContactPhone: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button type="submit" loading={isSaving} size="sm">
                  Save Personal & Bank Info
                </Button>
              </div>
            </form>
          </TabsContent>

          {/* Tab 4: Documents Vault */}
          <TabsContent value="documents" className="space-y-4 pt-3">
            {/* Banner to launch full HR Documents Vault */}
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <FileText className="size-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    HR Documents Vault
                    <Sparkles className="size-3 text-primary" />
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Multi-file drag & drop, inline preview lightbox, verification approval, and categories.
                  </p>
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() => setIsDocsModalOpen(true)}
                className="gap-1.5 shadow-2xs text-xs font-semibold shrink-0"
              >
                <Upload className="size-3.5" />
                Open Document Vault ({documents.length})
              </Button>
            </div>

            {/* Quick Upload Document Box */}
            <form onSubmit={handleUploadDocument} className="rounded-xl border border-dashed border-border p-4 bg-muted/20">
              <h4 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-1.5">
                <Plus className="size-3.5 text-primary" />
                Quick Upload Document
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label htmlFor="doc-title" className="text-xs">Document Title</Label>
                  <Input
                    id="doc-title"
                    placeholder="e.g. Offer Letter 2024, Aadhaar Card"
                    value={docTitle}
                    onChange={(e) => setDocTitle(e.target.value)}
                    className="mt-1 h-8 text-xs bg-background"
                  />
                </div>
                <div>
                  <Label htmlFor="doc-cat" className="text-xs">Category</Label>
                  <Select value={docCategory} onValueChange={setDocCategory}>
                    <SelectTrigger id="doc-cat" className="mt-1 h-8 text-xs bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="IDENTITY">Identity Proofs</SelectItem>
                      <SelectItem value="EDUCATION">Education & Certificates</SelectItem>
                      <SelectItem value="EMPLOYMENT">Employment & Offers</SelectItem>
                      <SelectItem value="BANK_TAX">Bank & Tax</SelectItem>
                      <SelectItem value="CONTRACTS">Contracts & Agreements</SelectItem>
                      <SelectItem value="OTHER">Other Document</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="doc-file" className="text-xs">Select File</Label>
                  <Input
                    id="doc-file"
                    type="file"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    className="mt-1 h-8 text-xs bg-background"
                  />
                </div>
              </div>
              <div className="flex justify-end mt-3">
                <Button
                  type="submit"
                  size="xs"
                  loading={uploadingDoc}
                  disabled={!selectedFile}
                  className="gap-1.5"
                >
                  <Upload className="size-3" />
                  Upload
                </Button>
              </div>
            </form>

            {/* Uploaded Documents List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Attached Documents ({documents.length})
                </h4>
                {documents.length > 0 && (
                  <Button
                    variant="link"
                    size="xs"
                    onClick={() => setIsDocsModalOpen(true)}
                    className="text-xs text-primary p-0 h-auto"
                  >
                    View All in Vault →
                  </Button>
                )}
              </div>
              {documents.length === 0 ? (
                <div className="text-center py-8 rounded-lg border border-border/70 bg-card">
                  <FileText className="size-8 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">No documents uploaded yet for this user.</p>
                </div>
              ) : (
                <div className="divide-y divide-border/60 rounded-lg border border-border bg-card overflow-hidden">
                  {documents.map((doc: any) => (
                    <div key={doc.id} className="flex items-center justify-between p-3 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                          <FileText className="size-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-medium text-foreground truncate">{doc.title}</p>
                            <Badge variant="neutral" className="text-xs px-1.5 py-0">
                              {(doc.category || "OTHER").replace(/_/g, " ")}
                            </Badge>
                            {doc.status === "VERIFIED" && (
                              <Badge variant="success" className="text-xs py-0">
                                Verified
                              </Badge>
                            )}
                            {doc.status === "PENDING" && (
                              <Badge variant="warning" className="text-xs py-0">
                                Pending
                              </Badge>
                            )}
                            {doc.status === "REJECTED" && (
                              <Badge variant="destructive" className="text-xs py-0">
                                Rejected
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {doc.fileName} • {formatFileSize(doc.fileSize)} • {new Date(doc.uploadedAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Button aria-label="Open document"
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => window.open(doc.fileUrl, "_blank")}
                          title="Open document"
                        >
                          <ExternalLink className="size-3.5 text-muted-foreground" />
                        </Button>
                        <Button aria-label="Delete document and remove local file"
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => setDocToDelete({ id: doc.id, name: doc.name })}
                          className="text-destructive hover:text-destructive"
                          title="Delete document and remove local file"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* Dedicated Full HR Documents Vault Modal */}
        {isDocsModalOpen && (
          <HrDocumentsModal
            userId={userId}
            isOpen={isDocsModalOpen}
            onClose={() => {
              setIsDocsModalOpen(false);
              mutate();
            }}
            user={user}
            onUpdate={mutate}
          />
        )}
      </DialogContent>

      <DeleteConfirmationDialog
        isOpen={!!docToDelete}
        onClose={() => setDocToDelete(null)}
        onConfirm={confirmDeleteDocument}
        itemName={docToDelete?.name || "Document"}
        title={docToDelete?.name ? `Delete Document: "${docToDelete.name}"?` : "Delete Document?"}
        isLoading={isDeletingDoc}
      />
    </Dialog>
  );
}
