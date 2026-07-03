import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/pool/list — raw pool (admin management view, no follow status).
export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const handles = await prisma.poolHandle.findMany({
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ handles });
}
