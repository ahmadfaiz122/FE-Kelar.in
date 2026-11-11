'use client';

import { FormEvent, useEffect, useState } from "react";
import { KeyRound, Search, ShieldCheck, UserPlus, Users } from "lucide-react";

type StaffUser = { id: string; fullName: string; email: string; isActive: boolean; createdAt: string; handledCount: number };

export function StaffManagement() {
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [query, setQuery] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function refresh() {
    setLoading(true);
    try { const response = await fetch("/api/lurah/staff", { cache: "no-store" }); const result = await response.json(); if (!response.ok) throw new Error(result.error ?? "Data petugas tidak dapat dimuat."); setStaff(result.staff ?? []); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Tidak dapat memuat petugas."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void refresh(); }, []);
  async function createStaff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy("create"); setError(""); setSuccess("");
    try {
      const response = await fetch("/api/lurah/staff", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fullName, email, password }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error ?? "Petugas belum dapat dibuat.");
      setFullName(""); setEmail(""); setPassword(""); setSuccess(`Akun petugas ${result.staff.fullName} berhasil dibuat. Akses dicatat di audit log.`); await refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Tidak dapat membuat akun."); }
    finally { setBusy(""); }
  }
  async function toggle(person: StaffUser) {
    setBusy(person.id); setError(""); setSuccess("");
    try { const response = await fetch(`/api/lurah/staff/${person.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !person.isActive }) }); const result = await response.json(); if (!response.ok) throw new Error(result.error ?? "Status petugas tidak dapat diperbarui."); setSuccess(`${person.fullName}: akun ${result.isActive ? "diaktifkan" : "dinonaktifkan"}.`); await refresh(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Aksi tidak dapat disimpan."); }
    finally { setBusy(""); }
  }
  const visible = staff.filter((person) => `${person.fullName} ${person.email}`.toLowerCase().includes(query.toLowerCase()));

  return <section><div className="page-heading"><div><span className="eyebrow">Kontrol akses</span><h1>Manajemen petugas</h1><p>Kelola akun petugas untuk lingkungan demo. Status nonaktif langsung menghentikan akses session.</p></div><span className="status-pill status-pill--blue">{staff.length} akun</span></div><div className="demo-banner"><ShieldCheck size={16} /><span>Hanya Lurah dapat membuat atau menonaktifkan akun petugas. Perubahan dicatat dan sesi petugas nonaktif tidak lagi berlaku.</span></div>
    {error && <div className="toast-error" role="alert" style={{ marginBottom: 14 }}>{error}</div>}{success && <div className="toast-success" role="status" style={{ marginBottom: 14 }}>{success}</div>}
    <div className="staff-admin-grid"><section className="section-card"><div className="section-card-header"><div><h2>Petugas terdaftar</h2><p>Aktivitas hanya menghitung penugasan yang tersimpan.</p></div><span className="metric-icon"><Users size={17} /></span></div><label className="search-field" style={{ marginBottom: 15 }}><Search size={16} /><input placeholder="Cari nama atau email" aria-label="Cari petugas" value={query} onChange={(event) => setQuery(event.target.value)} /></label>{loading ? <div className="empty-state">Memuat daftar petugas…</div> : visible.length ? <div className="staff-list">{visible.map((person) => <article className="staff-row" key={person.id}><div className="avatar">{person.fullName.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</div><div className="staff-copy"><b>{person.fullName}</b><span>{person.email} · {person.handledCount} pengajuan ditugaskan</span></div><span className={`status-pill ${person.isActive ? "status-pill--green" : "status-pill--neutral"}`}>{person.isActive ? "Aktif" : "Nonaktif"}</span><button className={`btn ${person.isActive ? "btn-danger" : "btn-secondary"}`} disabled={busy === person.id} onClick={() => void toggle(person)}>{busy === person.id ? "Menyimpan…" : person.isActive ? "Nonaktifkan" : "Aktifkan"}</button></article>)}</div> : <div className="empty-state"><div><Users size={23} /><p>Tidak ada petugas yang cocok.</p></div></div>}</section>
      <aside className="section-card"><div className="section-card-header"><div><h2>Tambah petugas</h2><p>Buat identitas role PETUGAS dari sisi server.</p></div><span className="metric-icon"><UserPlus size={17} /></span></div><form className="form-stack" onSubmit={createStaff}><label><span className="field-label">Nama lengkap *</span><input className="field" required minLength={2} maxLength={180} value={fullName} onChange={(event) => setFullName(event.target.value)} /></label><label><span className="field-label">Email *</span><input className="field" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label><label><span className="field-label">Kata sandi sementara *</span><input className="field" type="password" required minLength={10} value={password} onChange={(event) => setPassword(event.target.value)} /><span className="field-help">Minimal 10 karakter. Kata sandi tidak ditampilkan kembali.</span></label><button className="btn btn-primary" disabled={busy === "create"}>{busy === "create" ? "Membuat akun…" : "Buat akun petugas"}</button></form><div className="accountability-note"><KeyRound size={15} />Pengguna masuk tanpa memilih role; role dibaca dari database.</div></aside></div>
  </section>;
}
