import { z } from "zod";

export const createAnnotationSchema = z.object({
  assetId: z.string().optional().nullable(),
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  color: z.string().optional().default("#ef4444"),
  comment: z.string().min(1, "Comment text is required"),
  authorName: z.string().optional(),
  authorRole: z.string().optional(),
  version: z.number().int().positive().optional().default(1),
});

export const updateAnnotationSchema = z.object({
  isResolved: z.boolean().optional(),
  comment: z.string().min(1).optional(),
});

export const createAnnotationReplySchema = z.object({
  content: z.string().min(1, "Reply content is required"),
  authorName: z.string().optional(),
  authorRole: z.string().optional(),
});

export const stageDecisionSchema = z.object({
  stage: z.enum(["INTERNAL_LEAD", "ACCOUNT_MANAGER", "CLIENT"]),
  decision: z.enum(["APPROVED", "CHANGES_REQUESTED", "REJECTED"]),
  feedback: z.string().optional(),
  authorName: z.string().optional(),
});

export type CreateAnnotationInput = z.infer<typeof createAnnotationSchema>;
export type UpdateAnnotationInput = z.infer<typeof updateAnnotationSchema>;
export type CreateAnnotationReplyInput = z.infer<typeof createAnnotationReplySchema>;
export type StageDecisionInput = z.infer<typeof stageDecisionSchema>;
