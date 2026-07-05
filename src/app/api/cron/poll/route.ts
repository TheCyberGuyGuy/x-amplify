import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getAppBearerToken,
  searchRecentPosts,
  XApiError,
  type DiscoveredPost,
} from "@/lib/x-api";
import { notifyNewPosts, type NotifiablePost } from "@/lib/push";

// GET /api/cron/poll — discover new posts from the active pool via one
// batched search request, and persist them. No pushes are sent here (yet);
// this route only polls, dedupes, and keeps the timeline cache fresh.
//
// Invoked by Vercel Cron (or any scheduler) with:
//   Authorization: Bearer ${CRON_SECRET}

// Re-cover this much of the previous window so a delayed/failed poll can
// never permanently miss a post. Post.tweetId uniqueness absorbs the overlap.
const OVERLAP_MS = 5 * 60 * 1000;
// If there is no prior successful run, look back this far only.
const FIRST_RUN_LOOKBACK_MS = 30 * 60 * 1000;
// search/recent only accepts start_time within the last 7 days.
const SEARCH_WINDOW_MS = 7 * 24 * 60 * 60 * 1000 - 60 * 60 * 1000;

function monthlyReadBudget(): number {
  const n = Number(process.env.PUSH_MONTHLY_READ_BUDGET);
  return Number.isFinite(n) && n > 0 ? n : 2000; // ≈ $10/mo at ~$0.005/read
}

/** Current hour (0-23) in the portal's timezone. */
function hourInTz(tz: string): number {
  const h = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    hour12: false,
    timeZone: tz,
  }).format(new Date());
  return Number(h) % 24;
}

/** True if we're inside PUSH_ACTIVE_HOURS (e.g. "07-23"), default always-on. */
function inActiveHours(): boolean {
  const spec = process.env.PUSH_ACTIVE_HOURS;
  if (!spec) return true;
  const m = spec.match(/^(\d{1,2})-(\d{1,2})$/);
  if (!m) return true;
  const [start, end] = [Number(m[1]), Number(m[2])];
  const h = hourInTz(process.env.PUSH_TZ || "Asia/Jerusalem");
  // Supports windows that cross midnight (e.g. "22-06").
  return start <= end ? h >= start && h < end : h >= start || h < end;
}

/** Sum of posts read this calendar month (UTC) across all poll runs. */
async function postsReadThisMonth(): Promise<number> {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const agg = await prisma.pollRun.aggregate({
    where: { startedAt: { gte: monthStart } },
    _sum: { postsRead: true },
  });
  return agg._sum.postsRead ?? 0;
}

type HandleRef = {
  id: string;
  latestTweetAt: Date | null;
  pushEnabled: boolean;
  xUserId: string | null;
  displayName: string | null;
};

/**
 * Persist discovered posts. Returns the count of genuinely new posts and,
 * among those, the push-enabled ones ready to notify about.
 */
async function persistPosts(
  posts: DiscoveredPost[],
  handleByUsername: Map<string, HandleRef>
): Promise<{ newCount: number; notifiable: NotifiablePost[] }> {
  let newCount = 0;
  const created: NotifiablePost[] = [];
  for (const p of posts) {
    const handle = handleByUsername.get(p.authorUsername);
    if (!handle) continue; // author not (or no longer) in the pool

    const postedAt = new Date(p.createdAt);
    const result = await prisma.post.createMany({
      data: {
        tweetId: p.tweetId,
        poolHandleId: handle.id,
        text: p.text.slice(0, 280),
        postedAt,
      },
      skipDuplicates: true,
    });
    if (result.count === 0) continue; // overlap re-discovery
    newCount++;

    if (handle.pushEnabled) {
      const post = await prisma.post.findUnique({
        where: { tweetId: p.tweetId },
        select: { id: true },
      });
      if (post) {
        created.push({
          id: post.id,
          tweetId: p.tweetId,
          text: p.text,
          postedAt,
          authorUsername: p.authorUsername,
          authorXUserId: handle.xUserId,
          authorDisplayName: handle.displayName,
        });
      }
    }

    // Keep the dashboard timeline cache fresh as a side effect, so the
    // per-viewer refresh path in /api/timeline rarely needs to fire.
    if (!handle.latestTweetAt || postedAt > handle.latestTweetAt) {
      handle.latestTweetAt = postedAt;
      await prisma.poolHandle.update({
        where: { id: handle.id },
        data: {
          latestTweetId: p.tweetId,
          latestTweetAt: postedAt,
          tweetsCheckedAt: new Date(),
        },
      });
    }
  }
  return { newCount, notifiable: created };
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!inActiveHours()) {
    return NextResponse.json({ skipped: "quiet-hours" });
  }

  const budget = monthlyReadBudget();
  const spent = await postsReadThisMonth();
  if (spent >= budget) {
    console.warn(`[cron/poll] monthly read budget exhausted (${spent}/${budget})`);
    return NextResponse.json({ skipped: "budget-exhausted", spent, budget });
  }

  const handles = await prisma.poolHandle.findMany({
    where: { active: true },
    select: {
      id: true,
      username: true,
      latestTweetAt: true,
      pushEnabled: true,
      xUserId: true,
      displayName: true,
    },
  });
  if (handles.length === 0) {
    return NextResponse.json({ skipped: "empty-pool" });
  }
  const handleByUsername = new Map<string, HandleRef>(
    handles.map((h) => [
      h.username.toLowerCase(),
      {
        id: h.id,
        latestTweetAt: h.latestTweetAt,
        pushEnabled: h.pushEnabled,
        xUserId: h.xUserId,
        displayName: h.displayName,
      },
    ])
  );

  // Poll window: since the last successful run, minus overlap.
  const lastSuccess = await prisma.pollRun.findFirst({
    where: { status: "SUCCESS" },
    orderBy: { startedAt: "desc" },
    select: { startedAt: true },
  });
  const now = Date.now();
  const startTime = new Date(
    Math.max(
      lastSuccess
        ? lastSuccess.startedAt.getTime() - OVERLAP_MS
        : now - FIRST_RUN_LOOKBACK_MS,
      now - SEARCH_WINDOW_MS
    )
  );

  const run = await prisma.pollRun.create({ data: { status: "RUNNING" } });
  try {
    const { posts, requestCount } = await searchRecentPosts(
      handles.map((h) => h.username),
      startTime,
      getAppBearerToken()
    );
    const { newCount, notifiable } = await persistPosts(posts, handleByUsername);

    // Send pushes for fresh posts from push-enabled handles. Best-effort:
    // a push failure must never mark the poll as failed (posts are saved).
    let pushesSent = 0;
    if (notifiable.length > 0) {
      try {
        pushesSent = await notifyNewPosts(notifiable);
      } catch (e) {
        console.error("[cron/poll] push send failed:", e);
      }
      // Stamp even on failure so a retried poll can't double-notify.
      await prisma.post.updateMany({
        where: { id: { in: notifiable.map((p) => p.id) } },
        data: { notifiedAt: new Date() },
      });
    }

    await prisma.pollRun.update({
      where: { id: run.id },
      data: {
        status: "SUCCESS",
        finishedAt: new Date(),
        requestCount,
        postsRead: posts.length,
        newPosts: newCount,
      },
    });
    return NextResponse.json({
      ok: true,
      requestCount,
      postsRead: posts.length,
      newPosts: newCount,
      pushesSent,
      budget: { spent: spent + posts.length, total: budget },
    });
  } catch (e) {
    const err = e as XApiError;
    await prisma.pollRun.update({
      where: { id: run.id },
      data: {
        status: "ERROR",
        finishedAt: new Date(),
        error: err.message ?? "Unknown error",
      },
    });
    return NextResponse.json(
      { error: err.message ?? "Poll failed" },
      { status: err.status && err.status >= 400 ? err.status : 500 }
    );
  }
}
