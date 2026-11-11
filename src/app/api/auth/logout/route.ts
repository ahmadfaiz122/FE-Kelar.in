import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { sessions } from "@/db/schema";
import { cookieOptions, digestSession, SESSION_COOKIE } from "@/lib/auth";

export async function POST() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;
    if (token) await db.delete(sessions).where(eq(sessions.tokenHash, digestSession(token)));
    const response = NextResponse.json({ ok: true, redirectTo: "/" });
    response.cookies.set(SESSION_COOKIE, "", { ...cookieOptions(), maxAge: 0, expires: new Date(0) });
    return response;
  } catch {
    const response = NextResponse.json({ ok: true, redirectTo: "/" });
    response.cookies.set(SESSION_COOKIE, "", { ...cookieOptions(), maxAge: 0, expires: new Date(0) });
    return response;
  }
}
