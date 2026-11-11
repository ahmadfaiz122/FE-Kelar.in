import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { applicationEvents, applications, notifications, users } from "@/db/schema";
import { authorizeApi } from "@/lib/auth";
import type { Permission } from "@/lib/permissions";
import { hasPermission } from "@/lib/permissions";
import { findApplication, isSafeRoleStage } from "@/lib/application-access";
import { nextApprovalStatus } from "@/lib/application-helpers";
import type { ApprovalRole } from "@/db/schema";

const approvalPermission: Record<ApprovalRole, Permission> = {
  RTRW: "application:approve_rtrw",
  LURAH: "application:approve_lurah",
  CAMAT: "application:approve_camat",
};
const returnPermission: Record<ApprovalRole, Permission> = {
  RTRW: "application:return_rtrw",
  LURAH: "application:return_lurah",
  CAMAT: "application:return_camat",
};

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const access = await authorizeApi(["application:approve_rtrw", "application:approve_lurah", "application:approve_camat", "application:return_rtrw", "application:return_lurah", "application:return_camat"]);
  if ("response" in access) return access.response;
  if (!["RTRW", "LURAH", "CAMAT"].includes(access.user.role)) return NextResponse.json({ error: "Role ini tidak memiliki kewenangan persetujuan." }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const action = body.action;
  if (action !== "approve" && action !== "return") return NextResponse.json({ error: "Pilih aksi setujui atau kembalikan." }, { status: 400 });
  const stage = access.user.role as ApprovalRole;
  if (!hasPermission(access.user.role, action === "return" ? returnPermission[stage] : approvalPermission[stage])) return NextResponse.json({ error: "Anda tidak memiliki izin untuk aksi ini." }, { status: 403 });
  const note = typeof body.reason === "string" ? body.reason.trim().slice(0, 800) : "";
  if (action === "return" && note.length < 8) return NextResponse.json({ error: "Alasan pengembalian wajib diisi (minimal 8 karakter)." }, { status: 400 });

  const { id } = await context.params;
  const found = await findApplication(id);
  if (!found) return NextResponse.json({ error: "Pengajuan tidak ditemukan." }, { status: 404 });
  const app = found.application;
  if (!isSafeRoleStage(stage, app.status) || !found.service.approvalStages.includes(stage)) return NextResponse.json({ error: "Pengajuan ini tidak sedang menunggu persetujuan Anda." }, { status: 403 });
  if (stage === "RTRW" && app.assignedRtrwId !== access.user.id) return NextResponse.json({ error: "Pengajuan ini tidak ditujukan kepada RT/RW Anda." }, { status: 403 });

  const now = new Date();
  const nextStatus = action === "return" ? "MENUNGGU_WARGA" : nextApprovalStatus(found.service.approvalStages, stage);
  const detail = action === "return" ? note : note || `Persetujuan tahap ${stage} berhasil dicatat.`;
  let nextRole: "LURAH" | "CAMAT" | "PETUGAS" | null = null;
  if (nextStatus === "MENUNGGU_LURAH") nextRole = "LURAH";
  if (nextStatus === "MENUNGGU_CAMAT") nextRole = "CAMAT";
  if (nextStatus === "FINALISASI") nextRole = "PETUGAS";
  const recipientRows = nextStatus === "MENUNGGU_WARGA"
    ? [{ id: app.citizenId }]
    : nextRole ? await db.select({ id: users.id }).from(users).where(eq(users.role, nextRole)) : [];

  await db.transaction(async (tx) => {
    await tx.update(applications).set({ status: nextStatus, pausedAt: action === "return" && app.slaStartedAt && !app.pausedAt ? now : app.pausedAt, progressNote: detail, updatedAt: now }).where(eq(applications.id, app.id));
    await tx.insert(applicationEvents).values({ applicationId: app.id, actorId: access.user.id, eventType: action === "return" ? `RETURNED_${stage}` : `APPROVED_${stage}`, status: nextStatus, note: detail, metadata: { stage, decidedAt: now.toISOString() }, createdAt: now });
    await tx.insert(notifications).values([
      { userId: app.citizenId, applicationId: app.id, title: action === "return" ? "Perlu tindak lanjut warga" : `Persetujuan ${stage} berhasil`, body: action === "return" ? `${detail} Waktu SLA dijeda sampai dokumen diverifikasi kembali.` : `${detail}${nextStatus === "FINALISASI" ? " Surat menunggu finalisasi petugas." : " Pengajuan bergerak ke tahap berikutnya."}`, href: `/applications/${app.id}` },
      ...recipientRows.filter((row) => row.id !== app.citizenId).map((row) => ({ userId: row.id, applicationId: app.id, title: nextStatus === "FINALISASI" ? "Surat siap difinalisasi" : "Persetujuan baru menunggu", body: `${app.publicId} · ${found.service.name}`, href: nextStatus === "FINALISASI" ? "/staff/finalization" : nextStatus === "MENUNGGU_LURAH" ? "/lurah/approvals" : nextStatus === "MENUNGGU_CAMAT" ? "/camat/approvals" : "/staff/processing" })),
    ]);
  });
  return NextResponse.json({ ok: true, status: nextStatus, message: detail });
}
