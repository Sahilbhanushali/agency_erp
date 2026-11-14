import { contentStatusLabel, statusLabel } from "@/lib/post-status";
import { PostTypeIcon, typeLabel } from "@/components/posts/post-type-icon";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText,Calendar, Users } from "lucide-react";
import { format } from "date-fns";
import MediaRenderer from "@/components/MediaRenderer";
import PostTimingBadge from "./postTimingBadge";

type PostStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "SCHEDULED" | "POSTED" | "NEEDS_MINOR_CHANGE" | "RESUBMITTED" | "C_APPROVED";

interface Post {
  id: string;
  title: string;
  type: string;
  status: PostStatus;
  scheduledAt?: string;
  createdAt?: string;
  project: { name: string };
  assets: Array<{ id: string; filename: string; url: string; contentType?: string; isReference?: boolean; createdAt?: string }>;
}

interface PostGroupViewProps {
  posts: { [key: string]: Post[] };
  viewMode: "date" | "project";
  handleVideoPlay: (postId: string, assetId: string) => void;
}

const statusColors: Record<PostStatus, string> = {
  DRAFT: "bg-muted text-foreground",
  SUBMITTED: "bg-blue-100 text-blue-800",
  APPROVED: "bg-green-100 dark:bg-green-950/60 text-green-800 dark:text-green-300 border border-green-300 dark:border-green-800",
  REJECTED: "bg-red-100 text-red-800",
  SCHEDULED: "bg-green-700 dark:bg-green-800 text-white border border-green-800 dark:border-green-900 font-semibold shadow-sm",
  POSTED: "bg-green-700 dark:bg-green-800 text-white border border-green-800 dark:border-green-900 font-semibold shadow-sm",
  NEEDS_MINOR_CHANGE: "bg-amber-100 text-amber-800",
  RESUBMITTED: "bg-blue-200 text-blue-900",
  C_APPROVED: "bg-emerald-100 text-emerald-800 border border-emerald-300",
};

export default function PostGroupView({ posts, viewMode, handleVideoPlay }: PostGroupViewProps) {
  return (
    <div className="space-y-4">
      {Object.entries(posts).map(([groupKey, groupPosts]) => (
        <Card key={groupKey}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              {viewMode === "date" && <Calendar className="h-4 w-4" />}
              {viewMode === "project" && <Users className="h-4 w-4" />}
              <span>{viewMode === "date" ? format(new Date(groupKey), "EEEE, MMMM dd, yyyy") : groupKey}</span>
              <Badge variant="secondary">{groupPosts.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {groupPosts.map((post) => (
                <Card key={post.id} className="overflow-hidden">
                  <div className="relative aspect-video">
                    {post.assets.length > 0 ? (
                      <MediaRenderer
                        asset={post.assets[0]}
                        controls={false}
                        onPlay={(assetId) => handleVideoPlay(post.id, assetId)}
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full bg-muted">
                        <FileText className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                    <Badge className={`absolute top-2 left-2 ${statusColors[post.status]}`}>
                      {statusLabel(post.status)}
                    </Badge>
                  </div>
                  <CardContent className="p-3">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-1.5 flex-wrap">
                        <h4 className="font-medium text-sm line-clamp-1 flex-1 min-w-0">{post.title}</h4>
                        <PostTimingBadge post={post} />
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{post.project?.name}</span>
                        <span className="flex items-center gap-1">
                          <PostTypeIcon type={post.type} className="size-3.5" /> {typeLabel(post.type)}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
      {Object.keys(posts).length === 0 && (
        <Card>
          <CardContent className="text-center py-12 text-muted-foreground">
            No posts found matching your filters
          </CardContent>
        </Card>
      )}
    </div>
  );
}