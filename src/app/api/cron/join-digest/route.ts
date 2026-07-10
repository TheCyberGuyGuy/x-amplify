import { NextResponse, type NextRequest } from "next/server";
import { notifyNewJoiners } from "@/lib/join-digest";

// GET /api/cron/join-digest — daily re-engagement push: tell subscribed users
// about people who newly joined the pool and whom they don't yet follow.
// Invoked by Vercel Cron with: Authorization: Bearer ${CRON_SECRET}
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const pushesSent = await notifyNewJoiners();
    return NextResponse.json({ ok: true, pushesSent });
  } catch (e) {
    console.error("[cron/join-digest] failed:", e);
    return NextResponse.json(
      { error: (e as Error).message ?? "Join digest failed" },
      { status: 500 }
    );
  }
}
