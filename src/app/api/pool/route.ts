import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getAccessTokenForUser,
  lookupUsersByUsernames,
  lookupUserByUsername,
  isFollowing,
  isEtoroAffiliated,
  XApiError,
} from "@/lib/x-api";
import { isPoolType } from "@/lib/pool-types";
import { isAdmin } from "@/lib/roles";

export type PoolMember = {
  id: string;
  username: string;
  displayName: string | null;
  profileImage: string | null;
  description: string | null;
  isEtoroVerified: boolean;
  following: boolean;
  type: string | null;
};

// GET /api/pool — the logged-in user's follow status across the active pool.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const handles = await prisma.poolHandle.findMany({
    where: { active: true },
    orderBy: { createdAt: "asc" },
  });

  const myUsername = session.user.username?.toLowerCase();
  // Don't ask a user to follow themselves.
  const targets = handles.filter((h) => h.username.toLowerCase() !== myUsername);

  if (targets.length === 0) {
    return NextResponse.json({ following: [], toFollow: [], total: 0 });
  }

  try {
    let token = await getAccessTokenForUser(session.user.id);
    let xUsers;
    try {
      xUsers = await lookupUsersByUsernames(targets.map((h) => h.username), token);
    } catch (e) {
      // Token rejected mid-flight → force a refresh and retry once.
      if ((e as XApiError).status === 401) {
        token = await getAccessTokenForUser(session.user.id, true);
        xUsers = await lookupUsersByUsernames(targets.map((h) => h.username), token);
      } else {
        throw e;
      }
    }
    const byName = new Map(xUsers.map((u) => [u.username.toLowerCase(), u]));

    const members: PoolMember[] = targets.map((h) => {
      const x = byName.get(h.username.toLowerCase());
      return {
        id: h.id,
        username: h.username,
        displayName: x?.name ?? h.displayName,
        profileImage: x?.profile_image_url ?? h.profileImage,
        description: x?.description ?? h.description,
        isEtoroVerified: x ? isEtoroAffiliated(x) : h.isEtoroVerified,
        following: x ? isFollowing(x) : false,
        type: h.type,
      };
    });

    // Snapshot this viewer's follow state for the leaderboard. Best-effort:
    // never let a write failure break the dashboard.
    try {
      await prisma.$transaction(
        members.map((m) =>
          prisma.followState.upsert({
            where: {
              userId_poolHandleId: {
                userId: session.user.id,
                poolHandleId: m.id,
              },
            },
            create: {
              userId: session.user.id,
              poolHandleId: m.id,
              following: m.following,
            },
            update: { following: m.following },
          })
        )
      );
    } catch {
      // ignore — leaderboard will just be slightly stale for this user
    }

    return NextResponse.json({
      following: members.filter((m) => m.following),
      toFollow: members.filter((m) => !m.following),
      total: members.length,
    });
  } catch (e) {
    const err = e as XApiError;
    return NextResponse.json(
      { error: err.message ?? "X lookup failed" },
      { status: err.status ?? 500 }
    );
  }
}

// POST /api/pool — admin adds a handle (resolves + verifies via X).
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    username?: string;
    type?: string;
  };
  const username = body.username?.trim().replace(/^@/, "").toLowerCase();
  if (!username || !/^[a-z0-9_]{1,15}$/.test(username)) {
    return NextResponse.json({ error: "Invalid X handle." }, { status: 400 });
  }
  // Admins may assign any of the three types (incl. ETORO_HANDLE).
  const type = isPoolType(body.type) ? body.type : "ETORIAN";

  const existing = await prisma.poolHandle.findUnique({ where: { username } });
  if (existing) {
    return NextResponse.json({ error: "Handle already in the pool." }, { status: 409 });
  }

  try {
    const token = await getAccessTokenForUser(session.user.id);
    const x = await lookupUserByUsername(username, token);
    if (!x) {
      return NextResponse.json({ error: "No such X account." }, { status: 404 });
    }
    const handle = await prisma.poolHandle.create({
      data: {
        username: x.username.toLowerCase(),
        xUserId: x.id,
        displayName: x.name,
        profileImage: x.profile_image_url ?? null,
        description: x.description ?? null,
        isEtoroVerified: isEtoroAffiliated(x),
        type,
        addedById: session.user.id,
      },
    });
    return NextResponse.json({ handle }, { status: 201 });
  } catch (e) {
    const err = e as XApiError;
    return NextResponse.json(
      { error: err.message ?? "Failed to add handle" },
      { status: err.status ?? 500 }
    );
  }
}
