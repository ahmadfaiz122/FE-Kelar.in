import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { systemAuditLogs, users } from "@/db/schema";
import { authorizeApi } from "@/lib/auth";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const access = await authorizeApi("staff:manage");
  if ("response" in access) return access.response;
  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  if (typeof body.isActive !== "boolean") return NextResponse.json({ error: "Status aktif tidak valid." }, { status: 400 });
  const [person] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!person || person.role !== "PETUGAS") return NextResponse.json({ error: "Petugas tidak ditemukan." }, { status: 404 });
  await db.transaction(async (tx) => {
    await tx.update(users).set({ isActive: body.isActive }).where(eq(users.id, id));
    await tx.insert(systemAuditLogs).values({ actorId: access.user.id, action: body.isActive ? "STAFF_ACTIVATED" : "STAFF_DEACTIVATED", entityType: "user", entityId: id, beforeData: { isActive: person.isActive }, afterData: { isActive: body.isActive } });
  });
  return NextResponse.json({ ok: true, isActive: body.isActive });
}
