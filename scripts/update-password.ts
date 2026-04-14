/**
 * One-off script: update a user's password in the database.
 * Usage:
 *   DATABASE_URL="postgresql://..." npx tsx scripts/update-password.ts
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const EMAIL    = "rawan@mindlign.com";
const PASSWORD = "Mindlign2026!";

const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash(PASSWORD, 12);

  const user = await prisma.user.update({
    where: { email: EMAIL },
    data:  { passwordHash: hash },
    select: { id: true, email: true, role: true },
  });

  console.log(`Password updated for ${user.email} (${user.role})`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
