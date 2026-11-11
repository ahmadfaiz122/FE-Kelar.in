import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { authorizeApi } from "@/lib/auth";

export async function PATCH(request: Request) {
  const access = await authorizeApi("profile:read");
  if ("response" in access) return access.response;
  const body = await request.json().catch(() => ({}));
  const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
  if (fullName.length < 2 || fullName.length > 180) return NextResponse.json({ error: "Nama harus berisi 2–180 karakter." }, { status: 400 });
  await db.update(users).set({ fullName }).where(eq(users.id, access.user.id));
  return NextResponse.json({ ok: true, fullName });
}
