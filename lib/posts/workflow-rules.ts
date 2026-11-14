/**
 * The post lifecycle, as pure rules. No database, no framework, no imports — so the
 * whole state machine is testable in isolation (`node --test lib/posts/workflow-rules.test.ts`)
 * and the server engine (lib/posts/workflow.ts) and the UI read the same definitions.
 *
 *   DRAFT ──submit──▶ SUBMITTED ──approve──▶ APPROVED ─┬─(client approval OFF)──▶ ready ──schedule──▶ SCHEDULED ──publish──▶ POSTED
 *                       ▲   │                           └─(client approval ON)───▶ pending client ──client approves──▶ C_APPROVED (ready)
 *                       │   ├─reject──────────▶ REJECTED
 *          resubmit ────┘   └─request changes─▶ NEEDS_MINOR_CHANGE
 *
 * Any non-terminal state can be CANCELLED; CANCELLED reopens to DRAFT.
 * A material edit to an approved or scheduled post sends it back to RESUBMITTED.
 *
 * "Pending client approval" is not its own status: it is APPROVED on a post whose
 * `requiresClientApproval` is on. That keeps every existing APPROVED row meaning what it
 * meant before this toggle existed (approved and ready, the default).
 */

export const POST_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "RESUBMITTED",
  "APPROVED",
  "C_APPROVED",
  "REJECTED",
  "NEEDS_MINOR_CHANGE",
  "SCHEDULED",
  "POSTED",
  "CANCELLED",
] as const
export type WorkflowStatus = (typeof POST_STATUSES)[number]

export const WORKFLOW_ACTIONS = [
  "SUBMIT",
  "APPROVE",
  "REJECT",
  "REQUEST_CHANGES",
  "CLIENT_APPROVE",
  "CLIENT_REQUEST_CHANGES",
  "SCHEDULE",
  "RESCHEDULE",
  "UNSCHEDULE",
  "PUBLISH",
  "CANCEL",
  "REOPEN",
  "EDIT_INVALIDATE",
  "CLIENT_TOGGLE",
] as const
export type WorkflowAction = (typeof WORKFLOW_ACTIONS)[number]

/** What a person sees: the workflow stage, derived from status + the client toggle. */
export type WorkflowStage =
  | "DRAFT"
  | "PENDING_APPROVAL"
  | "CHANGES_REQUESTED"
  | "REJECTED"
  | "PENDING_CLIENT"
  | "READY_TO_SCHEDULE"
  | "SCHEDULED"
  | "PUBLISHED"
  | "CANCELLED"

export interface WorkflowPostState {
  status: WorkflowStatus
  requiresClientApproval: boolean
}

export const STAGE_LABELS: Record<WorkflowStage, string> = {
  DRAFT: "Draft",
  PENDING_APPROVAL: "Pending approval",
  CHANGES_REQUESTED: "Changes requested",
  REJECTED: "Rejected",
  PENDING_CLIENT: "Pending client approval",
  READY_TO_SCHEDULE: "Approved · ready to schedule",
  SCHEDULED: "Scheduled",
  PUBLISHED: "Published",
  CANCELLED: "Cancelled",
}

export function stageOf(post: WorkflowPostState): WorkflowStage {
  switch (post.status) {
    case "DRAFT":
      return "DRAFT"
    case "SUBMITTED":
    case "RESUBMITTED":
      return "PENDING_APPROVAL"
    case "NEEDS_MINOR_CHANGE":
      return "CHANGES_REQUESTED"
    case "REJECTED":
      return "REJECTED"
    case "APPROVED":
      return post.requiresClientApproval ? "PENDING_CLIENT" : "READY_TO_SCHEDULE"
    case "C_APPROVED":
      return "READY_TO_SCHEDULE"
    case "SCHEDULED":
      return "SCHEDULED"
    case "POSTED":
      return "PUBLISHED"
    case "CANCELLED":
      return "CANCELLED"
  }
}

/** Every required approval is in: the post may be scheduled or published. */
export const isSchedulable = (post: WorkflowPostState) => stageOf(post) === "READY_TO_SCHEDULE"

/** Content may still be edited (published and cancelled posts are frozen). */
export const isEditable = (post: WorkflowPostState) =>
  post.status !== "POSTED" && post.status !== "CANCELLED"

/** An edit to a post in this state throws away an approval and must be confirmed. */
export const editInvalidatesApproval = (post: WorkflowPostState) =>
  post.status === "APPROVED" || post.status === "C_APPROVED" || post.status === "SCHEDULED"

/** Which catalog permission (`posts:<action>`) an internal user needs for each action. */
export const ACTION_PERMISSION: Record<WorkflowAction, string | null> = {
  SUBMIT: "update",
  APPROVE: "approve",
  REJECT: "approve",
  REQUEST_CHANGES: "approve",
  CLIENT_APPROVE: null, // client share-link only
  CLIENT_REQUEST_CHANGES: null, // client share-link only
  SCHEDULE: "publish",
  RESCHEDULE: "publish",
  UNSCHEDULE: "publish",
  PUBLISH: "publish",
  CANCEL: "status",
  REOPEN: "status",
  EDIT_INVALIDATE: "update",
  CLIENT_TOGGLE: "update",
}

/** Actions that must carry a reason, so a rejection is never unexplained. */
export const REASON_REQUIRED: ReadonlySet<WorkflowAction> = new Set([
  "REJECT",
  "REQUEST_CHANGES",
  "CLIENT_REQUEST_CHANGES",
  "CANCEL",
])

export type ActorType = "USER" | "CLIENT" | "SYSTEM"

export interface DecideInput {
  post: WorkflowPostState
  action: WorkflowAction
  actorType: ActorType
  reason?: string | null
  /** For CLIENT_TOGGLE: the new value of requiresClientApproval. */
  nextRequiresClientApproval?: boolean
  /** A client approval exists for the post's current version (from the timeline). */
  clientApprovedCurrentVersion?: boolean
}

export type Decision =
  | { ok: true; to: WorkflowStatus; bumpVersion: boolean; requiresClientApproval: boolean }
  | { ok: false; code: "INVALID_TRANSITION" | "REASON_REQUIRED" | "FORBIDDEN_ACTOR"; message: string }

const deny = (code: Extract<Decision, { ok: false }>["code"], message: string): Decision => ({
  ok: false,
  code,
  message,
})

/**
 * Decide the result of applying `action` to `post`. The only place a transition is
 * allowed or refused; every route asks this function instead of writing a status.
 */
export function decide(input: DecideInput): Decision {
  const { post, action, actorType } = input
  const { status } = post
  const stage = stageOf(post)
  const keep = post.requiresClientApproval
  const to = (next: WorkflowStatus, bumpVersion = false, requiresClientApproval = keep): Decision => ({
    ok: true,
    to: next,
    bumpVersion,
    requiresClientApproval,
  })
  const invalid = (what: string) =>
    deny("INVALID_TRANSITION", `Cannot ${what} a post that is ${STAGE_LABELS[stage].toLowerCase()}.`)

  if (REASON_REQUIRED.has(action) && !input.reason?.trim()) {
    return deny("REASON_REQUIRED", "A reason is required for this action.")
  }

  const clientOnly = action === "CLIENT_APPROVE" || action === "CLIENT_REQUEST_CHANGES"
  if (clientOnly && actorType !== "CLIENT") {
    return deny("FORBIDDEN_ACTOR", "Only the client can record a client decision.")
  }
  if (!clientOnly && actorType === "CLIENT") {
    return deny("FORBIDDEN_ACTOR", "Clients can only approve or request changes.")
  }
  // Publishing is confirmed by the publisher (the scheduling team or the platform
  // integration) — never inferred from an approval.
  switch (action) {
    case "SUBMIT":
      if (status === "DRAFT") return to("SUBMITTED")
      if (status === "REJECTED" || status === "NEEDS_MINOR_CHANGE") return to("RESUBMITTED")
      return invalid("submit")

    case "APPROVE":
      if (stage !== "PENDING_APPROVAL") return invalid("approve")
      return to("APPROVED")

    case "REJECT":
      if (stage !== "PENDING_APPROVAL") return invalid("reject")
      return to("REJECTED")

    case "REQUEST_CHANGES":
      // A reviewer may also pull back an approval that has not been scheduled yet.
      if (stage === "PENDING_APPROVAL" || stage === "PENDING_CLIENT" || stage === "READY_TO_SCHEDULE") {
        return to("NEEDS_MINOR_CHANGE")
      }
      return invalid("request changes on")

    case "CLIENT_APPROVE":
      if (stage !== "PENDING_CLIENT") return invalid("client-approve")
      return to("C_APPROVED")

    case "CLIENT_REQUEST_CHANGES":
      if (stage !== "PENDING_CLIENT") return invalid("request changes on")
      return to("NEEDS_MINOR_CHANGE")

    case "SCHEDULE":
      if (!isSchedulable(post)) {
        return stage === "PENDING_CLIENT"
          ? deny("INVALID_TRANSITION", "This post is waiting for client approval and cannot be scheduled yet.")
          : invalid("schedule")
      }
      return to("SCHEDULED")

    case "RESCHEDULE":
      if (status !== "SCHEDULED") return invalid("reschedule")
      return to("SCHEDULED")

    case "UNSCHEDULE":
      if (status !== "SCHEDULED") return invalid("unschedule")
      return to(keep ? "C_APPROVED" : "APPROVED")

    case "PUBLISH":
      if (status === "SCHEDULED" || isSchedulable(post)) return to("POSTED")
      return invalid("publish")

    case "CANCEL":
      if (status === "POSTED" || status === "CANCELLED") return invalid("cancel")
      return to("CANCELLED")

    case "REOPEN":
      if (status !== "CANCELLED") return invalid("reopen")
      return to("DRAFT")

    case "EDIT_INVALIDATE":
      if (!isEditable(post)) return invalid("edit")
      // An edit while pending stays pending, at a new version; an edit after approval
      // restarts approval. Draft and sent-back posts are simply edited.
      if (editInvalidatesApproval(post)) return to("RESUBMITTED", true)
      return to(status, stage === "PENDING_APPROVAL")

    case "CLIENT_TOGGLE": {
      const next = !!input.nextRequiresClientApproval
      if (next === keep) return to(status, false, next)
      if (status === "POSTED" || status === "CANCELLED") return invalid("change client approval on")
      if (next) {
        // Turned ON. Anything already past internal approval without a client approval
        // for this version goes back to waiting for the client.
        const clientDone = !!input.clientApprovedCurrentVersion
        if ((status === "SCHEDULED" || status === "C_APPROVED") && !clientDone) return to("APPROVED", false, true)
        if (status === "C_APPROVED" && clientDone) return to("C_APPROVED", false, true)
        return to(status, false, true)
      }
      // Turned OFF: nothing waits for the client any more; status is unchanged and an
      // APPROVED post simply becomes ready to schedule.
      return to(status, false, false)
    }
  }
}
