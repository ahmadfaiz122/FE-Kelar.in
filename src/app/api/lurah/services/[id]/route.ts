import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { services, systemAuditLogs } from "@/db/schema";
import { authorizeApi } from "@/lib/auth";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const access = await authorizeApi("analytics:read");
  if ("response" in access) return access.response;
  const { id } = await context.params;
  const [service] = await db.select().from(services).where(eq(services.id, id)).limit(1);
  if (!service) return NextResponse.json({ error: "Layanan tidak ditemukan." }, { status: 404 });
  const body = await request.json().catch(() => ({}));
  const slaBusinessDays = Number(body.slaBusinessDays);
  const priorityTargetHours = Number(body.priorityTargetHours);
  const maxFileSizeMB = Number(body.maxFileSizeMB);
  const businessWeekdays: number[] = Array.isArray(body.businessWeekdays) ? (body.businessWeekdays as unknown[]).map((day) => Number(day)) : service.businessWeekdays;
  if (!Number.isInteger(slaBusinessDays) || slaBusinessDays < 1 || slaBusinessDays > 30 || !Number.isInteger(priorityTargetHours) || priorityTargetHours < 1 || priorityTargetHours > 72 || !Number.isInteger(maxFileSizeMB) || maxFileSizeMB < 1 || maxFileSizeMB > 20 || !businessWeekdays.length || businessWeekdays.some((day: number) => !Number.isInteger(day) || day < 0 || day > 6)) {
    return NextResponse.json({ error: "SLA (1–30 hari), target prioritas (1–72 jam), ukuran file (1–20 MB), atau kalender hari kerja tidak valid." }, { status: 400 });
  }
  const uniqueWeekdays = [...new Set(businessWeekdays)].sort();
  const before = { slaBusinessDays: service.slaBusinessDays, priorityTargetHours: service.priorityTargetHours, maxFileSizeMB: service.maxFileSizeMB, businessWeekdays: service.businessWeekdays };
  const after = { slaBusinessDays, priorityTargetHours, maxFileSizeMB, businessWeekdays: uniqueWeekdays };
  await db.transaction(async (tx) => {
    await tx.update(services).set(after).where(eq(services.id, id));
    await tx.insert(systemAuditLogs).values({ actorId: access.user.id, action: "SERVICE_SLA_UPDATED", entityType: "service", entityId: id, beforeData: before, afterData: after });
  });
  return NextResponse.json({ ok: true, service: { ...service, ...after } });
}
