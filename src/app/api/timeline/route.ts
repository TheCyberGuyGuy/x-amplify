import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getAccessTokenForUser,
  fetchLatestTweet,
  lookupUserByUsername,
  isValidXUserId,
  XApiError,
} from "@/lib/x-api";
import { isAdmin } from "@/lib/roles";

// How long a cached latest-post stays fresh before we re-check it.
// The post data is identical for every viewer, so this is fetched once per
// member per window and shared — cost is bound to the TTL, not to page views.
const TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

export type TimelineEntry = {
  id: string; // PoolHandle id
  username: string;
  displayName: string | null;
  type: string | null;
  latestTweetId: string | null;
  latestTweetAt: string | null;
};

type Handle = Awaited<ReturnType<typeof prisma.poolHandle.findMany>>[number];

/**
 * Re-fetch and cache the latest post for each given handle. Best-effort:
 * a failure on one handle doesn't abort the rest, and each handle is marked
 * checked so a bad one doesn't get retried on every request.
 */
async function refreshHandles(handles: Handle[], userId: string): Promise<void> {
  if (handles.length === 0) return;
  let token = await getAccessTokenForUser(userId);
  let refreshedToken = false;

  for (const h of handles) {
    try {
      // Resolve (and persist) a valid numeric X id if we don't have one.
      let xUserId = h.xUserId;
      if (!isValidXUserId(xUserId)) {
        const u = await lookupUserByUsername(h.username, token);
        if (!u) {
          // Handle gone/renamed — mark checked so we don't retry every load.
          await prisma.poolHandle.update({
            where: { id: h.id },
            data: { tweetsCheckedAt: new Date() },
          });
          continue;
        }
        xUserId = u.id;
      }

      const latest = await fetchLatestTweet(xUserId!, token);
      await prisma.poolHandle.update({
        where: { id: h.id },
        data: {
          xUserId,
          latestTweetId: latest?.id ?? null,
          latestTweetAt: latest?.createdAt ? new Date(latest.createdAt) : null,
          tweetsCheckedAt: new Date(),
        },
      });
    } catch (e) {
      // Refresh the token once on a 401, then keep going with the next handle.
      if ((e as XApiError).status === 401 && !refreshedToken) {
        refreshedToken = true;
        token = await getAccessTokenForUser(userId, true);
      }
      // Otherwise skip this handle; it stays stale and retries next window.
    }
  }
}

/** Build the viewer-facing list: everyone but me, with a post, newest first. */
async function buildEntries(
  myUsername?: string | null
): Promise<TimelineEntry[]> {
  const handles = await prisma.poolHandle.findMany({
    where: { active: true },
    orderBy: { createdAt: "asc" },
  });
  const me = myUsername?.toLowerCase();
  return handles
    .filter((h) => h.username.toLowerCase() !== me)
    .filter((h) => h.latestTweetId)
    .map((h) => ({
      id: h.id,
      username: h.username,
      displayName: h.displayName,
      type: h.type,
      latestTweetId: h.latestTweetId,
      latestTweetAt: h.latestTweetAt?.toISOString() ?? null,
    }))
    .sort((a, b) => (b.latestTweetAt ?? "").localeCompare(a.latestTweetAt ?? ""));
}

// GET /api/timeline — latest post per active member, refreshing only stale ones.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const handles = await prisma.poolHandle.findMany({
    where: { active: true },
    orderBy: { createdAt: "asc" },
  });

  const now = Date.now();
  const stale = handles.filter(
    (h) => !h.tweetsCheckedAt || now - h.tweetsCheckedAt.getTime() > TTL_MS
  );

  try {
    await refreshHandles(stale, session.user.id);
  } catch {
    // Token acquisition failed entirely — serve whatever is cached.
  }

  const entries = await buildEntries(session.user.username);
  return NextResponse.json({ entries, isAdmin: isAdmin(session.user.role) });
}

// POST /api/timeline — admin force-refresh of every active member (ignores TTL).
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const handles = await prisma.poolHandle.findMany({ where: { active: true } });
  try {
    await refreshHandles(handles, session.user.id);
  } catch (e) {
    const err = e as XApiError;
    return NextResponse.json(
      { error: err.message ?? "Refresh failed" },
      { status: err.status ?? 500 }
    );
  }

  const entries = await buildEntries(session.user.username);
  return NextResponse.json({ entries, isAdmin: true });
}
