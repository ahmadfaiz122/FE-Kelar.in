import { and, eq } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { applicationDocuments, applicationEvents, applications, notifications, services, users } from "@/db/schema";
import { authorizeApi } from "@/lib/auth";
import { loadApplications } from "@/lib/data";
import { priorityReasons } from "@/lib/catalog";
import { isRequiredRequirement } from "@/lib/format";
import { safeFileName, validateUpload } from "@/lib/validate-upload";
import { ensureDemoData } from "@/lib/seed";

export const runtime = "nodejs";

export async function GET() {
  const access = await authorizeApi(["application:read_own", "application:read_assigned", "application:read_pending_approval", "application:read_all", "application:read_pending_camat"]);
  if ("response" in access) return access.response;
  const rows = await loadApplications(access.user, { limit: 500 });
  return NextResponse.json({ applications: rows });
}

export async function POST(request: Request) {
  const access = await authorizeApi("application:create");
  if ("response" in access) return access.response;
  try {
    await ensureDemoData();
    const form = await request.formData();
    const serviceId = String(form.get("serviceId") ?? "");
    const answerText = form.get("answers");
    let answers: Record<string, string>;
    try {
      const parsed = JSON.parse(typeof answerText === "string" ? answerText : "{}");
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("invalid");
      answers = Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === "string").map(([key, value]) => [key, value.trim().slice(0, 1000)]));
    } catch {
      return NextResponse.json({ error: "Data formulir tidak valid." }, { status: 400 });
    }
    const fullName = answers.fullName?.trim();
    const address = answers.address?.trim();
    const purpose = answers.purpose?.trim();
    if (!fullName || fullName.length < 2 || fullName.length > 180 || !address || address.length < 5 || !purpose || purpose.length < 3) {
      return NextResponse.json({ error: "Nama, alamat, dan keperluan wajib diisi dengan benar." }, { status: 400 });
    }
    const [service] = await db.select().from(services).where(and(eq(services.id, serviceId), eq(services.isActive, true))).limit(1);
    if (!service) return NextResponse.json({ error: "Layanan yang dipilih tidak tersedia." }, { status: 404 });

    const uploaded = new Map<string, File>();
    for (const [key, value] of form.entries()) {
      if (!key.startsWith("file:") || !(value instanceof File) || value.size === 0) continue;
      const requirementId = key.slice(5);
      if (uploaded.has(requirementId)) return NextResponse.json({ error: "Ada dokumen yang diunggah lebih dari satu kali." }, { status: 400 });
      const isKnown = service.requirements.some((item) => item.id === requirementId) || requirementId === "priority_evidence";
      if (!isKnown) return NextResponse.json({ error: "Jenis dokumen tidak sesuai dengan layanan." }, { status: 400 });
      const error = validateUpload(value, service.maxFileSizeMB);
      if (error) return NextResponse.json({ error: `${value.name}: ${error}` }, { status: 400 });
      uploaded.set(requirementId, value);
    }
    const required = service.requirements.filter((item) => isRequiredRequirement(item, answers));
    const missing = required.filter((item) => !uploaded.has(item.id));
    if (missing.length) return NextResponse.json({ error: `Lengkapi dokumen: ${missing.map((item) => item.label).join(", ")}.` }, { status: 400 });

    const priorityRequested = form.get("priorityRequested") === "true";
    const priorityReason = typeof form.get("priorityReason") === "string" ? String(form.get("priorityReason")) : "";
    const priorityNote = typeof form.get("priorityNote") === "string" ? String(form.get("priorityNote")).trim().slice(0, 500) : "";
    if (priorityRequested && !service.priorityEnabled) return NextResponse.json({ error: "Layanan ini tidak menyediakan antrean prioritas." }, { status: 400 });
    if (priorityRequested && !priorityReasons.some((item) => item.id === priorityReason)) return NextResponse.json({ error: "Pilih alasan pengajuan prioritas." }, { status: 400 });
    if (priorityRequested && priorityReason === "other" && priorityNote.length < 8) return NextResponse.json({ error: "Jelaskan kebutuhan prioritas lainnya (minimal 8 karakter)." }, { status: 400 });
    const evidenceRequired = priorityRequested && service.priorityEvidenceReasons.includes(priorityReason);
    if (evidenceRequired && !uploaded.has("priority_evidence")) return NextResponse.json({ error: "Alasan prioritas ini memerlukan dokumen bukti pendukung." }, { status: 400 });
    if (!priorityRequested) uploaded.delete("priority_evidence");

    const [rtrw] = await db.select({ id: users.id }).from(users).where(and(eq(users.role, "RTRW"), eq(users.isActive, true))).limit(1);
    const publicId = `KL-${new Date().getFullYear()}-${randomBytes(3).toString("hex").toUpperCase()}`;
    const now = new Date();
    const created = await db.transaction(async (tx) => {
      const [application] = await tx.insert(applications).values({
        publicId,
        citizenId: access.user.id,
        serviceId: service.id,
        assignedRtrwId: rtrw?.id ?? null,
        status: "MENUNGGU_VERIFIKASI",
        formData: { ...answers, fullName, address, purpose, ...(priorityRequested ? { priorityReason } : {}) },
        submittedAt: now,
        priorityRequested,
        priorityReason: priorityRequested ? priorityReason : null,
        priorityNote: priorityRequested ? priorityNote || null : null,
        priorityStatus: priorityRequested ? "MENUNGGU" : null,
        createdAt: now,
        updatedAt: now,
      }).returning();
      for (const [requirementId, file] of uploaded) {
        const content = Buffer.from(await file.arrayBuffer());
        await tx.insert(applicationDocuments).values({ applicationId: application.id, requirementId, originalName: safeFileName(file.name), mimeType: file.type, sizeBytes: file.size, content, uploadedBy: access.user.id, revision: 1 });
      }
      await tx.insert(applicationEvents).values({ applicationId: application.id, actorId: access.user.id, eventType: "SUBMITTED", status: application.status, note: "Pengajuan berhasil dikirim. SLA dimulai setelah seluruh dokumen diverifikasi.", metadata: { submittedAt: now.toISOString() }, createdAt: now });
      await tx.insert(notifications).values([
        { userId: access.user.id, applicationId: application.id, title: "Pengajuan berhasil dikirim", body: `${service.name} (${publicId}) masuk ke antrean verifikasi. Estimasi dimulai setelah berkas dinyatakan lengkap.`, href: `/applications/${application.id}` },
        ...(await tx.select({ id: users.id }).from(users).where(and(eq(users.role, "PETUGAS"), eq(users.isActive, true)))).map((staff) => ({ userId: staff.id, applicationId: application.id, title: "Pengajuan baru masuk", body: `${publicId} menunggu verifikasi berkas.`, href: "/staff/verification" })),
      ]);
      return application;
    });
    return NextResponse.json({ ok: true, application: { id: created.id, publicId: created.publicId, status: created.status } }, { status: 201 });
  } catch (error) {
    console.error("Application submission failed", error);
    return NextResponse.json({ error: "Pengajuan belum dapat dikirim. Periksa berkas dan coba kembali." }, { status: 500 });
  }
}
