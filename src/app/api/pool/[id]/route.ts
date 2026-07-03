import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") return null;
  return session;
}

// PATCH /api/pool/:id — toggle active (admin).
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { active?: boolean };
  const handle = await prisma.poolHandle.update({
    where: { id },
    data: { active: body.active ?? true },
  });
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
