import webpush from "web-push";
import { prisma } from "@/lib/prisma";

// Web-push send pipeline. Guardrails, in order:
//  - only posts from pushEnabled handles, published within the last hour
//  - never notify the post's author about their own post
//  - per-user daily cap (posts still appear in the feed when capped)
//  - one push per poll cycle per user, batching simultaneous posts
//  - NotificationLog's (userId, postId) unique key makes re-sends no-ops
//  - dead subscriptions (404/410 from the push service) are deleted

const MAX_POST_AGE_MS = 60 * 60 * 1000;

function dailyCap(): number {
  const n = Number(process.env.PUSH_DAILY_CAP);
  return Number.isFinite(n) && n > 0 ? n : 3;
}

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

export type NotifiablePost = {
  id: string; // Post.id
  tweetId: string;
  text: string | null;
  postedAt: Date;
  authorUsername: string; // lowercase
  authorXUserId: string | null;
  authorDisplayName: string | null;
};

type Payload = {
  title: string;
  body: string;
  url: string;
  tag: string;
};

function buildPayload(posts: NotifiablePost[]): Payload {
  const first = posts[0];
  const name = first.authorDisplayName ?? `@${first.authorUsername}`;
  if (posts.length === 1) {
    return {
      title: `🚀 ${name} just posted`,
      body: (first.text ?? "Give it a boost — like, repost, or quote it.").slice(0, 140),
      url: `/dashboard?post=${first.tweetId}&u=${first.authorUsername}`,
      tag: `post-${first.tweetId}`,
    };
  }
  return {
    title: `🚀 ${name} and ${posts.length - 1} other${posts.length > 2 ? "s" : ""} just posted`,
    body: "Fresh posts from the network — give them a boost.",
    url: "/dashboard",
    tag: "post-batch",
  };
}

/**
 * Send a push for each of the given posts to every subscribed user
 * (except each post's author), batched to at most one push per user.
 * Returns the number of pushes attempted. Best-effort: a failure for one
 * subscription never aborts the rest.
 */
export async function notifyNewPosts(posts: NotifiablePost[]): Promise<number> {
  const now = Date.now();
  const fresh = posts.filter((p) => now - p.postedAt.getTime() < MAX_POST_AGE_MS);
  if (fresh.length === 0 || !vapidConfigured()) return 0;

  const subs = await prisma.pushSubscription.findMany({
    include: {
      user: { select: { id: true, username: true, xUserId: true } },
    },
  });
  if (subs.length === 0) return 0;

  // Group subscriptions (devices) by user.
  const byUser = new Map<string, typeof subs>();
  for (const s of subs) {
    const list = byUser.get(s.userId) ?? [];
    list.push(s);
    byUser.set(s.userId, list);
  }

  const dayAgo = new Date(now - 24 * 60 * 60 * 1000);
  const cap = dailyCap();
  let sent = 0;

  for (const [userId, userSubs] of byUser) {
    const { username, xUserId } = userSubs[0].user;
    const mine = fresh.filter(
      (p) =>
        p.authorUsername !== username?.toLowerCase() &&
        (!p.authorXUserId || p.authorXUserId !== xUserId)
    );
    if (mine.length === 0) continue;

    const recentCount = await prisma.notificationLog.count({
      where: { userId, sentAt: { gte: dayAgo } },
    });
    if (recentCount >= cap) continue;

    // Claim the (user, post) pairs first; skipDuplicates means a post this
    // user was already notified about (e.g. a retried poll) drops out here.
    const { count: claimed } = await prisma.notificationLog.createMany({
      data: mine.map((p) => ({ userId, postId: p.id })),
      skipDuplicates: true,
    });
    if (claimed === 0) continue;

    const payload = JSON.stringify(buildPayload(mine));
    for (const sub of userSubs) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload,
          { TTL: 60 * 60 }
        );
        sent++;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await prisma.pushSubscription
            .delete({ where: { id: sub.id } })
            .catch(() => {});
        }
        // Other errors: skip this device, keep going.
      }
    }
  }
  return sent;
}
