/**
 * Prisma's `DateTime @db.Date` columns reject date-only strings (e.g. "2026-08-13")
 * with "premature end of input" — they need a Date instance or full ISO datetime.
 * HTML date inputs / @IsDateString() DTOs only ever produce the date-only form.
 */
export function toDateOrUndefined(value?: string): Date | undefined {
  return value ? new Date(value) : undefined;
}
