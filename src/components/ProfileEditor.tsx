'use client';

import { FormEvent, useState } from "react";
import { CheckCircle2, KeyRound, ShieldCheck, UserRound } from "lucide-react";
import type { SessionUser } from "@/lib/auth";

const roles = { WARGA: "Warga", PETUGAS: "Petugas", RTRW: "RT / RW", LURAH: "Lurah", CAMAT: "Camat" };
export function ProfileEditor({ user }: { user: SessionUser }) {
  const [fullName, setFullName] = useState(user.fullName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setSuccess("");
    try { const response = await fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fullName }) }); const result = await response.json(); if (!response.ok) throw new Error(result.error ?? "Profil belum dapat disimpan."); setFullName(result.fullName); setSuccess("Nama profil berhasil disimpan."); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Tidak dapat menyimpan profil."); }
    finally { setBusy(false); }
  }
  return <section><div className="page-heading"><div><span className="eyebrow">Akun</span><h1>Profil saya</h1><p>Informasi identitas akun dan role yang dikelola di sisi server.</p></div><span className="status-pill status-pill--blue"><ShieldCheck size={13} /> {roles[user.role]}</span></div>{error && <div className="toast-error" role="alert" style={{ marginBottom: 14 }}>{error}</div>}{success && <div className="toast-success" role="status" style={{ marginBottom: 14 }}>{success}</div>}
    <div className="profile-layout"><section className="section-card"><div className="profile-heading"><div className="profile-avatar">{user.fullName.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</div><div><h2>{user.fullName}</h2><p>{user.email}</p></div></div><form className="form-stack" onSubmit={submit}><label><span className="field-label">Nama tampilan</span><input className="field" value={fullName} onChange={(event) => setFullName(event.target.value)} minLength={2} maxLength={180} required /><span className="field-help">Nama ini ditampilkan pada dashboard dan pratinjau dokumen.</span></label><label><span className="field-label">Email akun</span><input className="field" value={user.email} disabled readOnly /><span className="field-help">Email demo tidak dapat diubah dari halaman profil.</span></label><label><span className="field-label">Peran dan akses</span><input className="field" value={roles[user.role]} disabled readOnly /><span className="field-help">Peran ditetapkan pada database dan tidak dapat diubah dari browser.</span></label><button className="btn btn-primary" disabled={busy || fullName.trim() === user.fullName}>{busy ? "Menyimpan…" : "Simpan perubahan"}</button></form></section><aside className="section-card"><div className="section-card-header"><div><h2>Keamanan akun demo</h2><p>Session aplikasi</p></div><span className="metric-icon"><KeyRound size={16} /></span></div><div className="security-item"><ShieldCheck size={17} /><div><b>Session terlindungi</b><span>Token session berada dalam cookie HTTP-only dengan masa berlaku terbatas.</span></div></div><div className="security-item"><UserRound size={17} /><div><b>Role dikendalikan server</b><span>Menu dan aksi diperiksa ulang pada halaman dan endpoint API.</span></div></div><div className="security-item"><CheckCircle2 size={17} /><div><b>Gunakan data dummy</b><span>Jangan simpan informasi identitas asli pada lingkungan simulasi.</span></div></div></aside></div></section>;
}
