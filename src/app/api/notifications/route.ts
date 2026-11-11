import { and, desc, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { authorizeApi } from "@/lib/auth";

export async function GET() {
  const access = await authorizeApi("notification:read");
  if ("response" in access) return access.response;
  const rows = await db.select().from(notifications).where(eq(notifications.userId, access.user.id)).orderBy(desc(notifications.createdAt)).limit(100);
  return NextResponse.json({ notifications: rows, unreadCount: rows.filter((row) => !row.readAt).length });
}

export async function PATCH(request: Request) {
  const access = await authorizeApi("notification:read");
  if ("response" in access) return access.response;
  const body = await request.json().catch(() => ({}));
  if (body.markAll === true) {
    await db.update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.userId, access.user.id), isNull(notifications.readAt)));
  } else if (typeof body.id === "string") {
    await db.update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.id, body.id), eq(notifications.userId, access.user.id)));
  } else {
    return NextResponse.json({ error: "Pilih notifikasi yang akan ditandai." }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
