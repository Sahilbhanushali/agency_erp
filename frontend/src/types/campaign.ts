export type CampaignStatus =
  | "DRAFT"
  | "PLANNED"
  | "ACTIVE"
  | "PAUSED"
  | "COMPLETED"
  | "CANCELLED";

export type CampaignObjective =
  | "AWARENESS"
  | "ENGAGEMENT"
  | "LEADS"
  | "TRAFFIC"
  | "CONVERSIONS"
  | "SALES"
  | "APP_INSTALLS"
  | "OTHER";

export interface Campaign {
  id: string;
  companyId: string;
  clientId: string;
  projectId: string | null;
  name: string;
  description: string | null;
  objective: CampaignObjective;
  status: CampaignStatus;
  budget: string | null;
  currency: string;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
  client: { id: string; name: string } | null;
  project: { id: string; title: string } | null;
  createdBy: { id: string; firstName: string; lastName: string } | null;
  _count?: { posts: number };
}

/** Ratios are null when the campaign has no data to divide by — never rendered as 0. */
export interface CampaignPerformance {
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
  conversions: number;
  revenue: number;
  clickThroughRate: number | null;
  costPerClick: number | null;
  costPerLead: number | null;
  returnOnAdSpend: number | null;
}

export interface CampaignDetail extends Campaign {
  metrics: {
    id: string;
    periodStart: string;
    periodEnd: string;
    spend: string;
    impressions: number;
    clicks: number;
    leads: number;
    conversions: number;
    revenue: string;
  }[];
  performance: CampaignPerformance;
}

export interface CreateCampaignPayload {
  clientId: string;
  projectId?: string | null;
  companyId?: string;
  name: string;
  description?: string;
  objective?: CampaignObjective;
  status?: CampaignStatus;
  budget?: number;
  currency?: string;
  startDate?: string;
  endDate?: string;
}

export type UpdateCampaignPayload = Partial<
  Omit<CreateCampaignPayload, "companyId">
>;

export const CAMPAIGN_STATUSES: CampaignStatus[] = [
  "DRAFT",
  "PLANNED",
  "ACTIVE",
  "PAUSED",
  "COMPLETED",
  "CANCELLED",
];

export const CAMPAIGN_OBJECTIVES: CampaignObjective[] = [
  "AWARENESS",
  "ENGAGEMENT",
  "LEADS",
  "TRAFFIC",
  "CONVERSIONS",
  "SALES",
  "APP_INSTALLS",
  "OTHER",
];

/** APP_INSTALLS -> "App Installs". Used for objectives and statuses alike. */
export const humanizeEnum = (value: string) =>
  value
    .toLowerCase()
    .split("_")
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
