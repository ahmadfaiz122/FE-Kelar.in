import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { applicationEvents, applications, notifications, users } from "@/db/schema";
import { authorizeApi } from "@/lib/auth";
import { canManageAsStaff, findApplication } from "@/lib/application-access";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const access = await authorizeApi("application:process");
  if ("response" in access) return access.response;
  const { id } = await context.params;
  const found = await findApplication(id);
  if (!found) return NextResponse.json({ error: "Pengajuan tidak ditemukan." }, { status: 404 });
  if (!canManageAsStaff(access.user, found.application)) return NextResponse.json({ error: "Pengajuan ditangani petugas lain." }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const action = body.action;
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 800) : "";
  const now = new Date();
  let status: string;
  let eventType: string;
  let message: string;
  if (action === "start" && found.application.status === "TERVERIFIKASI") {
    status = "SEDANG_DIPROSES";
    eventType = "PROCESSING_STARTED";
    message = note || "Petugas mulai menyusun surat.";
  } else if (action === "submit" && found.application.status === "SEDANG_DIPROSES") {
    const firstStage = found.service.approvalStages[0];
    status = firstStage ? `MENUNGGU_${firstStage}` : "FINALISASI";
    eventType = "SENT_FOR_APPROVAL";
    message = note || "Surat siap diperiksa dan dikirim ke tahap persetujuan.";
  } else {
    return NextResponse.json({ error: "Tahap proses sudah berubah atau aksi tidak sesuai status." }, { status: 409 });
  }
  const recipients = status === "MENUNGGU_RTRW" && found.application.assignedRtrwId
    ? [found.application.assignedRtrwId]
    : status === "MENUNGGU_LURAH" ? (await db.select({ id: users.id }).from(users).where(eq(users.role, "LURAH"))).map((row) => row.id)
      : status === "MENUNGGU_CAMAT" ? (await db.select({ id: users.id }).from(users).where(eq(users.role, "CAMAT"))).map((row) => row.id)
        : (await db.select({ id: users.id }).from(users).where(eq(users.role, "PETUGAS"))).map((row) => row.id);
  await db.transaction(async (tx) => {
    await tx.update(applications).set({ assignedStaffId: access.user.id, status, progressNote: message, updatedAt: now }).where(eq(applications.id, found.application.id));
    await tx.insert(applicationEvents).values({ applicationId: found.application.id, actorId: access.user.id, eventType, status, note: message, createdAt: now });
    await tx.insert(notifications).values([
      { userId: found.application.citizenId, applicationId: found.application.id, title: status === "SEDANG_DIPROSES" ? "Pengajuan sedang diproses" : "Menunggu persetujuan", body: `${found.service.name}: ${message}`, href: `/applications/${found.application.id}` },
      ...recipients.map((userId) => ({ userId, applicationId: found.application.id, title: status.startsWith("MENUNGGU_") ? "Persetujuan baru menunggu" : "Pengajuan siap diproses", body: `${found.application.publicId} · ${found.service.name}`, href: status === "MENUNGGU_RTRW" ? "/rtrw/approvals" : status === "MENUNGGU_LURAH" ? "/lurah/approvals" : status === "MENUNGGU_CAMAT" ? "/camat/approvals" : "/staff/processing" })),
    ]);
  });
  return NextResponse.json({ ok: true, status });
}
