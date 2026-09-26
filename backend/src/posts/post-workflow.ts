import { BadRequestException } from '@nestjs/common';
import { PostStatus } from '@prisma/client';

/**
 * The content production workflow, as a transition map rather than free-form status
 * writes, so a post cannot jump from PUBLISHED back to IDEA or skip review entirely.
 *
 * ponytail: one workflow for every content type. The brief wants per-type workflows
 * (a reel goes through Script/Shoot/Edit, a carousel through Copy/Design) and those
 * would need a WorkflowDefinition model the schema does not have yet — a migration,
 * not a constant. Add it when a second workflow actually exists.
 */
export const POST_TRANSITIONS: Record<PostStatus, PostStatus[]> = {
  IDEA: [PostStatus.DRAFT, PostStatus.CANCELLED],
  DRAFT: [PostStatus.IN_DESIGN, PostStatus.IN_REVIEW, PostStatus.CANCELLED],
  IN_DESIGN: [PostStatus.IN_REVIEW, PostStatus.DRAFT, PostStatus.CANCELLED],
  IN_REVIEW: [
    PostStatus.APPROVED,
    PostStatus.NEEDS_REVISION,
    PostStatus.CANCELLED,
  ],
  NEEDS_REVISION: [
    PostStatus.DRAFT,
    PostStatus.IN_DESIGN,
    PostStatus.IN_REVIEW,
    PostStatus.CANCELLED,
  ],
  APPROVED: [
    PostStatus.SCHEDULED,
    PostStatus.NEEDS_REVISION,
    PostStatus.CANCELLED,
  ],
  // PUBLISHED is absent on purpose — see assertTransition.
  SCHEDULED: [PostStatus.APPROVED, PostStatus.CANCELLED],
  PUBLISHED: [],
  CANCELLED: [PostStatus.DRAFT],
};

export function assertTransition(from: PostStatus, to: PostStatus) {
  if (from === to) return;

  /**
   * Publishing owns this status. A post turns PUBLISHED only once every PostTarget
   * has gone live and carries a platform post id, whether that came from a provider
   * call or from someone recording a manual publish. Setting it directly would be a
   * claim with no evidence behind it, so the status field refuses.
   */
  if (to === PostStatus.PUBLISHED) {
    throw new BadRequestException(
      'Publish each destination instead — a post turns PUBLISHED once every destination has gone live.',
    );
  }

  if (!POST_TRANSITIONS[from].includes(to)) {
    const allowed = POST_TRANSITIONS[from];
    throw new BadRequestException(
      allowed.length
        ? `Cannot move a post from ${from} to ${to}. Allowed from ${from}: ${allowed.join(', ')}.`
        : `${from} is a final status and cannot be changed.`,
    );
  }
}
