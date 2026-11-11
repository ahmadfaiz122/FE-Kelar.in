import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { applicationEvents, applications, notifications } from "@/db/schema";
import { authorizeApi } from "@/lib/auth";
import { canManageAsStaff, findApplication } from "@/lib/application-access";
import { addBusinessDays } from "@/lib/dates";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const access = await authorizeApi("application:process");
  if ("response" in access) return access.response;
  const { id } = await context.params;
  const found = await findApplication(id);
  if (!found) return NextResponse.json({ error: "Pengajuan tidak ditemukan." }, { status: 404 });
  if (!canManageAsStaff(access.user, found.application)) return NextResponse.json({ error: "Pengajuan ditangani petugas lain." }, { status: 403 });
  if (!found.application.slaStartedAt || found.application.status === "SELESAI") return NextResponse.json({ error: "Estimasi belum berjalan atau pengajuan telah selesai." }, { status: 409 });
  const body = await request.json().catch(() => ({}));
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 800) : "";
  const days = Number(body.extensionBusinessDays ?? 1);
  if (reason.length < 8 || !Number.isInteger(days) || days < 1 || days > 30) return NextResponse.json({ error: "Alasan wajib diisi dan penyesuaian harus 1–30 hari kerja." }, { status: 400 });
  const oldDueAt = found.application.dueAt;
  const base = oldDueAt && oldDueAt > new Date() ? oldDueAt : new Date();
  const dueAt = addBusinessDays(base, days, found.service.businessWeekdays);
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx.update(applications).set({ dueAt, delayReason: reason, updatedAt: now }).where(eq(applications.id, found.application.id));
    await tx.insert(applicationEvents).values({ applicationId: found.application.id, actorId: access.user.id, eventType: "SLA_UPDATED", status: found.application.status, note: reason, metadata: { previousDueAt: oldDueAt?.toISOString() ?? null, newDueAt: dueAt.toISOString(), extensionBusinessDays: days }, createdAt: now });
    await tx.insert(notifications).values({ userId: found.application.citizenId, applicationId: found.application.id, title: "Estimasi pelayanan diperbarui", body: `${reason} Estimasi terbaru: ${new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "medium", timeStyle: "short" }).format(dueAt)} WIB.`, href: `/applications/${found.application.id}` });
  });
  return NextResponse.json({ ok: true, dueAt: dueAt.toISOString() });
}
