import { Prisma } from '@prisma/client';

const MAX_ATTEMPTS = 3;

/**
 * Shared by Quotations and Invoices so the two never drift on numbering.
 *
 * Numbers run per company — INV-2026-0001 exists once per tenant — so the next one
 * is derived from the newest number of the same company and year. Two parallel
 * creates can still land on the same number; the composite unique index catches
 * that and the create is retried with the next one.
 */
export async function createWithDocumentNumber<T>(options: {
  prefix: string;
  findLatestNumber: () => Promise<string | null>;
  create: (documentNumber: string) => Promise<T>;
}): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const latest = await options.findLatestNumber();
    const previous = Number(latest?.slice(options.prefix.length));
    const sequence = Number.isFinite(previous) ? previous + 1 : 1;

    try {
      return await options.create(
        `${options.prefix}${String(sequence).padStart(4, '0')}`,
      );
    } catch (error) {
      const isDuplicate =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002';
      if (!isDuplicate) throw error;
      lastError = error;
    }
  }

  throw lastError;
}
