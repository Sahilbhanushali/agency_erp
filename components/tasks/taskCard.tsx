import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Clock,
  Calendar,
  User,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Upload,
  Eye,
  MessageSquare,
  Image,
  Video,
  FileText,
  Link as LinkIcon,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Edit,
  Trash2,
  Volume2,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { getMediaUrl, getGoogleDriveEmbedUrl } from "@/lib/utils";
import AssetUpload from "./assetUpload";
import MediaPopup from "../mediaPopup";

enum PostStatus {
  DRAFT = "DRAFT",
  SUBMITTED = "SUBMITTED",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
  SCHEDULED = "SCHEDULED",
  POSTED = "POSTED",
  RESUBMITTED = "RESUBMITTED",
  NEEDS_MINOR_CHANGE = "NEEDS_MINOR_CHANGE",
}

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  type: string;
  user?: {
    name: string;
  };
}

interface AudioAttachment {
  type: "AUDIO";
  url: string;
  filename: string;
  size: number;
  mimeType: string;
  uploadedAt: string;
}

interface ApprovalFlow {
  status: string;
  attachments: AudioAttachment[];
}

interface Task {
  id: string;
  title: string;
  caption?: string;
  type: string;
  status: PostStatus;
  contentStatus?: string; // Added to support contentStatus check
  scheduledAt?: string;
  designDueDate?: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  project?: {
    id?: string;
    name?: string;
    client?: {
      name: string;
      company?: string;
      avatar?: string | null;
    };
  };
  assets: Array<{
    id: string;
    filename: string;
    url: string;
    createdAt?: string;
    type: string;
    isReference: boolean;
  }>;
  platforms?: Array<{
    id: string;
    platform: string;
  }>;
  assignedToId?: number;
  assignedTo?: {
    name: string;
    email: string;
  };
  feedback?: string;
  priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  customData?: {
    notes?: string;
    referenceUrl?: string;
  };
  comments?: Comment[];
  approvalFlows?: ApprovalFlow[];
}

interface TaskCardProps {
  task: Task;
  showDeadlines?: boolean;
  showOverdue?: boolean;
  showStatus?: boolean;
  showAll?: boolean;
  onClick?: (task: Task) => void;
  currentUserId?: number;
  mutate?: () => void;
}

export default function TaskCard({
  task,
  showDeadlines = false,
  showOverdue = false,
  showStatus = true,
  showAll = false,
  onClick,
  currentUserId,
  mutate,
}: TaskCardProps) {
  const router = useRouter();
  const [imageErrors, setImageErrors] = useState<{ [key: string]: boolean }>({});
  const [selectedAsset, setSelectedAsset] = useState<{
    url: string;
    filename: string;
    type: string;
  } | null>(null);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [currentAssetIndex, setCurrentAssetIndex] = useState(0);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const isContentApproved = task.contentStatus === "APPROVED";
  const isContentPending = !isContentApproved;

  const getStatusColor = (status: PostStatus) => {
    switch (status) {
      case PostStatus.DRAFT:
        return "bg-muted text-muted-foreground border-border";
      case PostStatus.SUBMITTED:
        return "bg-info/10 text-info border-info/20";
      case PostStatus.APPROVED:
        return "bg-success/10 text-success border-success/20";
      case PostStatus.REJECTED:
        return "bg-destructive/10 text-destructive border-destructive/20";
      case PostStatus.NEEDS_MINOR_CHANGE:
        return "bg-warning/10 text-warning border-warning/20";
      case PostStatus.SCHEDULED:
        return "bg-info/10 text-info border-info/20";
      case PostStatus.POSTED:
        return "bg-success/10 text-success border-success/20";
      case PostStatus.RESUBMITTED:
        return "bg-primary/10 text-primary border-primary/20";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  const getStatusIcon = (status: PostStatus) => {
    switch (status) {
      case PostStatus.APPROVED:
        return <CheckCircle2 className="w-4 h-4" />;
      case PostStatus.REJECTED:
        return <XCircle className="w-4 h-4" />;
      case PostStatus.NEEDS_MINOR_CHANGE:
        return <AlertTriangle className="w-4 h-4 text-amber-600" />;
      case PostStatus.SUBMITTED:
        return <Upload className="w-4 h-4" />;
      case PostStatus.SCHEDULED:
        return <Calendar className="w-4 h-4" />;
      case PostStatus.POSTED:
        return <Eye className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case "URGENT":
        return "bg-destructive text-destructive-foreground";
      case "HIGH":
        return "bg-warning text-foreground";
      case "MEDIUM":
        return "bg-warning/20 text-warning";
      case "LOW":
        return "bg-success text-white";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getAssetIcon = (filename: string) => {
    const ext = filename.toLowerCase().split(".").pop();
    if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext || "")) {
      return <Image className="w-5 h-5" />;
    }
    if (["mp4", "mov", "avi", "mkv"].includes(ext || "")) {
      return <Video className="w-5 h-5" />;
    }
    return <FileText className="w-5 h-5" />;
  };

  const isOverdue = () => {
    let designDue = task.designDueDate ? new Date(task.designDueDate) : null;
    if (!designDue && task.scheduledAt) {
      designDue = new Date(task.scheduledAt);
      designDue.setDate(designDue.getDate() - 7);
    }
    if (!designDue) return false;
    return designDue < new Date() && task.status === PostStatus.DRAFT;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
    });
  };

  const handleViewAssets = () => {
    router.push(`/dashboard/projects/posts/${task.id}`);
  };

  const handleImageError = (assetId: string) => {
    setImageErrors((prev) => ({ ...prev, [assetId]: true }));
  };

  const handleAssetClick = (asset: {
    id: string;
    filename: string;
    url: string;
    type: string;
  }) => {
    setSelectedAsset(asset);
    setIsPopupOpen(true);
  };

  const handleTitleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    router.push(`/dashboard/projects/posts/${task.id}`);
    onClick?.(task);
  };

  const designDueDate = task.designDueDate
    ? new Date(task.designDueDate)
    : task.scheduledAt
    ? new Date(new Date(task.scheduledAt).getTime() - 7 * 24 * 60 * 60 * 1000)
    : null;

  const isAssignedDesigner = currentUserId && task.assignedToId === currentUserId;
  const isRejected = task.status === PostStatus.REJECTED || task.status === PostStatus.NEEDS_MINOR_CHANGE;

  const referenceAssets = task.assets.filter((asset) => asset.isReference);
  const designAssets = task.assets.filter((asset) => !asset.isReference);

  const getDesignRejectionReason = () => {
    if (!task.comments) return null;
    
    const designComments = task.comments
      .filter(comment => comment.type === "DESIGN")
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    return designComments.length > 0 ? designComments[0] : null;
  };

  const getLatestAudioRejection = (): AudioAttachment | null => {
    if (!task.approvalFlows) return null;
    
    const allAudioAttachments: AudioAttachment[] = [];
    
    task.approvalFlows.forEach(flow => {
      if (flow.attachments && flow.attachments.length > 0) {
        const audioAttachments = flow.attachments.filter(att => att.type === "AUDIO");
        allAudioAttachments.push(...audioAttachments);
      }
    });
    
    if (allAudioAttachments.length > 0) {
      allAudioAttachments.sort((a, b) => 
        new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
      );
      return allAudioAttachments[0];
    }
    
    return null;
  };

  const handlePlayAudio = () => {
    if (isContentApproved && audioRef.current) {
      if (isPlayingAudio) {
        audioRef.current.pause();
        setIsPlayingAudio(false);
      } else {
        audioRef.current.play();
        setIsPlayingAudio(true);
      }
    }
  };

  const designRejectionComment = getDesignRejectionReason();
  const latestAudioRejection = getLatestAudioRejection();

  const handlePrevAsset = () => {
    setCurrentAssetIndex((prev) => (prev - 1 + designAssets.length) % designAssets.length);
  };

  const handleNextAsset = () => {
    setCurrentAssetIndex((prev) => (prev + 1) % designAssets.length);
  };

  const currentAsset = designAssets.length > 0 ? designAssets[currentAssetIndex] : null;

  const isVideo = currentAsset
    ? ["mp4", "mov", "avi", "mkv"].includes(currentAsset.filename.toLowerCase().split(".").pop() || "")
    : false;

  return (
    <>
      <Card
        className={`w-full max-w-lg border transition-colors duration-150 ${
          (isOverdue() && showOverdue) || isRejected 
            ? "border-destructive/30 bg-destructive/5 ring-1 ring-destructive/20"
            : "border-border"
        }`}
      >
        {/* Instagram-like header with client.company and client avatar */}
        <div className="flex items-center px-3 pt-3 pb-2">
          <img
            src={task.project?.client?.avatar || "/placeholder-client-logo.png"}
            alt={`${task.project?.client?.company || task.project?.client?.name} logo`}
            className="w-8 h-8 rounded-full mr-2 object-cover"
            onError={(e) => (e.currentTarget.src = "/placeholder-client-logo.png")}
          />
          <span className="font-semibold text-sm text-foreground truncate">
            {task.project?.client?.company || task.project?.client?.name || "Unknown Client"}
          </span>
        </div>

        <div className="relative aspect-square">
          {designAssets.length > 0 && currentAsset ? (
            <>
              <div
                className={`relative w-full h-full cursor-pointer`}
                onClick={() => handleAssetClick(currentAsset)}
              >
                {imageErrors[currentAsset.id] ? (
                <div className="flex flex-col items-center justify-center h-full bg-gradient-to-br from-destructive/5 to-destructive/10 border border-border rounded">
                    <AlertCircle className="h-8 w-8 text-destructive mb-2" />
                    <span className="text-destructive text-sm font-medium">Failed to load media</span>
                    <span className="text-destructive/70 text-xs mt-1">{currentAsset.filename}</span>
                  </div>
                ) : currentAsset.type === 'link' ? (
                  getGoogleDriveEmbedUrl(currentAsset.url) ? (
                    <div className="flex flex-col w-full h-full border border-border rounded overflow-hidden">
                      <div className="flex-1 relative">
                        <iframe
                          src={getGoogleDriveEmbedUrl(currentAsset.url)!}
                          className="absolute inset-0 w-full h-full border-0 object-cover"
                          allow="autoplay; encrypted-media"
                          allowFullScreen
                          title={currentAsset.filename || "Google Drive Video"}
                        />
                      </div>
                      <div className="bg-muted/50 p-2 border-t border-border flex items-center gap-2 shrink-0">
                        <LinkIcon className="h-4 w-4 text-blue-500 shrink-0" />
                        <a 
                          href={currentAsset.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline truncate"
                          title={currentAsset.url}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {currentAsset.filename || "Google Drive Link"}
                        </a>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full w-full bg-muted/30 hover:bg-muted/50 transition-colors border border-border rounded p-4 group">
                      <LinkIcon className="h-10 w-10 text-blue-500 mb-2 group-hover:scale-110 transition-transform" />
                      <span className="text-blue-600 text-sm font-medium text-center break-words line-clamp-2 w-full px-2">
                        {currentAsset.filename || "External Link"}
                      </span>
                    </div>
                  )
                ) : (
                  <>
                    {isVideo ? (
                      <video
                        src={getMediaUrl(currentAsset.url)}
                        controls
                        className="w-full h-full object-cover"
                        onError={() => handleImageError(currentAsset.id)}
                      />
                    ) : (
                      <img
                        src={getMediaUrl(currentAsset.url)}
                        alt={currentAsset.filename}
                        className="w-full h-full object-cover"
                        onError={() => handleImageError(currentAsset.id)}
                      />
                    )}
                  </>
                )}
                {isContentPending && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 pointer-events-none">
                    <div className="flex items-center gap-2 bg-yellow-100 dark:bg-yellow-950/30 text-yellow-800 dark:text-yellow-300 px-3 py-2 rounded-lg">
                      <Lock className="h-4 w-4" />
                      <span className="text-sm font-medium">Content Pending</span>
                    </div>
                  </div>
                )}
              </div>
              {designAssets.length > 1 && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`absolute left-2 top-1/2 transform -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white border-0 rounded-full z-10`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePrevAsset();
                    }}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`absolute right-2 top-1/2 transform -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white border-0 rounded-full z-10`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleNextAsset();
                    }}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <div className="absolute bottom-2 right-2 bg-black/70 text-white px-2 py-1 rounded text-xs font-medium z-10">
                    {(currentAssetIndex + 1)} / {designAssets.length}
                  </div>
                </>
              )}
              <Badge className={`absolute top-2 left-2 ${getStatusColor(task.status)} text-xs font-medium z-10`}>
                {task.status.charAt(0) + task.status.slice(1).toLowerCase()}
              </Badge>
            </>
          ) : (
            <div className="flex items-center justify-center h-full bg-gradient-to-br from-muted to-muted/50 border border-border rounded">
              <span className="text-muted-foreground text-sm font-medium">Design is pending</span>
              <Badge className={`absolute top-2 left-2 ${getStatusColor(task.status)} text-xs font-medium`}>
                {task.status.charAt(0) + task.status.slice(1).toLowerCase()}
              </Badge>
              {isContentPending && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <div className="flex items-center gap-2 bg-yellow-100 dark:bg-yellow-950/30 text-yellow-800 dark:text-yellow-300 px-3 py-2 rounded-lg">
                    <Lock className="h-4 w-4" />
                    <span className="text-sm font-medium">Content Pending Approval</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <CardContent className={`p-3 ${isRejected ? "text-red-800 dark:text-red-200" : ""}`}>
          <div className="space-y-2">
            <h3
              className={`line-clamp-1 cursor-pointer text-sm font-semibold text-foreground hover:text-primary hover:underline ${isRejected ? "text-destructive" : ""}`}
              onClick={handleTitleClick}
            >
              {task.title}
            </h3>
            {task.caption && (
              <p className={`text-xs ${isRejected ? "text-red-600 dark:text-red-400" : "text-muted-foreground"} line-clamp-1`}>
                {task.caption}
              </p>
            )}
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Created By : {task.createdBy || "Unknown Project"}</span>
              <span>Created At : {task.createdAt ? formatDate(task.createdAt) : ""}</span>
            </div>
            {/* {task.assignedTo && (
              <div className="text-xs text-gray-500 truncate">Assigned: {task.assignedTo.name}</div>
            )} */}
            {(task.priority || showAll) && task.priority && (
              <div className="text-xs text-muted-foreground">
                <Badge className={getPriorityColor(task.priority)}>
                  {task.priority.charAt(0) + task.priority.slice(1).toLowerCase()} Priority
                </Badge>
              </div>
            )}
            {(showDeadlines || showAll) && designDueDate && (
              <div className={`text-xs ${isRejected ? "text-red-500 dark:text-red-400" : "text-muted-foreground"}`}>
                <span className="font-medium">Due Date: </span>
                {formatDate(designDueDate.toISOString())}
                {isOverdue() && <span className="font-medium text-red-600"> (Overdue)</span>}
              </div>
            )}
            {/* {task.scheduledAt && (
              <div className={`text-xs ${isRejected ? "text-red-500" : "text-gray-500"}`}>
                <span className="font-medium">Post Date: </span>
                {formatDate(task.scheduledAt)}
              </div>
            )} */}
            {isContentPending && (
              <div className="text-xs">
                <div className="flex items-center gap-2 bg-yellow-50 dark:bg-yellow-950/30 text-yellow-800 dark:text-yellow-300 px-2 py-1 rounded">
                  <Lock className="h-4 w-4" />
                  <span className="font-medium">Content Pending Approval</span>
                </div>
              </div>
            )}
            {isRejected && (
              <div className="space-y-2">
                {designRejectionComment && (
                  <div className="text-xs">
                    <div className="text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 px-2 py-1 rounded text-xs">
                      <span className="font-medium">Changes: </span>
                      {designRejectionComment.content.length > 40
                        ? `${designRejectionComment.content.substring(0, 40)}...`
                        : designRejectionComment.content}
                    </div>
                  </div>
                )}
                {latestAudioRejection && (
                  <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded px-2 py-2">
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        className={`h-8 px-2 text-red-600 hover:bg-red-100`}
                        onClick={handlePlayAudio}
                      >
                        <Volume2 className={`h-4 w-4 mr-1 ${isPlayingAudio ? 'animate-pulse' : ''}`} />
                        {isPlayingAudio ? 'Playing...' : 'Play Audio Feedback'}
                      </Button>
                      <span className="text-xs text-red-500">
                        {formatDate(latestAudioRejection.uploadedAt)}
                      </span>
                    </div>
                    <audio
                      ref={audioRef}
                      src={latestAudioRejection.url}
                      onEnded={() => setIsPlayingAudio(false)}
                      onPause={() => setIsPlayingAudio(false)}
                      className="hidden"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center justify-between mt-2">
            <Button
              size="sm"
              variant="outline"
              className={`h-7 text-xs px-2 ${
                isRejected ? "text-red-650 dark:text-red-400 border-red-200 dark:border-red-900/60 hover:bg-red-50 dark:hover:bg-red-950/30" : ""
              }`}
              onClick={handleViewAssets}
            >
              <Eye className="mr-1 h-3 w-3" />
              View
            </Button>
            <div className="flex items-center gap-2">
              <AssetUpload
                taskId={task.id}
                onUploadSuccess={mutate}
                buttonVariant="outline"
                buttonClassName={`h-7 text-xs px-2 ${
                  isRejected ? "text-red-650 dark:text-red-400 border-red-200 dark:border-red-900/60 hover:bg-red-50 dark:hover:bg-red-950/30" : ""
                }`}
              />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    className={`h-7 p-1`}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="text-xs">
                  <DropdownMenuItem
                    onClick={() => router.push(`/dashboard/projects/posts/${task.id}/edit`)}
                  >
                    <Edit className="mr-2 h-3 w-3" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      // Placeholder for delete functionality
                    }}
                    className="text-red-600"
                  >
                    <Trash2 className="mr-2 h-3 w-3" />
                    Delete
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      // Placeholder for viewing assets
                    }}
                  >
                    <FileText className="mr-2 h-3 w-3" />
                    Assets ({task.assets?.length || 0})
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardContent>
      </Card>

      <MediaPopup
        isOpen={isPopupOpen}
        onClose={() => setIsPopupOpen(false)}
        asset={selectedAsset}
      />
    </>
  );
}
