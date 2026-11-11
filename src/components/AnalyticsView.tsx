'use client';

import { FormEvent, useState } from "react";
import Link from "next/link";
import { ArrowRight, BarChart3, CalendarClock, CheckCircle2, Clock3, FileText, Gauge, Save, Settings2, ShieldCheck, Star, TriangleAlert } from "lucide-react";
import type { ApplicationSummary } from "@/lib/data";
import type { AnalyticsData } from "@/components/DashboardView";
import { formatWib } from "@/lib/dates";

type ServiceSetting = { id: string; name: string; slaBusinessDays: number; priorityTargetHours: number; maxFileSizeMB: number; businessWeekdays: number[]; priorityEnabled: boolean };

function RatingDistribution({ analytics }: { analytics: AnalyticsData }) {
  const denominator = analytics.rating.count;
  return <div className="section-card rating-summary"><div className="section-card-header"><div><h2>Rating pelayanan</h2><p>Ringkasan hanya dari penilaian yang tersimpan</p></div><span className="metric-icon"><Star size={17} /></span></div>
    <div className="rating-summary-grid"><div><span>Rating Lurah</span><b>{analytics.rating.mayorCount ? `${analytics.rating.mayor!.toFixed(1)}/5` : "Belum ada rating"}</b>{analytics.rating.mayorCount > 0 && <small>{analytics.rating.mayorCount} penilaian</small>}</div><div><span>Pelayanan keseluruhan</span><b>{denominator ? `${analytics.rating.overall!.toFixed(1)}/5` : "Belum ada rating"}</b>{denominator > 0 && <small>{denominator} penilaian</small>}</div></div>
    {denominator > 0 ? <div className="rating-bars">{analytics.rating.distribution.map((item) => <div className="rating-bar-row" key={item.stars}><span>{item.stars} ★</span><div><i style={{ width: `${item.count / denominator * 100}%` }} /></div><small>{item.count}</small></div>)}</div> : <div className="empty-state" style={{ minHeight: 115 }}><div><Star size={22} /><p>Belum ada penilaian dari pengajuan selesai.</p></div></div>}
    <div className="category-summary">{analytics.rating.categories.map((item) => <div key={item.category}><span>{item.category === "kecepatan" ? "Kecepatan" : item.category === "keramahan" ? "Keramahan" : "Kejelasan"}</span><b>{item.count}</b></div>)}</div>
  </div>;
}

export function AnalyticsView({ analytics, services, applications, showSettings }: { analytics: AnalyticsData; services: ServiceSetting[]; applications: ApplicationSummary[]; showSettings: boolean }) {
  const [serviceRows, setServiceRows] = useState(services);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const maxTotal = Math.max(1, ...analytics.trend.map((item) => item.total));
  const completed = applications.filter((application) => application.status === "SELESAI").length;
  const rate = analytics.totals.onTimePercent;
  function update(id: string, change: Partial<ServiceSetting>) { setServiceRows((rows) => rows.map((row) => row.id === id ? { ...row, ...change } : row)); }
  function changeDay(id: string, weekday: number, enabled: boolean) {
    const row = serviceRows.find((item) => item.id === id);
    if (!row) return;
    const days = enabled ? [...new Set([...row.businessWeekdays, weekday])].sort() : row.businessWeekdays.filter((item) => item !== weekday);
    update(id, { businessWeekdays: days });
  }
  async function save(event: FormEvent<HTMLFormElement>, service: ServiceSetting) {
    event.preventDefault(); setBusy(service.id); setError(""); setSuccess("");
    try {
      const response = await fetch(`/api/lurah/services/${service.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(service) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Konfigurasi belum tersimpan.");
      setSuccess(`${service.name}: pengaturan tersimpan dan masuk audit log.`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Tidak dapat menyimpan konfigurasi."); }
    finally { setBusy(null); }
  }
  return <section>
    <div className="page-heading"><div><span className="eyebrow">Akuntabilitas & laporan</span><h1>{showSettings ? "SLA dan akuntabilitas" : "Laporan pelayanan"}</h1><p>{showSettings ? "Pantau waktu pelayanan dan sesuaikan estimasi ilustratif. Perubahan konfigurasi selalu dicatat." : "Ringkasan dihitung langsung dari pengajuan, persetujuan, SLA, dan penilaian yang ada pada database."}</p></div><Link href="/lurah/dashboard" className="btn btn-secondary"><Gauge size={16} /> Dashboard</Link></div>
    <div className="demo-banner"><ShieldCheck size={16} /><span>Angka yang ditampilkan berasal dari data pada database demo. Persentase kosong bila belum ada pengajuan selesai atau penilaian; bukan ukuran kinerja instansi nyata.</span></div>
    {error && <div className="toast-error" role="alert" style={{ marginBottom: 14 }}>{error}</div>}{success && <div className="toast-success" role="status" style={{ marginBottom: 14 }}>{success}</div>}
    <div className="dashboard-grid accountability-metrics"><article className="metric-card"><div className="metric-top">Pelayanan tepat waktu<span className="metric-icon"><Gauge size={17} /></span></div><div className="metric-value">{rate === null ? "—" : `${rate}%`}</div><div className="metric-foot">{analytics.totals.completed} selesai dengan estimasi tercatat</div></article><article className="metric-card"><div className="metric-top">Rata-rata proses<span className="metric-icon"><Clock3 size={17} /></span></div><div className="metric-value">{analytics.totals.averageDays === null ? "—" : `${analytics.totals.averageDays} h`}</div><div className="metric-foot">Perhitungan sejak berkas diverifikasi</div></article><article className="metric-card"><div className="metric-top">Pengajuan bulan ini<span className="metric-icon"><FileText size={17} /></span></div><div className="metric-value">{analytics.totals.currentMonth}</div><div className="metric-foot">{analytics.totals.previousMonthChange === null ? "Belum cukup data pembanding" : `${analytics.totals.previousMonthChange > 0 ? "+" : ""}${analytics.totals.previousMonthChange}% dari bulan sebelumnya`}</div></article><article className="metric-card"><div className="metric-top">Menunggu persetujuan<span className="metric-icon"><CalendarClock size={17} /></span></div><div className="metric-value">{analytics.totals.waitingApproval}</div><div className="metric-foot">RT/RW, Lurah, dan Camat</div></article></div>
    <div className="analytics-panels"><section className="section-card chart-card"><div className="section-card-header"><div><h2>Tren pengajuan bulanan</h2><p>Enam bulan terakhir · total {analytics.totals.applications} pengajuan pada lingkup query</p></div><span className="metric-icon"><BarChart3 size={17} /></span></div><div className="bar-chart chart-large">{analytics.trend.map((item) => <div className="bar-column" key={item.label}><span className="bar-value">{item.total}</span><div className="bar-track"><span className="bar-fill" style={{ height: `${Math.max(item.total ? 4 : 0, item.total / maxTotal * 100)}%` }} /></div><small>{item.label}</small></div>)}</div><div className="chart-footnote">Pengajuan: {analytics.totals.applications} <span>·</span> Selesai: {completed} <span>·</span> Terlambat: {analytics.totals.late}</div></section><RatingDistribution analytics={analytics} /></div>
    <section className="section-card late-queue-card"><div className="section-card-header"><div><h2>Pengajuan yang melewati estimasi</h2><p>Alasan dan pembaruan waktu disimpan pada audit pengajuan.</p></div><span className={`status-pill ${analytics.lateApplications.length ? "status-pill--red" : "status-pill--green"}`}>{analytics.lateApplications.length} terlambat</span></div>{analytics.lateApplications.length ? <div className="application-list">{analytics.lateApplications.map((application) => <article className="application-item" key={application.id}><div className="application-item-main"><h3>{application.serviceName}</h3><p>{application.publicId} · {application.citizenName} · estimasi {formatWib(application.dueAt)}</p><div className="late-reason"><TriangleAlert size={14} />{application.delayReason || "Penyebab keterlambatan belum dicatat."}</div></div><Link className="application-detail-link" href={`/applications/${application.id}`}>Detail <ArrowRight size={14} /></Link></article>)}</div> : <div className="empty-state"><div><CheckCircle2 size={24} /><p>Belum ada pengajuan aktif yang melewati estimasi.</p></div></div>}</section>
    {showSettings && <section className="section-card sla-settings-card"><div className="section-card-header"><div><h2>Konfigurasi SLA layanan</h2><p>Contoh ilustratif yang dapat disesuaikan. Tidak mewakili durasi resmi.</p></div><span className="metric-icon"><Settings2 size={17} /></span></div><div className="sla-config-list">{serviceRows.map((service) => <form className="sla-config-row" key={service.id} onSubmit={(event) => void save(event, service)}><div className="sla-config-title"><div><b>{service.name}</b><span>Hari kerja kalender Jakarta · {service.priorityEnabled ? "prioritas aktif" : "tanpa antrean prioritas"}</span></div><button className="btn btn-secondary" type="submit" disabled={busy === service.id}><Save size={15} />{busy === service.id ? "Menyimpan…" : "Simpan"}</button></div><div className="two-column-form"><label><span className="field-label">SLA dasar (hari kerja)</span><input type="number" min={1} max={30} className="field" value={service.slaBusinessDays} onChange={(event) => update(service.id, { slaBusinessDays: Number(event.target.value) })} /></label><label><span className="field-label">Target prioritas (jam)</span><input type="number" min={1} max={72} className="field" value={service.priorityTargetHours} onChange={(event) => update(service.id, { priorityTargetHours: Number(event.target.value) })} /></label><label><span className="field-label">Batas berkas (MB)</span><input type="number" min={1} max={20} className="field" value={service.maxFileSizeMB} onChange={(event) => update(service.id, { maxFileSizeMB: Number(event.target.value) })} /></label></div><div className="weekday-picker"><span className="field-label">Hari kerja kalender</span><div>{[{ id: 1, label: "Sen" }, { id: 2, label: "Sel" }, { id: 3, label: "Rab" }, { id: 4, label: "Kam" }, { id: 5, label: "Jum" }, { id: 6, label: "Sab" }, { id: 0, label: "Min" }].map((day) => <label className="weekday-option" key={day.id}><input type="checkbox" checked={service.businessWeekdays.includes(day.id)} onChange={(event) => changeDay(service.id, day.id, event.target.checked)} />{day.label}</label>)}</div><small>Minimal satu hari kerja dipilih. Hari libur nasional tidak dihitung dalam konfigurasi ilustratif ini.</small></div></form>)}</div><p className="field-help"><ShieldCheck size={13} /> Setiap perubahan menyimpan nilai lama dan baru di system audit log.</p></section>}
  </section>;
}
