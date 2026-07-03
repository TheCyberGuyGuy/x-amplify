import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SELF_SELECTABLE_TYPES, isPoolType } from "@/lib/pool-types";

// GET /api/onboarding — does the logged-in user still need to pick a type?
export async function GET() {
  const session = await auth();
  if (!session?.user?.username) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const handle = await prisma.poolHandle.findUnique({
    where: { username: session.user.username.toLowerCase() },
    select: { type: true },
  });
  return NextResponse.json({ needsOnboarding: !handle?.type, type: handle?.type ?? null });
}

// POST /api/onboarding — user picks eTorian or Popular Investor for their own handle.
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.username) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as { type?: string };
  if (!isPoolType(body.type) || !SELF_SELECTABLE_TYPES.includes(body.type)) {
    return NextResponse.json({ error: "Invalid type." }, { status: 400 });
  }

  const username = session.user.username.toLowerCase();
  await prisma.poolHandle.upsert({
    where: { username },
    create: {
      username,
      xUserId: session.user.id,
      displayName: session.user.name ?? null,
      profileImage: session.user.image ?? null,
      type: body.type,
      addedById: session.user.id,
    },
    update: { type: body.type },
  });
  return NextResponse.json({ ok: true, type: body.type });
}
