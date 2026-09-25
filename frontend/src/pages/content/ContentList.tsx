import ConfirmDialog from "@/components/shared/ConfirmDialog";
import DataTableShell from "@/components/shared/DataTableShell";
import PageHeader from "@/components/shared/PageHeader";
import PostsListTable from "@/components/tables/PostsListTable";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/context/AuthContext";
import { useDebounced } from "@/hooks/use-debounced";
import { usePaginatedList } from "@/hooks/use-paginated-list";
import { api, ApiError } from "@/lib/api";
import { can } from "@/lib/permissions";
import { humanizeEnum } from "@/types/campaign";
import {
  POST_STATUSES,
  POST_TYPES,
  type Post,
  type PostStatus,
  type PostType,
} from "@/types/post";
import { FileText, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import PostDetailSheet from "./components/PostDetailSheet";
import PostFormDialog from "./components/PostFormDialog";

export default function ContentList() {
  const { user: actor } = useAuth();
  const isSuperAdmin = actor?.roleName === "SUPER_ADMIN";

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<PostStatus | "ALL">("ALL");
  const [postType, setPostType] = useState<PostType | "ALL">("ALL");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [formOpen, setFormOpen] = useState(false);
  const [postToEdit, setPostToEdit] = useState<Post | null>(null);
  const [postToDelete, setPostToDelete] = useState<Post | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // A notification links to /content?postId=..., so that item opens directly.
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedId, setSelectedId] = useState<string | null>(() =>
    searchParams.get("postId")
  );

  const debouncedSearch = useDebounced(search);

  const query = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(pageSize),
    });
    if (status !== "ALL") params.set("status", status);
    if (postType !== "ALL") params.set("postType", postType);
    if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
    return params.toString();
  }, [page, pageSize, status, postType, debouncedSearch]);

  const {
    data: posts,
    total,
    isLoading,
    refetch,
  } = usePaginatedList<Post>("/posts", query, "Failed to load content.");

  useEffect(() => setPage(1), [debouncedSearch, pageSize, status, postType]);

  const canCreate = isSuperAdmin || can(actor, "posts:create");
  const canEdit = isSuperAdmin || can(actor, "posts:update");
  const canPublish = isSuperAdmin || can(actor, "posts:publish");
  const canRequestApproval = isSuperAdmin || can(actor, "approvals:create");
  const canDelete = isSuperAdmin || can(actor, "posts:delete");

  const openCreate = () => {
    setPostToEdit(null);
    setFormOpen(true);
  };

  const closeDetail = () => {
    setSelectedId(null);
    if (searchParams.has("postId")) {
      searchParams.delete("postId");
      setSearchParams(searchParams, { replace: true });
    }
  };

  const handleDelete = async () => {
    if (!postToDelete) return;
    setIsDeleting(true);
    try {
      await api.delete(`/posts/${postToDelete.id}`);
      toast.success("Content deleted.");
      refetch();
      setPostToDelete(null);
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Failed to delete content."
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const hasFilters = !!search || status !== "ALL" || postType !== "ALL";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Content"
        description="Every post, reel and story from idea through review to scheduling."
        breadcrumbs={[{ label: "Content" }]}
        badge={
          <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-md bg-muted text-muted-foreground border border-border">
            {total} total
          </span>
        }
        actions={
          canCreate && (
            <Button
              size="sm"
              className="gap-1.5 h-9 rounded-lg shadow-xs"
              onClick={openCreate}
            >
              <Plus className="w-4 h-4" />
              <span>New Content</span>
            </Button>
          )
        }
      />

      <DataTableShell
        search={{
          value: search,
          onChange: setSearch,
          placeholder: "Search by title, caption or client...",
        }}
        filters={
          <div className="flex items-center gap-2">
            <Select
              value={status}
              onValueChange={(value) => setStatus(value as PostStatus | "ALL")}
            >
              <SelectTrigger className="w-40 h-9 text-xs bg-background">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL" className="text-xs">
                  All Statuses
                </SelectItem>
                {POST_STATUSES.map((option) => (
                  <SelectItem key={option} value={option} className="text-xs">
                    {humanizeEnum(option)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={postType}
              onValueChange={(value) => setPostType(value as PostType | "ALL")}
            >
              <SelectTrigger className="w-36 h-9 text-xs bg-background">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL" className="text-xs">
                  All Types
                </SelectItem>
                {POST_TYPES.map((option) => (
                  <SelectItem key={option} value={option} className="text-xs">
                    {humanizeEnum(option)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
        isLoading={isLoading}
        isEmpty={posts.length === 0}
        emptyState={{
          icon: FileText,
          title: hasFilters ? "No matching content" : "No content yet",
          description: hasFilters
            ? "Try a different search term or clear the filters."
            : "Raise your first content idea, then move it through design, review and approval before it gets scheduled.",
          action:
            !hasFilters && canCreate
              ? { label: "Create Content", onClick: openCreate, icon: Plus }
              : undefined,
        }}
        pagination={{
          page,
          pageSize,
          total,
          onPageChange: setPage,
          onPageSizeChange: setPageSize,
        }}
      >
        <PostsListTable
          posts={posts}
          onView={(post) => setSelectedId(post.id)}
          onEdit={(post) => {
            setPostToEdit(post);
            setFormOpen(true);
          }}
          onDelete={canDelete ? setPostToDelete : () => undefined}
        />
      </DataTableShell>

      <PostFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        post={postToEdit}
        onSaved={refetch}
      />

      <PostDetailSheet
        postId={selectedId}
        onOpenChange={(open) => !open && closeDetail()}
        onChanged={refetch}
        canEdit={canEdit}
        canPublish={canPublish}
        canRequestApproval={canRequestApproval}
      />

      <ConfirmDialog
        open={!!postToDelete}
        onOpenChange={(open) => !open && setPostToDelete(null)}
        title="Delete Content"
        description={`Delete "${postToDelete?.title}"? Its production timeline and references go with it. This cannot be undone.`}
        isLoading={isDeleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}
