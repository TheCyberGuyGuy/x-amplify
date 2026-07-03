import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST /api/follow — record that a user clicked "Follow" (pilot metrics).
// The actual follow happens on X via an intent link; this is just tracking.
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as { poolHandleId?: string };
  if (!body.poolHandleId) {
    return NextResponse.json({ error: "Missing poolHandleId" }, { status: 400 });
  }
  await prisma.followEvent.upsert({
    where: {
      userId_poolHandleId: {
        userId: session.user.id,
        poolHandleId: body.poolHandleId,
      },
    },
    create: { userId: session.user.id, poolHandleId: body.poolHandleId },
    update: { clickedAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
