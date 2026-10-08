import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Trash2 } from "lucide-react";

interface BulkActionsProps {
  selectedPosts: string[];
  handleBulkStatusChange: (newStatus: string) => void;
  handleBulkContentStatusChange: (newContentStatus: string) => void;
  handleBulkDelete: () => void;
  setSelectedPosts: (posts: string[]) => void;
}

export default function BulkActions({
  selectedPosts,
  handleBulkStatusChange,
  handleBulkContentStatusChange,
  handleBulkDelete,
  setSelectedPosts,
}: BulkActionsProps) {
  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
      <div className="text-sm text-gray-600">
        {selectedPosts.length} post{selectedPosts.length !== 1 ? "s" : ""} selected
      </div>
      <div className="flex items-center gap-2">
        {/* Post Status Dropdown */}
        <Select onValueChange={handleBulkStatusChange}>
          <SelectTrigger className="w-[150px] h-8 text-xs">
            <SelectValue placeholder="Change Post Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="DRAFT">Draft</SelectItem>
            <SelectItem value="SUBMITTED">Submitted</SelectItem>
            <SelectItem value="APPROVED">I Approve</SelectItem>
            <SelectItem value="C_APPROVED">C Approve</SelectItem>
            <SelectItem value="REJECTED">Changes</SelectItem>
            <SelectItem value="SCHEDULED">Scheduled</SelectItem>
            <SelectItem value="POSTED">Posted</SelectItem>
          </SelectContent>
        </Select>

        {/* Content Status Dropdown */}
        <Select onValueChange={handleBulkContentStatusChange}>
          <SelectTrigger className="w-[150px] h-8 text-xs">
            <SelectValue placeholder="Change Content Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="DRAFT">Draft</SelectItem>
            <SelectItem value="PENDING_REVIEW">Pending Review</SelectItem>
            <SelectItem value="APPROVED">I Approve</SelectItem>
            <SelectItem value="C_APPROVED">C Approve</SelectItem>
            <SelectItem value="REJECTED">Changes</SelectItem>
            <SelectItem value="NEEDS_REVISION">Needs Revision</SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant="destructive"
          size="sm"
          onClick={handleBulkDelete}
          className="h-8 text-xs"
        >
          <Trash2 className="mr-1 h-4 w-4" />
          Delete
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setSelectedPosts([])}
          className="h-8 text-xs"
        >
          <X className="mr-1 h-4 w-4" />
          Clear Selection
        </Button>
      </div>
    </div>
  );
}