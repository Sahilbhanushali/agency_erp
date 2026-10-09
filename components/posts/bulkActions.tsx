"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  X,
  Trash2,
  Download,
  CheckCircle2,
  FileCheck,
  Sparkles,
} from "lucide-react";

interface BulkActionsProps {
  selectedPosts: string[];
  handleBulkStatusChange: (newStatus: string) => void;
  handleBulkContentStatusChange: (newContentStatus: string) => void;
  handleBulkDelete: () => void;
  setSelectedPosts: (posts: string[]) => void;
  onBulkExport?: () => void;
}

export default function BulkActions({
  selectedPosts,
  handleBulkStatusChange,
  handleBulkContentStatusChange,
  handleBulkDelete,
  setSelectedPosts,
  onBulkExport,
}: BulkActionsProps) {
  if (!selectedPosts || selectedPosts.length === 0) return null;

  return (
    <aside aria-label="Batch operations" className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 max-w-[95vw] transition-all animate-in fade-in slide-in-from-bottom-5 duration-200">
      <div className="flex flex-wrap items-center gap-2.5 rounded-2xl border border-border/80 bg-card/95 px-4 py-2.5 shadow-2xl backdrop-blur-md sm:rounded-full sm:px-5">
        {/* Selection Count Pill */}
        <div className="flex items-center gap-2 pr-1 border-r border-border/60">
          <Badge variant="default" className="tabular-nums font-semibold px-2 py-0.5">
            {selectedPosts.length}
          </Badge>
          <span className="text-xs font-medium text-foreground whitespace-nowrap">
            selected
          </span>
        </div>

        {/* Post Design Status Action */}
        <div className="flex items-center">
          <Select onValueChange={handleBulkStatusChange}>
            <SelectTrigger aria-label="Bulk change design status" className="h-8 min-w-[140px] text-xs bg-background/80 hover:bg-background">
              <CheckCircle2 className="size-3.5 mr-1.5 text-primary" />
              <SelectValue placeholder="Design Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="DRAFT">Draft</SelectItem>
              <SelectItem value="SUBMITTED">Submitted</SelectItem>
              <SelectItem value="APPROVED">Approve (I Approve)</SelectItem>
              <SelectItem value="C_APPROVED">Client Approved</SelectItem>
              <SelectItem value="REJECTED">Request Changes</SelectItem>
              <SelectItem value="SCHEDULED">Scheduled</SelectItem>
              <SelectItem value="POSTED">Posted</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Content Status Action */}
        <div className="flex items-center">
          <Select onValueChange={handleBulkContentStatusChange}>
            <SelectTrigger aria-label="Bulk change copy status" className="h-8 min-w-[140px] text-xs bg-background/80 hover:bg-background">
              <FileCheck className="size-3.5 mr-1.5 text-blue-500" />
              <SelectValue placeholder="Copy Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="DRAFT">Draft</SelectItem>
              <SelectItem value="PENDING_REVIEW">Pending Review</SelectItem>
              <SelectItem value="APPROVED">Approve Copy</SelectItem>
              <SelectItem value="C_APPROVED">Client Approved</SelectItem>
              <SelectItem value="REJECTED">Reject Copy</SelectItem>
              <SelectItem value="NEEDS_REVISION">Needs Revision</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Bulk Export Action if available */}
        {onBulkExport && (
          <Button
            variant="outline"
            size="sm"
            onClick={onBulkExport}
            className="h-8 px-2.5 text-xs gap-1.5 bg-background/80 hover:bg-background"
          >
            <Download className="size-3.5" />
            <span className="hidden sm:inline">Export</span>
          </Button>
        )}

        {/* Bulk Delete Action */}
        <Button
          variant="destructive"
          size="sm"
          onClick={handleBulkDelete}
          className="h-8 px-2.5 text-xs gap-1.5"
        >
          <Trash2 className="size-3.5" />
          <span>Delete</span>
        </Button>

        {/* Dismiss / Clear Selection */}
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => setSelectedPosts([])}
          className="size-7 rounded-full text-muted-foreground hover:text-foreground"
          title="Clear selection"
        >
          <X className="size-3.5" />
        </Button>
      </div>
    </aside>
  );
}