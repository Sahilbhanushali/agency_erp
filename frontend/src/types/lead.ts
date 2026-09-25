import type { TaskPriority } from "./task";

export type LeadStatus =
  | "NEW"
  | "CONTACTED"
  | "QUALIFIED"
  | "PROPOSAL"
  | "NEGOTIATION"
  | "WON"
  | "LOST";

export type LeadSource =
  | "WEBSITE"
  | "REFERRAL"
  | "SOCIAL"
  | "COLD_OUTREACH"
  | "EVENT"
  | "INBOUND_CALL"
  | "PARTNER"
  | "OTHER";

export type LeadActivityType =
  | "NOTE"
  | "CALL"
  | "EMAIL"
  | "MEETING"
  | "STATUS_CHANGED"
  | "ASSIGNED"
  | "FOLLOW_UP_SET"
  | "CONVERTED";

export interface LeadActivity {
  id: string;
  type: LeadActivityType;
  note: string | null;
  fromValue: string | null;
  toValue: string | null;
  createdAt: string;
  user: { id: string; firstName: string; lastName: string } | null;
}

export interface Lead {
  id: string;
  companyId: string;
  ownerId: string | null;
  name: string;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  source: LeadSource;
  industry: string | null;
  estimatedValue: string | null;
  currency: string;
  status: LeadStatus;
  priority: TaskPriority;
  notes: string | null;
  nextFollowUpAt: string | null;
  position: number;
  convertedClientId: string | null;
  lostReason: string | null;
  closedAt: string | null;
  createdAt: string;
  owner: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
  } | null;
  convertedClient: { id: string; name: string } | null;
  _count?: { activities: number };
}

export interface LeadDetail extends Lead {
  activities: LeadActivity[];
}

export interface PipelineStageSummary {
  status: LeadStatus;
  count: number;
  value: number;
}

export interface CreateLeadPayload {
  companyId?: string;
  name: string;
  companyName?: string;
  email?: string;
  phone?: string;
  source?: LeadSource;
  industry?: string;
  estimatedValue?: number;
  currency?: string;
  status?: LeadStatus;
  priority?: TaskPriority;
  ownerId?: string | null;
  notes?: string;
  nextFollowUpAt?: string | null;
  lostReason?: string;
}

export type UpdateLeadPayload = Partial<Omit<CreateLeadPayload, "companyId">>;

/** Board column order, matching the server's pipeline. */
export const PIPELINE_STAGES: LeadStatus[] = [
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "PROPOSAL",
  "NEGOTIATION",
  "WON",
  "LOST",
];

export const LEAD_SOURCES: LeadSource[] = [
  "WEBSITE",
  "REFERRAL",
  "SOCIAL",
  "COLD_OUTREACH",
  "EVENT",
  "INBOUND_CALL",
  "PARTNER",
  "OTHER",
];

export const LOGGABLE_ACTIVITIES: LeadActivityType[] = [
  "CALL",
  "EMAIL",
  "MEETING",
  "NOTE",
];

/** A won deal reads as success, a lost one as closed — not as a failure state. */
export const STAGE_DOT: Record<LeadStatus, string> = {
  NEW: "bg-neutral-400",
  CONTACTED: "bg-sky-500",
  QUALIFIED: "bg-indigo-500",
  PROPOSAL: "bg-amber-500",
  NEGOTIATION: "bg-orange-500",
  WON: "bg-emerald-500",
  LOST: "bg-neutral-300 dark:bg-neutral-600",
};
