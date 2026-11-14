/**
 * What a post means to the CLIENT on their share link. Pure and import-free so both
 * customer views (lookbook and post detail) render the same thing the server enforces:
 * the client can approve only a post that is waiting for them.
 */
export type ClientReviewState =
  | "AWAITING_CLIENT"
  | "CLIENT_APPROVED"
  | "CHANGES_REQUESTED"
  | "AGENCY_APPROVED"
  | "IN_PROGRESS"
  | "SCHEDULED"
  | "PUBLISHED"

export function clientReviewState(post: {
  status: string
  requiresClientApproval?: boolean | null
}): ClientReviewState {
  switch (post.status) {
    case "APPROVED":
      return post.requiresClientApproval ? "AWAITING_CLIENT" : "AGENCY_APPROVED"
    case "C_APPROVED":
      return "CLIENT_APPROVED"
    case "REJECTED":
    case "NEEDS_MINOR_CHANGE":
      return "CHANGES_REQUESTED"
    case "SCHEDULED":
      return "SCHEDULED"
    case "POSTED":
      return "PUBLISHED"
    default:
      return "IN_PROGRESS"
  }
}

export const CLIENT_REVIEW_LABELS: Record<ClientReviewState, string> = {
  AWAITING_CLIENT: "Awaiting your approval",
  CLIENT_APPROVED: "Approved",
  CHANGES_REQUESTED: "Changes requested",
  AGENCY_APPROVED: "Approved by the team",
  IN_PROGRESS: "In progress",
  SCHEDULED: "Scheduled",
  PUBLISHED: "Published",
}

/** States in which the post no longer needs anything from the client. */
export const isClientDone = (state: ClientReviewState) =>
  state === "CLIENT_APPROVED" || state === "AGENCY_APPROVED" || state === "SCHEDULED" || state === "PUBLISHED"
