import { eq } from "drizzle-orm";
import { db } from "@/db";
import { services } from "@/db/schema";
import type { UserRole } from "@/db/schema";
import { DashboardView } from "@/components/DashboardView";
import { ApplicationsListView } from "@/components/ApplicationsListView";
import { ApplicationDetailView } from "@/components/ApplicationDetailView";
import { NewApplicationForm } from "@/components/NewApplicationForm";
import { ForbiddenPage } from "@/components/ForbiddenPage";
import { AnalyticsView } from "@/components/AnalyticsView";
import { StaffManagement } from "@/components/StaffManagement";
import { NotificationsCenter } from "@/components/NotificationsCenter";
import { ProfileEditor } from "@/components/ProfileEditor";
import { pageUser } from "@/lib/page-auth";
import { loadApplications, loadApplicationDetail, loadLurahAnalytics, loadAccountNotifications } from "@/lib/data";
import { ensureDemoData } from "@/lib/seed";

export async function RoleDashboardPage({ role }: { role: UserRole }) {
  const user = await pageUser([role], role === "WARGA" ? "/dashboard" : `/${role === "PETUGAS" ? "staff" : role.toLowerCase()}/dashboard`);
  if (!user) return <ForbiddenPage />;
  const rows = await loadApplications(user);
  const analytics = role === "LURAH" ? await loadLurahAnalytics(user) : undefined;
  return <DashboardView user={user} applications={rows} analytics={analytics} />;
}

export async function RoleQueuePage({
  role, path, title, description, statuses, priorityOnly = false, showCitizen,
}: {
  role: UserRole; path: string; title: string; description: string; statuses?: string[]; priorityOnly?: boolean; showCitizen?: boolean;
}) {
  const user = await pageUser([role], path);
  if (!user) return <ForbiddenPage />;
  const rows = await loadApplications(user, statuses ? { statuses } : {});
  const visible = priorityOnly ? rows.filter((item) => item.priorityStatus === "MENUNGGU") : rows;
  return <ApplicationsListView applications={visible} title={title} description={description} showCitizen={showCitizen ?? role !== "WARGA"} emptyLabel={priorityOnly ? "Tidak ada permintaan prioritas yang menunggu keputusan." : undefined} />;
}

export async function CitizenApplicationsPage() {
  const user = await pageUser(["WARGA"], "/applications");
  if (!user) return <ForbiddenPage />;
  const rows = await loadApplications(user);
  return <ApplicationsListView applications={rows} title="Pengajuan saya" description="Semua pengajuan milik akun Anda, status, estimasi, dan akses ke timeline." showCitizen={false} emptyLabel="Anda belum membuat pengajuan." />;
}

export async function NewApplicationPage() {
  const user = await pageUser(["WARGA"], "/applications/new");
  if (!user) return <ForbiddenPage />;
  try {
    await ensureDemoData();
    const catalog = await db.select({ id: services.id, code: services.code, name: services.name, description: services.description, category: services.category, requirements: services.requirements, slaBusinessDays: services.slaBusinessDays, priorityEnabled: services.priorityEnabled, priorityTargetHours: services.priorityTargetHours, priorityEvidenceReasons: services.priorityEvidenceReasons, maxFileSizeMB: services.maxFileSizeMB }).from(services).where(eq(services.isActive, true));
    return <NewApplicationForm services={catalog} fullName={user.fullName} />;
  } catch {
    return <div className="section-card">Katalog layanan belum dapat dimuat. Coba muat kembali halaman ini.</div>;
  }
}

export async function ApplicationDetailPage({ id }: { id: string }) {
  const user = await pageUser(undefined, `/applications/${id}`);
  if (!user) return <ForbiddenPage />;
  const detail = await loadApplicationDetail(user, id);
  if (!detail) return <section><div className="page-heading"><div><span className="eyebrow">Tidak ditemukan</span><h1>Pengajuan tidak tersedia</h1><p>Pengajuan mungkin tidak ada atau tidak dapat dilihat dari akun ini.</p></div></div></section>;
  if (detail === "forbidden") return <ForbiddenPage />;
  return <ApplicationDetailView detail={detail} user={user} />;
}

export async function LurahAnalyticsPage({ settings = false }: { settings?: boolean }) {
  const user = await pageUser(["LURAH"], settings ? "/lurah/accountability" : "/lurah/reports");
  if (!user) return <ForbiddenPage />;
  const [analytics, serviceRows, applications] = await Promise.all([
    loadLurahAnalytics(user),
    db.select({ id: services.id, name: services.name, slaBusinessDays: services.slaBusinessDays, priorityTargetHours: services.priorityTargetHours, maxFileSizeMB: services.maxFileSizeMB, businessWeekdays: services.businessWeekdays, priorityEnabled: services.priorityEnabled }).from(services).where(eq(services.isActive, true)),
    loadApplications(user, { limit: 100 }),
  ]);
  return <AnalyticsView analytics={analytics} services={serviceRows} applications={applications} showSettings={settings} />;
}

export async function StaffManagementPage() {
  const user = await pageUser(["LURAH"], "/lurah/staff");
  if (!user) return <ForbiddenPage />;
  return <StaffManagement />;
}

export async function NotificationsPage() {
  const user = await pageUser(undefined, "/notifications");
  if (!user) return <ForbiddenPage />;
  const rows = await loadAccountNotifications(user.id);
  return <NotificationsCenter initialNotifications={rows} />;
}

export async function ProfilePage() {
  const user = await pageUser(undefined, "/profile");
  if (!user) return <ForbiddenPage />;
  return <ProfileEditor user={user} />;
}
