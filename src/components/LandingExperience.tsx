'use client';

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowRight, BadgeCheck, Bell, CalendarClock, Check, ChevronDown, ChevronUp, Clock3, FileCheck2, FileText, HeartHandshake, Menu, Search, ShieldCheck, Sparkles, TrendingUp, X } from "lucide-react";
import { Brand } from "@/components/Brand";
import type { ServiceRequirement } from "@/db/schema";

type PublicService = {
  id: string;
  code: string;
  name: string;
  description: string;
  category: string;
  requirements: ServiceRequirement[];
  slaBusinessDays: number;
  priorityEnabled: boolean;
  priorityTargetHours: number;
};

const questions = [
  { question: "Bagaimana cara mengajukan surat?", answer: "Masuk menggunakan akun terdaftar, pilih layanan pada dashboard, lengkapi informasi yang diperlukan, lalu unggah dokumen persyaratan. Aplikasi demo menyediakan lima akun peran untuk melihat alur yang berbeda." },
  { question: "Apa yang terjadi jika dokumen saya kurang?", answer: "Petugas dapat mengembalikan berkas dengan alasan dan daftar dokumen yang perlu dilengkapi. Anda menerima notifikasi, lalu dapat mengunggah versi perbaikan. Riwayat versi lama tetap tercatat." },
  { question: "Kapan estimasi pelayanan mulai dihitung?", answer: "Perhitungan SLA dimulai saat petugas menyatakan seluruh dokumen telah terverifikasi. Waktu tunggu kelengkapan dari warga dijeda dan tidak dihitung sebagai waktu pelayanan." },
  { question: "Bagaimana cara mengetahui status pengajuan?", answer: "Timeline di halaman detail menampilkan setiap perubahan status, waktu, peran yang menangani, dan catatan. Notifikasi juga tersimpan di pusat notifikasi akun." },
  { question: "Apakah saya bisa meminta pengajuan prioritas?", answer: "Permintaan prioritas tersedia hanya untuk layanan domisili dan keterangan kematian pada konfigurasi demo. Petugas tetap memeriksa alasan dan bukti pendukung sebelum mengambil keputusan." },
  { question: "Apakah surat yang diunduh merupakan dokumen resmi?", answer: "Tidak. Surat pada aplikasi demo diberi watermark SIMULASI / BUKAN DOKUMEN RESMI dan tidak memiliki tanda tangan elektronik atau integrasi instansi." },
];

function estimateLabel(days: number) {
  return `Ilustrasi ${days} hari kerja`;
}

export function LandingExperience({ services }: { services: PublicService[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Semua kategori");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [faqOpen, setFaqOpen] = useState<number | null>(0);
  const [mobileMenu, setMobileMenu] = useState(false);
  const categories = useMemo(() => ["Semua kategori", ...Array.from(new Set(services.map((service) => service.category)))], [services]);
  const visibleServices = useMemo(() => services.filter((service) =>
    (category === "Semua kategori" || service.category === category) &&
    `${service.name} ${service.description} ${service.category}`.toLowerCase().includes(query.toLowerCase()),
  ), [services, query, category]);

  return (
    <main>
      <header className="public-nav">
        <div className="site-container public-nav-inner">
          <Brand />
          <button className="icon-button mobile-menu-button" aria-label={mobileMenu ? "Tutup menu" : "Buka menu"} onClick={() => setMobileMenu(!mobileMenu)}>
            {mobileMenu ? <X size={20} /> : <Menu size={20} />}
          </button>
          <nav className={`public-links${mobileMenu ? " open" : ""}`} aria-label="Navigasi utama">
            <Link href="/">Beranda</Link>
            <Link href="/services">Layanan</Link>
            <a href="/#cara-kerja" onClick={() => setMobileMenu(false)}>Cara Kerja</a>
            <Link href="/about">Tentang</Link>
            <Link className="btn btn-primary" href="/login">Login <ArrowRight size={16} /></Link>
          </nav>
        </div>
      </header>

      <section className="hero-section">
        <div className="site-container hero-grid">
          <div className="hero-copy">
            <div className="eyebrow">Pelayanan publik, lebih dekat</div>
            <h1>Urus Administrasi Kelurahan, <span>Lebih Mudah dan Transparan.</span></h1>
            <p>Ajukan surat secara digital, lengkapi persyaratan, dan pantau proses pelayanan tanpa harus terus-menerus datang ke kantor kelurahan.</p>
            <div className="hero-actions">
              <Link href="/login" className="btn btn-primary">Masuk ke Kelar.in <ArrowRight size={17} /></Link>
              <a href="#preview" className="btn btn-secondary">Lihat Preview <ArrowDown size={16} /></a>
            </div>
            <div className="hero-footnote"><ShieldCheck size={17} /> Status, alur, dan estimasi tercatat di satu tempat.</div>
          </div>
          <div className="preview-window" id="preview" aria-label="Preview sistem kelar.in">
            <div className="preview-chrome"><div className="preview-dots"><i /><i /><i /></div><span className="preview-label">Kelurahan Digital · Preview</span><span className="preview-label">•••</span></div>
            <div className="preview-body">
              <aside className="preview-sidebar"><div className="preview-side-logo">kelar.in</div><div className="preview-side-item active"><TrendingUp size={12} /> Ringkasan</div><div className="preview-side-item"><FileText size={12} /> Pengajuan</div><div className="preview-side-item"><CalendarClock size={12} /> Akuntabilitas</div><div className="preview-side-item"><Bell size={12} /> Notifikasi</div></aside>
              <div className="preview-main">
                <div className="eyebrow" style={{ fontSize: ".56rem" }}>Dashboard Lurah</div>
                <h3>Ringkasan pelayanan</h3><p>Contoh data simulasi · bukan data operasional</p>
                <div className="preview-stat-grid"><div className="preview-stat"><small>Pengajuan bulan ini</small><b>128</b></div><div className="preview-stat"><small>Tepat waktu</small><b>92%</b></div><div className="preview-stat"><small>Rata-rata</small><b>3,2 <small>hari</small></b></div></div>
                <div className="preview-chart"><span className="preview-chart-label">Tren layanan · preview</span><svg viewBox="0 0 360 100" preserveAspectRatio="none" aria-hidden="true"><path d="M0,77 C25,70 36,75 56,57 S92,64 113,45 145,52 167,38 201,52 225,30 259,41 280,23 315,35 360,12" fill="none" stroke="#805c75" strokeWidth="3"/><path d="M0,77 C25,70 36,75 56,57 S92,64 113,45 145,52 167,38 201,52 225,30 259,41 280,23 315,35 360,12 L360,100 L0,100 Z" fill="rgba(164,126,150,.13)"/></svg></div>
                <div className="preview-status"><span>Surat keterangan domisili</span><span>✓ Terverifikasi</span></div>
              </div>
            </div>
            <span className="preview-stamp"><Sparkles size={12} style={{ verticalAlign: "-2px" }} /> Preview Sistem</span>
            <div className="preview-caption"><span className="status-pill status-pill--amber">Data dummy</span> Tampilan contoh untuk pengenalan produk</div>
          </div>
        </div>
      </section>

      <section className="section" id="layanan">
        <div className="site-container">
          <div className="section-heading"><div className="eyebrow">Sembilan layanan dalam satu tempat</div><h2>Informasi layanan, sebelum Anda mulai</h2><p>Kenali persyaratan dan estimasi ilustratif terlebih dahulu. Pengajuan hanya tersedia setelah login.</p></div>
          <div className="service-controls">
            <label className="search-field"><Search size={17} aria-hidden="true" /><input aria-label="Cari layanan" placeholder="Cari nama layanan…" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
            <select className="filter-select" aria-label="Filter kategori layanan" value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map((item) => <option key={item}>{item}</option>)}</select>
          </div>
          {visibleServices.length ? <div className="service-grid">{visibleServices.map((service, index) => {
            const isOpen = expanded === service.id;
            return <article className="service-card" key={service.id}>
              <div className="service-card-top"><span className="service-icon"><FileCheck2 size={19} /></span><span className="service-category">{service.category}</span></div>
              <h3>{service.name}</h3><p>{service.description}</p>
              <div className="service-meta"><span><Clock3 size={14} /> {estimateLabel(service.slaBusinessDays)}</span>{service.priorityEnabled && <span className="priority-tag"><Sparkles size={13} /> Prioritas tersedia</span>}</div>
              {isOpen && <div className="service-requirements"><strong>Persyaratan utama</strong><ul>{service.requirements.slice(0, 4).map((requirement) => <li key={requirement.id}>{requirement.label}{requirement.conditional ? " (kondisional)" : !requirement.required ? " (opsional)" : ""}</li>)}</ul>{service.requirements.length > 4 && <span className="field-help">Persyaratan lain dapat dilihat setelah login.</span>}</div>}
              <div className="service-card-actions"><button className="text-link" onClick={() => setExpanded(isOpen ? null : service.id)} aria-expanded={isOpen}>{isOpen ? "Tutup persyaratan" : "Lihat persyaratan"} {isOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}</button><Link className="text-link" href="/login">Masuk untuk mengajukan <ArrowRight size={14} /></Link></div>
            </article>;
          })}</div> : <div className="surface empty-state"><div><Search size={25} /><p>Tidak ada layanan yang cocok dengan pencarian.</p></div></div>}
          <div style={{ textAlign: "center", marginTop: 23 }}><Link href="/services" className="btn btn-secondary">Lihat semua informasi layanan <ArrowRight size={16} /></Link></div>
        </div>
      </section>

      <section className="section" id="cara-kerja" style={{ background: "rgba(255,253,250,.46)" }}>
        <div className="site-container">
          <div className="section-heading"><div className="eyebrow">Alur yang jelas dari awal</div><h2>Langkah sederhana, proses lebih terlihat</h2><p>Setiap pengajuan berjalan melalui tahap yang tercatat dan dapat dipantau oleh pengguna yang berwenang.</p></div>
          <div className="steps-grid">{[
            { title: "Masuk ke akun", desc: "Gunakan akun warga untuk mengakses dashboard dan memulai permohonan." },
            { title: "Pilih layanan", desc: "Lengkapi informasi dan persyaratan dinamis sesuai kebutuhan layanan." },
            { title: "Pantau proses", desc: "Petugas dan pihak terkait memeriksa berkas serta memberikan persetujuan." },
            { title: "Unduh surat", desc: "Setelah finalisasi, surat simulasi tersedia di halaman pengajuan Anda." },
          ].map((step, index) => <article className="step-card" key={step.title}><span className="step-number">0{index + 1}</span><h3>{step.title}</h3><p>{step.desc}</p></article>)}</div>
        </div>
      </section>

      <section className="section">
        <div className="site-container">
          <div className="transparency-panel">
            <div><div className="eyebrow">Transparansi & akuntabilitas</div><h2>Waktu pelayanan yang dapat dijelaskan.</h2><p>Estimasi bukan sekadar angka. Kelar.in mencatat kapan SLA dimulai, kapan dokumen menunggu kelengkapan, serta perubahan estimasi beserta alasannya.</p><Link href="/login" className="btn btn-primary" style={{ marginTop: 20 }}>Lihat dashboard setelah login <ArrowRight size={16} /></Link></div>
            <div className="transparency-list">
              <div className="transparency-item"><Clock3 size={18} /><div><b>Estimasi dimulai saat berkas terverifikasi</b><span>Pengiriman awal tidak memulai hitungan SLA.</span></div></div>
              <div className="transparency-item"><FileCheck2 size={18} /><div><b>Waktu tunggu warga dijeda</b><span>Perbaikan dokumen tidak dibebankan pada waktu kerja pelayanan.</span></div></div>
              <div className="transparency-item"><BadgeCheck size={18} /><div><b>Perubahan tercatat di timeline</b><span>Catatan petugas, persetujuan, dan estimasi baru terlihat di pengajuan.</span></div></div>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="faq" style={{ paddingTop: 28 }}>
        <div className="site-container"><div className="section-heading"><div className="eyebrow">Pertanyaan umum</div><h2>Hal yang perlu Anda ketahui</h2><p>Informasi singkat tentang alur dan penggunaan sistem demo.</p></div><div className="faq-list">{questions.map((item, index) => <div className="faq-item" key={item.question}><button className="faq-trigger" aria-expanded={faqOpen === index} onClick={() => setFaqOpen(faqOpen === index ? null : index)}>{item.question}{faqOpen === index ? <ChevronUp size={18} /> : <ChevronDown size={18} />}</button>{faqOpen === index && <p className="faq-answer">{item.answer}</p>}</div>)}</div></div>
      </section>
      <footer className="site-footer"><div className="site-container"><div className="footer-grid">
        <div className="footer-brand"><Brand light /><p>Platform demo pelayanan publik digital untuk mengajukan surat, memantau proses, dan memahami transparansi waktu pelayanan.</p><span className="status-pill status-pill--amber" style={{ marginTop: 14 }}>Simulasi · bukan layanan operasional</span></div>
        <div className="footer-column"><h3>Navigasi</h3><Link href="/">Beranda</Link><Link href="/services">Informasi layanan</Link><a href="/#cara-kerja">Cara kerja</a><Link href="/about">Tentang kelar.in</Link></div>
        <div className="footer-column"><h3>Bantuan</h3><a href="/#faq">FAQ</a><Link href="/login">Masuk ke aplikasi</Link><Link href="/accessibility">Aksesibilitas</Link><Link href="/privacy">Kebijakan privasi demo</Link></div>
        <div className="footer-column"><h3>Informasi demo</h3><span>Data kontak kelurahan tidak tersedia pada lingkungan simulasi.</span><span>Email bantuan: demo@kelar.in (contoh)</span><Link href="/terms">Ketentuan penggunaan</Link></div>
      </div><div className="footer-bottom"><span>© {new Date().getFullYear()} kelar.in · Lingkungan simulasi.</span><span>Dirancang untuk pelayanan yang lebih transparan dan mudah dipahami.</span></div></div></footer>
    </main>
  );
}
