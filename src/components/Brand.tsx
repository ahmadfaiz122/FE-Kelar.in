import Link from "next/link";

export function Brand({ href = "/", light = false, compact = false }: { href?: string; light?: boolean; compact?: boolean }) {
  return (
    <Link href={href} className={`wordmark${light ? " footer-brandmark" : ""}`} aria-label="kelar.in beranda">
      <span className="logo-mark" aria-hidden="true">k.</span>
      {!compact && <span>kelar.in</span>}
    </Link>
  );
}
