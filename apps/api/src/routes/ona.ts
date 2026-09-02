import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { prisma } from "../lib/prisma";
import { runOnaSync } from "../services/onaSync";
import { runOnaCorrelation } from "../services/onaCorrelation";
import { logger } from "../lib/logger";
import { seedCorrelationTestData } from "../services/seedCorrelationTest";

export const onaRouter = Router();

// ── Save M365 credentials for an org (admin only) ────────────────────────────
onaRouter.post(
  "/connect/:orgId",
  requireAuth,
  requireRole("ADMIN"),
  async (req, res) => {
    try {
      const { orgId } = req.params;
      const { tenantId, clientId, clientSecret } = req.body;

      if (!tenantId || !clientId || !clientSecret) {
        return res
          .status(400)
          .json({ error: "tenantId, clientId, and clientSecret are required" });
      }

      await prisma.organisation.update({
        where: { id: orgId },
        data: {
          m365TenantId: tenantId,
          m365ClientId: clientId,
          m365ClientSecret: clientSecret,
          onaEnabled: true,
        },
      });

      res.json({ success: true });
    } catch (err) {
      logger.error("ONA connect failed", { err });
      res.status(500).json({ error: "Failed to save M365 credentials" });
    }
  }
);

// ── Trigger manual sync (admin only) ─────────────────────────────────────────
onaRouter.post(
  "/sync/:orgId",
  requireAuth,
  requireRole("ADMIN"),
  async (req, res) => {
    try {
      const { orgId } = req.params;
      const { cycleId } = req.body;

      const { reciprocityReliable, employeesProcessed } = await runOnaSync(orgId);
      logger.info(`ONA sync: ${employeesProcessed} employees, reciprocity reliable: ${reciprocityReliable}`);
      await runOnaCorrelation(orgId, cycleId);

      res.json({ success: true, message: "ONA sync complete", employeesProcessed, reciprocityReliable });
    } catch (err) {
      logger.error("ONA sync failed", { err });
      res.status(500).json({ error: (err as Error).message });
    }
  }
);

// ── Get ONA results for dashboard ────────────────────────────────────────────
onaRouter.get("/results/:orgId", requireAuth, async (req, res) => {
  try {
    const { orgId } = req.params;

    const [insightCards, topMetrics, org] = await Promise.all([
      prisma.onaInsightCard.findMany({
        where: { organisationId: orgId },
        include: { department: true },
        orderBy: [
          { riskLevel: "asc" }, // urgent first (alphabetically before healthy/moderate)
          { createdAt: "desc" },
        ],
      }),
      prisma.onaMetric.findMany({
        where: { organisationId: orgId },
        orderBy: { isolationScore: "desc" },
        take: 50,
        include: { department: true },
      }),
      prisma.organisation.findUnique({
        where: { id: orgId },
        select: { onaEnabled: true, onaLastSyncAt: true },
      }),
    ]);

    res.json({
      onaEnabled: org?.onaEnabled ?? false,
      lastSyncAt: org?.onaLastSyncAt ?? null,
      insightCards,
      metrics: topMetrics,
    });
  } catch (err) {
    logger.error("ONA results fetch failed", { err });
    res.status(500).json({ error: "Failed to fetch ONA results" });
  }
});

// ── Consent log ───────────────────────────────────────────────────────────────
onaRouter.get(
  "/consent/:orgId",
  requireAuth,
  requireRole("ADMIN"),
  async (req, res) => {
    try {
      const logs = await prisma.onaConsentLog.findMany({
        where: { organisationId: req.params.orgId },
        orderBy: { createdAt: "desc" },
      });
      res.json(logs);
    } catch (err) {
      logger.error("ONA consent fetch failed", { err });
      res.status(500).json({ error: "Failed to fetch consent logs" });
    }
  }
);

onaRouter.post(
  "/consent/:orgId",
  requireAuth,
  requireRole("ADMIN"),
  async (req, res) => {
    try {
      const { orgId } = req.params;
      const { disclosedBy, disclosureDate, policyVersion, notes } = req.body;

      const log = await prisma.onaConsentLog.create({
        data: {
          organisationId: orgId,
          disclosedBy,
          disclosureDate: new Date(disclosureDate),
          policyVersion,
          notes,
        },
      });

      res.json(log);
    } catch (err) {
      logger.error("ONA consent create failed", { err });
      res.status(500).json({ error: "Failed to record consent" });
    }
  }
);

// ── TEMPORARY: seed correlation test data + run correlation (admin only) ─────
onaRouter.post(
  "/seed-correlation-test/:orgId",
  requireAuth,
  requireRole("ADMIN"),
  async (req, res) => {
    try {
      const { orgId } = req.params;
      await seedCorrelationTestData(orgId);
      await runOnaCorrelation(orgId);
      const insightCardsGenerated = await prisma.onaInsightCard.count({ where: { organisationId: orgId } });
      res.json({ success: true, insightCardsGenerated });
    } catch (err) {
      logger.error("Seed correlation test failed", { err });
      res.status(500).json({ error: (err as Error).message });
    }
  }
);
