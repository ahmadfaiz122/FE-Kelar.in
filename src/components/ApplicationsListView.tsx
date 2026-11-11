'use client';

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDownUp, ArrowRight, CalendarClock, CircleAlert, FileText, Search, Sparkles } from "lucide-react";
import type { ApplicationSummary } from "@/lib/data";
import { formatWib, isLate } from "@/lib/dates";
import { humanStatus, statusTone } from "@/lib/format";

const filterItems = [
  { value: "ALL", label: "Semua" },
  { value: "MENUNGGU_VERIFIKASI", label: "Verifikasi" },
  { value: "MENUNGGU_WARGA", label: "Perlu perbaikan" },
  { value: "SEDANG_DIPROSES", label: "Diproses" },
  { value: "MENUNGGU_RTRW", label: "RT/RW" },
  { value: "MENUNGGU_LURAH", label: "Lurah" },
  { value: "MENUNGGU_CAMAT", label: "Camat" },
  { value: "FINALISASI", label: "Finalisasi" },
  { value: "SELESAI", label: "Selesai" },
];

export function ApplicationsListView({ applications, title, description, showCitizen = false, emptyLabel = "Belum ada pengajuan pada daftar ini." }: { applications: ApplicationSummary[]; title: string; description: string; showCitizen?: boolean; emptyLabel?: string }) {
  const [status, setStatus] = useState("ALL");
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => applications.filter((application) =>
    (status === "ALL" || application.status === status) &&
    `${application.publicId} ${application.serviceName} ${application.citizenName}`.toLowerCase().includes(query.toLowerCase()),
  ), [applications, status, query]);
  const counts = applications.reduce<Record<string, number>>((map, item) => ({ ...map, [item.status]: (map[item.status] ?? 0) + 1 }), {});

  return <section>
    <div className="page-heading"><div><span className="eyebrow">Ruang pelayanan</span><h1>{title}</h1><p>{description}</p></div>{showCitizen && <Link href="/applications/new" className="btn btn-primary"><FileText size={16} /> Buat pengajuan</Link>}</div>
    <div className="section-card">
      <div className="queue-toolbar"><label className="search-field"><Search size={16} /><input aria-label="Cari pengajuan" placeholder="Cari ID, layanan, atau nama…" value={query} onChange={(event) => setQuery(event.target.value)} /></label><span className="field-help" style={{ marginTop: 0 }}>{filtered.length} dari {applications.length} pengajuan</span></div>
      <div className="queue-filter" style={{ marginBottom: 15 }}>{filterItems.filter((item) => item.value === "ALL" || counts[item.value]).map((item) => <button className={`filter-chip${status === item.value ? " active" : ""}`} key={item.value} onClick={() => setStatus(item.value)}>{item.label}{item.value !== "ALL" && counts[item.value] ? ` · ${counts[item.value]}` : ""}</button>)}</div>
      {filtered.length ? <div className="application-list">{filtered.map((application) => {
        const late = application.status !== "SELESAI" && isLate(application.dueAt, application.completedAt);
        return <article className="application-item" key={application.id}>
          <div className="application-item-main"><h3>{application.serviceName}</h3><p>{application.publicId} · {showCitizen ? application.citizenName : formatWib(application.submittedAt)}</p><div className="list-meta"><span><CalendarClock size={13} /> {application.status === "MENUNGGU_VERIFIKASI" ? "SLA belum dimulai" : `Estimasi ${formatWib(application.dueAt)}`}</span>{late && <span className="late-text"><CircleAlert size={13} /> Terlambat</span>}{application.priorityRequested && <span className="priority-tag"><Sparkles size={12} /> Prioritas {application.priorityStatus === "DISETUJUI" ? "disetujui" : application.priorityStatus === "MENUNGGU" ? "menunggu" : application.priorityStatus === "DITOLAK" ? "ditolak" : ""}</span>}</div>{late && <p className="late-reason">Alasan: {application.delayReason || "Belum dicatat petugas."}</p>}</div>
          <div className="application-item-end"><span className={`status-pill status-pill--${statusTone(application.status)}`}>{humanStatus(application.status)}</span><Link className="application-detail-link" href={`/applications/${application.id}`}>Detail <ArrowRight size={14} /></Link></div>
        </article>;
      })}</div> : <div className="empty-state"><div><ArrowDownUp size={23} /><p>{query ? "Tidak ada pengajuan yang cocok." : emptyLabel}</p>{showCitizen && <Link className="text-link" href="/applications/new">Mulai pengajuan <ArrowRight size={14} /></Link>}</div></div>}
    </div>
  </section>;
}
