'use client';

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2, Clock3, FilePlus2, FileText, Info, Trash2, UploadCloud } from "lucide-react";
import type { ServiceRequirement } from "@/db/schema";
import { priorityReasons } from "@/lib/catalog";
import { isRequiredRequirement } from "@/lib/format";

type ServiceOption = {
  id: string; code: string; name: string; description: string; category: string;
  requirements: ServiceRequirement[]; slaBusinessDays: number; priorityEnabled: boolean; priorityTargetHours: number;
  priorityEvidenceReasons: string[]; maxFileSizeMB: number;
};
type SelectedFile = { file: File; previewUrl: string };

export function NewApplicationForm({ services, fullName }: { services: ServiceOption[]; fullName: string }) {
  const router = useRouter();
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const service = services.find((item) => item.id === serviceId);
  const [answers, setAnswers] = useState<Record<string, string>>({ fullName, address: "", phone: "", purpose: "" });
  const [files, setFiles] = useState<Record<string, SelectedFile | undefined>>({});
  const [priorityRequested, setPriorityRequested] = useState(false);
  const [priorityReason, setPriorityReason] = useState("");
  const [priorityNote, setPriorityNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => () => Object.values(files).forEach((item) => item && URL.revokeObjectURL(item.previewUrl)), [files]);
  const requiredRequirements = useMemo(() => service?.requirements.filter((item) => isRequiredRequirement(item, answers)) ?? [], [service, answers]);
  const evidenceRequired = Boolean(priorityRequested && priorityReason && service?.priorityEvidenceReasons.includes(priorityReason));
  const missingFiles = [...requiredRequirements.filter((item) => !files[item.id]).map((item) => item.label), ...(evidenceRequired && !files.priority_evidence ? ["Bukti pendukung prioritas"] : [])];

  function updateAnswer(key: string, value: string) {
    setAnswers((current) => ({ ...current, [key]: value }));
  }
  function changeFile(key: string, incoming?: File) {
    setError("");
    if (!incoming) return;
    const extension = incoming.name.split(".").pop()?.toLowerCase();
    const accepted = ["application/pdf", "image/jpeg", "image/png"].includes(incoming.type) && ["pdf", "jpg", "jpeg", "png"].includes(extension ?? "");
    if (!accepted) { setError("Format file harus PDF, JPG, JPEG, atau PNG."); return; }
    if (incoming.size > (service?.maxFileSizeMB ?? 5) * 1024 * 1024) { setError(`Ukuran file maksimal ${service?.maxFileSizeMB ?? 5} MB.`); return; }
    if (incoming.size === 0) { setError("File kosong tidak dapat diunggah."); return; }
    const previewUrl = URL.createObjectURL(incoming);
    setFiles((current) => {
      if (current[key]) URL.revokeObjectURL(current[key]!.previewUrl);
      return { ...current, [key]: { file: incoming, previewUrl } };
    });
  }
  function removeFile(key: string) {
    setFiles((current) => {
      if (current[key]) URL.revokeObjectURL(current[key]!.previewUrl);
      const next = { ...current };
      delete next[key];
      return next;
    });
  }
  function renderFileInput(id: string, label: string, required: boolean, reason: string) {
    const selected = files[id];
    return <div className="requirement-upload" key={id}>
      <div className="requirement-upload-header"><div><b>{label}</b><span className={required ? "requirement-required" : "requirement-optional"}>{required ? "Wajib" : "Opsional"}</span></div>{selected && <button type="button" className="icon-button" aria-label={`Hapus ${label}`} onClick={() => removeFile(id)}><Trash2 size={16} /></button>}</div>
      <p><Info size={13} /> {reason}</p>
      {selected ? <div className="selected-file"><FileText size={16} /><span title={selected.file.name}>{selected.file.name}<small>{(selected.file.size / (1024 * 1024)).toFixed(2)} MB · siap diunggah</small></span><a className="text-link" href={selected.previewUrl} target="_blank" rel="noreferrer">Preview</a><label className="replace-file">Ganti<input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={(event) => changeFile(id, event.target.files?.[0])} aria-label={`Ganti ${label}`} /></label></div> : <label className="upload-drop"><UploadCloud size={18} /><span>Pilih file PDF, JPG, JPEG, atau PNG</span><input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={(event) => changeFile(id, event.target.files?.[0])} aria-label={`Unggah ${label}`} /><small>Maks. {service?.maxFileSizeMB ?? 5} MB {required ? "· Wajib" : "· Opsional"}</small></label>}
    </div>;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!service) { setError("Pilih layanan terlebih dahulu."); return; }
    if (missingFiles.length) { setError(`Lengkapi berkas: ${missingFiles.join(", ")}.`); return; }
    if (priorityRequested && !priorityReason) { setError("Pilih alasan permintaan prioritas."); return; }
    if (priorityRequested && priorityReason === "other" && priorityNote.trim().length < 8) { setError("Jelaskan kebutuhan prioritas lainnya (minimal 8 karakter)."); return; }
    setBusy(true);
    setError("");
    try {
      const body = new FormData();
      body.append("serviceId", service.id);
      body.append("answers", JSON.stringify(answers));
      body.append("priorityRequested", String(priorityRequested));
      body.append("priorityReason", priorityReason);
      body.append("priorityNote", priorityNote);
      for (const [id, item] of Object.entries(files)) if (item) body.append(`file:${id}`, item.file, item.file.name);
      const response = await fetch("/api/applications", { method: "POST", body });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Pengajuan belum berhasil dikirim.");
      router.push(`/applications/${result.application.id}`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Koneksi terputus. Periksa jaringan dan coba lagi.");
    } finally { setBusy(false); }
  }

  return <div>
    <div className="page-heading"><div><span className="eyebrow">Pengajuan baru</span><h1>Lengkapi kebutuhan layanan</h1><p>Persyaratan yang ditampilkan menyesuaikan jawaban Anda. Periksa dokumen sebelum dikirim.</p></div><Link href="/applications" className="btn btn-secondary"><ArrowLeft size={16} /> Pengajuan saya</Link></div>
    <div className="demo-banner"><Info size={17} /><span>Demo kelar.in: gunakan informasi dan file contoh saja. Jangan mengunggah KTP, KK, atau dokumen asli. SLA dimulai setelah verifikasi berkas, bukan saat formulir dikirim.</span></div>
    {error && <div className="toast-error" role="alert" style={{ marginBottom: 15 }}>{error}</div>}
    <form onSubmit={submit} className="new-application-layout">
      <section className="section-card form-stack">
        <div className="section-card-header"><div><h2>1. Pilih layanan</h2><p>Daftar layanan dikelola pada katalog sistem.</p></div><span className="step-number">01</span></div>
        <label><span className="field-label">Jenis layanan</span><select className="field" value={serviceId} required onChange={(event) => { Object.values(files).forEach((item) => item && URL.revokeObjectURL(item.previewUrl)); setFiles({}); setServiceId(event.target.value); setPriorityRequested(false); setAnswers({ fullName, address: "", phone: "", purpose: "" }); }}><option value="" disabled>Pilih layanan</option>{services.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        {service && <div className="selected-service-summary"><span className="service-icon"><FilePlus2 size={18} /></span><div><b>{service.name}</b><p>{service.description}</p><span className="service-meta"><Clock3 size={13} /> Estimasi ilustratif {service.slaBusinessDays} hari kerja · mulai setelah verifikasi berkas</span></div></div>}
      </section>

      <section className="section-card form-stack">
        <div className="section-card-header"><div><h2>2. Informasi pemohon</h2><p>Data ini digunakan untuk menyusun pratinjau surat.</p></div><span className="step-number">02</span></div>
        <div className="two-column-form"><label><span className="field-label">Nama pemohon *</span><input className="field" autoComplete="name" required minLength={2} maxLength={180} value={answers.fullName ?? ""} onChange={(event) => updateAnswer("fullName", event.target.value)} placeholder="Nama lengkap" /></label><label><span className="field-label">Nomor kontak</span><input className="field" type="tel" autoComplete="tel" maxLength={32} value={answers.phone ?? ""} onChange={(event) => updateAnswer("phone", event.target.value)} placeholder="08xx xxxx xxxx" /></label></div>
        <label><span className="field-label">Alamat domisili *</span><textarea className="field" rows={3} required minLength={5} maxLength={500} value={answers.address ?? ""} onChange={(event) => updateAnswer("address", event.target.value)} placeholder="Jalan, nomor, RT/RW, dan wilayah (gunakan data simulasi)" /></label>
        <label><span className="field-label">Keperluan surat *</span><textarea className="field" rows={2} required minLength={3} maxLength={500} value={answers.purpose ?? ""} onChange={(event) => updateAnswer("purpose", event.target.value)} placeholder="Jelaskan tujuan pengajuan secara singkat" /></label>
        {service?.code === "DOMISILI" && <div className="two-column-form"><label><span className="field-label">Status tempat tinggal *</span><select className="field" required value={answers.residenceType ?? ""} onChange={(event) => updateAnswer("residenceType", event.target.value)}><option value="">Pilih status</option><option value="sendiri">Rumah milik sendiri</option><option value="kontrak">Kontrak / sewa</option><option value="menumpang">Menumpang</option></select></label><label><span className="field-label">Tujuan domisili *</span><select className="field" required value={answers.purposeType ?? ""} onChange={(event) => updateAnswer("purposeType", event.target.value)}><option value="">Pilih tujuan</option><option value="pribadi">Keperluan pribadi</option><option value="usaha">Usaha</option><option value="lembaga">Lembaga</option></select></label></div>}
        {service?.code === "SKU" && <label><span className="field-label">Kepemilikan tempat usaha *</span><select className="field" required value={answers.placeOwnership ?? ""} onChange={(event) => updateAnswer("placeOwnership", event.target.value)}><option value="">Pilih status</option><option value="sendiri">Milik sendiri</option><option value="sewa">Sewa</option></select><span className="field-help">Persyaratan PBB atau surat izin pemilik menyesuaikan jawaban.</span></label>}
      </section>

      <section className="section-card form-stack">
        <div className="section-card-header"><div><h2>3. Dokumen persyaratan</h2><p>Format PDF, JPG, JPEG, atau PNG sesuai batas per layanan.</p></div><span className="step-number">03</span></div>
        {service ? <div className="requirement-list">{service.requirements.filter((item) => !item.conditional || item.conditional.values.includes(answers[item.conditional.field] ?? "")).map((item) => renderFileInput(item.id, item.label, isRequiredRequirement(item, answers), item.reason))}</div> : <div className="empty-state">Pilih jenis layanan untuk menampilkan persyaratan.</div>}
      </section>

      {service?.priorityEnabled && <section className="section-card form-stack priority-request-card">
        <div className="section-card-header"><div><h2>4. Permintaan prioritas</h2><p>Permintaan diperiksa petugas dan tidak otomatis mengubah antrean.</p></div><span className="status-pill status-pill--orange">Opsional</span></div>
        <label className="checkbox-line"><input type="checkbox" checked={priorityRequested} onChange={(event) => { setPriorityRequested(event.target.checked); if (!event.target.checked) { setPriorityReason(""); removeFile("priority_evidence"); } }} />Ajukan peninjauan prioritas untuk layanan ini.</label>
        {priorityRequested && <div className="form-stack"><label><span className="field-label">Alasan prioritas *</span><select className="field" required value={priorityReason} onChange={(event) => setPriorityReason(event.target.value)}><option value="">Pilih alasan</option>{priorityReasons.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>{priorityReason === "other" && <label><span className="field-label">Jelaskan kebutuhan *</span><textarea className="field" rows={2} minLength={8} required value={priorityNote} onChange={(event) => setPriorityNote(event.target.value)} placeholder="Tuliskan tenggat atau kebutuhan Anda" /></label>}{evidenceRequired && renderFileInput("priority_evidence", "Dokumen bukti pendukung prioritas", true, "Sesuai konfigurasi, alasan yang dipilih membutuhkan bukti yang relevan." )}<span className="field-help">Target prioritas ilustratif hanya berlaku jika petugas menyetujui permintaan.</span></div>}
      </section>}

      <section className="form-submit-bar"><div><b>{missingFiles.length ? `${missingFiles.length} dokumen wajib belum dipilih` : "Periksa ringkasan sebelum mengirim"}</b><span>Saat dikirim, status menjadi menunggu verifikasi. SLA belum berjalan.</span></div><button className="btn btn-primary" type="submit" disabled={busy || !service}>{busy ? "Mengirim pengajuan…" : "Kirim pengajuan"} {!busy && <ArrowRight size={17} />}</button></section>
    </form>
  </div>;
}
