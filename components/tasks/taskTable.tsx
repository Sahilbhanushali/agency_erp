"use client";

import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { CheckCircle, MessageSquare, Clock, Image, Video, FileText, Lock } from "lucide-react";
import AssetUpload from "./assetUpload";
import { Task } from "./taskGrid";

interface TaskTableProps {
  tasks: Task[];
  title: string;
  showDeadlines?: boolean;
  showOverdue?: boolean;
  showStatus?: boolean;
  showAll?: boolean;
  emptyMessage?: string;
  emptySubMessage?: string;
  mutate?: () => void;
}

export default function TaskTable({
  tasks,
  title,
  showDeadlines = false,
  showOverdue = false,
  showStatus = false,
  showAll = false,
  emptyMessage = "No tasks found for this category",
  emptySubMessage = "Great job staying on top of your work!",
  mutate,
}: TaskTableProps) {
  const getBadgeVariant = (status: string) => {
    switch (status) {
      case 'APPROVED':
      case 'POSTED':
        return "success";
      case 'SUBMITTED':
      case 'SCHEDULED':
        return "info";
      case 'REJECTED':
        return "destructive";
      case 'NEEDS_MINOR_CHANGE':
        return "warning";
      case 'RESUBMITTED':
        return "purple";
      default:
        return "neutral";
    }
  };

  const getAssetIcon = (filename: string) => {
    const ext = filename.toLowerCase().split('.').pop();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) {
      return <Image className="size-3.5 text-primary" />;
    }
    if (['mp4', 'mov', 'avi', 'mkv'].includes(ext || '')) {
      return <Video className="size-3.5 text-info" />;
    }
    return <FileText className="size-3.5 text-muted-foreground" />;
  };

  const isOverdue = (task: Task) => {
    let designDue = task.designDueDate ? new Date(task.designDueDate) : null;
    if (!designDue && task.scheduledAt) {
      designDue = new Date(task.scheduledAt);
      designDue.setDate(designDue.getDate() - 7);
    }
    if (!designDue) return false;
    return designDue < new Date() && ['DRAFT', 'REJECTED', 'NEEDS_MINOR_CHANGE'].includes(task.status);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
    });
  };

  if (tasks.length === 0) {
    return (
      <EmptyState
        icon={CheckCircle}
        title={emptyMessage}
        description={emptySubMessage}
        className="my-4"
      />
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-base font-semibold tracking-tight text-foreground">{title}</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead>Type</TableHead>
            {showStatus && <TableHead>Status</TableHead>}
            {(showDeadlines || showOverdue || showAll) && (
              <TableHead>Design Due</TableHead>
            )}
            <TableHead>Post Date</TableHead>
            <TableHead>Assets</TableHead>
            <TableHead>Platforms</TableHead>
            <TableHead>Feedback</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.map(task => {
            const isContentApproved = task.contentStatus === "APPROVED";
            const overdue = isOverdue(task);
            return (
              <TableRow
                key={task.id}
                className={overdue && showOverdue ? 'bg-destructive/5 dark:bg-destructive/10' : ''}
              >
                <TableCell className="font-medium text-foreground max-w-[200px] truncate">{task.title}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-[10px] font-mono">{task.type}</Badge>
                </TableCell>
                {showStatus && (
                  <TableCell>
                    <Badge variant={getBadgeVariant(task.status)} dot className="text-[10px]">
                      {task.status}
                    </Badge>
                  </TableCell>
                )}
                {(showDeadlines || showOverdue || showAll) && (
                  <TableCell>
                    {task.scheduledAt ? (
                      <div className={`flex items-center gap-1.5 text-xs ${overdue ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                        <Clock className="size-3.5" />
                        <span className="tabular-nums">
                          {formatDate(new Date(new Date(task.scheduledAt).getTime() - 7 * 24 * 60 * 60 * 1000).toISOString())}
                        </span>
                        {overdue && showOverdue && <span>(Overdue)</span>}
                      </div>
                    ) : (
                      <span className="text-muted-foreground/60">-</span>
                    )}
                  </TableCell>
                )}
                <TableCell className="text-muted-foreground text-xs tabular-nums">
                  {task.scheduledAt ? formatDate(task.scheduledAt) : <span className="text-muted-foreground/60">-</span>}
                </TableCell>
                <TableCell>
                  {task.assets.length > 0 ? (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      {getAssetIcon(task.assets[0].filename)}
                      <span className="tabular-nums">{task.assets.length} file{task.assets.length !== 1 ? 's' : ''}</span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground/60">-</span>
                  )}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {task.platforms?.length ? task.platforms.map((p: any) => p.platform).join(', ') : <span className="text-muted-foreground/60">-</span>}
                </TableCell>
                <TableCell>
                  {task.feedback ? (
                    <Badge variant="warning" className="text-[10px] gap-1">
                      <MessageSquare className="size-3" /> Feedback
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground/60">-</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {isContentApproved ? (
                    <AssetUpload
                      taskId={task.id}
                      onUploadSuccess={() => mutate?.()}
                      buttonClassName="inline-flex h-7 items-center gap-1.5 rounded-md bg-primary px-2.5 text-xs font-medium text-primary-foreground shadow-2xs hover:bg-primary/90 transition-colors"
                    />
                  ) : (
                    <Badge variant="neutral" className="gap-1 text-[10px]">
                      <Lock className="size-3" /> Content Pending
                    </Badge>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
