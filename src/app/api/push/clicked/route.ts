import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST /api/push/clicked — stamp clickedAt on the notification log when a
// user taps a push. Best-effort metric; the tweetId is parsed from the
// notification's target URL (/dashboard?post=<tweetId>).
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as { url?: string };
  const tweetId = body.url?.match(/[?&]post=(\d+)/)?.[1];

  if (tweetId) {
    const post = await prisma.post.findUnique({ where: { tweetId } });
    if (post) {
      await prisma.notificationLog.updateMany({
        where: { userId: session.user.id, postId: post.id, clickedAt: null },
        data: { clickedAt: new Date() },
      });
    }
  } else {
    // Batch notification (no specific post): stamp the most recent unclicked one.
    const latest = await prisma.notificationLog.findFirst({
      where: { userId: session.user.id, clickedAt: null },
      orderBy: { sentAt: "desc" },
    });
    if (latest) {
      await prisma.notificationLog.update({
        where: { id: latest.id },
        data: { clickedAt: new Date() },
      });
    }
  }
  return NextResponse.json({ ok: true });
}
