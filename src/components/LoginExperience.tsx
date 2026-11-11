'use client';

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Eye, EyeOff, ShieldCheck, Sparkles } from "lucide-react";
import { Brand } from "@/components/Brand";
import { demoRoleCredentials } from "@/lib/application-helpers";

export function LoginExperience() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password, next: searchParams.get("next") ?? undefined }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Login gagal. Coba kembali.");
      router.replace(result.redirectTo);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Tidak dapat terhubung ke layanan login.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-screen">
      <header className="login-topbar"><Link className="login-back" href="/"><ArrowLeft size={17} /> Kembali ke beranda</Link><Brand /></header>
      <div className="login-grid">
        <section className="login-story">
          <span className="status-pill status-pill--amber"><Sparkles size={13} /> Lingkungan demo</span>
          <h1>Pelayanan yang lebih jelas, dimulai dari sini.</h1>
          <p>Masuk ke dashboard sesuai peran Anda. Setiap akun melihat tugas, informasi, dan aksi yang memang menjadi kewenangannya.</p>
          <div className="login-benefits"><div><ShieldCheck size={18} /><span>Session dilindungi cookie HTTP-only.</span></div><div><ArrowRight size={18} /><span>Pengajuan mengikuti alur persetujuan yang tercatat.</span></div></div>
          <div className="login-note"><b>Catatan simulasi</b><span>Data dan surat pada lingkungan ini merupakan data demo, bukan layanan operasional maupun dokumen resmi.</span></div>
        </section>
        <section className="login-card surface">
          <div className="eyebrow">Selamat datang kembali</div><h2>Masuk ke kelar.in</h2><p className="login-subtitle">Gunakan akun yang terdaftar untuk melanjutkan.</p>
          {searchParams.get("expired") === "1" && <div className="toast-error" role="status">Sesi Anda berakhir. Silakan masuk kembali.</div>}
          {error && <div className="toast-error" role="alert">{error}</div>}
          <form className="form-stack" onSubmit={submit}>
            <label><span className="field-label">Email</span><input className="field" type="email" name="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nama@email.com" /></label>
            <label><span className="field-label">Kata sandi</span><span className="password-control"><input className="field" type={showPassword ? "text" : "password"} name="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Masukkan kata sandi" /><button type="button" className="icon-button" aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></span></label>
            <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? "Memeriksa sesi…" : "Masuk"} {!busy && <ArrowRight size={16} />}</button>
          </form>
          <div className="demo-accounts"><div className="demo-accounts-heading"><div><b>Akun demo</b><span>Pilih email untuk mengisi formulir</span></div><span className="demo-password">Kata sandi: <b>kelar123</b></span></div><div className="demo-account-grid">{demoRoleCredentials.map((account) => <button type="button" className={`demo-account${email === account.email ? " selected" : ""}`} key={account.email} onClick={() => { setEmail(account.email); setPassword("kelar123"); setError(""); }}><span>{account.role}</span><b>{account.email}</b></button>)}</div><p className="field-help">Role tidak dapat dipilih di sini; akses diambil dari akun di database.</p></div>
        </section>
      </div>
      <div className="login-footer">Akses aplikasi hanya untuk pengguna terautentikasi <span>·</span> <Link href="/privacy">Privasi demo</Link></div>
    </main>
  );
}
