import { ApprovalDecisionType, ApprovalStatus } from '@prisma/client';
import { isResolved, isVerdict, outcomeOf } from './approval-workflow';

describe('approval outcomes', () => {
  it('maps each verdict to the status it produces', () => {
    expect(outcomeOf(ApprovalDecisionType.APPROVE)).toBe(
      ApprovalStatus.APPROVED,
    );
    expect(outcomeOf(ApprovalDecisionType.REJECT)).toBe(
      ApprovalStatus.REJECTED,
    );
    expect(outcomeOf(ApprovalDecisionType.REQUEST_CHANGES)).toBe(
      ApprovalStatus.CHANGES_REQUESTED,
    );
  });

  it('treats a comment as no verdict, so the request stays open', () => {
    expect(outcomeOf(ApprovalDecisionType.COMMENT)).toBeNull();
    expect(isVerdict(ApprovalDecisionType.COMMENT)).toBe(false);
  });

  it('counts every other decision as a verdict', () => {
    for (const decision of [
      ApprovalDecisionType.APPROVE,
      ApprovalDecisionType.REJECT,
      ApprovalDecisionType.REQUEST_CHANGES,
    ]) {
      expect(isVerdict(decision)).toBe(true);
    }
  });

  it('only PENDING counts as unresolved', () => {
    expect(isResolved(ApprovalStatus.PENDING)).toBe(false);
    for (const status of [
      ApprovalStatus.APPROVED,
      ApprovalStatus.REJECTED,
      ApprovalStatus.CHANGES_REQUESTED,
      ApprovalStatus.CANCELLED,
    ]) {
      expect(isResolved(status)).toBe(true);
    }
  });
});
