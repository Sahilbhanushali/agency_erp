import { BadRequestException } from '@nestjs/common';
import { LeadStatus } from '@prisma/client';
import { assertStatusChange, isOpen, PIPELINE_STAGES } from './lead-pipeline';

const open = { isConverted: false };

describe('lead pipeline', () => {
  it('lists every stage exactly once', () => {
    expect(new Set(PIPELINE_STAGES).size).toBe(PIPELINE_STAGES.length);
    expect(PIPELINE_STAGES).toHaveLength(Object.keys(LeadStatus).length);
  });

  it('treats only WON and LOST as closed', () => {
    expect(isOpen(LeadStatus.NEW)).toBe(true);
    expect(isOpen(LeadStatus.NEGOTIATION)).toBe(true);
    expect(isOpen(LeadStatus.WON)).toBe(false);
    expect(isOpen(LeadStatus.LOST)).toBe(false);
  });

  it('lets a deal skip stages, because real ones do', () => {
    expect(() =>
      assertStatusChange(LeadStatus.NEW, LeadStatus.NEGOTIATION, open),
    ).not.toThrow();
  });

  it('lets a stalled deal move backwards', () => {
    expect(() =>
      assertStatusChange(LeadStatus.PROPOSAL, LeadStatus.CONTACTED, open),
    ).not.toThrow();
  });

  it('allows a lost deal to be revived', () => {
    expect(() =>
      assertStatusChange(LeadStatus.LOST, LeadStatus.QUALIFIED, open),
    ).not.toThrow();
  });

  it('refuses to lose a deal without a reason', () => {
    expect(() =>
      assertStatusChange(LeadStatus.PROPOSAL, LeadStatus.LOST, open),
    ).toThrow(BadRequestException);
    expect(() =>
      assertStatusChange(LeadStatus.PROPOSAL, LeadStatus.LOST, {
        ...open,
        lostReason: '   ',
      }),
    ).toThrow(/why the lead was lost/);
    expect(() =>
      assertStatusChange(LeadStatus.PROPOSAL, LeadStatus.LOST, {
        ...open,
        lostReason: 'Went with an in-house team',
      }),
    ).not.toThrow();
  });

  it('freezes the stage once the lead is already a client', () => {
    expect(() =>
      assertStatusChange(LeadStatus.WON, LeadStatus.NEGOTIATION, {
        isConverted: true,
      }),
    ).toThrow(/already been converted/);
  });

  it('ignores a no-op change even on a converted lead', () => {
    expect(() =>
      assertStatusChange(LeadStatus.WON, LeadStatus.WON, { isConverted: true }),
    ).not.toThrow();
  });
});
