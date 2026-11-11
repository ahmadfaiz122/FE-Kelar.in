import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { UserRole } from "@/db/schema";
import { getCurrentUser, SESSION_COOKIE } from "@/lib/auth";

export async function pageUser(allowedRoles?: UserRole[], intendedPath = "/dashboard") {
  const user = await getCurrentUser();
  if (!user) {
    const cookieExists = (await cookies()).has(SESSION_COOKIE);
    redirect(cookieExists ? "/login?expired=1" : `/login?next=${encodeURIComponent(intendedPath)}`);
  }
  if (allowedRoles && !allowedRoles.includes(user.role)) return null;
  return user;
}
