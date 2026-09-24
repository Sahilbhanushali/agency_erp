export type SocialPlatform =
  | "FACEBOOK"
  | "INSTAGRAM"
  | "LINKEDIN"
  | "TWITTER_X"
  | "YOUTUBE"
  | "GOOGLE"
  | "TIKTOK"
  | "PINTEREST"
  | "SNAPCHAT"
  | "THREADS"
  | "WHATSAPP"
  | "TELEGRAM"
  | "REDDIT";

/** CONNECTING arrives with the first real OAuth flow; nothing sets it yet. */
export type ConnectionState =
  | "NOT_CONNECTED"
  | "CONNECTED"
  | "EXPIRED"
  | "DISCONNECTED";

export interface SocialAccount {
  id: string;
  companyId: string;
  clientId: string;
  platform: SocialPlatform;
  externalId: string;
  accountName: string;
  accountType: string | null;
  isActive: boolean;
  tokenExpiresAt: string | null;
  lastSyncedAt: string | null;
  createdAt: string;
  connectionState: ConnectionState;
  /** False when this deployment has no integration for the platform. */
  publishingAvailable: boolean;
  scopes: string[];
  client?: { id: string; name: string } | null;
}

export type PublishStatus =
  | "PENDING"
  | "SCHEDULED"
  | "PUBLISHING"
  | "PUBLISHED"
  | "FAILED"
  | "CANCELLED";

export interface PostTarget {
  id: string;
  postId: string;
  socialAccountId: string;
  status: PublishStatus;
  scheduledAt: string | null;
  publishedAt: string | null;
  platformPostId: string | null;
  failureReason: string | null;
  socialAccount: {
    id: string;
    platform: SocialPlatform;
    accountName: string;
    externalId: string;
    isActive: boolean;
    connectionState: ConnectionState;
    publishingAvailable: boolean;
  };
}

export const SOCIAL_PLATFORMS: SocialPlatform[] = [
  "INSTAGRAM",
  "FACEBOOK",
  "LINKEDIN",
  "TWITTER_X",
  "YOUTUBE",
  "TIKTOK",
  "PINTEREST",
  "THREADS",
  "SNAPCHAT",
  "GOOGLE",
  "WHATSAPP",
  "TELEGRAM",
  "REDDIT",
];

export const CONNECTION_COPY: Record<
  ConnectionState,
  { label: string; tone: string }
> = {
  CONNECTED: {
    label: "Connected",
    tone: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  },
  NOT_CONNECTED: {
    label: "Not connected",
    tone: "bg-muted text-muted-foreground border-border",
  },
  EXPIRED: {
    label: "Expired",
    tone: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
  },
  DISCONNECTED: {
    label: "Disconnected",
    tone: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30",
  },
};
