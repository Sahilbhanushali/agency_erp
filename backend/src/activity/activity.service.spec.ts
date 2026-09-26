import { Prisma } from '@prisma/client';
import { redact } from './activity.service';

describe('redact', () => {
  it('drops credentials wherever they are nested', () => {
    const result = redact({
      email: 'someone@example.com',
      passwordHash: '$2b$10$hash',
      nested: { refreshToken: 'secret', keep: 'yes' },
    }) as Record<string, unknown>;

    expect(result).toEqual({
      email: 'someone@example.com',
      nested: { keep: 'yes' },
    });
    expect(JSON.stringify(result)).not.toContain('hash');
  });

  it('keeps a money column readable instead of flattening it to {}', () => {
    const result = redact({ amount: new Prisma.Decimal('1234.56') });
    expect(result).toEqual({ amount: '1234.56' });
  });

  it('stores dates as ISO strings', () => {
    const result = redact({ paidAt: new Date('2026-09-24T00:00:00.000Z') });
    expect(result).toEqual({ paidAt: '2026-09-24T00:00:00.000Z' });
  });

  it('survives values that have no JSON form', () => {
    expect(redact({ fn: () => 1, big: 10n, ok: 1 })).toEqual({ ok: 1 });
  });

  it('returns undefined rather than null for an absent state', () => {
    expect(redact(undefined)).toBeUndefined();
    expect(redact(null)).toBeUndefined();
  });
});
