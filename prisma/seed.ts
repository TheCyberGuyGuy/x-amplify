import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Pilot pool. Profile data + eToro verification are filled in live when an
// admin re-adds them through the UI (which calls X); this just pre-populates
// the pool so the dashboard isn't empty on first run.
const PILOT_HANDLES = [
  "etoro",
  "samuelrudnick",
  // add the rest of your 5 pilot handles here
];

async function main() {
  for (const username of PILOT_HANDLES) {
    await prisma.poolHandle.upsert({
      where: { username: username.toLowerCase() },
      create: { username: username.toLowerCase() },
      update: {},
    });
    console.log(`seeded @${username}`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
