'use client';

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, ArrowDownLeft, BarChart3, Bell, BriefcaseBusiness, CheckCheck, ChevronDown, ClipboardCheck, ClipboardList, FileClock, FilePlus2, FileText, Gauge, History, LayoutDashboard, LogOut, Menu, PanelLeftClose, PanelLeftOpen, Settings, ShieldCheck, UserRound, Users, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { SessionUser } from "@/lib/auth";
import type { UserRole } from "@/db/schema";
import { safeInitials } from "@/lib/format";
import { relativeWib } from "@/lib/dates";
import { roleDashboard } from "@/lib/permissions";
import { Brand } from "@/components/Brand";

type NavigationItem = { href: string; label: string; icon: LucideIcon; group?: string };
type NotificationItem = { id: string; title: string; body: string; href: string; readAt: string | null; createdAt: string };

const navigation: Record<UserRole, NavigationItem[]> = {
  WARGA: [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, group: "Menu utama" },
    { href: "/applications/new", label: "Buat pengajuan", icon: FilePlus2, group: "Menu utama" },
    { href: "/applications", label: "Pengajuan saya", icon: FileText, group: "Menu utama" },
    { href: "/notifications", label: "Notifikasi", icon: Bell, group: "Lainnya" },
    { href: "/profile", label: "Profil", icon: UserRound, group: "Lainnya" },
  ],
  PETUGAS: [
    { href: "/staff/dashboard", label: "Dashboard", icon: LayoutDashboard, group: "Ruang kerja" },
    { href: "/staff/verification", label: "Verifikasi berkas", icon: ClipboardCheck, group: "Antrean kerja" },
    { href: "/staff/processing", label: "Proses surat", icon: FileClock, group: "Antrean kerja" },
    { href: "/staff/priority", label: "Antrean prioritas", icon: Activity, group: "Antrean kerja" },
    { href: "/staff/finalization", label: "Finalisasi surat", icon: CheckCheck, group: "Antrean kerja" },
    { href: "/staff/applications", label: "Pengajuan masuk", icon: ClipboardList, group: "Riwayat" },
    { href: "/staff/history", label: "Riwayat pengajuan", icon: History, group: "Riwayat" },
  ],
  RTRW: [
    { href: "/rtrw/dashboard", label: "Dashboard", icon: LayoutDashboard, group: "Ruang kerja" },
    { href: "/rtrw/approvals", label: "Pengajuan menunggu ACC", icon: ClipboardCheck, group: "Persetujuan" },
    { href: "/rtrw/history", label: "Riwayat persetujuan", icon: History, group: "Persetujuan" },
    { href: "/rtrw/residents", label: "Profil warga", icon: Users, group: "Informasi" },
    { href: "/notifications", label: "Notifikasi", icon: Bell, group: "Informasi" },
  ],
  LURAH: [
    { href: "/lurah/dashboard", label: "Dashboard", icon: LayoutDashboard, group: "Monitoring" },
    { href: "/lurah/approvals", label: "Persetujuan surat", icon: ClipboardCheck, group: "Monitoring" },
    { href: "/lurah/monitoring", label: "Monitoring pengajuan", icon: Activity, group: "Monitoring" },
    { href: "/lurah/accountability", label: "Akuntabilitas SLA", icon: Gauge, group: "Laporan" },
    { href: "/lurah/reports", label: "Laporan pelayanan", icon: BarChart3, group: "Laporan" },
    { href: "/lurah/staff", label: "Manajemen petugas", icon: Users, group: "Pengaturan" },
  ],
  CAMAT: [
    { href: "/camat/dashboard", label: "Dashboard", icon: LayoutDashboard, group: "Ruang kerja" },
    { href: "/camat/approvals", label: "Persetujuan ahli waris", icon: ShieldCheck, group: "Persetujuan khusus" },
  ],
};

const roleName: Record<UserRole, string> = { WARGA: "Warga", PETUGAS: "Petugas", RTRW: "RT / RW", LURAH: "Lurah", CAMAT: "Camat" };
const pageTitle = (items: NavigationItem[], pathname: string) => [...items].sort((a, b) => b.href.length - a.href.length).find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))?.label ?? "Ruang kerja";

export function AppShell({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [busy, setBusy] = useState(false);
  const items = navigation[user.role];
  const unread = notifications.filter((item) => !item.readAt).length;
  const grouped = useMemo(() => items.reduce<Record<string, NavigationItem[]>>((groups, item) => { const group = item.group ?? "Menu"; groups[group] = [...(groups[group] ?? []), item]; return groups; }, {}), [items]);

  async function refreshNotifications() {
    try {
      const response = await fetch("/api/notifications", { cache: "no-store" });
      if (response.ok) setNotifications((await response.json()).notifications ?? []);
    } catch { /* a transient notification request does not block navigation */ }
  }
  useEffect(() => { void refreshNotifications(); }, []);

  async function markNotification(id?: string) {
    await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(id ? { id } : { markAll: true }) });
    await refreshNotifications();
  }
  async function logout() {
    if (busy) return;
    setBusy(true);
    try { await fetch("/api/auth/logout", { method: "POST" }); } finally { window.location.assign("/"); }
  }
  function isActive(href: string) { return pathname === href || (href !== "/dashboard" && href !== "/staff/dashboard" && href !== "/rtrw/dashboard" && href !== "/lurah/dashboard" && href !== "/camat/dashboard" && pathname.startsWith(`${href}/`)); }

  const sidebar = (
    <aside className={`portal-sidebar${collapsed ? " collapsed" : ""}${mobileOpen ? " mobile-open" : ""}`} aria-label="Navigasi aplikasi">
      <div className="portal-logo-row"><Brand href={user.role === "WARGA" ? "/dashboard" : `/${user.role.toLowerCase()}/dashboard`} /><button className="icon-button mobile-hide" aria-label={collapsed ? "Perluas sidebar" : "Ciutkan sidebar"} onClick={() => setCollapsed(!collapsed)}>{collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}</button><button className="icon-button mobile-close" aria-label="Tutup navigasi" onClick={() => setMobileOpen(false)}><X size={18} /></button></div>
      <div style={{ overflowY: "auto", flex: 1 }}>{Object.entries(grouped).map(([group, groupItems]) => <div key={group}><div className="portal-nav-heading">{group}</div><nav className="portal-nav">{groupItems.map((item) => { const Icon = item.icon; return <Link key={item.href} className={`portal-nav-link${isActive(item.href) ? " active" : ""}`} href={item.href} title={collapsed ? item.label : undefined} onClick={() => setMobileOpen(false)}><Icon size={18} strokeWidth={1.8} /><span>{item.label}</span></Link>; })}</nav></div>)}</div>
      <div className="portal-user-box"><div className="avatar">{safeInitials(user.fullName)}</div><div className="portal-user-copy"><b>{user.fullName}</b><span>{roleName[user.role]} · akun demo</span></div></div>
    </aside>
  );

  return <div className="portal-shell">
    {sidebar}
    <button className={`drawer-backdrop${mobileOpen ? " visible" : ""}`} aria-label="Tutup navigasi" onClick={() => setMobileOpen(false)} />
    <div className={`portal-main${collapsed ? " collapsed" : ""}`}>
      <header className="portal-topbar">
        <div className="portal-topbar-left"><button className="icon-button mobile-menu-button" aria-label="Buka navigasi" onClick={() => setMobileOpen(true)}><Menu size={20} /></button><span className="portal-breadcrumb">{roleName[user.role]} <span style={{ marginInline: 7, color: "#c4b9c1" }}>/</span></span><span className="portal-topbar-title">{pageTitle(items, pathname)}</span></div>
        <div className="portal-topbar-actions">
          <span className="status-pill status-pill--amber mobile-hide">Data simulasi</span>
          <div style={{ position: "relative" }}><button className="icon-button" aria-label={`Notifikasi${unread ? `, ${unread} belum dibaca` : ""}`} aria-expanded={notificationOpen} onClick={() => { setNotificationOpen(!notificationOpen); if (!notificationOpen) void refreshNotifications(); }}><Bell size={19} />{unread > 0 && <span className="notification-badge">{unread > 9 ? "9+" : unread}</span>}</button>{notificationOpen && <div className="notification-popover"><div className="section-card-header"><div><h2>Notifikasi</h2><p>{unread ? `${unread} belum dibaca` : "Semua sudah dibaca"}</p></div>{unread > 0 && <button className="text-link" onClick={() => void markNotification()}>Tandai semua</button>}</div>{notifications.length ? notifications.slice(0, 6).map((item) => <Link className={`notification-item${item.readAt ? "" : " unread"}`} key={item.id} href={item.href} onClick={() => { if (!item.readAt) void markNotification(item.id); setNotificationOpen(false); }}><b>{item.title}</b><p>{item.body}</p><small>{relativeWib(item.createdAt)}</small></Link>) : <div className="empty-state" style={{ minHeight: 100 }}>Belum ada notifikasi.</div>}<Link className="text-link" href="/notifications" onClick={() => setNotificationOpen(false)} style={{ display: "flex", justifyContent: "center", paddingTop: 12 }}>Lihat pusat notifikasi <ArrowDownLeft size={14} /></Link></div>}</div>
          <button className="icon-button" title="Profil" aria-label="Lihat profil" onClick={() => window.location.assign("/profile")}><UserRound size={19} /></button>
          <button className="icon-button" title={busy ? "Keluar…" : "Keluar"} aria-label="Keluar" disabled={busy} onClick={() => void logout()}><LogOut size={18} /></button>
        </div>
      </header>
      <main className="portal-content">{children}<div className="portal-footer">© {new Date().getFullYear()} kelar.in · Platform demo, bukan layanan operasional.</div></main>
      <nav className="mobile-bottom-nav" aria-label="Navigasi cepat">{items.slice(0, 4).map((item) => { const Icon = item.icon; return <Link className={`mobile-nav-link${isActive(item.href) ? " active" : ""}`} key={item.href} href={item.href}><Icon /><span>{item.label.length > 13 ? `${item.label.slice(0, 11)}…` : item.label}</span></Link>; })}</nav>
    </div>
  </div>;
}
