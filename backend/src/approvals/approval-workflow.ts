import { ApprovalDecisionType, ApprovalStatus } from '@prisma/client';

/**
 * A comment is not a verdict, so it leaves the request open. The other three are
 * verdicts and close it — a further round of review is a new request, which is what
 * gives each round its own decision trail rather than one mutable blob.
 */
const OUTCOME: Record<ApprovalDecisionType, ApprovalStatus | null> = {
  APPROVE: ApprovalStatus.APPROVED,
  REJECT: ApprovalStatus.REJECTED,
  REQUEST_CHANGES: ApprovalStatus.CHANGES_REQUESTED,
  COMMENT: null,
};

export function outcomeOf(decision: ApprovalDecisionType) {
  return OUTCOME[decision];
}

export function isVerdict(decision: ApprovalDecisionType) {
  return OUTCOME[decision] !== null;
}

export function isResolved(status: ApprovalStatus) {
  return status !== ApprovalStatus.PENDING;
}
