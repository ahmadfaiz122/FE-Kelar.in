import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { applicationDocuments, applicationEvents, applications, notifications } from "@/db/schema";
import { authorizeApi } from "@/lib/auth";
import { findApplication } from "@/lib/application-access";
import { isRequiredRequirement } from "@/lib/format";
import { safeFileName, validateUpload } from "@/lib/validate-upload";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const access = await authorizeApi("application:upload_own_document");
  if ("response" in access) return access.response;
  const { id } = await context.params;
  const found = await findApplication(id);
  if (!found) return NextResponse.json({ error: "Pengajuan tidak ditemukan." }, { status: 404 });
  if (found.application.citizenId !== access.user.id) return NextResponse.json({ error: "Anda tidak dapat mengubah pengajuan ini." }, { status: 403 });
  if (found.application.status !== "MENUNGGU_WARGA") return NextResponse.json({ error: "Dokumen hanya dapat diperbaiki pada tahap menunggu warga." }, { status: 409 });

  try {
    const form = await request.formData();
    const answersRaw = form.get("answers");
    const patchAnswers = typeof answersRaw === "string" ? JSON.parse(answersRaw) as Record<string, unknown> : {};
    const answers: Record<string, string> = { ...found.application.formData };
    for (const [key, value] of Object.entries(patchAnswers)) if (typeof value === "string") answers[key] = value.trim().slice(0, 1000);
    const uploads = new Map<string, File>();
    for (const [key, value] of form.entries()) {
      if (!key.startsWith("file:") || !(value instanceof File) || value.size === 0) continue;
      const requirementId = key.slice(5);
      if (!found.service.requirements.some((requirement) => requirement.id === requirementId) && requirementId !== "priority_evidence") {
        return NextResponse.json({ error: "Jenis dokumen tidak sesuai dengan layanan." }, { status: 400 });
      }
      if (uploads.has(requirementId)) return NextResponse.json({ error: "Dokumen yang sama dipilih lebih dari sekali." }, { status: 400 });
      const error = validateUpload(value, found.service.maxFileSizeMB);
      if (error) return NextResponse.json({ error: `${value.name}: ${error}` }, { status: 400 });
      uploads.set(requirementId, value);
    }
    if (!uploads.size) return NextResponse.json({ error: "Pilih setidaknya satu dokumen perbaikan." }, { status: 400 });
    const current = await db.select({ requirementId: applicationDocuments.requirementId }).from(applicationDocuments).where(and(eq(applicationDocuments.applicationId, found.application.id), eq(applicationDocuments.isCurrent, true)));
    const available = new Set([...current.map((item) => item.requirementId), ...uploads.keys()]);
    const missing = found.service.requirements.filter((requirement) => isRequiredRequirement(requirement, answers) && !available.has(requirement.id));
    const priorityEvidenceMissing = found.application.priorityRequested && found.service.priorityEvidenceReasons.includes(found.application.priorityReason ?? "") && !available.has("priority_evidence");
    if (missing.length || priorityEvidenceMissing) {
      const labels = [...missing.map((item) => item.label), ...(priorityEvidenceMissing ? ["Bukti prioritas"] : [])];
      return NextResponse.json({ error: `Masih ada dokumen yang belum tersedia: ${labels.join(", ")}.` }, { status: 400 });
    }
    const now = new Date();
    await db.transaction(async (tx) => {
      for (const [requirementId, file] of uploads) {
        const previous = await tx.select({ revision: applicationDocuments.revision }).from(applicationDocuments).where(and(eq(applicationDocuments.applicationId, found.application.id), eq(applicationDocuments.requirementId, requirementId))).orderBy(desc(applicationDocuments.revision)).limit(1);
        await tx.update(applicationDocuments).set({ isCurrent: false }).where(and(eq(applicationDocuments.applicationId, found.application.id), eq(applicationDocuments.requirementId, requirementId), eq(applicationDocuments.isCurrent, true)));
        await tx.insert(applicationDocuments).values({ applicationId: found.application.id, requirementId, originalName: safeFileName(file.name), mimeType: file.type, sizeBytes: file.size, content: Buffer.from(await file.arrayBuffer()), uploadedBy: access.user.id, revision: (previous[0]?.revision ?? 0) + 1, uploadedAt: now });
      }
      await tx.update(applications).set({ status: "MENUNGGU_VERIFIKASI", formData: answers, updatedAt: now }).where(eq(applications.id, found.application.id));
      await tx.insert(applicationEvents).values({ applicationId: found.application.id, actorId: access.user.id, eventType: "DOCUMENTS_RESUBMITTED", status: "MENUNGGU_VERIFIKASI", note: "Warga mengirim dokumen perbaikan. SLA tetap dijeda sampai verifikasi selesai.", metadata: { revisedRequirements: [...uploads.keys()] }, createdAt: now });
      await tx.insert(notifications).values({ userId: access.user.id, applicationId: found.application.id, title: "Dokumen perbaikan dikirim", body: "Dokumen revisi diterima dan akan diverifikasi petugas.", href: `/applications/${found.application.id}` });
    });
    return NextResponse.json({ ok: true, message: "Dokumen perbaikan berhasil dikirim." });
  } catch (error) {
    console.error("Document repair failed", error);
    return NextResponse.json({ error: "Dokumen perbaikan belum dapat dikirim. Coba kembali." }, { status: 400 });
  }
}
