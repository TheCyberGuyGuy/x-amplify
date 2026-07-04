import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSuperAdmin } from "@/lib/roles";

// POST /api/admin/role — super admin promotes/demotes an admin by username.
// Body: { username: string, makeAdmin: boolean }
export async function POST(req: Request) {
  const session = await auth();
  if (!isSuperAdmin(session?.user?.role)) {
    return NextResponse.json({ error: "Super admin only." }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    username?: string;
    makeAdmin?: boolean;
  };
  const username = body.username?.trim().replace(/^@/, "").toLowerCase();
  if (!username) {
    return NextResponse.json({ error: "Missing username." }, { status: 400 });
  }
  if (username === session!.user.username?.toLowerCase()) {
    return NextResponse.json({ error: "You can't change your own role." }, { status: 400 });
  }

  // Match case-insensitively; the target must have logged in at least once.
  const users = await prisma.user.findMany({ select: { id: true, username: true, role: true } });
  const target = users.find((u) => u.username?.toLowerCase() === username);
  if (!target) {
    return NextResponse.json(
      { error: "That person hasn't logged in yet, so they can't be made an admin." },
      { status: 404 }
    );
  }
  if (target.role === "SUPER_ADMIN") {
    return NextResponse.json({ error: "Can't change a super admin's role." }, { status: 400 });
  }

  const role = body.makeAdmin ? "ADMIN" : "EMPLOYEE";
  await prisma.user.update({ where: { id: target.id }, data: { role } });
  return NextResponse.json({ ok: true, role });
}
