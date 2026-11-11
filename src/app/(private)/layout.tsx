import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { getCurrentUser, SESSION_COOKIE } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function PrivateLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) {
    const hadSession = (await cookies()).has(SESSION_COOKIE);
    redirect(hadSession ? "/login?expired=1" : "/login?next=%2Fdashboard");
  }
  return <AppShell user={user}>{children}</AppShell>;
}
