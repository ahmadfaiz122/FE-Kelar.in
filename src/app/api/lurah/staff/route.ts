import { asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { applications, systemAuditLogs, users } from "@/db/schema";
import { authorizeApi, hashPassword } from "@/lib/auth";

export async function GET() {
  const access = await authorizeApi("staff:manage");
  if ("response" in access) return access.response;
  const staff = await db.select({ id: users.id, fullName: users.fullName, email: users.email, isActive: users.isActive, createdAt: users.createdAt }).from(users).where(eq(users.role, "PETUGAS")).orderBy(asc(users.fullName));
  const withCounts = await Promise.all(staff.map(async (person) => {
    const assigned = await db.select({ id: applications.id }).from(applications).where(eq(applications.assignedStaffId, person.id));
    return { ...person, handledCount: assigned.length };
  }));
  return NextResponse.json({ staff: withCounts });
}

export async function POST(request: Request) {
  const access = await authorizeApi("staff:manage");
  if ("response" in access) return access.response;
  const body = await request.json().catch(() => ({}));
  const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (fullName.length < 2 || fullName.length > 180 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 10) return NextResponse.json({ error: "Nama, email valid, dan kata sandi minimal 10 karakter wajib diisi." }, { status: 400 });
  try {
    const [created] = await db.insert(users).values({ fullName, email, role: "PETUGAS", passwordHash: hashPassword(password) }).returning({ id: users.id, fullName: users.fullName, email: users.email, isActive: users.isActive });
    await db.insert(systemAuditLogs).values({ actorId: access.user.id, action: "STAFF_CREATED", entityType: "user", entityId: created.id, afterData: { email, fullName, role: "PETUGAS" } });
    return NextResponse.json({ ok: true, staff: created }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Email sudah digunakan atau petugas tidak dapat dibuat." }, { status: 409 });
  }
}
