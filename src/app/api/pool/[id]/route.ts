import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/roles";
import { isPoolType } from "@/lib/pool-types";

async function requireAdmin() {
  const session = await auth();
  if (!isAdmin(session?.user?.role)) return null;
  return session;
}

// PATCH /api/pool/:id — edit a handle: toggle active and/or change type (admin+).
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    active?: boolean;
    type?: string;
  };

  const data: { active?: boolean; type?: string } = {};
  if (typeof body.active === "boolean") data.active = body.active;
  if (body.type !== undefined) {
    if (!isPoolType(body.type)) {
      return NextResponse.json({ error: "Invalid type." }, { status: 400 });
    }
    data.type = body.type;
  }

  const handle = await prisma.poolHandle.update({ where: { id }, data });
  return NextResponse.json({ handle });
}

// DELETE /api/pool/:id — remove from pool (admin).
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  await prisma.poolHandle.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
