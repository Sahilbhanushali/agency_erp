import { PrismaClient } from "@prisma/client"
import { noteWrite } from "@/lib/realtime/invalidate"

const WRITES = new Set([
  "create",
  "createMany",
  "createManyAndReturn",
  "update",
  "updateMany",
  "updateManyAndReturn",
  "upsert",
  "delete",
  "deleteMany",
])

/**
 * Every write through this client tells open tabs to refetch — see
 * lib/realtime/invalidate.ts. Hooking here rather than in each route is what makes live
 * updates cover every module, including writes from background work and any route
 * added later.
 */
function createClient() {
  return new PrismaClient().$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const result = await query(args)
          if (WRITES.has(operation)) {
            // A *Many that matched nothing changed nothing.
            const count = (result as { count?: unknown } | null)?.count
            if (typeof count !== "number" || count > 0) void noteWrite(model)
          }
          return result
        },
      },
    },
  })
}

type ExtendedClient = ReturnType<typeof createClient>

const globalForPrisma = globalThis as unknown as {
  prisma: ExtendedClient | undefined
}

/**
 * One client for the whole app, cached on globalThis in development so hot reloads do
 * not open a new connection pool each time.
 *
 * The client is lazy: constructing it does not connect, so a missing DATABASE_URL
 * surfaces as a clear Prisma initialization error on the first query rather than
 * being typed as `any` and crashing on a property access.
 */
export const prisma = globalForPrisma.prisma ?? createClient()

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma
}
