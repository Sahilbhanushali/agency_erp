import StatusBadge from "@/components/shared/StatusBadge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { humanizeEnum } from "@/types/campaign";
import type { Post } from "@/types/post";
import RowActions from "./RowActions";
import { cellClass, headClass, rowClass } from "./table-styles";

interface PostsListTableProps {
  posts: Post[];
  onView: (post: Post) => void;
  onEdit: (post: Post) => void;
  onDelete: (post: Post) => void;
}

export default function PostsListTable({
  posts,
  onView,
  onEdit,
  onDelete,
}: PostsListTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className={`${headClass} w-14 text-center`}>#</TableHead>
          <TableHead className={headClass}>Content</TableHead>
          <TableHead className={headClass}>Client</TableHead>
          <TableHead className={headClass}>Campaign</TableHead>
          <TableHead className={headClass}>Type</TableHead>
          <TableHead className={headClass}>Scheduled</TableHead>
          <TableHead className={headClass}>Owner</TableHead>
          <TableHead className={headClass}>Status</TableHead>
          <TableHead className={`${headClass} text-end pe-6`}>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {posts.map((post, index) => (
          <TableRow
            key={post.id}
            className={`cursor-pointer ${rowClass}`}
            onClick={() => onView(post)}
          >
            <TableCell
              className={`${cellClass} text-center font-mono text-xs text-muted-foreground`}
            >
              {String(index + 1).padStart(2, "0")}
            </TableCell>
            <TableCell className={cellClass}>
              <div className="flex flex-col">
                <span className="font-semibold text-foreground group-hover:text-primary transition-colors">
                  {post.title}
                </span>
                {post.caption && (
                  <span className="text-[11px] text-muted-foreground truncate max-w-[260px]">
                    {post.caption}
                  </span>
                )}
              </div>
            </TableCell>
            <TableCell
              className={`${cellClass} text-xs font-medium text-foreground/80`}
            >
              {post.client?.name ?? "—"}
            </TableCell>
            <TableCell className={`${cellClass} text-xs text-foreground/80`}>
              {post.campaign?.name ?? "—"}
            </TableCell>
            <TableCell className={`${cellClass} text-xs text-foreground/90`}>
              {humanizeEnum(post.postType)}
            </TableCell>
            <TableCell
              className={`${cellClass} text-xs text-muted-foreground font-mono`}
            >
              {post.scheduledDate
                ? new Date(post.scheduledDate).toLocaleString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "—"}
            </TableCell>
            <TableCell className={cellClass}>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-muted text-muted-foreground font-semibold text-[10px] flex items-center justify-center shrink-0 border border-border">
                  {post.assignee?.firstName?.[0]?.toUpperCase() ?? "—"}
                </div>
                <span className="text-xs text-foreground/90">
                  {post.assignee
                    ? `${post.assignee.firstName} ${post.assignee.lastName}`
                    : "Unassigned"}
                </span>
              </div>
            </TableCell>
            <TableCell className={cellClass}>
              <StatusBadge status={post.status} />
            </TableCell>
            <TableCell className={`${cellClass} text-end pe-6`}>
              <RowActions
                label={post.title}
                onView={() => onView(post)}
                onEdit={() => onEdit(post)}
                onDelete={() => onDelete(post)}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
