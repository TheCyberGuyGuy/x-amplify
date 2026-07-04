import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/roles";

// GET /api/pool/list — raw pool for admin management, annotated with each
// handle's linked user role (so super admins can manage admins).
export async function GET() {
  const session = await auth();
  if (!isAdmin(session?.user?.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const handles = await prisma.poolHandle.findMany({
    orderBy: { createdAt: "asc" },
  });

  // Map username -> role for people who have actually logged in.
  const users = await prisma.user.findMany({
    select: { username: true, role: true },
  });
  const roleByName = new Map(
    users
      .filter((u) => u.username)
      .map((u) => [u.username!.toLowerCase(), u.role])
  );

  const annotated = handles.map((h) => ({
    ...h,
    userRole: roleByName.get(h.username.toLowerCase()) ?? null,
  }));

  return NextResponse.json({ handles: annotated });
}
