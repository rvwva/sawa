import { PrismaClient } from "@prisma/client";
import { logger } from "./logger";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: [
      { level: "query", emit: "event" },
      { level: "error", emit: "stdout" },
      { level: "warn",  emit: "stdout" },
    ],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

prisma.$on("query" as never, (e: any) => {
  if (process.env.NODE_ENV === "development") {
    logger.debug(`Query (${e.duration}ms): ${e.query}`);
  }
});

/** Used by /api/health to verify DB connectivity. */
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (err) {
    logger.error("Database connection check failed", { err });
    return false;
  }
}

/** Graceful disconnect — called on process exit. */
export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
}

process.on("SIGTERM", disconnectDatabase);
process.on("SIGINT",  disconnectDatabase);
