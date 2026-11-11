import Link from "next/link";
import { ArrowLeft, ShieldX } from "lucide-react";

export function ForbiddenPage() {
  return <main className="forbidden-screen"><div className="surface forbidden-card"><div className="forbidden-icon"><ShieldX size={25} /></div><span className="eyebrow">HTTP 403 · akses dibatasi</span><h1>Anda tidak memiliki izin untuk halaman ini.</h1><p>Akses dan data dibatasi berdasarkan peran akun. Kembali ke dashboard akun Anda untuk melanjutkan.</p><Link className="btn btn-primary" href="/dashboard"><ArrowLeft size={16} /> Kembali ke ruang kerja</Link></div></main>;
}
