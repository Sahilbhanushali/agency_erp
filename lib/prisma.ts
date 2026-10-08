import { PrismaClient } from "@prisma/client"

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

/**
 * One client for the whole app, cached on globalThis in development so hot reloads do
 * not open a new connection pool each time.
 *
 * The client is lazy: constructing it does not connect, so a missing DATABASE_URL
 * surfaces as a clear Prisma initialization error on the first query rather than
 * being typed as `any` and crashing on a property access.
 */
export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma
}
