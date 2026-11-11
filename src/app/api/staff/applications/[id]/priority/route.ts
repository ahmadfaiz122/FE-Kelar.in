import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { applicationEvents, applications, notifications } from "@/db/schema";
import { authorizeApi } from "@/lib/auth";
import { canManageAsStaff, findApplication } from "@/lib/application-access";
import { addPriorityHours } from "@/lib/dates";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const access = await authorizeApi("application:manage_priority");
  if ("response" in access) return access.response;
  const { id } = await context.params;
  const found = await findApplication(id);
  if (!found) return NextResponse.json({ error: "Pengajuan tidak ditemukan." }, { status: 404 });
  if (!canManageAsStaff(access.user, found.application)) return NextResponse.json({ error: "Pengajuan ditangani petugas lain." }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const decision = body.decision;
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 800) : "";
  if (!found.application.priorityRequested || !found.service.priorityEnabled) return NextResponse.json({ error: "Pengajuan ini tidak memiliki permintaan prioritas." }, { status: 409 });
  if (found.application.priorityStatus !== "MENUNGGU") return NextResponse.json({ error: "Permintaan prioritas sudah diputuskan." }, { status: 409 });
  if (!["approve", "decline"].includes(decision) || reason.length < 8) return NextResponse.json({ error: "Pilih keputusan dan sertakan alasan tertulis minimal 8 karakter." }, { status: 400 });
  const now = new Date();
  const approved = decision === "approve";
  const target = approved && found.application.slaStartedAt ? addPriorityHours(now, found.service.priorityTargetHours) : null;
  const status = approved ? "DISETUJUI" : "DITOLAK";
  await db.transaction(async (tx) => {
    await tx.update(applications).set({ priorityStatus: status, priorityDecisionReason: reason, priorityDecisionAt: now, priorityTargetAt: target, ...(target ? { dueAt: target } : {}), updatedAt: now }).where(eq(applications.id, found.application.id));
    await tx.insert(applicationEvents).values({ applicationId: found.application.id, actorId: access.user.id, eventType: approved ? "PRIORITY_APPROVED" : "PRIORITY_DECLINED", status: found.application.status, note: reason, metadata: { decision: status, previousDueAt: found.application.dueAt?.toISOString() ?? null, newDueAt: target?.toISOString() ?? null, priorityTargetHours: found.service.priorityTargetHours }, createdAt: now });
    await tx.insert(notifications).values({ userId: found.application.citizenId, applicationId: found.application.id, title: approved ? "Prioritas disetujui" : "Prioritas belum dapat disetujui", body: `${reason}${approved ? target ? ` Target prioritas ilustratif: ${new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "medium", timeStyle: "short" }).format(target)} WIB.` : " Target mulai dihitung setelah berkas terverifikasi." : " Pengajuan tetap diproses melalui antrean normal."}`, href: `/applications/${found.application.id}` });
  });
  return NextResponse.json({ ok: true, priorityStatus: status, targetAt: target?.toISOString() ?? null });
}
