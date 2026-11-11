import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { applications } from "@/db/schema";
import { authorizeApi } from "@/lib/auth";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const access = await authorizeApi("application:download_own_completed_letter");
  if ("response" in access) return access.response;
  const { id } = await context.params;
  const [application] = await db.select().from(applications).where(eq(applications.id, id)).limit(1);
  if (!application) return NextResponse.json({ error: "Pengajuan tidak ditemukan." }, { status: 404 });
  if (application.citizenId !== access.user.id) return NextResponse.json({ error: "Anda tidak dapat mengunduh surat ini." }, { status: 403 });
  if (application.status !== "SELESAI" || !application.letterData) return NextResponse.json({ error: "Surat belum diterbitkan." }, { status: 409 });
  const content = new Blob([Uint8Array.from(application.letterData)], { type: "application/pdf" });
  return new Response(content, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${application.letterFileName ?? `${application.publicId}-SIMULASI.pdf`}"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}
