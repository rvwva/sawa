#!/usr/bin/env tsx
/**
 * Data Retention Cron Job
 * =======================
 * Deletes respondent records (and cascaded responses + scores) older than the
 * configured retention window (default 5 years, per PDPL/GDPR requirement).
 *
 * Run nightly via Cloud Scheduler → Cloud Run job, or cron:
 *   0 2 * * * tsx /app/scripts/data-retention.ts
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({ log: ["warn", "error"] });

async function main() {
  const retentionYears = parseInt(process.env.DATA_RETENTION_YEARS ?? "5", 10);
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - retentionYears);

  console.log(
    `[retention] Running — deleting respondents created before ${cutoff.toISOString()} (${retentionYears}y retention)`
  );

  // Delete respondents older than cutoff (cascades: responses, scores)
  const deleted = await prisma.respondent.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });

  // Also purge expired refresh tokens
  const tokens = await prisma.refreshToken.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });

  // Log to audit_logs table (no user — system action)
  if (deleted.count > 0) {
    await prisma.auditLog.create({
      data: {
        action: "DATA_DELETED",
        entityType: "Respondent",
        metadata: {
          respondentsDeleted: deleted.count,
          refreshTokensPurged: tokens.count,
          retentionYears,
          cutoffDate: cutoff.toISOString(),
          triggeredBy: "scheduled-cron",
        },
      },
    });
  }

  console.log(
    `[retention] Done — deleted ${deleted.count} respondent record(s), ${tokens.count} expired token(s)`
  );
}

main()
  .catch((err) => {
    console.error("[retention] Fatal error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
