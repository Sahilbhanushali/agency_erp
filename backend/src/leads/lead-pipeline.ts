import { BadRequestException } from '@nestjs/common';
import { LeadStatus } from '@prisma/client';

/** Pipeline column order, left to right. */
export const PIPELINE_STAGES: LeadStatus[] = [
  LeadStatus.NEW,
  LeadStatus.CONTACTED,
  LeadStatus.QUALIFIED,
  LeadStatus.PROPOSAL,
  LeadStatus.NEGOTIATION,
  LeadStatus.WON,
  LeadStatus.LOST,
];

export const CLOSED_STAGES: LeadStatus[] = [LeadStatus.WON, LeadStatus.LOST];

export function isOpen(status: LeadStatus) {
  return !CLOSED_STAGES.includes(status);
}

/**
 * A sales pipeline is not a production workflow: deals skip stages, go backwards,
 * and get revived. So movement between stages is free, and only the two rules that
 * protect real information are enforced — a loss must say why, and a lead that has
 * already become a client is finished moving.
 */
export function assertStatusChange(
  from: LeadStatus,
  to: LeadStatus,
  options: { lostReason?: string | null; isConverted: boolean },
) {
  if (from === to) return;

  if (options.isConverted) {
    throw new BadRequestException(
      'This lead has already been converted into a client; its pipeline stage is settled.',
    );
  }

  if (to === LeadStatus.LOST && !options.lostReason?.trim()) {
    throw new BadRequestException(
      'Record why the lead was lost — it is the most useful thing to know later.',
    );
  }
}
