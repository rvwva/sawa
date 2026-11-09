import request from "supertest";
import jwt from "jsonwebtoken";
import express from "express";

process.env.JWT_SECRET = "test-secret";
process.env.REFRESH_TOKEN_SECRET = "test-refresh-secret";

import { prisma } from "./__mocks__/prisma";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { plansRouter, stepDisplayStatus, computeDueAt } from "../routes/plans";
import { issueTokens } from "../routes/auth";
import { templates, generatePlans } from "../services/planTemplates";
import rawJson from "../services/planTemplates/plan-templates.json";

const p = prisma as any;

function token(payload: object): string {
  return jwt.sign(payload, process.env.JWT_SECRET!);
}

const MANAGER = { userId: "mgr-1", email: "m@x.com", role: "MANAGER", organisationId: "org-1", departmentId: "dept-1" };
const EXEC = { userId: "exec-1", email: "e@x.com", role: "EXECUTIVE", organisationId: "org-1" };

function plansApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/plans", plansRouter);
  return app;
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── Access token ────────────────────────────────────────────────────────────

describe("issueTokens", () => {
  it("puts departmentId in the access token", () => {
    const { accessToken } = issueTokens("u1", "m@x.com", "MANAGER", "org-1", "dept-1");
    const decoded = jwt.verify(accessToken, process.env.JWT_SECRET!) as Record<string, unknown>;
    expect(decoded.departmentId).toBe("dept-1");
    expect(decoded.organisationId).toBe("org-1");
    expect(decoded.role).toBe("MANAGER");
  });

  it("puts departmentId: null for users without a department", () => {
    const { accessToken } = issueTokens("u2", "e@x.com", "EXECUTIVE", "org-1", null);
    const decoded = jwt.verify(accessToken, process.env.JWT_SECRET!) as Record<string, unknown>;
    expect(decoded).toHaveProperty("departmentId", null);
  });
});

// ─── MANAGER blocked from ADMIN/EXECUTIVE routes ─────────────────────────────

describe("MANAGER role on routes restricted to ADMIN/EXECUTIVE", () => {
  const app = express();
  app.get("/results/:orgId", requireAuth, requireRole("ADMIN", "EXECUTIVE"), (_req, res) => res.json({}));

  it("MANAGER → 403", async () => {
    const res = await request(app).get("/results/org-1").set("Authorization", `Bearer ${token(MANAGER)}`);
    expect(res.status).toBe(403);
  });

  it("EXECUTIVE → 200", async () => {
    const res = await request(app).get("/results/org-1").set("Authorization", `Bearer ${token(EXEC)}`);
    expect(res.status).toBe(200);
  });

  it("MANAGER → 403 on POST /plans/:orgId/generate", async () => {
    const res = await request(plansApp())
      .post("/api/plans/org-1/generate")
      .set("Authorization", `Bearer ${token(MANAGER)}`);
    expect(res.status).toBe(403);
  });
});

// ─── Plan visibility routes ──────────────────────────────────────────────────

describe("GET /api/plans/:orgId/:id for MANAGER", () => {
  it("org-wide plan → 403", async () => {
    p.actionPlan.findFirst.mockResolvedValueOnce({ id: "plan-1", organisationId: "org-1", departmentId: null, steps: [] });
    const res = await request(plansApp())
      .get("/api/plans/org-1/plan-1")
      .set("Authorization", `Bearer ${token(MANAGER)}`);
    expect(res.status).toBe(403);
  });

  it("own department plan → 200", async () => {
    p.actionPlan.findFirst.mockResolvedValueOnce({ id: "plan-1", organisationId: "org-1", departmentId: "dept-1", steps: [] });
    const res = await request(plansApp())
      .get("/api/plans/org-1/plan-1")
      .set("Authorization", `Bearer ${token(MANAGER)}`);
    expect(res.status).toBe(200);
  });

  it("list query is limited to the manager's department", async () => {
    p.actionPlan.findMany.mockResolvedValueOnce([]);
    await request(plansApp()).get("/api/plans/org-1").set("Authorization", `Bearer ${token(MANAGER)}`);
    expect(p.actionPlan.findMany.mock.calls[0][0].where).toEqual({ organisationId: "org-1", departmentId: "dept-1" });
  });
});

// ─── Step ownership ──────────────────────────────────────────────────────────

describe("PATCH /api/plans/steps/:id ownership", () => {
  const stepOwnedBy = (ownerUserId: string | null) => ({
    id: "step-1",
    state: "IN_PROGRESS",
    completedAt: null,
    ownerUserId,
    plan: { organisationId: "org-1", departmentId: "dept-1" },
  });

  it("MANAGER who is not the owner → 403", async () => {
    p.actionStep.findUnique.mockResolvedValueOnce(stepOwnedBy("other-user"));
    const res = await request(plansApp())
      .patch("/api/plans/steps/step-1")
      .set("Authorization", `Bearer ${token(MANAGER)}`)
      .send({ state: "DONE" });
    expect(res.status).toBe(403);
    expect(p.actionStep.update).not.toHaveBeenCalled();
  });

  it("MANAGER who owns the step → 200 and completedAt is set on DONE", async () => {
    p.actionStep.findUnique.mockResolvedValueOnce(stepOwnedBy("mgr-1"));
    p.actionStep.update.mockResolvedValueOnce({ id: "step-1" });
    const res = await request(plansApp())
      .patch("/api/plans/steps/step-1")
      .set("Authorization", `Bearer ${token(MANAGER)}`)
      .send({ state: "DONE" });
    expect(res.status).toBe(200);
    const data = p.actionStep.update.mock.calls[0][0].data;
    expect(data.state).toBe("DONE");
    expect(data.completedAt).toBeInstanceOf(Date);
  });

  it("moving out of DONE clears completedAt", async () => {
    p.actionStep.findUnique.mockResolvedValueOnce({ ...stepOwnedBy("mgr-1"), state: "DONE", completedAt: new Date() });
    p.actionStep.update.mockResolvedValueOnce({ id: "step-1" });
    await request(plansApp())
      .patch("/api/plans/steps/step-1")
      .set("Authorization", `Bearer ${token(MANAGER)}`)
      .send({ state: "IN_PROGRESS" });
    expect(p.actionStep.update.mock.calls[0][0].data.completedAt).toBeNull();
  });

  it("MANAGER cannot post an update on someone else's step", async () => {
    p.actionStep.findUnique.mockResolvedValueOnce(stepOwnedBy("other-user"));
    const res = await request(plansApp())
      .post("/api/plans/steps/step-1/updates")
      .set("Authorization", `Bearer ${token(MANAGER)}`)
      .send({ type: "COMMENT" });
    expect(res.status).toBe(403);
  });
});

// ─── Approve: owner assignment ───────────────────────────────────────────────

describe("POST /api/plans/:orgId/:id/approve", () => {
  const draft = {
    id: "plan-1",
    organisationId: "org-1",
    departmentId: "dept-1",
    partnerDepartmentId: "dept-2",
    templateKey: "WORKLOAD_MANAGER_CONNECTION",
    status: "DRAFT",
    steps: [
      { id: "s-m", order: 1, ownerRole: "MANAGER", dueOffsetDays: 5 },
      { id: "s-h", order: 6, ownerRole: "HR", dueOffsetDays: 60 },
      { id: "s-s", order: 4, ownerRole: "SPONSOR", dueOffsetDays: 21 },
    ],
  };

  beforeEach(() => {
    p.$transaction.mockImplementation((fn: (tx: unknown) => unknown) => fn(p));
    p.actionPlan.update.mockResolvedValue({ id: "plan-1" });
  });

  function ownersAssigned(): Record<string, string | null> {
    return Object.fromEntries(
      p.actionStep.update.mock.calls.map((c: any[]) => [c[0].where.id, c[0].data.ownerUserId])
    );
  }

  it("400 without sponsorUserId", async () => {
    p.actionPlan.findFirst.mockResolvedValueOnce(draft);
    const res = await request(plansApp())
      .post("/api/plans/org-1/plan-1/approve")
      .set("Authorization", `Bearer ${token(EXEC)}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it("MANAGER steps → department manager, HR steps → approver, SPONSOR steps → sponsor", async () => {
    p.actionPlan.findFirst.mockResolvedValueOnce(draft);
    p.user.findFirst
      .mockResolvedValueOnce({ id: "sponsor-1" }) // sponsor lookup
      .mockResolvedValueOnce({ id: "dept-manager-1" }); // department manager lookup
    const res = await request(plansApp())
      .post("/api/plans/org-1/plan-1/approve")
      .set("Authorization", `Bearer ${token(EXEC)}`)
      .send({ sponsorUserId: "sponsor-1" });
    expect(res.status).toBe(200);
    expect(ownersAssigned()).toEqual({ "s-m": "dept-manager-1", "s-h": "exec-1", "s-s": "sponsor-1" });
    expect(p.user.findFirst.mock.calls[1][0].where).toMatchObject({ role: "MANAGER", departmentId: "dept-1" });
    expect(p.actionPlan.update.mock.calls[0][0].data).toMatchObject({ status: "ACTIVE", sponsorUserId: "sponsor-1" });
  });

  it("managerUserId in the request overrides the department manager", async () => {
    p.actionPlan.findFirst.mockResolvedValueOnce(draft);
    p.user.findFirst.mockResolvedValueOnce({ id: "sponsor-1" }).mockResolvedValueOnce({ id: "override-mgr" });
    await request(plansApp())
      .post("/api/plans/org-1/plan-1/approve")
      .set("Authorization", `Bearer ${token(EXEC)}`)
      .send({ sponsorUserId: "sponsor-1", managerUserId: "override-mgr" });
    expect(ownersAssigned()["s-m"]).toBe("override-mgr");
  });

  it("changing partnerDepartmentId re-renders every text field with the new name", async () => {
    p.actionPlan.findFirst.mockResolvedValueOnce(draft);
    p.user.findFirst.mockResolvedValueOnce({ id: "sponsor-1" }).mockResolvedValueOnce({ id: "dept-manager-1" });
    p.department.findFirst.mockResolvedValueOnce({ id: "dept-3", name: "Finance", nameAr: "المالية" });
    p.department.findUnique.mockResolvedValueOnce({ id: "dept-1", name: "Support", nameAr: "الدعم" });
    await request(plansApp())
      .post("/api/plans/org-1/plan-1/approve")
      .set("Authorization", `Bearer ${token(EXEC)}`)
      .send({ sponsorUserId: "sponsor-1", partnerDepartmentId: "dept-3" });

    const planData = p.actionPlan.update.mock.calls[0][0].data;
    expect(planData.partnerDepartmentId).toBe("dept-3");
    expect(planData.titleEn).toContain("Support");

    // Step with order 6 is not the joint session; check the HR step at order 6 got re-rendered fields
    const stepData = p.actionStep.update.mock.calls.find((c: any[]) => c[0].where.id === "s-h")[0].data;
    expect(stepData).toHaveProperty("whoEn");
    expect(stepData).toHaveProperty("evidenceNoteAr");
    for (const v of Object.values(stepData)) {
      if (typeof v === "string") expect(v).not.toMatch(/\{(partner_)?department\}/);
    }
  });
});

// ─── Due dates ───────────────────────────────────────────────────────────────

function riyadhDay(d: Date): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Riyadh", weekday: "short" }).format(d);
}

describe("computeDueAt — Saudi weekend shift", () => {
  const monday = new Date("2026-11-02T10:00:00Z");

  it("landing on Friday → Thursday before", () => {
    const d = computeDueAt(monday, 4); // Fri 6 Nov
    expect(riyadhDay(d)).toBe("Thu");
    expect(d.toISOString().slice(0, 10)).toBe("2026-11-05");
  });

  it("landing on Saturday → Thursday before", () => {
    const d = computeDueAt(monday, 5); // Sat 7 Nov
    expect(riyadhDay(d)).toBe("Thu");
    expect(d.toISOString().slice(0, 10)).toBe("2026-11-05");
  });

  it("landing on Thursday is unchanged", () => {
    expect(computeDueAt(monday, 3).toISOString().slice(0, 10)).toBe("2026-11-05");
  });

  it("landing on Sunday is unchanged", () => {
    expect(computeDueAt(monday, 6).toISOString().slice(0, 10)).toBe("2026-11-08");
  });
});

// ─── Display status ──────────────────────────────────────────────────────────

describe("stepDisplayStatus", () => {
  const now = new Date("2026-11-04T12:00:00Z");
  const in14 = new Date("2026-11-18T12:00:00Z");
  const in3 = new Date("2026-11-07T12:00:00Z");
  const past = new Date("2026-10-28T12:00:00Z");

  it.each([
    ["DONE", null, "done"],
    ["ADAPTED", in14, "adapted"],
    ["NEEDS_SUPPORT", in14, "needs_support"],
    ["NOT_STARTED", in3, "due_this_week"],
    ["IN_PROGRESS", past, "due_this_week"],
    ["IN_PROGRESS", in14, "on_track"],
    ["NOT_STARTED", in14, "upcoming"],
    ["NOT_STARTED", null, "upcoming"],
  ])("%s due %s → %s", (state, due, expected) => {
    expect(stepDisplayStatus(state as any, due as Date | null, now)).toBe(expected);
  });
});

// ─── Template matching + full field copy ─────────────────────────────────────

describe("generatePlans", () => {
  const dept1 = { id: "dept-1", name: "Support", nameAr: "الدعم", organisationId: "org-1" };
  const dept2 = { id: "dept-2", name: "Sales", nameAr: "المبيعات", organisationId: "org-1" };

  function setup(signals: string[], riskLevel = "urgent") {
    p.onaInsightCard.findMany.mockResolvedValueOnce([
      { id: "card-1", departmentId: "dept-1", signals, riskLevel, department: dept1 },
    ]);
    p.department.findMany.mockResolvedValueOnce([dept1, dept2]);
    p.onaMetric.findMany.mockResolvedValueOnce([
      { departmentId: "dept-1", isolationScore: 0.8 },
      { departmentId: "dept-2", isolationScore: 0.6 },
    ]);
    p.assessmentCycle.findMany.mockResolvedValueOnce(
      ["CBI", "PSYCH_SAFETY", "LMX7", "TURNOVER"].map((type, i) => ({ id: `c${i}`, assessment: { type } }))
    );
    p.score.findMany.mockResolvedValueOnce([]);
    p.respondent.count.mockResolvedValue(5);
  }

  it("burnout + isolation → WORKLOAD_MANAGER_CONNECTION (HIGH)", async () => {
    setup(["high_isolation", "elevated_burnout"]);
    await generatePlans("org-1");
    expect(p.actionPlan.create.mock.calls[0][0].data.templateKey).toBe("WORKLOAD_MANAGER_CONNECTION");
  });

  it("burnout alone → EARLY_WORKLOAD_CHECK (MEDIUM)", async () => {
    setup(["elevated_burnout"], "moderate");
    await generatePlans("org-1");
    expect(p.actionPlan.create.mock.calls[0][0].data.templateKey).toBe("EARLY_WORKLOAD_CHECK");
  });

  it("department under the respondent floor gets no plan", async () => {
    setup(["elevated_burnout"]);
    p.respondent.count.mockResolvedValue(4);
    await generatePlans("org-1");
    expect(p.actionPlan.create).not.toHaveBeenCalled();
  });

  it("missing scale → org-wide MEASUREMENT_GAP plan with departmentId null", async () => {
    setup([]);
    p.assessmentCycle.findMany.mockReset().mockResolvedValueOnce([{ id: "c0", assessment: { type: "CBI" } }]);
    await generatePlans("org-1");
    const gap = p.actionPlan.create.mock.calls.map((c: any[]) => c[0].data).find((d: any) => d.templateKey === "MEASUREMENT_GAP");
    expect(gap.departmentId).toBeNull();
    expect(gap.signalsSnapshot.missingScales).toEqual(["PSYCH_SAFETY", "LMX7", "TURNOVER"]);
  });

  it("every field of the first template's first step lands on the created ActionStep", async () => {
    setup(["high_isolation", "elevated_burnout"]);
    await generatePlans("org-1");

    const json = (rawJson as any).templates[0];
    const src = json.steps[0];
    const plan = p.actionPlan.create.mock.calls[0][0].data;
    const step = plan.steps.create[0];

    const fill = (s: string | null, lang: "en" | "ar") =>
      s === null
        ? null
        : s
            .replace(/\{department\}/g, lang === "en" ? "Support" : "الدعم")
            .replace(/\{partner_department\}/g, lang === "en" ? "Sales" : "المبيعات");

    expect(plan.templateKey).toBe(json.key);
    expect(plan.partnerDepartmentId).toBe("dept-2");
    expect(step).toEqual({
      order: src.order,
      dueOffsetDays: src.dueOffsetDays,
      ownerRole: src.ownerRole,
      verification: src.verification,
      evidenceLevel: src.evidenceLevel,
      sourceKeys: src.sourceKeys,
      workstreamEn: fill(src.en.workstream, "en"),
      workstreamAr: fill(src.ar.workstream, "ar"),
      whenEn: fill(src.en.when, "en"),
      whenAr: fill(src.ar.when, "ar"),
      titleEn: fill(src.en.title, "en"),
      titleAr: fill(src.ar.title, "ar"),
      bodyEn: fill(src.en.body, "en"),
      bodyAr: fill(src.ar.body, "ar"),
      whoEn: fill(src.en.who, "en"),
      whoAr: fill(src.ar.who, "ar"),
      outputEn: fill(src.en.output, "en"),
      outputAr: fill(src.ar.output, "ar"),
      evidenceNoteEn: fill(src.en.evidenceNote, "en"),
      evidenceNoteAr: fill(src.ar.evidenceNote, "ar"),
    });

    // Guard: no key in the JSON step was left unmapped.
    expect(Object.keys(src).sort()).toEqual(
      ["order", "dueOffsetDays", "ownerRole", "verification", "evidenceLevel", "sourceKeys", "en", "ar"].sort()
    );
    expect(Object.keys(src.en).sort()).toEqual(["workstream", "when", "title", "body", "who", "output", "evidenceNote"].sort());

    // Plan-level content
    expect(plan.introEn).toBe(fill(json.intro.en, "en"));
    expect(plan.doneWhenAr).toBe(fill(json.doneWhen.ar, "ar"));
    expect(plan.watchForEn).toEqual(json.watchFor.en.map((w: any) => ({ text: fill(w.text, "en"), sourceKeys: w.sourceKeys })));
    expect(plan.watchForAr).toHaveLength(json.watchFor.ar.length);
    expect(plan.signalsSnapshot).toMatchObject({ signals: ["high_isolation", "elevated_burnout"], riskLevel: "urgent" });
  });

  it("templates load and every step has dueOffsetDays > 0", () => {
    expect(templates.length).toBe(4);
    for (const t of templates) for (const s of t.steps) expect(s.dueOffsetDays).toBeGreaterThan(0);
  });
});
