import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import "./application.css";

export const metadata: Metadata = {
  title: "kelar.in — Pelayanan publik digital yang transparan",
  description: "Ajukan surat kelurahan secara digital, pantau tahap pelayanan, dan lihat estimasi yang transparan bersama kelar.in.",
  applicationName: "kelar.in",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
