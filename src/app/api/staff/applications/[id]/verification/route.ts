import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { applicationDocuments, applicationEvents, applications, notifications } from "@/db/schema";
import { authorizeApi } from "@/lib/auth";
import { canManageAsStaff, findApplication } from "@/lib/application-access";
import { isRequiredRequirement } from "@/lib/format";
import { addBusinessDays, addPriorityHours } from "@/lib/dates";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const access = await authorizeApi(["application:verify", "application:return_document"]);
  if ("response" in access) return access.response;
  const { id } = await context.params;
  const found = await findApplication(id);
  if (!found) return NextResponse.json({ error: "Pengajuan tidak ditemukan." }, { status: 404 });
  if (!canManageAsStaff(access.user, found.application)) return NextResponse.json({ error: "Pengajuan ini ditangani petugas lain." }, { status: 403 });
  if (!["MENUNGGU_VERIFIKASI", "MENUNGGU_WARGA"].includes(found.application.status)) return NextResponse.json({ error: "Pengajuan tidak sedang menunggu verifikasi." }, { status: 409 });
  const body = await request.json().catch(() => ({}));
  const action = body.action;
  const now = new Date();
  const app = found.application;
  const requestedIds: string[] = Array.isArray(body.missingRequirementIds) ? body.missingRequirementIds.filter((value: unknown): value is string => typeof value === "string") : [];

  if (action === "return") {
    const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 800) : "";
    const validIds = requestedIds.filter((id) => found.service.requirements.some((requirement) => requirement.id === id));
    if (reason.length < 8 || !validIds.length) return NextResponse.json({ error: "Sertakan alasan dan pilih dokumen yang perlu diperbaiki." }, { status: 400 });
    await db.transaction(async (tx) => {
      await tx.update(applications).set({ assignedStaffId: access.user.id, status: "MENUNGGU_WARGA", pausedAt: app.slaStartedAt && !app.pausedAt ? now : app.pausedAt, updatedAt: now }).where(eq(applications.id, app.id));
      await tx.insert(applicationEvents).values({ applicationId: app.id, actorId: access.user.id, eventType: "DOCUMENTS_RETURNED", status: "MENUNGGU_WARGA", note: reason, metadata: { missingRequirementIds: validIds }, createdAt: now });
      await tx.insert(notifications).values({ userId: app.citizenId, applicationId: app.id, title: "Dokumen perlu diperbaiki", body: `${reason} Buka pengajuan untuk mengirim revisi.`, href: `/applications/${app.id}` });
    });
    return NextResponse.json({ ok: true, status: "MENUNGGU_WARGA" });
  }

  if (action !== "verify") return NextResponse.json({ error: "Aksi verifikasi tidak dikenal." }, { status: 400 });
  const currentDocs = await db.select({ requirementId: applicationDocuments.requirementId }).from(applicationDocuments).where(and(eq(applicationDocuments.applicationId, app.id), eq(applicationDocuments.isCurrent, true)));
  const available = new Set(currentDocs.map((item) => item.requirementId));
  const missing = found.service.requirements.filter((item) => isRequiredRequirement(item, app.formData) && !available.has(item.id));
  const evidenceMissing = app.priorityRequested && found.service.priorityEvidenceReasons.includes(app.priorityReason ?? "") && !available.has("priority_evidence");
  if (missing.length || evidenceMissing) {
    return NextResponse.json({ error: `Berkas belum lengkap: ${[...missing.map((item) => item.label), ...(evidenceMissing ? ["Bukti prioritas"] : [])].join(", ")}.` }, { status: 400 });
  }

  const pausedSeconds = app.pausedAt ? Math.max(0, Math.floor((now.getTime() - app.pausedAt.getTime()) / 1000)) : 0;
  const resumedDue = app.pausedAt && app.dueAt ? new Date(app.dueAt.getTime() + pausedSeconds * 1000) : null;
  const newPriorityDue = app.priorityStatus === "DISETUJUI" && !app.pausedAt ? addPriorityHours(now, found.service.priorityTargetHours) : null;
  const dueAt = newPriorityDue ?? resumedDue ?? app.dueAt ?? addBusinessDays(now, found.service.slaBusinessDays, found.service.businessWeekdays);
  const verifiedAt = app.verifiedAt ?? now;
  const firstVerify = !app.slaStartedAt;
  await db.transaction(async (tx) => {
    await tx.update(applications).set({
      assignedStaffId: access.user.id,
      status: "TERVERIFIKASI",
      verifiedAt,
      slaStartedAt: app.slaStartedAt ?? now,
      dueAt,
      pausedAt: null,
      accumulatedPauseDuration: app.accumulatedPauseDuration + pausedSeconds,
      progressNote: "Dokumen lengkap dan telah diverifikasi.",
      updatedAt: now,
    }).where(eq(applications.id, app.id));
    await tx.insert(applicationEvents).values({ applicationId: app.id, actorId: access.user.id, eventType: firstVerify ? "DOCUMENTS_VERIFIED" : "DOCUMENTS_REVERIFIED", status: "TERVERIFIKASI", note: firstVerify ? "Dokumen lengkap. SLA mulai dihitung sejak verifikasi ini." : "Dokumen perbaikan telah diverifikasi. SLA dilanjutkan tanpa menghitung waktu tunggu warga.", metadata: { verifiedAt: now.toISOString(), dueAt: dueAt.toISOString(), pausedSeconds }, createdAt: now });
    await tx.insert(notifications).values({ userId: app.citizenId, applicationId: app.id, title: "Dokumen telah terverifikasi", body: `Berkas lengkap. SLA ${found.service.slaBusinessDays} hari kerja mulai dihitung sejak ${new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "medium", timeStyle: "short" }).format(now)} WIB.`, href: `/applications/${app.id}` });
  });
  return NextResponse.json({ ok: true, status: "TERVERIFIKASI", verifiedAt: verifiedAt.toISOString(), dueAt: dueAt.toISOString() });
}
