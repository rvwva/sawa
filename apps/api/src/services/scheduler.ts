/**
 * Sawa Reminder Scheduler
 * ========================
 * Runs hourly via setInterval. For every ACTIVE cycle that has stored
 * recipientEmails, sends automated reminders at the 3-day and 1-day marks
 * before the deadline. Each reminder is sent at most once (tracked in
 * remindersSent JSON on the cycle record).
 *
 * Start by calling startScheduler() once at server boot.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { sendCycleReminder } from "./email";
import { logger } from "../lib/logger";
import { runOnaSync } from "./onaSync";
import { runOnaCorrelation } from "./onaCorrelation";

const INTERVAL_MS = 60 * 60 * 1000; // check every hour

// How many hours on either side of the target counts as "close enough"
// (guards against missed checks due to restarts)
const WINDOW_HOURS = 0.75;

// ─── Main check ───────────────────────────────────────────────────────────────

async function checkReminders(): Promise<void> {
  const now = new Date();

  // Only fetch ACTIVE cycles that have a recipient list and haven't yet closed
  const cycles = await prisma.assessmentCycle.findMany({
    where: {
      status: "ACTIVE",
      endsAt: { gt: now },
      recipientEmails: { not: Prisma.DbNull },
    },
    include: {
      assessment:   { select: { name: true, nameAr: true } },
      organisation: { select: { name: true, nameAr: true } },
    },
  });

  if (cycles.length === 0) return;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  for (const cycle of cycles) {
    const emails = cycle.recipientEmails as string[] | null;
    if (!emails || emails.length === 0) continue;

    const remindersSent = (cycle.remindersSent as Record<string, string> | null) ?? {};
    const hoursUntilEnd = (cycle.endsAt.getTime() - now.getTime()) / (1000 * 60 * 60);

    // 3-day reminder window: 72h ± WINDOW_HOURS
    const want3d = hoursUntilEnd >= 72 - WINDOW_HOURS && hoursUntilEnd <= 72 + WINDOW_HOURS;
    // 1-day reminder window: 24h ± WINDOW_HOURS
    const want1d = hoursUntilEnd >= 24 - WINDOW_HOURS && hoursUntilEnd <= 24 + WINDOW_HOURS;

    if (want3d && !remindersSent["3d"]) {
      await sendReminder(cycle, emails, 3, remindersSent, appUrl);
    } else if (want1d && !remindersSent["1d"]) {
      await sendReminder(cycle, emails, 1, remindersSent, appUrl);
    }
  }
}

async function sendReminder(
  cycle: {
    id:           string;
    title:        string;
    linkToken:    string;
    endsAt:       Date;
    assessment:   { name: string; nameAr: string | null };
    organisation: { name: string; nameAr: string | null };
  },
  emails:        string[],
  days:          1 | 3,
  remindersSent: Record<string, string>,
  appUrl:        string
): Promise<void> {
  const key = days === 3 ? "3d" : "1d";
  try {
    await sendCycleReminder({
      recipientEmails:   emails,
      organisationName:  cycle.organisation.name,
      organisationNameAr: cycle.organisation.nameAr ?? undefined,
      assessmentName:    cycle.assessment.name,
      assessmentNameAr:  cycle.assessment.nameAr ?? undefined,
      cycleTitle:        cycle.title,
      assessmentUrl:     `${appUrl}/assess/${cycle.linkToken}`,
      endsAt:            cycle.endsAt,
      daysRemaining:     days,
    });

    // Mark reminder as sent so we never send it twice
    await prisma.assessmentCycle.update({
      where: { id: cycle.id },
      data: {
        remindersSent: { ...remindersSent, [key]: new Date().toISOString() },
      },
    });

    logger.info(`Auto-reminder (${days}d) sent for cycle ${cycle.id}`, {
      cycleTitle: cycle.title,
      recipients: emails.length,
    });
  } catch (err) {
    logger.error(`Auto-reminder (${days}d) failed for cycle ${cycle.id}`, { err });
  }
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────

export function startScheduler(): void {
  logger.info("Reminder scheduler started (interval: 1h)");

  // Run once shortly after boot, then on the hourly interval
  setTimeout(() => {
    checkReminders().catch((err) =>
      logger.error("Scheduler initial run failed", { err })
    );
  }, 30_000); // 30s after boot

  setInterval(() => {
    checkReminders().catch((err) =>
      logger.error("Scheduler interval run failed", { err })
    );
  }, INTERVAL_MS);

  // ONA weekly sync — fires next Sunday at 02:00, then every 7 days
  const ONA_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;
  const msUntilNextSunday = (() => {
    const now = new Date();
    const daysUntilSunday = (7 - now.getDay()) % 7 || 7;
    const next = new Date(now);
    next.setDate(now.getDate() + daysUntilSunday);
    next.setHours(2, 0, 0, 0);
    return Math.max(next.getTime() - now.getTime(), 0);
  })();

  async function syncAllOnaOrgs(): Promise<void> {
    const orgs = await prisma.organisation.findMany({ where: { onaEnabled: true } });
    for (const org of orgs) {
      await runOnaSync(org.id).catch((err) =>
        logger.error(`ONA sync failed for org ${org.id}`, { err })
      );
      await runOnaCorrelation(org.id).catch((err) =>
        logger.error(`ONA correlation failed for org ${org.id}`, { err })
      );
    }
  }

  setTimeout(() => {
    syncAllOnaOrgs().catch((err) => logger.error("ONA weekly sync failed", { err }));
    setInterval(() => {
      syncAllOnaOrgs().catch((err) => logger.error("ONA weekly sync failed", { err }));
    }, ONA_INTERVAL_MS);
  }, msUntilNextSunday);

  logger.info("ONA weekly sync scheduled");
}
