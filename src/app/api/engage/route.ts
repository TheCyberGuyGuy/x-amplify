import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ACTIONS = new Set(["LIKE", "REPOST", "QUOTE"]);

// GET /api/engage — has the current user ever boosted a post? Powers the
// "Boost a post" step in the dashboard flow banner.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const count = await prisma.engagementEvent.count({
    where: { userId: session.user.id },
  });
  return NextResponse.json({ count });
}

// POST /api/engage — record a boost click (like/repost/quote intent) on a
// discovered post. Mirrors /api/follow: the real action happens on X via an
// intent link; this is just the pilot metric.
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    tweetId?: string;
    action?: string;
  };
  if (!body.tweetId || !body.action || !ACTIONS.has(body.action)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const post = await prisma.post.findUnique({ where: { tweetId: body.tweetId } });
  if (!post) {
    // Post not (yet) discovered by the poll — nothing to attach the metric to.
    return NextResponse.json({ ok: true, tracked: false });
  }

  await prisma.engagementEvent.upsert({
    where: {
      userId_postId_action: {
        userId: session.user.id,
        postId: post.id,
        action: body.action,
      },
    },
    create: { userId: session.user.id, postId: post.id, action: body.action },
    update: { clickedAt: new Date() },
  });
  return NextResponse.json({ ok: true, tracked: true });
}
