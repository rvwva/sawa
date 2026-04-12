/**
 * seed-test.ts — Mindlign Test Data Seed
 * ========================================
 * Creates one demo client org with realistic CBI assessment data for testing.
 *
 * Prerequisites: run the base seed first (creates CBI assessment definition):
 *   npm run seed -w packages/database
 *
 * Usage:
 *   npm run seed:test -w packages/database
 *
 * Creates:
 *   - Organisation : Acme Arabia / مجموعة أكمي العربية  (slug: acme-arabia)
 *   - Departments  : Engineering (5 respondents), Sales (5 respondents)
 *   - Executive    : demo@mindlign.com / Demo1234567
 *   - 3 CBI cycles : 2 CLOSED (trend data) + 1 ACTIVE (live dashboard)
 *   - 10 full respondents in ACTIVE cycle (responses + computed scores)
 *   - 8 lite respondents in each CLOSED cycle (scores only; responses pruned)
 *
 * Expected dashboard output:
 *   Overall avg total      : ~60  (Moderate)
 *   Engineering dept avg   : ~51  (Moderate)
 *   Sales dept avg         : ~70  (Moderate)
 *   Trend Q2→Q3→Q4 2025    : 72 → 65 → 60 (improving)
 *   Band distribution      : 2 Low · 6 Moderate · 2 High
 */

import { PrismaClient, AssessmentType, CycleStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// ── CBI scoring helper ────────────────────────────────────────────────────────
// Mirrors cbi.py exactly: cbi_13 is the only reversed item.

const CBI_PERSONAL = ["cbi_1","cbi_2","cbi_3","cbi_4","cbi_5","cbi_6"] as const;
const CBI_WORK     = ["cbi_7","cbi_8","cbi_9","cbi_10","cbi_11","cbi_12","cbi_13"] as const;
const CBI_CLIENT   = ["cbi_14","cbi_15","cbi_16","cbi_17","cbi_18","cbi_19"] as const;
const CBI_REVERSED = new Set(["cbi_13"]);

function cbiBand(score: number): string {
  if (score >= 75) return "High";
  if (score >= 50) return "Moderate";
  return "Low";
}

function scoreCBI(resp: Record<string, number>) {
  const adj  = (k: string): number => CBI_REVERSED.has(k) ? 100 - resp[k] : resp[k];
  const mean = (keys: readonly string[]): number =>
    keys.reduce((s, k) => s + adj(k), 0) / keys.length;

  const personal = mean(CBI_PERSONAL);
  const work     = mean(CBI_WORK);
  const client   = mean(CBI_CLIENT);
  const allAdj   = [...CBI_PERSONAL, ...CBI_WORK, ...CBI_CLIENT].map(adj);
  const total    = allAdj.reduce((a, b) => a + b, 0) / allAdj.length;

  return {
    personal_burnout: { score: personal, band: cbiBand(personal) },
    work_burnout:     { score: work,     band: cbiBand(work)     },
    client_burnout:   { score: client,   band: cbiBand(client)   },
    total:            { score: total,    band: cbiBand(total)    },
  };
}

// ── Employee response profiles for the ACTIVE cycle ───────────────────────────
// All CBI values ∈ {0, 25, 50, 75, 100}.
// cbi_13 is stored raw; reversal happens inside scoreCBI().
// Approx totals annotated per employee.

type EmpProfile = { dept: "eng" | "sales"; responses: Record<string, number> };

const ACTIVE_PROFILES: EmpProfile[] = [
  // ── Engineering (5) ──────────────────────────────────────────────────────────
  {
    dept: "eng",
    responses: {                                      // total ≈ 25 — Low
      cbi_1: 25, cbi_2: 25, cbi_3: 25, cbi_4: 25, cbi_5: 25, cbi_6: 25,
      cbi_7: 25, cbi_8: 25, cbi_9: 25, cbi_10: 25, cbi_11: 25, cbi_12: 25, cbi_13: 75,
      cbi_14: 25, cbi_15: 25, cbi_16: 25, cbi_17: 25, cbi_18: 25, cbi_19: 25,
    },
  },
  {
    dept: "eng",
    responses: {                                      // total ≈ 46 — Low
      cbi_1: 50, cbi_2: 50, cbi_3: 50, cbi_4: 25, cbi_5: 50, cbi_6: 50,
      cbi_7: 50, cbi_8: 50, cbi_9: 50, cbi_10: 25, cbi_11: 50, cbi_12: 50, cbi_13: 50,
      cbi_14: 50, cbi_15: 50, cbi_16: 25, cbi_17: 50, cbi_18: 50, cbi_19: 50,
    },
  },
  {
    dept: "eng",
    responses: {                                      // total ≈ 62 — Moderate
      cbi_1: 75, cbi_2: 50, cbi_3: 75, cbi_4: 50, cbi_5: 75, cbi_6: 50,
      cbi_7: 50, cbi_8: 75, cbi_9: 50, cbi_10: 75, cbi_11: 50, cbi_12: 75, cbi_13: 25,
      cbi_14: 50, cbi_15: 75, cbi_16: 50, cbi_17: 50, cbi_18: 75, cbi_19: 50,
    },
  },
  {
    dept: "eng",
    responses: {                                      // total ≈ 67 — Moderate
      cbi_1: 75, cbi_2: 75, cbi_3: 50, cbi_4: 75, cbi_5: 75, cbi_6: 75,
      cbi_7: 75, cbi_8: 75, cbi_9: 50, cbi_10: 75, cbi_11: 75, cbi_12: 75, cbi_13: 25,
      cbi_14: 50, cbi_15: 75, cbi_16: 50, cbi_17: 75, cbi_18: 50, cbi_19: 50,
    },
  },
  {
    dept: "eng",
    responses: {                                      // total ≈ 53 — Moderate
      cbi_1: 50, cbi_2: 75, cbi_3: 50, cbi_4: 50, cbi_5: 75, cbi_6: 50,
      cbi_7: 50, cbi_8: 50, cbi_9: 75, cbi_10: 50, cbi_11: 50, cbi_12: 75, cbi_13: 50,
      cbi_14: 50, cbi_15: 50, cbi_16: 25, cbi_17: 50, cbi_18: 50, cbi_19: 25,
    },
  },
  // ── Sales (5) ────────────────────────────────────────────────────────────────
  {
    dept: "sales",
    responses: {                                      // total ≈ 59 — Moderate
      cbi_1: 75, cbi_2: 50, cbi_3: 75, cbi_4: 50, cbi_5: 50, cbi_6: 75,
      cbi_7: 50, cbi_8: 75, cbi_9: 50, cbi_10: 75, cbi_11: 50, cbi_12: 50, cbi_13: 25,
      cbi_14: 50, cbi_15: 50, cbi_16: 50, cbi_17: 75, cbi_18: 50, cbi_19: 50,
    },
  },
  {
    dept: "sales",
    responses: {                                      // total ≈ 76 — High
      cbi_1: 75, cbi_2: 75, cbi_3: 100, cbi_4: 75, cbi_5: 75, cbi_6: 100,
      cbi_7: 75, cbi_8: 75, cbi_9: 100, cbi_10: 75, cbi_11: 75, cbi_12: 75, cbi_13: 25,
      cbi_14: 50, cbi_15: 75, cbi_16: 75, cbi_17: 75, cbi_18: 50, cbi_19: 75,
    },
  },
  {
    dept: "sales",
    responses: {                                      // total ≈ 64 — Moderate
      cbi_1: 75, cbi_2: 75, cbi_3: 50, cbi_4: 75, cbi_5: 50, cbi_6: 75,
      cbi_7: 75, cbi_8: 50, cbi_9: 75, cbi_10: 50, cbi_11: 75, cbi_12: 75, cbi_13: 50,
      cbi_14: 75, cbi_15: 50, cbi_16: 75, cbi_17: 50, cbi_18: 75, cbi_19: 50,
    },
  },
  {
    dept: "sales",
    responses: {                                      // total ≈ 83 — High
      cbi_1: 100, cbi_2: 75, cbi_3: 100, cbi_4: 100, cbi_5: 75, cbi_6: 100,
      cbi_7: 75, cbi_8: 100, cbi_9: 75, cbi_10: 75, cbi_11: 100, cbi_12: 75, cbi_13: 0,
      cbi_14: 75, cbi_15: 75, cbi_16: 75, cbi_17: 75, cbi_18: 50, cbi_19: 75,
    },
  },
  {
    dept: "sales",
    responses: {                                      // total ≈ 67 — Moderate
      cbi_1: 75, cbi_2: 75, cbi_3: 75, cbi_4: 75, cbi_5: 50, cbi_6: 75,
      cbi_7: 75, cbi_8: 50, cbi_9: 75, cbi_10: 75, cbi_11: 50, cbi_12: 75, cbi_13: 25,
      cbi_14: 75, cbi_15: 50, cbi_16: 75, cbi_17: 50, cbi_18: 75, cbi_19: 50,
    },
  },
];

// ── Pre-computed score sets for CLOSED cycles ─────────────────────────────────
// Raw responses are omitted (simulates data retention pruning).
// Scores are inserted directly so trend queries work correctly.

type ClosedScore = {
  dept: "eng" | "sales";
  personal: number;
  work: number;
  client: number;
  total: number;
};

// Cycle 1 — Q2 2025 (oldest, avg total ≈ 72 — higher concern period)
const CLOSED1: ClosedScore[] = [
  { dept: "eng",   personal: 68, work: 70, client: 60, total: 66 },
  { dept: "eng",   personal: 75, work: 78, client: 65, total: 73 },
  { dept: "eng",   personal: 80, work: 76, client: 72, total: 76 },
  { dept: "eng",   personal: 62, work: 68, client: 55, total: 62 },
  { dept: "sales", personal: 78, work: 75, client: 70, total: 74 },
  { dept: "sales", personal: 82, work: 80, client: 75, total: 79 },
  { dept: "sales", personal: 70, work: 72, client: 68, total: 70 },
  { dept: "sales", personal: 85, work: 82, client: 78, total: 82 },
];

// Cycle 2 — Q3 2025 (avg total ≈ 65 — improving after intervention)
const CLOSED2: ClosedScore[] = [
  { dept: "eng",   personal: 55, work: 58, client: 50, total: 55 },
  { dept: "eng",   personal: 68, work: 70, client: 62, total: 67 },
  { dept: "eng",   personal: 72, work: 68, client: 65, total: 68 },
  { dept: "eng",   personal: 50, work: 55, client: 48, total: 51 },
  { dept: "sales", personal: 72, work: 70, client: 68, total: 70 },
  { dept: "sales", personal: 78, work: 75, client: 70, total: 74 },
  { dept: "sales", personal: 62, work: 65, client: 60, total: 63 },
  { dept: "sales", personal: 68, work: 65, client: 62, total: 65 },
];

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Seeding Mindlign test data…\n");

  // ── 1. Verify CBI assessment exists ──────────────────────────────────────────
  const cbi = await prisma.assessment.findUnique({
    where: { type: AssessmentType.CBI },
  });
  if (!cbi) {
    throw new Error(
      "CBI assessment definition not found.\n" +
      "Run the base seed first:  npm run seed -w packages/database"
    );
  }
  console.log("✓ CBI assessment found");

  // ── 2. Organisation ───────────────────────────────────────────────────────────
  const org = await prisma.organisation.upsert({
    where:  { slug: "acme-arabia" },
    update: {},
    create: {
      name:        "Acme Arabia",
      nameAr:      "مجموعة أكمي العربية",
      slug:        "acme-arabia",
      industry:    "Technology",
      sizeRange:   "50-200",
      countryCode: "SA",
      timezone:    "Asia/Riyadh",
    },
  });
  console.log(`✓ Organisation: ${org.name}`);

  // ── 3. Departments ────────────────────────────────────────────────────────────
  async function findOrCreateDept(name: string, nameAr: string) {
    const existing = await prisma.department.findFirst({
      where: { organisationId: org.id, name },
    });
    return existing ?? await prisma.department.create({
      data: { organisationId: org.id, name, nameAr },
    });
  }

  const engDept   = await findOrCreateDept("Engineering", "الهندسة");
  const salesDept = await findOrCreateDept("Sales",       "المبيعات");
  console.log(`✓ Departments: Engineering, Sales`);

  // ── 4. Executive user ─────────────────────────────────────────────────────────
  const demoEmail = "demo@mindlign.com";
  const demoPassword = "Demo1234567";

  const existingUser = await prisma.user.findUnique({ where: { email: demoEmail } });
  if (!existingUser) {
    const hash = await bcrypt.hash(demoPassword, 12);
    await prisma.user.create({
      data: {
        organisationId: org.id,
        email:          demoEmail,
        passwordHash:   hash,
        firstName:      "Demo",
        lastName:       "Executive",
        role:           "EXECUTIVE",
        isActive:       true,
      },
    });
    console.log(`✓ Executive user created: ${demoEmail} / ${demoPassword}`);
  } else {
    console.log(`✓ Executive user already exists: ${demoEmail}`);
  }

  // ── 5. Cycles ─────────────────────────────────────────────────────────────────
  async function findOrCreateCycle(data: {
    title:    string;
    status:   CycleStatus;
    startsAt: Date;
    endsAt:   Date;
    closedAt?: Date;
  }) {
    const existing = await prisma.assessmentCycle.findFirst({
      where: { organisationId: org.id, title: data.title },
    });
    return existing ?? await prisma.assessmentCycle.create({
      data: { organisationId: org.id, assessmentId: cbi.id, ...data },
    });
  }

  const cycle1 = await findOrCreateCycle({
    title:    "Q2 2025 Burnout Assessment",
    status:   CycleStatus.CLOSED,
    startsAt: new Date("2025-04-01"),
    endsAt:   new Date("2025-06-30"),
    closedAt: new Date("2025-07-01"),
  });

  const cycle2 = await findOrCreateCycle({
    title:    "Q3 2025 Burnout Assessment",
    status:   CycleStatus.CLOSED,
    startsAt: new Date("2025-07-01"),
    endsAt:   new Date("2025-09-30"),
    closedAt: new Date("2025-10-01"),
  });

  const cycle3 = await findOrCreateCycle({
    title:    "Q4 2025 Burnout Assessment",
    status:   CycleStatus.ACTIVE,
    startsAt: new Date("2025-10-01"),
    endsAt:   new Date("2025-12-31"),
  });

  console.log(`✓ Cycles: ${cycle1.title} | ${cycle2.title} | ${cycle3.title}`);

  // ── 6. Seed CLOSED cycles (score records only) ────────────────────────────────

  async function seedClosedCycle(
    cycleId:  string,
    scores:   ClosedScore[],
    closedAt: Date,
  ) {
    const count = await prisma.respondent.count({ where: { cycleId } });
    if (count > 0) {
      console.log(`  ↩ ${cycleId} already has respondents — skipping`);
      return;
    }

    for (let i = 0; i < scores.length; i++) {
      const s    = scores[i];
      const dept = s.dept === "eng" ? engDept : salesDept;
      // Spread submission times across the last 8 hours before cycle close
      const submittedAt = new Date(closedAt.getTime() - (scores.length - i) * 3_600_000);

      const respondent = await prisma.respondent.create({
        data: {
          cycleId,
          departmentId:    dept.id,
          consentGiven:    true,
          consentAt:       submittedAt,
          consentVersion:  "1.0",
          submittedAt,
        },
      });

      await prisma.score.createMany({
        data: [
          { respondentId: respondent.id, subscale: "personal_burnout", rawScore: s.personal, scaledScore: s.personal, band: cbiBand(s.personal) },
          { respondentId: respondent.id, subscale: "work_burnout",     rawScore: s.work,     scaledScore: s.work,     band: cbiBand(s.work)     },
          { respondentId: respondent.id, subscale: "client_burnout",   rawScore: s.client,   scaledScore: s.client,   band: cbiBand(s.client)   },
          { respondentId: respondent.id, subscale: "total",            rawScore: s.total,    scaledScore: s.total,    band: cbiBand(s.total)    },
        ],
      });
    }
    console.log(`  ✓ ${scores.length} respondents seeded into closed cycle`);
  }

  console.log(`\nSeeding closed cycles…`);
  await seedClosedCycle(cycle1.id, CLOSED1, new Date("2025-07-01"));
  await seedClosedCycle(cycle2.id, CLOSED2, new Date("2025-10-01"));

  // ── 7. Seed ACTIVE cycle (full responses + computed scores) ───────────────────

  console.log(`\nSeeding active cycle…`);
  const activeCount = await prisma.respondent.count({ where: { cycleId: cycle3.id } });

  if (activeCount > 0) {
    console.log(`  ↩ Active cycle already has respondents — skipping`);
  } else {
    const now = new Date();

    for (let i = 0; i < ACTIVE_PROFILES.length; i++) {
      const p    = ACTIVE_PROFILES[i];
      const dept = p.dept === "eng" ? engDept : salesDept;
      // Spread submissions over the past 20 hours
      const submittedAt = new Date(now.getTime() - (ACTIVE_PROFILES.length - i) * 7_200_000);

      const respondent = await prisma.respondent.create({
        data: {
          cycleId:        cycle3.id,
          departmentId:   dept.id,
          consentGiven:   true,
          consentAt:      submittedAt,
          consentVersion: "1.0",
          submittedAt,
        },
      });

      // Raw response rows (one per CBI item)
      await prisma.response.createMany({
        data: Object.entries(p.responses).map(([questionKey, rawValue]) => ({
          respondentId: respondent.id,
          questionKey,
          rawValue,
        })),
      });

      // Computed CBI scores
      const c = scoreCBI(p.responses);
      await prisma.score.createMany({
        data: [
          { respondentId: respondent.id, subscale: "personal_burnout", rawScore: c.personal_burnout.score, scaledScore: c.personal_burnout.score, band: c.personal_burnout.band },
          { respondentId: respondent.id, subscale: "work_burnout",     rawScore: c.work_burnout.score,     scaledScore: c.work_burnout.score,     band: c.work_burnout.band     },
          { respondentId: respondent.id, subscale: "client_burnout",   rawScore: c.client_burnout.score,   scaledScore: c.client_burnout.score,   band: c.client_burnout.band   },
          { respondentId: respondent.id, subscale: "total",            rawScore: c.total.score,            scaledScore: c.total.score,            band: c.total.band            },
        ],
      });
    }

    console.log(`  ✓ ${ACTIVE_PROFILES.length} respondents seeded (full responses + scores)`);
  }

  // ── Summary ───────────────────────────────────────────────────────────────────
  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Test seed complete!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Login URL  : <your-railway-web-url>/login
  Email      : demo@mindlign.com
  Password   : Demo1234567

  Active cycle : ${cycle3.title}
  Trend data   : Q2 2025 (avg ~72) → Q3 2025 (avg ~65) → Q4 2025 (avg ~60)

  Dashboard expected:
    Overall avg score   : ~60  (Moderate)
    Engineering dept    : ~51  (Moderate)
    Sales dept          : ~70  (Moderate)
    Band split          : 2 Low · 6 Moderate · 2 High
`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
