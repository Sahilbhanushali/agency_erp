import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Instagram, Facebook, Twitter, Linkedin, Youtube, Globe } from "lucide-react";
import { useState, useEffect } from "react";
import { format } from "date-fns";

type PostStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "SCHEDULED" | "POSTED" | "NEEDS_MINOR_CHANGE" | "RESUBMITTED";
type ContentStatus = "DRAFT" | "PENDING_REVIEW" | "APPROVED" | "REJECTED" | "NEEDS_REVISION" | "NEEDS_MINOR_CHANGE" | "RESUBMITTED";

interface StatusChangeDialogProps {
  statusChangeDialog: { postId: string } | null;
  setStatusChangeDialog: (value: { postId: string } | null) => void;
  selectedStatus: PostStatus;
  setSelectedStatus: (value: PostStatus) => void;
  selectedContentStatus: ContentStatus;
  setSelectedContentStatus: (value: ContentStatus) => void;
  selectedDate: string;
  setSelectedDate: (value: string) => void;
  handleConfirmStatusChange: (statusType: "content" | "design", postedPlatforms?: string[]) => void;
  permissions?: string[];
  currentPostStatus?: PostStatus;
  postTitle?: string;
  currentPostPlatforms?: Array<{ id: string; platform: string; isPosted?: boolean }>;
}

const getPlatformIcon = (platformName: string, isSelected: boolean) => {
  if (!isSelected) {
    const GreyWrapper = ({ children }: { children: React.ReactNode }) => (
      <div className="p-1.5 rounded-full bg-gray-100 dark:bg-gray-800">{children}</div>
    );
    const className = "h-3.5 w-3.5 text-gray-400 dark:text-gray-500";
    switch (platformName.toLowerCase()) {
      case 'instagram': return <GreyWrapper><Instagram className={className} /></GreyWrapper>;
      case 'facebook': return <GreyWrapper><Facebook className={className} /></GreyWrapper>;
      case 'twitter': return <GreyWrapper><Twitter className={className} /></GreyWrapper>;
      case 'linkedin': return <GreyWrapper><Linkedin className={className} /></GreyWrapper>;
      case 'youtube': return <GreyWrapper><Youtube className={className} /></GreyWrapper>;
      default: return <GreyWrapper><Globe className={className} /></GreyWrapper>;
    }
  }

  switch (platformName.toLowerCase()) {
    case 'instagram': return <div className="p-1.5 rounded-full bg-pink-100 dark:bg-pink-950"><Instagram className="h-3.5 w-3.5 text-pink-600 dark:text-pink-400" /></div>;
    case 'facebook': return <div className="p-1.5 rounded-full bg-blue-100 dark:bg-blue-950"><Facebook className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" /></div>;
    case 'twitter': return <div className="p-1.5 rounded-full bg-sky-100 dark:bg-sky-950"><Twitter className="h-3.5 w-3.5 text-sky-500 dark:text-sky-400" /></div>;
    case 'linkedin': return <div className="p-1.5 rounded-full bg-indigo-100 dark:bg-indigo-950"><Linkedin className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" /></div>;
    case 'youtube': return <div className="p-1.5 rounded-full bg-red-100 dark:bg-red-950"><Youtube className="h-3.5 w-3.5 text-red-600 dark:text-red-400" /></div>;
    default: return <div className="p-1.5 rounded-full bg-gray-100 dark:bg-gray-800"><Globe className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400" /></div>;
  }
};

export default function StatusChangeDialog({
  statusChangeDialog,
  setStatusChangeDialog,
  selectedStatus,
  setSelectedStatus,
  selectedContentStatus,
  setSelectedContentStatus,
  selectedDate,
  setSelectedDate,
  handleConfirmStatusChange,
  permissions = [],
  currentPostStatus,
  postTitle,
  currentPostPlatforms,
}: StatusChangeDialogProps) {
  // The catalog folded the old "Manage-content" and "Manage-design" into posts:update, so
  // both tabs now follow it; /api/me/permissions only returns canonical names.
  const hasContentPermission = permissions.includes("posts:update");
  const hasDesignPermission = hasContentPermission;

  // Determine initial tab based on permissions
  const initialTab = hasContentPermission && !hasDesignPermission ? "content" : "design";
  const [activeTab, setActiveTab] = useState<"content" | "design">(initialTab);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);

  // Update activeTab when dialog opens or permissions change
  useEffect(() => {
    if (statusChangeDialog !== null) {
      if (hasContentPermission && !hasDesignPermission) {
        setActiveTab("content");
      } else if (hasDesignPermission && !hasContentPermission) {
        setActiveTab("design");
      } else {
        setActiveTab("design"); // Default to design status tab if both present
      }
      
      if (currentPostPlatforms) {
        const initiallyPosted = currentPostPlatforms.filter(p => p.isPosted).map(p => p.platform);
        if (initiallyPosted.length > 0) {
          setSelectedPlatforms(initiallyPosted);
        } else {
          setSelectedPlatforms(currentPostPlatforms.map(p => p.platform));
        }
      } else {
        setSelectedPlatforms([]);
      }
    }
  }, [statusChangeDialog, hasContentPermission, hasDesignPermission, currentPostPlatforms]);

  const canReject = currentPostStatus !== "DRAFT";

  const formattedTitle = postTitle
    ? `Change ${activeTab === "design" ? "Design Approval" : "Content Status"}: ${postTitle}`
    : `Change ${activeTab === "design" ? "Design Approval" : "Content Status"}`;

  return (
    <Dialog open={statusChangeDialog !== null} onOpenChange={() => setStatusChangeDialog(null)}>
      <DialogContent className="max-w-md rounded-2xl p-6 sm:p-7 bg-background border border-border shadow-xl">
        <DialogHeader className="space-y-3 pb-2">
          <DialogTitle className="text-xl font-bold text-foreground leading-snug">
            {formattedTitle}
          </DialogTitle>
          {hasContentPermission && hasDesignPermission && (
            <div className="flex bg-muted/70 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setActiveTab("design")}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  activeTab === "design"
                    ? "bg-background text-foreground shadow-sm font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Design Status
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("content")}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  activeTab === "content"
                    ? "bg-background text-foreground shadow-sm font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Content Status
              </button>
            </div>
          )}
        </DialogHeader>

        <div className="space-y-5 py-2">
          {(!hasContentPermission && !hasDesignPermission) ? (
            <div className="text-sm text-red-600 font-medium">
              You do not have permission to change Content or Design Status.
            </div>
          ) : (!hasContentPermission && activeTab === "content") || (!hasDesignPermission && activeTab === "design") ? (
            <div className="text-sm text-red-600 font-medium">
              You do not have permission to change {activeTab === "content" ? "Content" : "Design"} Status.
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-5">
                <div className="flex flex-col md:flex-row gap-6 md:gap-8 items-start">
                  <div className={`w-full ${activeTab === 'design' && selectedStatus === 'POSTED' && currentPostPlatforms && currentPostPlatforms.length > 0 ? 'md:w-[60%]' : 'md:w-full'}`}>
                    <label className="text-sm font-semibold text-foreground block mb-2">
                      Select Status
                </label>
                <Select
                  value={activeTab === "design" ? selectedStatus : selectedContentStatus}
                  onValueChange={(value) =>
                    activeTab === "design"
                      ? setSelectedStatus(value as PostStatus)
                      : setSelectedContentStatus(value as ContentStatus)
                  }
                >
                  <SelectTrigger aria-label="Select Status" className="w-full h-11 px-3.5 border border-input rounded-xl bg-background text-foreground text-sm font-medium focus:ring-2 focus:ring-ring">
                    <SelectValue placeholder="Select Status" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl shadow-lg">
                    {activeTab === "design" ? (
                      <>
                        {/*
                          Only moves a person makes here. Client approval is the client's
                          (share link); scheduling and publishing have their own controls in
                          the post's Approval workflow panel. The server refuses anything else.
                        */}
                        <SelectItem value="SUBMITTED">Submit for approval</SelectItem>
                        <SelectItem value="RESUBMITTED">Resubmit after changes</SelectItem>
                        <SelectItem value="APPROVED">Approve</SelectItem>
                        <SelectItem value="NEEDS_MINOR_CHANGE" disabled={!canReject}>
                          Request changes {!canReject && "(not available for drafts)"}
                        </SelectItem>
                        <SelectItem value="REJECTED" disabled={!canReject}>
                          Reject {!canReject && "(not available for drafts)"}
                        </SelectItem>
                      </>
                    ) : (
                      <>
                        <SelectItem value="DRAFT">Draft</SelectItem>
                        <SelectItem value="PENDING_REVIEW">Pending review</SelectItem>
                        <SelectItem value="APPROVED">Approve copy</SelectItem>
                        <SelectItem value="NEEDS_MINOR_CHANGE">Request changes</SelectItem>
                        <SelectItem value="REJECTED">Reject copy</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
                  
              {activeTab === "design" && selectedStatus === "POSTED" && currentPostPlatforms && currentPostPlatforms.length > 0 && (
                <div className="w-full md:w-[40%] md:pl-6 pt-1 md:pt-0">
                      <label className="text-sm font-semibold text-foreground block mb-2">
                        Posted Platforms
                      </label>
                      <div className="flex flex-wrap gap-4 mt-1">
                        {currentPostPlatforms.map((p) => {
                          const isSelected = selectedPlatforms.includes(p.platform);
                          const Icon = getPlatformIcon(p.platform, isSelected);
                          return (
                            <div key={p.id} className="flex items-center gap-2">
                              <Checkbox 
                                checked={isSelected}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setSelectedPlatforms(prev => [...prev, p.platform]);
                                  } else {
                                    setSelectedPlatforms(prev => prev.filter(plat => plat !== p.platform));
                                  }
                                }}
                                id={`platform-${p.id}`}
                              />
                              <label htmlFor={`platform-${p.id}`} className="flex items-center gap-1.5 text-sm cursor-pointer hover:opacity-80">
                                {Icon} <span className="font-medium capitalize">{p.platform.toLowerCase()}</span>
                              </label>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-sm font-semibold text-foreground block mb-2">
                  Date & Time
                </label>
                <Input aria-label="Date & Time"
                  type="datetime-local"
                  value={selectedDate || format(new Date(), "yyyy-MM-dd'T'HH:mm")}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full h-11 px-3.5 border border-input rounded-xl bg-background text-foreground text-sm font-medium focus:ring-2 focus:ring-ring"
                />
              </div>

              </div>
            </>
          )}
        </div>

        <DialogFooter className="pt-3 flex flex-row items-center justify-end gap-3">
          <Button
            variant="outline"
            type="button"
            onClick={() => setStatusChangeDialog(null)}
            className="px-5 h-10 rounded-xl text-sm font-medium border-border hover:bg-accent text-foreground"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => handleConfirmStatusChange(activeTab, selectedPlatforms)}
            className="px-6 h-10 rounded-xl text-sm font-semibold bg-foreground text-background hover:bg-foreground/90 transition-colors"
            disabled={(activeTab === "content" && !hasContentPermission) || (activeTab === "design" && !hasDesignPermission) || (!hasContentPermission && !hasDesignPermission)}
          >
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}