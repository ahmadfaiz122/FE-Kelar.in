'use client';

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, BadgeCheck, Check, CheckCircle2, CircleAlert, Clock3, Download, FileCheck2, FileClock, FileText, Info, RefreshCw, Send, ShieldCheck, Sparkles, Star, UploadCloud } from "lucide-react";
import type { SessionUser } from "@/lib/auth";
import type { ApplicationSummary } from "@/lib/data";
import type { ApprovalRole, UserRole } from "@/db/schema";
import { priorityReasons } from "@/lib/catalog";
import { formatWib, isLate } from "@/lib/dates";
import { humanStatus, isRequiredRequirement, statusTone } from "@/lib/format";

type DocumentView = { id: string; requirementId: string; originalName: string; mimeType: string; sizeBytes: number; revision: number; isCurrent: boolean; uploadedAt: string; uploadedBy: string };
type EventView = { id: string; eventType: string; status: string | null; note: string | null; metadata: Record<string, unknown>; createdAt: string; actorName: string | null; actorRole: UserRole | null };
type DetailData = { application: ApplicationSummary; documents: DocumentView[]; timeline: EventView[]; rating: { stars: number; category: string; comment: string | null } | null; approvalActors: { role: UserRole | null; fullName: string | null; actorId: string | null }[]; citizenName: string };
const eventTitle: Record<string, string> = {
  SUBMITTED: "Pengajuan dikirim", DOCUMENTS_RETURNED: "Dokumen perlu diperbaiki", DOCUMENTS_RESUBMITTED: "Dokumen perbaikan dikirim", DOCUMENTS_VERIFIED: "Dokumen terverifikasi", DOCUMENTS_REVERIFIED: "Perbaikan diverifikasi", PROCESSING_STARTED: "Surat mulai diproses", SENT_FOR_APPROVAL: "Menunggu persetujuan", APPROVED_RTRW: "Disetujui RT/RW", APPROVED_LURAH: "Disetujui Lurah", APPROVED_CAMAT: "Disetujui Camat", RETURNED_RTRW: "Dikembalikan RT/RW", RETURNED_LURAH: "Dikembalikan Lurah", RETURNED_CAMAT: "Dikembalikan Camat", PRIORITY_APPROVED: "Prioritas disetujui", PRIORITY_DECLINED: "Prioritas tidak disetujui", SLA_UPDATED: "Estimasi pelayanan diperbarui", LETTER_ISSUED: "Surat diterbitkan", RATING_SUBMITTED: "Penilaian warga tercatat", DEMO_STAGE: "Perubahan tahap (demo)",
};
const roleLabel: Record<string, string> = { WARGA: "Warga", PETUGAS: "Petugas", RTRW: "RT/RW", LURAH: "Lurah", CAMAT: "Camat" };

export function ApplicationDetailView({ detail, user }: { detail: DetailData; user: SessionUser }) {
  const router = useRouter();
  const { application: app } = detail;
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [staffReason, setStaffReason] = useState("");
  const [missingIds, setMissingIds] = useState<string[]>([]);
  const [decisionReason, setDecisionReason] = useState("");
  const [delayReason, setDelayReason] = useState("");
  const [extensionDays, setExtensionDays] = useState(1);
  const [correctionFiles, setCorrectionFiles] = useState<Record<string, File>>({});
  const [stars, setStars] = useState(5);
  const [category, setCategory] = useState("kecepatan");
  const [comment, setComment] = useState("");
  const required = useMemo(() => app.requirements.filter((requirement) => isRequiredRequirement(requirement, app.formData)), [app]);
  const currentDocuments = new Map(detail.documents.filter((document) => document.isCurrent).map((document) => [document.requirementId, document]));
  const missingRequired = required.filter((requirement) => !currentDocuments.has(requirement.id));
  const latestReturn = [...detail.timeline].reverse().find((event) => event.eventType.startsWith("RETURNED_") || event.eventType === "DOCUMENTS_RETURNED");
  const repairIds = Array.isArray(latestReturn?.metadata.missingRequirementIds) ? latestReturn!.metadata.missingRequirementIds.filter((id): id is string => typeof id === "string") : required.map((item) => item.id);
  const repairRequirements = app.requirements.filter((item) => repairIds.includes(item.id));
  const late = app.status !== "SELESAI" && isLate(app.dueAt);
  const waitingForUser = app.status === "MENUNGGU_WARGA";
  const stageForRole: Partial<Record<UserRole, string>> = { RTRW: "MENUNGGU_RTRW", LURAH: "MENUNGGU_LURAH", CAMAT: "MENUNGGU_CAMAT" };
  const canApprove = stageForRole[user.role] === app.status && app.approvalStages.includes(user.role as ApprovalRole) && (user.role !== "RTRW" || app.assignedRtrwId === user.id);
  const nextLabels: Record<string, string> = { MENUNGGU_VERIFIKASI: "verifikasi berkas", MENUNGGU_WARGA: "perbaikan dokumen oleh warga", TERVERIFIKASI: "pemrosesan surat", SEDANG_DIPROSES: "persetujuan RT/RW", MENUNGGU_RTRW: "persetujuan RT/RW", MENUNGGU_LURAH: "persetujuan Lurah", MENUNGGU_CAMAT: "persetujuan Camat", FINALISASI: "finalisasi surat", SELESAI: "penilaian layanan" };

  async function post(url: string, body?: Record<string, unknown>, method = "POST", data?: FormData) {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(url, { method, headers: data ? undefined : { "Content-Type": "application/json" }, body: data ?? (body ? JSON.stringify(body) : undefined) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "Aksi belum dapat disimpan.");
      setMessage(result.message ?? "Perubahan berhasil disimpan.");
      if (data) setCorrectionFiles({});
      router.refresh();
      window.setTimeout(() => window.location.reload(), 450);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Koneksi gagal. Periksa jaringan lalu coba lagi."); }
    finally { setBusy(false); }
  }

  function sendVerification(action: "verify" | "return") {
    if (action === "return" && (staffReason.trim().length < 8 || !missingIds.length)) { setError("Sertakan alasan dan pilih dokumen yang perlu diperbaiki."); return; }
    void post(`/api/staff/applications/${app.id}/verification`, { action, reason: staffReason, missingRequirementIds: missingIds });
  }
  function sendApproval(action: "approve" | "return") {
    if (action === "return" && decisionReason.trim().length < 8) { setError("Alasan pengembalian minimal 8 karakter."); return; }
    void post(`/api/approvals/${app.id}`, { action, reason: decisionReason });
  }
  function uploadCorrection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!Object.keys(correctionFiles).length) { setError("Pilih dokumen perbaikan terlebih dahulu."); return; }
    const body = new FormData();
    body.append("answers", JSON.stringify(app.formData));
    for (const [id, file] of Object.entries(correctionFiles)) body.append(`file:${id}`, file, file.name);
    void post(`/api/applications/${app.id}/documents`, undefined, "POST", body);
  }
  function submitRating(event: FormEvent<HTMLFormElement>) { event.preventDefault(); void post(`/api/applications/${app.id}/rating`, { stars, category, comment }); }
  function approvePriority(decision: "approve" | "decline") {
    if (decisionReason.trim().length < 8) { setError("Alasan keputusan prioritas minimal 8 karakter."); return; }
    void post(`/api/staff/applications/${app.id}/priority`, { decision, reason: decisionReason });
  }
  function recordDelay(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (delayReason.trim().length < 8) { setError("Jelaskan penyebab keterlambatan (minimal 8 karakter). "); return; }
    void post(`/api/staff/applications/${app.id}/delay`, { reason: delayReason, extensionBusinessDays: extensionDays });
  }
  function showError(text: string) { setError(text); }

  const statusAction = user.role === "PETUGAS" && ["MENUNGGU_VERIFIKASI", "TERVERIFIKASI", "SEDANG_DIPROSES", "FINALISASI"].includes(app.status);
  return <section>
    <div className="detail-back-row"><Link className="text-link" href={user.role === "WARGA" ? "/applications" : user.role === "PETUGAS" ? "/staff/applications" : user.role === "RTRW" ? "/rtrw/approvals" : user.role === "LURAH" ? "/lurah/monitoring" : "/camat/approvals"}><ArrowLeft size={15} /> Kembali ke daftar</Link><span className="detail-id">ID · {app.publicId}</span></div>
    <div className="page-heading detail-heading"><div><span className="eyebrow">{app.serviceName}</span><h1>Status dan riwayat pengajuan</h1><p>Diajukan {formatWib(app.submittedAt)} · data demo</p></div><span className={`status-pill status-pill--${statusTone(app.status)}`}>{humanStatus(app.status)}</span></div>
    {error && <div className="toast-error" role="alert" style={{ marginBottom: 14 }}>{error}</div>}{message && <div className="toast-success" role="status" style={{ marginBottom: 14 }}>{message}</div>}
    <div className="demo-banner"><Info size={16} /><span>Informasi, persetujuan, dan lampiran di halaman ini adalah data simulasi. Surat yang diterbitkan diberi watermark <b>SIMULASI / BUKAN DOKUMEN RESMI.</b></span></div>
    <div className="detail-grid">
      <div className="detail-main-stack">
        <section className="section-card detail-overview-card"><div className="detail-overview-head"><div className="service-icon"><FileText size={20} /></div><div><h2>{app.serviceName}</h2><p>{app.publicId} · {user.role === "WARGA" ? "Pengajuan Anda" : `Pemohon: ${detail.citizenName}`}</p></div><span className={`status-pill status-pill--${statusTone(app.status)}`}>{humanStatus(app.status)}</span></div>
          {app.status === "MENUNGGU_VERIFIKASI" && <div className="sla-not-started"><Clock3 size={16} /><div><b>Estimasi belum dimulai</b><span>Penghitungan {app.slaBusinessDays} hari kerja baru dimulai setelah berkas dinyatakan lengkap.</span></div></div>}
          {app.slaStartedAt && <div className={`sla-card${late ? " sla-card--late" : ""}`}><div><small>SLA dimulai</small><b>{formatWib(app.slaStartedAt)}</b></div><div><small>Estimasi saat ini</small><b>{formatWib(app.dueAt)}</b></div>{late && <div className="sla-late-message"><CircleAlert size={16} /><span><b>Perlu perhatian</b><small>{app.delayReason || "Penyebab keterlambatan belum dicatat."}</small></span></div>}{app.pausedAt && <p className="sla-pause"><Clock3 size={13} /> SLA dijeda sejak {formatWib(app.pausedAt)} sampai dokumen diverifikasi kembali.</p>}</div>}
          {app.priorityRequested && <div className="priority-detail-box"><Sparkles size={17} /><div><b>Permintaan prioritas · {app.priorityStatus === "DISETUJUI" ? "Disetujui" : app.priorityStatus === "DITOLAK" ? "Tidak disetujui" : "Menunggu keputusan petugas"}</b><span>Alasan: {priorityReasons.find((item) => item.id === app.priorityReason)?.label ?? app.priorityReason ?? "—"}</span>{app.priorityDecisionReason && <small>Catatan petugas: {app.priorityDecisionReason}</small>}{app.priorityStatus === "DISETUJUI" && app.priorityTargetAt && <small>Target ilustratif: {formatWib(app.priorityTargetAt)}</small>}{app.priorityStatus === "DITOLAK" && <small>Pengajuan tetap berjalan melalui antrean normal.</small>}</div></div>}
          <div className="detail-section"><h3>Informasi pemohon</h3><div className="detail-row"><span>Nama</span><b>{app.formData.fullName || detail.citizenName}</b></div><div className="detail-row"><span>Alamat</span><b>{app.formData.address || "—"}</b></div><div className="detail-row"><span>Kontak</span><b>{app.formData.phone || "Tidak dicantumkan"}</b></div><div className="detail-row"><span>Keperluan</span><b>{app.formData.purpose || "—"}</b></div></div>
          <div className="detail-section"><div className="section-card-header"><div><h3>Dokumen persyaratan</h3><p>{app.requirements.length} persyaratan layanan · revisi lama tetap tercatat</p></div></div>{app.requirements.map((requirement) => { const versions = detail.documents.filter((document) => document.requirementId === requirement.id); const current = versions.find((document) => document.isCurrent); const requiredNow = isRequiredRequirement(requirement, app.formData); return <div className="document-requirement-row" key={requirement.id}><div className="document-requirement-title"><b>{requirement.label}</b><span className={requiredNow ? "requirement-required" : "requirement-optional"}>{requiredNow ? "Wajib" : requirement.conditional ? "Kondisional" : "Opsional"}</span></div>{requirement.reason && <p className="document-reason">{requirement.reason}</p>}{current ? <div className="document-row"><a className="document-link" href={`/api/documents/${current.id}`} target="_blank" rel="noreferrer"><FileText size={15} /> {current.originalName}</a><span>Revisi {current.revision} · {formatWib(current.uploadedAt)}</span></div> : <div className="document-missing">{requiredNow ? "Belum dilampirkan" : "Tidak dilampirkan"}</div>}{versions.length > 1 && <details className="revision-history"><summary>{versions.length - 1} versi sebelumnya</summary>{versions.filter((document) => !document.isCurrent).map((document) => <div className="document-row" key={document.id}><a className="document-link" href={`/api/documents/${document.id}`} target="_blank" rel="noreferrer"><FileText size={14} /> {document.originalName}</a><span>Revisi {document.revision} · {formatWib(document.uploadedAt)}</span></div>)}</details>}</div>; })}</div>
          {app.status === "SELESAI" && <div className="letter-download-box"><div><BadgeCheck size={19} /><span><b>Surat simulasi telah diterbitkan</b><small>Dokumen ini bukan surat resmi dan tidak memiliki tanda tangan elektronik.</small></span></div>{user.role === "WARGA" && <a className="btn btn-primary" href={`/api/applications/${app.id}/letter`}><Download size={16} /> Unduh surat PDF</a>}</div>}
        </section>

        <section className="section-card"><div className="section-card-header"><div><h2>Timeline pengajuan</h2><p>Riwayat aktivitas disimpan sebagai catatan audit.</p></div><span className="status-pill status-pill--blue">Berikutnya: {nextLabels[app.status] ?? "tahap selesai"}</span></div>
          <div className="timeline">{detail.timeline.length ? detail.timeline.map((event, index) => <article className={`timeline-item${index === detail.timeline.length - 1 ? " current" : ""}`} key={event.id}><span className="timeline-dot" /><div className="timeline-copy"><b>{eventTitle[event.eventType] ?? event.eventType.replaceAll("_", " ").toLowerCase()}</b>{event.status && <span className={`status-pill status-pill--${statusTone(event.status)}`}>{humanStatus(event.status)}</span>}{event.note && <p>{event.note}</p>}<small>{event.actorName ? `${event.actorName} · ${roleLabel[event.actorRole ?? ""] ?? "Pengguna"} · ` : "Sistem · "}{formatWib(event.createdAt)}</small></div></article>) : <div className="empty-state">Riwayat belum tersedia.</div>}</div>
        </section>
      </div>

      <aside className="detail-side-stack">
        <section className="section-card"><div className="section-card-header"><div><h2>Aksi berikutnya</h2><p>Aksi aktif sesuai peran dan status</p></div><span className="metric-icon"><ShieldCheck size={17} /></span></div><div className="action-panel">
          {user.role === "WARGA" && waitingForUser && <form className="form-stack" onSubmit={uploadCorrection}><div className="alert-box"><CircleAlert size={16} />Petugas meminta perbaikan. Waktu SLA dijeda sampai revisi diverifikasi.</div><b className="action-subheading">Unggah dokumen perbaikan</b>{repairRequirements.map((requirement) => <label className="correction-upload" key={requirement.id}><span>{requirement.label}</span><input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={(event) => { const file = event.target.files?.[0]; if (file) setCorrectionFiles((current) => ({ ...current, [requirement.id]: file })); }} /><small>{correctionFiles[requirement.id]?.name ?? "PDF, JPG, JPEG, PNG · ukuran diperiksa server"}</small></label>)}<button className="btn btn-primary" disabled={busy || !Object.keys(correctionFiles).length}><UploadCloud size={16} />{busy ? "Mengirim revisi…" : "Kirim dokumen perbaikan"}</button></form>}

          {user.role === "PETUGAS" && app.status === "MENUNGGU_VERIFIKASI" && <div className="form-stack"><div className="alert-box"><Info size={16} />Periksa berkas wajib yang masih kosong sebelum menandai lengkap.</div><b className="action-subheading">Dokumen perlu diperbaiki</b>{required.map((requirement) => { const missing = !currentDocuments.has(requirement.id); return <label className="checkbox-line" key={requirement.id}><input type="checkbox" checked={missingIds.includes(requirement.id)} onChange={(event) => setMissingIds((current) => event.target.checked ? [...new Set([...current, requirement.id])] : current.filter((id) => id !== requirement.id))} />{requirement.label}{missing && <span className="requirement-required">· belum ada</span>}</label>; })}<label><span className="field-label">Alasan / catatan untuk warga</span><textarea className="field" rows={3} value={staffReason} onChange={(event) => setStaffReason(event.target.value)} placeholder="Contoh: mohon unggah ulang dokumen yang lebih jelas" /></label><button type="button" className="btn btn-danger" disabled={busy} onClick={() => sendVerification("return")}>Kembalikan untuk perbaikan</button><button type="button" className="btn btn-primary" disabled={busy} onClick={() => sendVerification("verify")}><CheckCircle2 size={16} /> Verifikasi berkas lengkap</button></div>}
          {user.role === "PETUGAS" && app.status === "TERVERIFIKASI" && <div className="form-stack"><div className="alert-box success"><CheckCircle2 size={16} />SLA aktif sejak {formatWib(app.slaStartedAt)} dan estimasi tersimpan.</div><button className="btn btn-primary" disabled={busy} onClick={() => void post(`/api/staff/applications/${app.id}/processing`, { action: "start", note: "Petugas mulai menyusun surat." })}><FileClock size={16} /> Mulai proses surat</button></div>}
          {user.role === "PETUGAS" && app.status === "SEDANG_DIPROSES" && <div className="form-stack"><label><span className="field-label">Catatan perkembangan (opsional)</span><textarea className="field" rows={3} value={staffReason} onChange={(event) => setStaffReason(event.target.value)} placeholder="Ringkasan langkah yang telah dilakukan" /></label><button className="btn btn-primary" disabled={busy} onClick={() => void post(`/api/staff/applications/${app.id}/processing`, { action: "submit", note: staffReason })}><Send size={16} /> Kirim untuk persetujuan</button></div>}
          {user.role === "PETUGAS" && app.priorityStatus === "MENUNGGU" && <div className="form-stack"><div className="alert-box"><Sparkles size={16} />Alasan prioritas warga: {priorityReasons.find((item) => item.id === app.priorityReason)?.label ?? "—"}</div><label><span className="field-label">Alasan keputusan prioritas (wajib)</span><textarea className="field" rows={3} value={decisionReason} onChange={(event) => setDecisionReason(event.target.value)} placeholder="Jelaskan pertimbangan persetujuan atau penolakan" /></label><button className="btn btn-primary" disabled={busy} onClick={() => approvePriority("approve")}>Setujui prioritas</button><button className="btn btn-secondary" disabled={busy} onClick={() => approvePriority("decline")}>Tolak prioritas</button></div>}
          {canApprove && <div className="form-stack"><div className="alert-box"><ShieldCheck size={16} />Pengajuan menunggu keputusan {roleLabel[user.role]} sesuai alur layanan.</div><label><span className="field-label">Catatan persetujuan (opsional) / alasan pengembalian</span><textarea className="field" rows={3} value={decisionReason} onChange={(event) => setDecisionReason(event.target.value)} placeholder="Tuliskan catatan yang akan dicatat pada timeline" /></label><button className="btn btn-primary" disabled={busy} onClick={() => sendApproval("approve")}><Check size={16} /> Setujui pengajuan</button><button className="btn btn-secondary" disabled={busy} onClick={() => sendApproval("return")}>Kembalikan dengan alasan</button></div>}
          {user.role === "PETUGAS" && app.status === "FINALISASI" && <div className="form-stack"><div className="alert-box"><Info size={16} />Semua persetujuan yang dikonfigurasi telah dipenuhi. Hasil akhir diberi watermark simulasi.</div><button className="btn btn-primary" disabled={busy} onClick={() => void post(`/api/staff/applications/${app.id}/finalize`)}><BadgeCheck size={16} /> Finalisasi & terbitkan PDF</button></div>}
          {user.role === "PETUGAS" && late && <form className="form-stack delay-form" onSubmit={recordDelay}><div className="alert-box error"><CircleAlert size={16} />Estimasi terlewati. Catat penyebab dan penyesuaian dengan alasan yang dapat dilihat warga.</div><label><span className="field-label">Alasan perubahan estimasi *</span><textarea className="field" rows={3} minLength={8} required value={delayReason} onChange={(event) => setDelayReason(event.target.value)} placeholder="Contoh: menunggu persetujuan Lurah" /></label><label><span className="field-label">Penyesuaian estimasi (hari kerja)</span><select className="field" value={extensionDays} onChange={(event) => setExtensionDays(Number(event.target.value))}>{[1, 2, 3, 5, 7, 10].map((day) => <option value={day} key={day}>{day} hari kerja</option>)}</select></label><button className="btn btn-secondary" disabled={busy}><RefreshCw size={15} /> Catat perubahan estimasi</button></form>}
          {user.role === "WARGA" && app.status === "SELESAI" && !detail.rating && <form className="form-stack rating-form" onSubmit={submitRating}><div><b className="action-subheading">Bagaimana pengalaman Anda?</b><p className="field-help" style={{ marginTop: 3 }}>Satu penilaian untuk setiap pengajuan selesai.</p></div><div className="rating-pick" role="radiogroup" aria-label="Nilai pelayanan">{[1, 2, 3, 4, 5].map((value) => <button type="button" key={value} className={stars >= value ? "selected" : ""} aria-label={`${value} bintang`} aria-pressed={stars === value} onClick={() => setStars(value)}><Star size={25} /></button>)}</div><label><span className="field-label">Kategori komentar</span><select className="field" value={category} onChange={(event) => setCategory(event.target.value)}><option value="kecepatan">Kecepatan</option><option value="keramahan">Keramahan</option><option value="kejelasan">Kejelasan informasi</option></select></label><label><span className="field-label">Komentar (opsional)</span><textarea className="field" rows={3} maxLength={500} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Masukan singkat untuk perbaikan" /></label><button className="btn btn-primary" disabled={busy}>Kirim penilaian</button></form>}
          {detail.rating && user.role === "WARGA" && <div className="alert-box success"><CheckCircle2 size={16} />Penilaian Anda {detail.rating.stars}/5 pada kategori {detail.rating.category} sudah tercatat.</div>}
          {!statusAction && !canApprove && !(user.role === "WARGA" && waitingForUser) && !(user.role === "WARGA" && app.status === "SELESAI" && !detail.rating) && !(user.role === "PETUGAS" && app.priorityStatus === "MENUNGGU") && !(user.role === "PETUGAS" && late) && <div className="empty-action"><CheckCircle2 size={18} /><span>{app.status === "SELESAI" ? "Pengajuan telah selesai." : `Menunggu ${nextLabels[app.status] ?? "tahap berikutnya"}.`}</span></div>}
          {statusAction && !["MENUNGGU_VERIFIKASI", "TERVERIFIKASI", "SEDANG_DIPROSES", "FINALISASI"].includes(app.status) && <span />}
        </div></section>
        <section className="section-card"><div className="section-card-header"><div><h2>Informasi estimasi</h2><p>Konfigurasi saat pengajuan</p></div><span className="metric-icon"><Clock3 size={17} /></span></div><div className="info-metric"><span>Durasi ilustratif layanan</span><b>{app.slaBusinessDays} hari kerja</b></div><div className="info-metric"><span>Kalender</span><b>Hari kerja · WIB</b></div><div className="info-metric"><span>Jeda dokumen</span><b>Tidak dihitung dalam SLA</b></div>{app.progressNote && <div className="application-note"><b>Catatan terkini</b><p>{app.progressNote}</p></div>}<div className="next-stage-card"><span className="next-stage-number"><ArrowRight size={15} /></span><div><small>Langkah berikutnya</small><b>{nextLabels[app.status] ?? "Proses selesai"}</b></div></div></section>
        <section className="section-card"><div className="section-card-header"><div><h2>Riwayat persetujuan</h2><p>Dicatat berdasarkan aktor dan waktu</p></div></div>{app.approvalStages.map((stage) => { const actor = detail.approvalActors.filter((item) => item.role === stage).at(-1); const current = app.status === `MENUNGGU_${stage}`; return <div className="approval-stage-row" key={stage}><span className={`approval-dot${actor ? " done" : current ? " current" : ""}`}>{actor ? <Check size={12} /> : null}</span><span><b>{roleLabel[stage]}</b><small>{actor?.fullName ? `Disetujui ${actor.fullName}` : current ? "Menunggu persetujuan" : "Tahap berikutnya"}</small></span></div>; })}</section>
      </aside>
    </div>
  </section>;
}
