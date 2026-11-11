import { Suspense } from "react";
import { redirect } from "next/navigation";
import { LoginExperience } from "@/components/LoginExperience";
import { getCurrentUser } from "@/lib/auth";
import { roleDashboard } from "@/lib/permissions";
import { ensureDemoData } from "@/lib/seed";
import "./login.css";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  await ensureDemoData();
  const user = await getCurrentUser();
  if (user) redirect(roleDashboard(user.role));
  return <Suspense fallback={<main className="login-screen"><div className="login-loading">Memuat halaman masuk…</div></main>}><LoginExperience /></Suspense>;
}
