import webpush from "web-push";
import { prisma } from "@/lib/prisma";

// "New people joined" re-engagement digest. For each push-subscribed user we
// send at most one batched notification per run, listing pool members who
// joined since that user's watermark (User.joinDigestAt) and whom they don't
// already follow. The watermark advances every run so nobody is told about the
// same joiner twice; first-timers (null watermark) look back a fixed window.
//
// Deliberately mirrors the small VAPID/send helpers in push.ts rather than
// sharing them, to keep the verified post-notification path untouched.

const FIRST_DIGEST_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000; // never-notified users
const MAX_CANDIDATE_AGE_MS = 30 * 24 * 60 * 60 * 1000; // ignore stale "joins"

function vapidConfigured(): boolean {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:admin@etoro.com",
    pub,
    priv
  );
  return true;
}

type Joiner = {
  id: string; // PoolHandle.id
  username: string;
  displayName: string | null;
  createdAt: Date;
};

function buildPayload(joiners: Joiner[]): string {
  const names = joiners.map((j) => j.displayName ?? `@${j.username}`);
  let title: string;
  if (names.length === 1) {
    title = `🎉 ${names[0]} joined X-Amplify`;
  } else if (names.length === 2) {
    title = `🎉 ${names[0]} and ${names[1]} joined X-Amplify`;
  } else {
    title = `🎉 ${names[0]}, ${names[1]} and ${names.length - 2} more joined X-Amplify`;
  }
  return JSON.stringify({
    title,
    body: "Follow them to boost each other's reach on X.",
    // join=1 lets /api/push/clicked skip this (it isn't a post notification);
    // #to-follow scrolls straight to the People to follow section.
    url: "/dashboard?join=1#to-follow",
    tag: "join-digest",
  });
}

/**
 * Send the "new joiners" digest to every subscribed user. Returns the number
 * of pushes attempted. Best-effort: one failed send never aborts the rest, and
 * each processed user's watermark advances so the next run starts fresh.
 */
export async function notifyNewJoiners(): Promise<number> {
  if (!vapidConfigured()) return 0;
  const now = Date.now();

  const candidates: Joiner[] = await prisma.poolHandle.findMany({
    where: {
      active: true,
      type: { not: null },
      createdAt: { gte: new Date(now - MAX_CANDIDATE_AGE_MS) },
    },
    select: { id: true, username: true, displayName: true, createdAt: true },
  });
  if (candidates.length === 0) return 0;

  const subs = await prisma.pushSubscription.findMany({
    include: {
      user: { select: { id: true, username: true, joinDigestAt: true } },
    },
  });
  if (subs.length === 0) return 0;

  // Group devices by user.
  const byUser = new Map<string, typeof subs>();
  for (const s of subs) {
    const list = byUser.get(s.userId) ?? [];
    list.push(s);
    byUser.set(s.userId, list);
  }

  let sent = 0;
  for (const [userId, userSubs] of byUser) {
    const { username, joinDigestAt } = userSubs[0].user;
    const start = joinDigestAt ?? new Date(now - FIRST_DIGEST_LOOKBACK_MS);
    const mine = candidates.filter(
      (c) =>
        c.createdAt > start &&
        c.username.toLowerCase() !== username?.toLowerCase()
    );

    // Drop joiners this user already follows.
    let fresh = mine;
    if (mine.length > 0) {
      const followed = await prisma.followState.findMany({
        where: {
          userId,
          following: true,
          poolHandleId: { in: mine.map((c) => c.id) },
        },
        select: { poolHandleId: true },
      });
      const followedIds = new Set(followed.map((f) => f.poolHandleId));
      fresh = mine.filter((c) => !followedIds.has(c.id));
    }

    if (fresh.length > 0) {
      const payload = buildPayload(fresh);
      for (const sub of userSubs) {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            payload,
            { TTL: 24 * 60 * 60 }
          );
          sent++;
        } catch (e) {
          const status = (e as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) {
            await prisma.pushSubscription
              .delete({ where: { id: sub.id } })
              .catch(() => {});
          }
        }
      }
    }

    // Advance the watermark whether or not we sent, so a user who follows
    // everyone new isn't re-evaluated against the same joiners next run.
    await prisma.user
      .update({ where: { id: userId }, data: { joinDigestAt: new Date(now) } })
      .catch(() => {});
  }
  return sent;
}
