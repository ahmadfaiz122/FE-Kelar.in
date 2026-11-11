import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { authorizeApi, cookieOptions, createSessionToken, digestSession, SESSION_MAX_AGE, SESSION_COOKIE, verifyPassword } from "@/lib/auth";
import { canAccessPath, roleDashboard } from "@/lib/permissions";
import { ensureDemoData } from "@/lib/seed";

export const runtime = "nodejs";
const attempts = new Map<string, { count: number; resetAt: number }>();

export async function POST(request: Request) {
  try {
    await ensureDemoData();
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const now = Date.now();
    const state = attempts.get(ip);
    if (state && state.resetAt > now && state.count >= 12) {
      return NextResponse.json({ error: "Terlalu banyak percobaan. Coba lagi dalam beberapa menit." }, { status: 429 });
    }
    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!email || !password || email.length > 255 || password.length > 200) {
      return NextResponse.json({ error: "Email dan kata sandi wajib diisi." }, { status: 400 });
    }
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!user || !user.isActive || !verifyPassword(password, user.passwordHash)) {
      const updated = state && state.resetAt > now ? { ...state, count: state.count + 1 } : { count: 1, resetAt: now + 5 * 60_000 };
      attempts.set(ip, updated);
      return NextResponse.json({ error: "Email atau kata sandi tidak sesuai." }, { status: 401 });
    }
    attempts.delete(ip);
    const token = createSessionToken();
    const expiresAt = new Date(now + SESSION_MAX_AGE * 1000);
    await db.insert(sessions).values({ userId: user.id, tokenHash: digestSession(token), expiresAt });
    const requestedPath = typeof body.next === "string" && body.next.startsWith("/") && !body.next.startsWith("//") ? body.next : "";
    const destination = requestedPath && canAccessPath(user.role, requestedPath) ? requestedPath : roleDashboard(user.role);
    const response = NextResponse.json({ user: { id: user.id, fullName: user.fullName, email: user.email, role: user.role }, redirectTo: destination });
    response.cookies.set(SESSION_COOKIE, token, cookieOptions());
    return response;
  } catch (error) {
    console.error("Login error", error);
    return NextResponse.json({ error: "Layanan login sedang tidak tersedia. Silakan coba kembali." }, { status: 500 });
  }
}

export async function GET() {
  const access = await authorizeApi();
  if ("response" in access) return access.response;
  return NextResponse.json({ authenticated: true, user: access.user });
}
