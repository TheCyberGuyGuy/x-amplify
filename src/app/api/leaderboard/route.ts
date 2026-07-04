import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type LeaderboardRow = {
  userId: string;
  name: string | null;
  username: string | null;
  image: string | null;
  count: number; // pool members this person follows
  total: number; // pool members eligible for them (excludes self)
  pct: number;
  isMe: boolean;
};

// GET /api/leaderboard — ranks portal users by how much of the pool they follow.
// Only includes people who have signed in (we snapshot their state on load).
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const activeHandles = await prisma.poolHandle.findMany({
    where: { active: true },
    select: { username: true },
  });
  const activeUsernames = activeHandles.map((h) => h.username.toLowerCase());

  // All snapshots against currently-active handles, with the viewer's identity.
  const states = await prisma.followState.findMany({
    where: { poolHandle: { active: true } },
    select: {
      following: true,
      user: {
        select: { id: true, name: true, username: true, image: true },
      },
    },
  });

  // Aggregate per measured user.
  type Measured = { user: (typeof states)[number]["user"]; count: number };
  const byUser = new Map<string, Measured>();
  for (const s of states) {
    const cur = byUser.get(s.user.id) ?? { user: s.user, count: 0 };
    if (s.following) cur.count += 1;
    byUser.set(s.user.id, cur);
  }

  const rows: LeaderboardRow[] = [...byUser.values()].map(({ user, count }) => {
    const uname = user.username?.toLowerCase();
    // Eligible pool = active handles minus this person's own handle.
    const total = uname
      ? activeUsernames.filter((u) => u !== uname).length
      : activeUsernames.length;
    return {
      userId: user.id,
      name: user.name,
      username: user.username,
      image: user.image,
      count: Math.min(count, total),
      total,
      pct: total ? Math.round((Math.min(count, total) / total) * 100) : 0,
      isMe: user.id === session.user.id,
    };
  });

  rows.sort(
    (a, b) => b.pct - a.pct || b.count - a.count || (a.name ?? "").localeCompare(b.name ?? "")
  );

  return NextResponse.json({ rows });
}
