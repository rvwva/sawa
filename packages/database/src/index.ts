/**
 * @sawa/database
 * Exports Prisma client singleton and all generated types.
 * Import from this package rather than directly from @prisma/client
 * to ensure a single connection pool across the monorepo.
 */

import { PrismaClient } from "@prisma/client";

// Re-export all generated types for consumers
export * from "@prisma/client";

// ─── Singleton Prisma client ─────────────────────────────────────────────────
// In dev, prevent multiple hot-reload instances from exhausting the pool.

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient() {
  return new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? [{ level: "query", emit: "event" }, "warn", "error"]
        : ["warn", "error"],
    errorFormat: "colorless",
  });
}

export const prisma: PrismaClient =
  globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// ─── Graceful shutdown ───────────────────────────────────────────────────────

process.on("beforeExit", async () => {
  await prisma.$disconnect();
});

// ─── Connection health check ─────────────────────────────────────────────────

export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

// ─── Data retention helper ───────────────────────────────────────────────────
// Called by the nightly cron / admin endpoint.

export async function purgeExpiredRespondents(retentionYears = 5): Promise<number> {
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - retentionYears);

  const result = await prisma.respondent.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });

  return result.count;
}

// ─── Convenience query helpers ───────────────────────────────────────────────

/**
 * Return all score rows for a cycle as a flat array,
 * joined with respondent/department info.
 */
export async function getScoresForCycle(cycleId: string) {
  return prisma.score.findMany({
    where: {
      respondent: {
        cycleId,
        submittedAt: { not: null },
      },
    },
    include: {
      respondent: {
        select: {
          id: true,
          departmentId: true,
          submittedAt: true,
          department: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { subscale: "asc" },
  });
}

/**
 * Return the respondent count for a cycle, optionally filtered to a department.
 * The 5-respondent minimum check uses this.
 */
export async function getRespondentCount(
  cycleId: string,
  departmentId?: string
): Promise<number> {
  return prisma.respondent.count({
    where: {
      cycleId,
      submittedAt: { not: null },
      ...(departmentId ? { departmentId } : {}),
    },
  });
}
