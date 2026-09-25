export type ApprovalStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "CHANGES_REQUESTED"
  | "CANCELLED";

export type ApprovalDecisionType =
  | "APPROVE"
  | "REJECT"
  | "REQUEST_CHANGES"
  | "COMMENT";

/** Append-only: there is no endpoint that edits or removes one of these. */
export interface ApprovalDecision {
  id: string;
  decision: ApprovalDecisionType;
  comment: string | null;
  createdAt: string;
  user: { id: string; firstName: string; lastName: string } | null;
  clientPortalUser: { id: string; name: string } | null;
}

export interface ApprovalRequest {
  id: string;
  companyId: string;
  entity: string;
  entityId: string;
  title: string;
  note: string | null;
  status: ApprovalStatus;
  dueAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
  requestedById: string;
  requestedBy: { id: string; firstName: string; lastName: string } | null;
  assignedTo: { id: string; firstName: string; lastName: string } | null;
  clientPortalUser: { id: string; name: string; email: string } | null;
  decisions: ApprovalDecision[];
}

export const APPROVAL_STATUSES: ApprovalStatus[] = [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "CHANGES_REQUESTED",
  "CANCELLED",
];

/** Entities the backend will currently accept for approval. */
export const APPROVABLE_ENTITIES = [
  "POST",
  "CAMPAIGN",
  "QUOTATION",
  "INVOICE",
  "EXPENSE",
  "PROJECT",
  "DOCUMENT",
] as const;

/** Where a given entity's record lives, so an approval can link to it. */
export const ENTITY_LINK: Record<string, (id: string) => string | null> = {
  POST: (id) => `/content?postId=${id}`,
  CAMPAIGN: () => "/campaigns-list",
  QUOTATION: (id) => `/quotations-list/${id}`,
  INVOICE: (id) => `/invoices-list/${id}`,
  PROJECT: (id) => `/projects-list/${id}`,
};

export const DECISION_COPY: Record<
  ApprovalDecisionType,
  { label: string; tone: string }
> = {
  APPROVE: { label: "Approved", tone: "text-emerald-600 dark:text-emerald-400" },
  REJECT: { label: "Rejected", tone: "text-rose-600 dark:text-rose-400" },
  REQUEST_CHANGES: {
    label: "Requested changes",
    tone: "text-amber-600 dark:text-amber-400",
  },
  COMMENT: { label: "Commented", tone: "text-muted-foreground" },
};
