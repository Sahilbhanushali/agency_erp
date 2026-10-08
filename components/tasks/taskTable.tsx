"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, MessageSquare, Clock, Calendar, Image, Video, FileText, Lock } from "lucide-react";
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
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DRAFT': return "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600";
      case 'SUBMITTED': return "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-700 hover:bg-blue-200 dark:hover:bg-blue-800";
      case 'APPROVED': return "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 border-green-200 dark:border-green-700 hover:bg-green-200 dark:hover:bg-green-800";
      case 'REJECTED': return "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 border-red-200 dark:border-red-700 hover:bg-red-200 dark:hover:bg-red-800";
      case 'NEEDS_MINOR_CHANGE': return "bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-700 hover:bg-amber-200 dark:hover:bg-amber-800";
      case 'SCHEDULED': return "bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 border-purple-200 dark:border-purple-700 hover:bg-purple-200 dark:hover:bg-purple-800";
      case 'POSTED': return "bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-700 hover:bg-emerald-200 dark:hover:bg-emerald-800";
      case 'RESUBMITTED': return "bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200 border-orange-200 dark:border-orange-700 hover:bg-orange-200 dark:hover:bg-orange-800";
      default: return "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600";
    }
  };

  const getAssetIcon = (filename: string) => {
    const ext = filename.toLowerCase().split('.').pop();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) {
      return <Image className="w-4 h-4 text-blue-600" />;
    }
    if (['mp4', 'mov', 'avi', 'mkv'].includes(ext || '')) {
      return <Video className="w-4 h-4 text-purple-600" />;
    }
    return <FileText className="w-4 h-4 text-gray-600" />;
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
      <Card className="bg-gradient-to-br from-muted to-muted/50 shadow-lg rounded-xl">
        <CardContent className="p-8 text-center">
          <div className="space-y-4">
            <CheckCircle className="h-12 w-12 mx-auto text-muted-foreground animate-pulse" />
            <p className="text-foreground font-semibold text-lg">{emptyMessage}</p>
            <p className="text-sm text-muted-foreground">{emptySubMessage}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-foreground">{title}</h2>
      <Card className="bg-gradient-to-br from-card to-muted/20 shadow-lg rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="text-xs font-semibold text-muted-foreground uppercase py-3">Title</TableHead>
              <TableHead className="text-xs font-semibold text-muted-foreground uppercase py-3">Type</TableHead>
              {showStatus && <TableHead className="text-xs font-semibold text-muted-foreground uppercase py-3">Status</TableHead>}
              {(showDeadlines || showOverdue || showAll) && (
                <TableHead className="text-xs font-semibold text-muted-foreground uppercase py-3">Design Due</TableHead>
              )}
              <TableHead className="text-xs font-semibold text-muted-foreground uppercase py-3">Post Date</TableHead>
              <TableHead className="text-xs font-semibold text-muted-foreground uppercase py-3">Assets</TableHead>
              <TableHead className="text-xs font-semibold text-muted-foreground uppercase py-3">Platforms</TableHead>
              <TableHead className="text-xs font-semibold text-muted-foreground uppercase py-3">Feedback</TableHead>
              <TableHead className="text-xs font-semibold text-muted-foreground uppercase py-3">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.map(task => {
              const isContentApproved = task.contentStatus === "APPROVED";
              return (
                <TableRow
                  key={task.id}
                  className={`transition-all duration-200 hover:bg-muted/50 ${
                    isOverdue(task) && showOverdue ? 'bg-red-50 dark:bg-red-950/30' : ''
                  }`}
                >
                  <TableCell className="font-medium text-foreground">{task.title}</TableCell>
                  <TableCell className="text-muted-foreground">{task.type}</TableCell>
                  {showStatus && (
                    <TableCell>
                      <Badge className={`${getStatusColor(task.status)} transition-all duration-200`}>
                        {task.status}
                      </Badge>
                    </TableCell>
                  )}
                  {(showDeadlines || showOverdue || showAll) && (
                    <TableCell>
                      {task.scheduledAt ? (
                        <div className={`flex items-center gap-1 ${isOverdue(task) ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
                          <Clock className="w-4 h-4" />
                          {formatDate(new Date(new Date(task.scheduledAt).getTime() - 7 * 24 * 60 * 60 * 1000).toISOString())}
                          {isOverdue(task) && showOverdue && <span className="font-medium"> (Overdue)</span>}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  )}
                  <TableCell className="text-muted-foreground">
                    {task.scheduledAt ? formatDate(task.scheduledAt) : <span className="text-muted-foreground/60">-</span>}
                  </TableCell>
                  <TableCell>
                    {task.assets.length > 0 ? (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        {getAssetIcon(task.assets[0].filename)}
                        <span>{task.assets.length} file{task.assets.length !== 1 ? 's' : ''}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground/60">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {task.platforms?.length ? task.platforms.map((p: any) => p.platform).join(', ') : <span className="text-muted-foreground/60">-</span>}
                  </TableCell>
                  <TableCell>
                    {task.feedback ? (
                      <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                        <MessageSquare className="w-4 h-4" />
                        <span>Available</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground/60">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {isContentApproved ? (
                      <AssetUpload
                        taskId={task.id}
                        onUploadSuccess={() => mutate?.()}
                        buttonClassName="flex items-center gap-2 h-8 text-xs px-3 bg-blue-600 text-white hover:bg-blue-700 rounded-full transition-all duration-200"
                      />
                    ) : (
                      <div className="flex items-center gap-2 bg-yellow-50 dark:bg-yellow-950/30 text-yellow-800 dark:text-yellow-300 px-3 py-1 rounded-full">
                        <Lock className="h-4 w-4" />
                        <span className="text-xs font-medium">Content Pending Approval</span>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}