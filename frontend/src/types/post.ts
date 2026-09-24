export type PostStatus =
  | "IDEA"
  | "DRAFT"
  | "IN_DESIGN"
  | "IN_REVIEW"
  | "NEEDS_REVISION"
  | "APPROVED"
  | "SCHEDULED"
  | "PUBLISHED"
  | "CANCELLED";

export type PostType =
  | "STATIC"
  | "CAROUSEL"
  | "REEL"
  | "STORY"
  | "VIDEO"
  | "GIF"
  | "POLL"
  | "TEXT"
  | "LINK";

export interface PostReference {
  id: string;
  url: string;
  title: string | null;
  note: string | null;
  position: number;
}

export interface PostTimelineEntry {
  id: string;
  action: string;
  note: string | null;
  fromValue: string | null;
  toValue: string | null;
  createdAt: string;
  user: { id: string; firstName: string; lastName: string } | null;
}

export interface Post {
  id: string;
  companyId: string;
  clientId: string;
  campaignId: string | null;
  projectId: string | null;
  workspaceId: string | null;
  title: string;
  caption: string | null;
  postType: PostType;
  status: PostStatus;
  scheduledDate: string | null;
  createdAt: string;
  updatedAt: string;
  client: { id: string; name: string } | null;
  campaign: { id: string; name: string } | null;
  project: { id: string; title: string } | null;
  workspace: { id: string; name: string; colorHex: string | null } | null;
  assignee: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
  } | null;
  createdBy: { id: string; firstName: string; lastName: string } | null;
  _count?: { media: number; references: number };
}

export interface PostDetail extends Post {
  references: PostReference[];
  timeline: PostTimelineEntry[];
  /** Which statuses this post may move to next, decided by the server. */
  allowedTransitions: PostStatus[];
}

export interface CreatePostPayload {
  clientId: string;
  companyId?: string;
  campaignId?: string | null;
  projectId?: string | null;
  workspaceId?: string | null;
  title: string;
  caption?: string;
  postType?: PostType;
  status?: PostStatus;
  scheduledDate?: string | null;
  assigneeId?: string | null;
}

export type UpdatePostPayload = Partial<
  Omit<CreatePostPayload, "companyId" | "clientId">
>;

export const POST_STATUSES: PostStatus[] = [
  "IDEA",
  "DRAFT",
  "IN_DESIGN",
  "IN_REVIEW",
  "NEEDS_REVISION",
  "APPROVED",
  "SCHEDULED",
  "PUBLISHED",
  "CANCELLED",
];

/** New content may only be raised at these; everything later is a workflow move. */
export const INITIAL_POST_STATUSES: PostStatus[] = ["IDEA", "DRAFT"];

export const POST_TYPES: PostType[] = [
  "STATIC",
  "CAROUSEL",
  "REEL",
  "STORY",
  "VIDEO",
  "GIF",
  "POLL",
  "TEXT",
  "LINK",
];
