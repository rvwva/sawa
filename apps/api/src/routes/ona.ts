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

// ── Get ONA results for dashboard — department-level summary ─────────────────
onaRouter.get("/results/:orgId", requireAuth, async (req, res) => {
  try {
    const { orgId } = req.params;

    const [insightCards, metrics, interactions, departments, org] = await Promise.all([
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
        select: { userEmail: true, departmentId: true, isolationScore: true, reciprocityScore: true },
      }),
      prisma.onaInteraction.findMany({
        where: { organisationId: orgId },
        select: { fromUserEmail: true, toUserEmail: true, weight: true },
      }),
      prisma.department.findMany({
        where: { organisationId: orgId },
        select: { id: true, name: true, nameAr: true },
      }),
      prisma.organisation.findUnique({
        where: { id: orgId },
        select: { onaEnabled: true, onaLastSyncAt: true },
      }),
    ]);

    // Map each employee to their department, for aggregating interactions
    const deptByEmail = new Map<string, string | null>();
    for (const m of metrics) deptByEmail.set(m.userEmail, m.departmentId);

    // Average isolation/reciprocity per department
    const deptStats = new Map<string, { count: number; isolationSum: number; reciprocitySum: number }>();
    for (const m of metrics) {
      if (!m.departmentId) continue;
      const s = deptStats.get(m.departmentId) ?? { count: 0, isolationSum: 0, reciprocitySum: 0 };
      s.count += 1;
      s.isolationSum += m.isolationScore;
      s.reciprocitySum += m.reciprocityScore;
      deptStats.set(m.departmentId, s);
    }

    const departmentNodes = departments
      .filter((d) => deptStats.has(d.id))
      .map((d) => {
        const s = deptStats.get(d.id)!;
        return {
          departmentId: d.id,
          name: d.name,
          nameAr: d.nameAr,
          employeeCount: s.count,
          avgIsolationScore: s.isolationSum / s.count,
          avgReciprocityScore: s.reciprocitySum / s.count,
        };
      });

    // Aggregate interactions into cross-department edges only (weight summed both ways)
    const edgeWeights = new Map<string, number>();
    for (const i of interactions) {
      const fromDept = deptByEmail.get(i.fromUserEmail);
      const toDept = deptByEmail.get(i.toUserEmail);
      if (!fromDept || !toDept || fromDept === toDept) continue;
      const key = [fromDept, toDept].sort().join("::");
      edgeWeights.set(key, (edgeWeights.get(key) ?? 0) + i.weight);
    }
    const departmentEdges = [...edgeWeights.entries()].map(([key, weight]) => {
      const [sourceDeptId, targetDeptId] = key.split("::");
      return { sourceDeptId, targetDeptId, weight };
    });

    res.json({
      onaEnabled: org?.onaEnabled ?? false,
      lastSyncAt: org?.onaLastSyncAt ?? null,
      insightCards,
      departmentNodes,
      departmentEdges,
    });
  } catch (err) {
    logger.error("ONA results fetch failed", { err });
    res.status(500).json({ error: "Failed to fetch ONA results" });
  }
});

// ── Drill down into one department's individual network ──────────────────────
onaRouter.get("/results/:orgId/department/:deptId", requireAuth, async (req, res) => {
  try {
    const { orgId, deptId } = req.params;

    const [metrics, department] = await Promise.all([
      prisma.onaMetric.findMany({
        where: { organisationId: orgId, departmentId: deptId },
        select: { userEmail: true, isolationScore: true, reciprocityScore: true },
      }),
      prisma.department.findUnique({
        where: { id: deptId },
        select: { name: true, nameAr: true },
      }),
    ]);

    const emails = metrics.map((m) => m.userEmail);

    const interactions = emails.length
      ? await prisma.onaInteraction.findMany({
          where: {
            organisationId: orgId,
            fromUserEmail: { in: emails },
            toUserEmail: { in: emails },
          },
          select: { fromUserEmail: true, toUserEmail: true, weight: true },
        })
      : [];

    res.json({ department, metrics, interactions });
  } catch (err) {
    logger.error("ONA department drill-down fetch failed", { err });
    res.status(500).json({ error: "Failed to fetch department detail" });
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
