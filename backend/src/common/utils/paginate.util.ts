export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 25;

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  pageCount: number;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: PaginationMeta;
}

/** Spread into a findMany alongside the count half of the same $transaction. */
export function toSkipTake(page = DEFAULT_PAGE, limit = DEFAULT_LIMIT) {
  return { skip: (page - 1) * limit, take: limit };
}

export function buildMeta(
  total: number,
  page = DEFAULT_PAGE,
  limit = DEFAULT_LIMIT,
): PaginationMeta {
  return {
    page,
    limit,
    total,
    pageCount: Math.max(1, Math.ceil(total / limit)),
  };
}

/**
 * Case-insensitivity comes from the MySQL column collation, so no `mode` here —
 * that option is Postgres-only and Prisma rejects it on MySQL.
 */
export function searchFilter(search: string | undefined, fields: string[]) {
  const query = search?.trim();
  if (!query) return {};
  return { OR: fields.map((field) => ({ [field]: { contains: query } })) };
}
