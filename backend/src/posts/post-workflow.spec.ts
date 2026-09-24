import { BadRequestException } from '@nestjs/common';
import { PostStatus } from '@prisma/client';
import { assertTransition, POST_TRANSITIONS } from './post-workflow';

describe('assertTransition', () => {
  it('allows the normal production path', () => {
    const path: PostStatus[] = [
      PostStatus.IDEA,
      PostStatus.DRAFT,
      PostStatus.IN_DESIGN,
      PostStatus.IN_REVIEW,
      PostStatus.APPROVED,
      PostStatus.SCHEDULED,
    ];
    for (let i = 0; i < path.length - 1; i++) {
      expect(() => assertTransition(path[i], path[i + 1])).not.toThrow();
    }
  });

  it('allows a review to bounce back for revision and return', () => {
    expect(() =>
      assertTransition(PostStatus.IN_REVIEW, PostStatus.NEEDS_REVISION),
    ).not.toThrow();
    expect(() =>
      assertTransition(PostStatus.NEEDS_REVISION, PostStatus.IN_DESIGN),
    ).not.toThrow();
  });

  it('refuses to skip review and approve a draft outright', () => {
    expect(() =>
      assertTransition(PostStatus.DRAFT, PostStatus.APPROVED),
    ).toThrow(BadRequestException);
  });

  it('refuses to reopen published content', () => {
    expect(() =>
      assertTransition(PostStatus.PUBLISHED, PostStatus.DRAFT),
    ).toThrow(/final status/);
  });

  it('never lets a hand-written status claim something was published', () => {
    // Publishing owns this status; only a real destination going live evidences it.
    for (const from of Object.values(PostStatus)) {
      if (from === PostStatus.PUBLISHED) continue;
      expect(() => assertTransition(from, PostStatus.PUBLISHED)).toThrow(
        /Publish each destination/,
      );
    }
  });

  it('treats a no-op update as allowed', () => {
    expect(() =>
      assertTransition(PostStatus.PUBLISHED, PostStatus.PUBLISHED),
    ).not.toThrow();
  });

  it('lets anything in flight be cancelled', () => {
    for (const [from, allowed] of Object.entries(POST_TRANSITIONS)) {
      if (from === PostStatus.PUBLISHED || from === PostStatus.CANCELLED)
        continue;
      expect(allowed).toContain(PostStatus.CANCELLED);
    }
  });
});
