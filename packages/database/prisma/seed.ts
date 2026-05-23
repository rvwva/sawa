import { PrismaClient, AssessmentType } from "@prisma/client";
import bcrypt from "bcryptjs";
import {
  CBI_SURVEY_SCHEMA,
  CBI_SCORING_RULES,
} from "../../scoring/definitions/cbi";
import {
  WHO5_SURVEY_SCHEMA,
  WHO5_SCORING_RULES,
} from "../../scoring/definitions/who5";
import {
  CULTURE_SURVEY_SCHEMA,
  CULTURE_SCORING_RULES,
} from "../../scoring/definitions/culture";

const prisma = new PrismaClient();

async function main() {
  // ── 1. Assessment definitions ──────────────────────────────────────────────
  console.log("Seeding assessment definitions…");

  const assessments = [
    {
      type: AssessmentType.CBI,
      name: "Copenhagen Burnout Inventory",
      nameAr: "مقياس كوبنهاغن للاحتراق الوظيفي",
      description:
        "Measures personal, work-related, and client-related burnout across 19 items.",
      itemCount: 19,
      surveySchema: CBI_SURVEY_SCHEMA,
      scoringRules: CBI_SCORING_RULES,
      version: "1.0",
    },
    {
      type: AssessmentType.WHO5,
      name: "WHO-5 Wellbeing Index",
      nameAr: "مؤشر الرفاهية WHO-5",
      description:
        "Short, self-reported measure of current mental wellbeing across 5 items.",
      itemCount: 5,
      surveySchema: WHO5_SURVEY_SCHEMA,
      scoringRules: WHO5_SCORING_RULES,
      version: "1.0",
    },
    {
      type: AssessmentType.CULTURE,
      name: "Mindlign Culture Assessment",
      nameAr: "تقييم ثقافة مايندلاين",
      description:
        "Proprietary 9-dimension workplace culture assessment across 40 items.",
      itemCount: 40,
      surveySchema: CULTURE_SURVEY_SCHEMA,
      scoringRules: CULTURE_SCORING_RULES,
      version: "1.0",
    },
  ];

  for (const a of assessments) {
    await prisma.assessment.upsert({
      where:  { type: a.type },
      update: {
        // Keep name + schemas fresh on every deploy
        name:        a.name,
        nameAr:      a.nameAr,
        surveySchema: a.surveySchema as any,
        scoringRules: a.scoringRules as any,
        updatedAt:   new Date(),
      },
      create: a as any,
    });
    console.log(`  ✓ ${a.name}`);
  }

  // ── 2. Demo organisation (skipped in production if env is set) ─────────────
  if (process.env.SKIP_DEMO_ORG !== "true") {
    console.log("\nSeeding demo organisation…");
    const org = await prisma.organisation.upsert({
      where:  { slug: "demo-corp" },
      update: {},
      create: {
        name:        "Demo Corporation",
        nameAr:      "شركة ديمو",
        slug:        "demo-corp",
        industry:    "Technology",
        sizeRange:   "200-500",
        countryCode: "SA",
        timezone:    "Asia/Riyadh",
      },
    });

    await prisma.department.createMany({
      skipDuplicates: true,
      data: [
        { organisationId: org.id, name: "Engineering",     nameAr: "الهندسة" },
        { organisationId: org.id, name: "Human Resources", nameAr: "الموارد البشرية" },
        { organisationId: org.id, name: "Operations",      nameAr: "العمليات" },
        { organisationId: org.id, name: "Finance",         nameAr: "المالية" },
        { organisationId: org.id, name: "Sales",           nameAr: "المبيعات" },
      ],
    });

    console.log("  ✓ Demo org + 5 departments");
  }

  // ── 3. Platform admin user ─────────────────────────────────────────────────
  // Reads ADMIN_EMAIL + ADMIN_PASSWORD from the environment.
  // On Cloud Run these come from Secret Manager via --update-secrets.
  // Uses upsert with empty update so re-runs never overwrite a changed password.
  const adminEmail    = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (adminEmail && adminPassword) {
    console.log("\nSeeding platform admin user…");
    const existing = await prisma.user.findUnique({ where: { email: adminEmail } });

    if (!existing) {
      const passwordHash = await bcrypt.hash(adminPassword, 12);
      await prisma.user.create({
        data: {
          email:        adminEmail,
          passwordHash,
          firstName:    "Platform",
          lastName:     "Admin",
          role:         "ADMIN",
          isActive:     true,
        },
      });
      console.log(`  ✓ Admin user created: ${adminEmail}`);
    } else {
      console.log(`  ✓ Admin user already exists: ${adminEmail} — skipping`);
    }
  } else {
    console.log("\n  ℹ ADMIN_EMAIL / ADMIN_PASSWORD not set — skipping admin user seed");
  }

  console.log("\nSeed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
