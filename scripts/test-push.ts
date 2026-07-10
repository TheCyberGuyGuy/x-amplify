/**
 * Send a test push to every stored subscription, using the same web-push +
 * VAPID path as the cron poller. Isolates the "send + display + click" layers
 * from post discovery so you can verify pushes end-to-end on demand.
 *
 *   npx tsx scripts/test-push.ts
 *
 * Prereq: enable the notification bell in the app first (creates a
 * PushSubscription row), and keep that browser tab/PWA open so its service
 * worker can receive and display the notification.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Load .env.local into process.env before importing anything that reads it
// (Prisma needs DATABASE_URL; web-push needs the VAPID keys).
function loadEnv(file: string) {
  let raw: string;
  try {
    raw = readFileSync(resolve(process.cwd(), file), "utf8");
  } catch {
    return;
  }
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let val = m[2].trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    val = val.replace(/\s+#.*$/, "").trim(); // strip trailing comments
    if (!(m[1] in process.env)) process.env[m[1]] = val;
  }
}
loadEnv(".env.local");
loadEnv(".env");

async function main() {
  const webpush = (await import("web-push")).default;
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();

  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) {
    console.error("❌ VAPID keys missing. Set NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY.");
    process.exit(1);
  }
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:admin@etoro.com", pub, priv);

  const subs = await prisma.pushSubscription.findMany({
    include: { user: { select: { username: true } } },
  });
  if (subs.length === 0) {
    console.error("❌ No subscriptions in the DB. Turn on the notification bell in the app first.");
    process.exit(1);
  }
  console.log(`Found ${subs.length} subscription(s). Sending test push...`);

  const payload = JSON.stringify({
    title: "🚀 Test push",
    body: "If you can read this, the push pipeline works end-to-end.",
    url: "/dashboard",
    tag: "test-push",
  });

  let ok = 0;
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
        { TTL: 60 }
      );
      ok++;
      console.log(`  ✅ sent to @${sub.user.username ?? "?"} (${sub.endpoint.slice(0, 40)}…)`);
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      console.log(`  ❌ ${status ?? "?"} for @${sub.user.username ?? "?"} — ${(e as Error).message}`);
    }
  }
  console.log(`\nDone: ${ok}/${subs.length} delivered to the push service.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
