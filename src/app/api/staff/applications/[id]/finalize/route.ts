import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { applicationEvents, applications, notifications } from "@/db/schema";
import { authorizeApi } from "@/lib/auth";
import { canManageAsStaff, findApplication } from "@/lib/application-access";
import { generateSimulationPdf } from "@/lib/pdf";

export const runtime = "nodejs";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const access = await authorizeApi("application:finalize");
  if ("response" in access) return access.response;
  const { id } = await context.params;
  const found = await findApplication(id);
  if (!found) return NextResponse.json({ error: "Pengajuan tidak ditemukan." }, { status: 404 });
  if (!canManageAsStaff(access.user, found.application)) return NextResponse.json({ error: "Pengajuan ditangani petugas lain." }, { status: 403 });
  if (found.application.status !== "FINALISASI") return NextResponse.json({ error: "Surat belum mencapai tahap finalisasi." }, { status: 409 });
  const completedAt = new Date();
  const letterData = generateSimulationPdf({ title: found.service.name, publicId: found.application.publicId, citizenName: found.citizenName, serviceName: found.service.name, createdAt: completedAt, purpose: found.application.formData.purpose });
  const letterFileName = `${found.application.publicId}-SIMULASI.pdf`;
  await db.transaction(async (tx) => {
    await tx.update(applications).set({ status: "SELESAI", completedAt, letterData, letterFileName, updatedAt: completedAt }).where(eq(applications.id, found.application.id));
    await tx.insert(applicationEvents).values({ applicationId: found.application.id, actorId: access.user.id, eventType: "LETTER_ISSUED", status: "SELESAI", note: "Surat simulasi diterbitkan. Bukan dokumen resmi dan tidak memiliki tanda tangan elektronik.", metadata: { fileName: letterFileName, completedAt: completedAt.toISOString() }, createdAt: completedAt });
    await tx.insert(notifications).values({ userId: found.application.citizenId, applicationId: found.application.id, title: "Surat berhasil diterbitkan", body: "Surat simulasi sudah dapat diunduh. Dokumen ditandai BUKAN DOKUMEN RESMI.", href: `/applications/${found.application.id}` });
  });
  return NextResponse.json({ ok: true, status: "SELESAI", letterFileName });
}
