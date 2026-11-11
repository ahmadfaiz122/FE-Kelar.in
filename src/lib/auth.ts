import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { sessions, users, type UserRole } from "@/db/schema";
import type { Permission } from "@/lib/permissions";
import { hasPermission } from "@/lib/permissions";

export const SESSION_COOKIE = "kelar_session";
export const SESSION_MAX_AGE = 60 * 60 * 8;
export type SessionUser = { id: string; email: string; fullName: string; role: UserRole; isActive: boolean };

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string) {
  const [algorithm, salt, hash] = stored.split(":");
  if (algorithm !== "scrypt" || !salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return expected.length === candidate.length && timingSafeEqual(candidate, expected);
}

export function createSessionToken() {
  return randomBytes(32).toString("base64url");
}

export function digestSession(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const rows = await db
    .select({ id: users.id, email: users.email, fullName: users.fullName, role: users.role, isActive: users.isActive, sessionId: sessions.id })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.tokenHash, digestSession(token)), gt(sessions.expiresAt, new Date()), eq(users.isActive, true)))
    .limit(1);
  if (!rows[0]) return null;
  const { sessionId: _sessionId, ...user } = rows[0];
  return user;
}

export async function authorizeApi(permission?: Permission | Permission[]) {
  let user: SessionUser | null;
  try {
    user = await getCurrentUser();
  } catch {
    return { response: NextResponse.json({ error: "Sesi tidak valid. Silakan masuk kembali." }, { status: 401 }) };
  }
  if (!user) return { response: NextResponse.json({ error: "Silakan masuk untuk melanjutkan.", code: "UNAUTHENTICATED" }, { status: 401 }) };
  const requested = permission ? (Array.isArray(permission) ? permission : [permission]) : [];
  if (requested.length > 0 && !requested.some((item) => hasPermission(user!.role, item))) {
    return { response: NextResponse.json({ error: "Anda tidak memiliki izin untuk tindakan ini.", code: "FORBIDDEN" }, { status: 403 }) };
  }
  return { user };
}

export function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE,
  };
}
