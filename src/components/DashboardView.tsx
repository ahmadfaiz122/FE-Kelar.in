'use client';

import Link from "next/link";
import { ArrowRight, BadgeCheck, Bell, BriefcaseBusiness, CalendarCheck2, ChartNoAxesCombined, CircleAlert, Clock3, FileCheck2, FileClock, FilePlus2, FileText, Gauge, Heart, History, ShieldCheck, Sparkles, Users, Workflow } from "lucide-react";
import type { SessionUser } from "@/lib/auth";
import type { ApplicationSummary } from "@/lib/data";
import { formatWib, isLate } from "@/lib/dates";
import { humanStatus, statusTone } from "@/lib/format";

export type AnalyticsData = {
  totals: { applications: number; completed: number; late: number; waitingApproval: number; onTimePercent: number | null; previousMonthChange: number | null; currentMonth: number; averageDays: number | null };
  rating: { overall: number | null; count: number; mayor: number | null; mayorCount: number; distribution: { stars: number; count: number }[]; categories: { category: string; count: number }[] };
  trend: { label: string; total: number }[];
  lateApplications: ApplicationSummary[];
  approvalsWaiting: ApplicationSummary[];
};

type Metric = { label: string; value: string | number; foot: string; icon: typeof FileText };
const text: Record<string, { greeting: string; subtitle: string; focus: string; queueTitle: string; queueCaption: string }> = {
  WARGA: { greeting: "Selamat datang", subtitle: "Pantau setiap pengajuan dan dapatkan informasi proses dalam satu dashboard.", focus: "Pengajuan terbaru", queueTitle: "Aktivitas pengajuan", queueCaption: "Status pribadi yang tercatat di akun Anda." },
  PETUGAS: { greeting: "Ruang kerja petugas", subtitle: "Kelola verifikasi, proses surat, prioritas, dan finalisasi dalam satu antrean.", focus: "Perlu perhatian", queueTitle: "Antrean kerja", queueCaption: "Pengajuan yang berada dalam lingkup tugas Anda." },
  RTRW: { greeting: "Ruang persetujuan RT/RW", subtitle: "Tinjau pengajuan yang ditugaskan kepada Anda sebelum memberi persetujuan lingkungan.", focus: "Menunggu pemeriksaan", queueTitle: "Persetujuan lingkungan", queueCaption: "Pengajuan warga pada penugasan akun ini." },
  LURAH: { greeting: "Monitoring pelayanan", subtitle: "Pantau transparansi SLA, antrean persetujuan, dan ringkasan kualitas pelayanan.", focus: "Butuh persetujuan", queueTitle: "Pemantauan layanan", queueCaption: "Status pengajuan lintas tahap dari database sistem." },
  CAMAT: { greeting: "Persetujuan khusus Camat", subtitle: "Tinjau hanya pengajuan ahli waris yang memerlukan persetujuan Camat.", focus: "Menunggu persetujuan", queueTitle: "Antrean persetujuan khusus", queueCaption: "Akses dibatasi pada tahap yang menjadi kewenangan Anda." },
};

function MetricCard({ metric }: { metric: Metric }) {
  const Icon = metric.icon;
  return <article className="metric-card"><div className="metric-top"><span>{metric.label}</span><span className="metric-icon"><Icon size={17} /></span></div><div className="metric-value">{metric.value}</div><div className="metric-foot">{metric.foot}</div></article>;
}

function Stars({ value }: { value: number }) {
  return <span className="stars" aria-label={`${value} dari 5 bintang`}><span aria-hidden="true">{"★".repeat(Math.round(value))}{"☆".repeat(5 - Math.round(value))}</span></span>;
}

function QuickLinks({ role }: { role: string }) {
  const choices: Record<string, { href: string; icon: typeof FileText; title: string; note: string }[]> = {
    WARGA: [
      { href: "/applications/new", icon: FilePlus2, title: "Mulai pengajuan", note: "Pilih salah satu dari 9 layanan" },
      { href: "/applications", icon: Workflow, title: "Lacak pengajuan", note: "Lihat timeline dan estimasi" },
      { href: "/notifications", icon: Bell, title: "Pusat notifikasi", note: "Informasi perubahan status" },
    ],
    PETUGAS: [
      { href: "/staff/verification", icon: FileCheck2, title: "Verifikasi berkas", note: "Periksa dokumen baru" },
      { href: "/staff/priority", icon: Sparkles, title: "Antrean prioritas", note: "Tinjau permintaan beserta alasan" },
      { href: "/staff/finalization", icon: BadgeCheck, title: "Finalisasi surat", note: "Terbitkan dokumen simulasi" },
    ],
    RTRW: [
      { href: "/rtrw/approvals", icon: ShieldCheck, title: "Tinjau persetujuan", note: "Lihat penugasan RT/RW" },
      { href: "/rtrw/history", icon: History, title: "Riwayat keputusan", note: "Audit persetujuan lingkungan" },
      { href: "/notifications", icon: Bell, title: "Notifikasi", note: "Pengajuan yang memerlukan tindak lanjut" },
    ],
    LURAH: [
      { href: "/lurah/approvals", icon: BadgeCheck, title: "Persetujuan surat", note: "Periksa antrean yang menunggu" },
      { href: "/lurah/accountability", icon: Gauge, title: "Akuntabilitas SLA", note: "SLA, estimasi, dan penilaian" },
      { href: "/lurah/staff", icon: Users, title: "Manajemen petugas", note: "Kelola akses akun petugas" },
    ],
    CAMAT: [
      { href: "/camat/approvals", icon: ShieldCheck, title: "Persetujuan ahli waris", note: "Tahap Camat saja" },
      { href: "/notifications", icon: Bell, title: "Notifikasi", note: "Perubahan pada pengajuan terkait" },
    ],
  };
  return <div className="quick-links">{(choices[role] ?? []).map((item) => { const Icon = item.icon; return <Link className="quick-link" key={item.href} href={item.href}><span className="quick-link-icon"><Icon size={17} /></span><span className="quick-link-copy"><b>{item.title}</b><span>{item.note}</span></span><ArrowRight className="quick-arrow" size={15} /></Link>; })}</div>;
}

function TrendChart({ data }: { data: AnalyticsData["trend"] }) {
  const max = Math.max(1, ...data.map((item) => item.total));
  return <div className="bar-chart" aria-label="Tren pengajuan enam bulan"><div className="chart-baseline" />{data.map((item) => <div className="bar-column" key={`${item.label}-${item.total}`}><span className="bar-value">{item.total}</span><div className="bar-track"><span className="bar-fill" style={{ height: `${Math.max(4, item.total / max * 100)}%` }} /></div><small>{item.label}</small></div>)}</div>;
}

export function DashboardView({ user, applications, analytics }: { user: SessionUser; applications: ApplicationSummary[]; analytics?: AnalyticsData }) {
  const role = user.role;
  const content = text[role];
  const count = (status: string) => applications.filter((item) => item.status === status).length;
  const incomplete = applications.filter((item) => !["SELESAI", "DITOLAK"].includes(item.status));
  const late = applications.filter((item) => item.status !== "SELESAI" && isLate(item.dueAt, item.completedAt));
  let metrics: Metric[] = [];
  if (role === "WARGA") metrics = [
    { label: "Pengajuan aktif", value: incomplete.length, foot: "Sedang berjalan", icon: FileClock },
    { label: "Perlu perbaikan", value: count("MENUNGGU_WARGA"), foot: "Tindak lanjut Anda", icon: CircleAlert },
    { label: "Telah selesai", value: count("SELESAI"), foot: "Surat siap diunduh", icon: FileCheck2 },
    { label: "Menunggu verifikasi", value: count("MENUNGGU_VERIFIKASI"), foot: "SLA belum dimulai", icon: Clock3 },
  ];
  if (role === "PETUGAS") metrics = [
    { label: "Menunggu verifikasi", value: count("MENUNGGU_VERIFIKASI"), foot: "Berkas perlu diperiksa", icon: FileCheck2 },
    { label: "Sedang diproses", value: count("SEDANG_DIPROSES") + count("TERVERIFIKASI"), foot: "Penyusunan surat", icon: FileClock },
    { label: "Prioritas menunggu", value: applications.filter((item) => item.priorityStatus === "MENUNGGU").length, foot: "Perlu keputusan petugas", icon: Sparkles },
    { label: "Terlambat", value: late.length, foot: "Alasan transparan pada detail", icon: CircleAlert },
  ];
  if (role === "RTRW") metrics = [
    { label: "Menunggu ACC", value: count("MENUNGGU_RTRW"), foot: "Perlu ditinjau", icon: ShieldCheck },
    { label: "Dalam proses warga", value: count("MENUNGGU_WARGA"), foot: "Dijeda sampai revisi", icon: Clock3 },
    { label: "Riwayat tercatat", value: applications.length, foot: "Pengajuan pada penugasan Anda", icon: History },
    { label: "Prioritas", value: applications.filter((item) => item.priorityStatus === "DISETUJUI").length, foot: "Keputusan prioritas petugas", icon: Sparkles },
  ];
  if (role === "LURAH" && analytics) metrics = [
    { label: "Tepat waktu", value: analytics.totals.onTimePercent === null ? "—" : `${analytics.totals.onTimePercent}%`, foot: `${analytics.totals.completed} pengajuan selesai`, icon: Gauge },
    { label: "Rata-rata proses", value: analytics.totals.averageDays === null ? "—" : `${analytics.totals.averageDays} hari`, foot: "Sejak berkas terverifikasi", icon: Clock3 },
    { label: "Menunggu persetujuan", value: analytics.totals.waitingApproval, foot: "RT/RW · Lurah · Camat", icon: ShieldCheck },
    { label: "Terlambat", value: analytics.totals.late, foot: "Periksa penyebab dan estimasi", icon: CircleAlert },
  ];
  if (role === "CAMAT") metrics = [
    { label: "Menunggu persetujuan", value: count("MENUNGGU_CAMAT"), foot: "Hanya layanan ahli waris", icon: ShieldCheck },
    { label: "Riwayat status", value: applications.length, foot: "Dalam akses penugasan khusus", icon: History },
  ];

  let queue: ApplicationSummary[] = [];
  if (role === "WARGA") queue = [...applications].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)).slice(0, 4);
  if (role === "PETUGAS") queue = applications.filter((item) => ["MENUNGGU_VERIFIKASI", "MENUNGGU_WARGA", "TERVERIFIKASI", "SEDANG_DIPROSES", "FINALISASI"].includes(item.status) || item.priorityStatus === "MENUNGGU").slice(0, 6);
  if (role === "RTRW") queue = applications.filter((item) => item.status === "MENUNGGU_RTRW").slice(0, 6);
  if (role === "LURAH") queue = applications.filter((item) => ["MENUNGGU_LURAH", "MENUNGGU_CAMAT", "MENUNGGU_RTRW"].includes(item.status)).slice(0, 6);
  if (role === "CAMAT") queue = applications.filter((item) => item.status === "MENUNGGU_CAMAT").slice(0, 6);

  return <section>
    <div className="page-heading"><div><span className="eyebrow">{role === "WARGA" ? "Dashboard warga" : `${role} · ruang privat`}</span><h1>{content.greeting}, {user.fullName.split(" ")[0]}.</h1><p>{content.subtitle}</p></div>{role === "WARGA" ? <Link className="btn btn-primary" href="/applications/new"><FilePlus2 size={16} /> Buat pengajuan</Link> : role === "LURAH" ? <Link className="btn btn-secondary" href="/lurah/reports"><ChartNoAxesCombined size={16} /> Lihat laporan</Link> : null}</div>
    <div className="demo-banner"><Sparkles size={16} /><span><b>Lingkungan demonstrasi.</b> Statistik, pengajuan contoh, dan dokumen yang tersedia adalah data simulasi; bukan data operasional kelurahan.</span></div>
    <div className="dashboard-grid">{metrics.map((metric) => <MetricCard metric={metric} key={metric.label} />)}</div>

    {role === "LURAH" && analytics && <div className="accountability-grid">
      <section className="section-card chart-card"><div className="section-card-header"><div><h2>Tren pengajuan</h2><p>Enam bulan terakhir · dihitung dari data sistem</p></div><span className="metric-icon"><ChartNoAxesCombined size={17} /></span></div><TrendChart data={analytics.trend} /></section>
      <section className="section-card rating-summary"><div className="section-card-header"><div><h2>Reputasi pelayanan</h2><p>Rating dari pengajuan selesai</p></div><span className="metric-icon"><Heart size={17} /></span></div><div className="rating-summary-grid"><div><span>Rating Lurah</span><b>{analytics.rating.mayorCount ? `${analytics.rating.mayor!.toFixed(1)}/5` : "Belum ada rating"}</b>{analytics.rating.mayorCount > 0 && <small>{analytics.rating.mayorCount} penilaian</small>}</div><div><span>Pelayanan keseluruhan</span><b>{analytics.rating.count ? `${analytics.rating.overall!.toFixed(1)}/5` : "Belum ada rating"}</b>{analytics.rating.count > 0 && <small>{analytics.rating.count} penilaian</small>}</div></div><div className="rating-bars">{analytics.rating.distribution.map((item) => <div className="rating-bar-row" key={item.stars}><span>{item.stars} ★</span><div><i style={{ width: `${analytics.rating.count ? item.count / analytics.rating.count * 100 : 0}%` }} /></div><small>{item.count}</small></div>)}</div><Link className="text-link" href="/lurah/accountability">Rincian akuntabilitas <ArrowRight size={14} /></Link></section>
    </div>}

    <div className="workspace-columns">
      <section className="section-card"><div className="section-card-header"><div><h2>{role === "LURAH" ? "Antrean persetujuan" : content.queueTitle}</h2><p>{content.queueCaption}</p></div><Link className="text-link" href={role === "WARGA" ? "/applications" : role === "PETUGAS" ? "/staff/applications" : role === "RTRW" ? "/rtrw/approvals" : role === "LURAH" ? "/lurah/monitoring" : "/camat/approvals"}>Lihat semua <ArrowRight size={14} /></Link></div>
        {queue.length ? <div className="application-list">{queue.map((application) => <article className="application-item" key={application.id}><div className={`queue-dot queue-dot--${statusTone(application.status)}`} /><div className="application-item-main"><h3>{application.serviceName}</h3><p>{application.publicId}{role !== "WARGA" ? ` · ${application.citizenName}` : ""} · {formatWib(application.submittedAt)}</p><div className="list-meta"><span className={`status-pill status-pill--${statusTone(application.status)}`}>{humanStatus(application.status)}</span>{application.priorityStatus === "MENUNGGU" && <span className="priority-tag"><Sparkles size={12} /> Prioritas</span>}{application.status === "MENUNGGU_VERIFIKASI" && <span className="list-hint">SLA belum dimulai</span>}</div>{isLate(application.dueAt) && application.status !== "SELESAI" && <p className="late-reason">Terlambat: {application.delayReason || "Alasan belum dicatat."}</p>}</div><Link className="application-detail-link" href={`/applications/${application.id}`} aria-label={`Detail ${application.publicId}`}><ArrowRight size={16} /></Link></article>)}</div> : <div className="empty-state"><div><FileText size={26} /><p>Belum ada pengajuan pada antrean ini.</p>{role === "WARGA" && <Link className="text-link" href="/applications/new">Ajukan layanan <ArrowRight size={14} /></Link>}</div></div>}
      </section>
      <aside className="section-card"><div className="section-card-header"><div><h2>Akses cepat</h2><p>Aksi sesuai kewenangan akun</p></div><span className="metric-icon"><BriefcaseBusiness size={17} /></span></div><QuickLinks role={role} />{role === "LURAH" && analytics && <div className="accountability-note"><CalendarCheck2 size={16} />Perubahan dibanding bulan sebelumnya: {analytics.totals.previousMonthChange === null ? "belum cukup data" : `${analytics.totals.previousMonthChange > 0 ? "+" : ""}${analytics.totals.previousMonthChange}%`}.</div>}{role === "WARGA" && <div className="accountability-note"><ShieldCheck size={16} />Waktu layanan mulai dihitung setelah dokumen terverifikasi.</div>}{role === "RTRW" && <div className="accountability-note"><Users size={16} />Daftar ini hanya mencakup warga pada penugasan RT/RW Anda.</div>}</aside>
    </div>
  </section>;
}
