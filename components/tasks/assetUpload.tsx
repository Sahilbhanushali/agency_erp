"use client";
import toast from "react-hot-toast";
import { useState } from "react";
import { Upload, X, File } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";

interface AssetUploadProps {
  taskId: string;
  onUploadSuccess?: () => void;
  buttonText?: string;
  buttonVariant?: "default" | "outline" | "secondary" | "destructive" | "ghost" | "link";
  buttonClassName?: string;
  maxFiles?: number;
  disabled?: boolean;
}

export default function AssetUpload({
  taskId,
  onUploadSuccess,
  buttonText = "Submit",
  buttonVariant = "default",
  buttonClassName = "",
  maxFiles = 10,
  disabled = false,
}: AssetUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [currentStep, setCurrentStep] = useState<"idle" | "status" | "upload">("idle");
  const [isDragging, setIsDragging] = useState(false);

  const processFiles = (files: File[]) => {
    if (files.length === 0) return;

    if (selectedFiles.length + files.length > maxFiles) {
      toast.error(`Maximum ${maxFiles} files allowed. Please select fewer files.`);
      return;
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp", "video/mp4", "video/mov", "video/avi"];
    const invalidFiles = files.filter((file) => !allowedTypes.includes(file.type));

    if (invalidFiles.length > 0) {
      toast.error("Only images (JPEG, PNG, GIF, WebP) and videos (MP4, MOV, AVI) are allowed.");
      return;
    }

    setSelectedFiles((prev) => [...prev, ...files]);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    processFiles(Array.from(event.target.files || []));
    event.target.value = "";
  };

  const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(Array.from(e.dataTransfer.files));
    }
  };
  const removeFile = (indexToRemove: number) => {
    setSelectedFiles((prev) => prev.filter((_, index) => index !== indexToRemove));
  };

  const uploadFiles = async () => {
    if (selectedFiles.length === 0) return [];

    const formData = new FormData();
    selectedFiles.forEach((file) => {
      formData.append("files", file);
    });

    const response = await fetch(`/api/posts/${taskId}/assets`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to upload files");
    }

    return await response.json();
  };

  const handleSubmitAndUpload = async () => {
    if (selectedFiles.length === 0) {
      toast.error("Please select at least one file to upload.");
      return;
    }

    setUploading(true);

    try {
      setCurrentStep("status");
      // await updatePostStatus(); // Commented out as in original code
      setCurrentStep("upload");
      await uploadFiles();

      toast(`Post submitted and ${selectedFiles.length} asset${selectedFiles.length > 1 ? "s" : ""} uploaded successfully.`);

      // Clear files and reset state before closing
      setSelectedFiles([]);
      setCurrentStep("idle");
      setIsOpen(false); // Ensure dialog closes
      if (onUploadSuccess) onUploadSuccess();
    } catch (error) {
      console.error("Error in submit and upload process:", error);
      let errorMessage = "An unexpected error occurred.";
      if (error instanceof Error) {
        errorMessage = error.message;
      }

      toast.error("Done");
      setCurrentStep("idle");
    } finally {
      setUploading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const getProgressMessage = () => {
    switch (currentStep) {
      case "status":
        return "Updating status to SUBMITTED...";
      case "upload":
        return `Uploading ${selectedFiles.length} file${selectedFiles.length !== 1 ? "s" : ""}...`;
      default:
        return `Upload ${selectedFiles.length} File${selectedFiles.length !== 1 ? "s" : ""}`;
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open);
        if (!open) {
          setSelectedFiles([]); // Clear files when dialog closes
          setCurrentStep("idle");
        }
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant={buttonVariant}
          disabled={uploading || disabled}
          className={`group flex items-center gap-2 transition-all duration-300 ease-in-out ${buttonClassName}`}
        >
          <Upload className="w-4 h-4 transition-transform group-hover:scale-110" />
          {buttonText}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md w-full bg-card rounded-2xl shadow-2xl p-6 sm:p-8 border border-border">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-foreground tracking-tight">
            Upload Your Assets
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-6 mt-4">
          {/* Info Banner */}
          <div className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
            <p className="text-sm text-black font-medium leading-relaxed">
              Upload images or videos to submit your post. Supported formats: JPEG, PNG, GIF, WebP, MP4, MOV, AVI. Max {maxFiles} files.
            </p>
          </div>

          {/* File Input */}
          <div className="space-y-3">
            <label htmlFor="file-upload" className="text-sm font-semibold text-foreground">
              Select Files
            </label>
            <div className="relative group">
              <div className="flex items-center justify-center w-full">
                <label
                  htmlFor="file-upload"
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl transition-all duration-300 cursor-pointer ${
                    isDragging
                      ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30 scale-[1.02]"
                      : "border-border bg-muted/50 hover:bg-muted"
                  }`}
                >
                  <div className="flex flex-col items-center gap-2">
                    <File className="w-8 h-8 text-indigo-500 group-hover:scale-110 transition-transform" />
                    <span className="text-sm font-medium text-muted-foreground">
                      Click or drag files here
                    </span>
                    <span className="text-xs text-muted-foreground/80">
                      Up to {maxFiles} files
                    </span>
                  </div>
                  <input
                    id="file-upload"
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    onChange={handleFileChange}
                    disabled={uploading}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Selected Files List */}
          {selectedFiles.length > 0 && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <h4 className="text-sm font-semibold text-foreground">
                  Selected Files ({selectedFiles.length}/{maxFiles})
                </h4>
                {selectedFiles.length > 0 && !uploading && (
                  <button
                    onClick={() => setSelectedFiles([])}
                    className="text-xs font-medium text-indigo-500 hover:text-indigo-600 hover:underline"
                  >
                    Clear All
                  </button>
                )}
              </div>
              <div className="max-h-64 overflow-y-auto bg-card border border-border rounded-xl shadow-sm">
                {selectedFiles.map((file, index) => (
                  <div
                    key={`${file.name}-${index}`}
                    className="flex items-center justify-between p-3 border-b border-border hover:bg-indigo-950/20 transition-all duration-200"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {file.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(file.size)} • {file.type.startsWith("image/") ? "Image" : "Video"}
                      </p>
                    </div>
                    <button
                      onClick={() => removeFile(index)}
                      disabled={uploading}
                      className="p-1 text-muted-foreground hover:text-red-500 hover:bg-red-950/20 rounded-full transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Progress Indicator */}
          {uploading && currentStep !== "idle" && (
            <div className="p-4 bg-muted/50 border border-border rounded-xl flex items-center gap-3">
              <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-sm font-medium text-foreground">
                {currentStep === "status" && "Step 1/2: Updating post status..."}
                {currentStep === "upload" && `Step 2/2: Uploading ${selectedFiles.length} file${selectedFiles.length !== 1 ? "s" : ""}...`}
              </span>
            </div>
          )}
        </div>

        <DialogFooter className="mt-6 flex sm:justify-end gap-3">
          <button
            onClick={() => {
              setIsOpen(false);
            }}
            disabled={uploading}
            className="px-4 py-2 text-muted-foreground bg-muted hover:bg-muted/80 rounded-lg font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmitAndUpload}
            disabled={uploading || selectedFiles.length === 0}
            className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-blue-500 text-white rounded-lg font-medium hover:from-indigo-600 hover:to-blue-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? getProgressMessage() : `Upload ${selectedFiles.length} File${selectedFiles.length !== 1 ? "s" : ""}`}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}