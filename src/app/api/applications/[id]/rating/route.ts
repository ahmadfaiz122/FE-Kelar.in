import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { applicationEvents, applications, notifications, ratings } from "@/db/schema";
import { authorizeApi } from "@/lib/auth";

const categories = new Set(["kecepatan", "keramahan", "kejelasan"]);

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const access = await authorizeApi("rating:create_own");
  if ("response" in access) return access.response;
  const { id } = await context.params;
  const [application] = await db.select().from(applications).where(eq(applications.id, id)).limit(1);
  if (!application) return NextResponse.json({ error: "Pengajuan tidak ditemukan." }, { status: 404 });
  if (application.citizenId !== access.user.id) return NextResponse.json({ error: "Hanya pemilik pengajuan yang dapat memberi rating." }, { status: 403 });
  if (application.status !== "SELESAI") return NextResponse.json({ error: "Rating tersedia setelah pengajuan selesai." }, { status: 409 });
  const body = await request.json().catch(() => ({}));
  const stars = Number(body.stars);
  const category = typeof body.category === "string" ? body.category : "";
  const comment = typeof body.comment === "string" ? body.comment.trim().slice(0, 500) : "";
  if (!Number.isInteger(stars) || stars < 1 || stars > 5 || !categories.has(category)) return NextResponse.json({ error: "Pilih bintang 1–5 dan kategori komentar." }, { status: 400 });
  const existing = await db.select({ id: ratings.id }).from(ratings).where(eq(ratings.applicationId, application.id)).limit(1);
  if (existing.length) return NextResponse.json({ error: "Rating untuk pengajuan ini sudah pernah dikirim." }, { status: 409 });
  const [mayorEvent] = await db.select({ actorId: applicationEvents.actorId }).from(applicationEvents).where(and(eq(applicationEvents.applicationId, application.id), eq(applicationEvents.eventType, "APPROVED_LURAH"))).orderBy(desc(applicationEvents.createdAt)).limit(1);
  try {
    await db.transaction(async (tx) => {
      await tx.insert(ratings).values({ applicationId: application.id, citizenId: access.user.id, handledStaffId: application.assignedStaffId, mayorId: mayorEvent?.actorId ?? null, stars, category, comment: comment || null });
      await tx.insert(applicationEvents).values({ applicationId: application.id, actorId: access.user.id, eventType: "RATING_SUBMITTED", status: application.status, note: `Warga memberi nilai ${stars}/5 pada kategori ${category}.`, metadata: { stars, category }, createdAt: new Date() });
      await tx.insert(notifications).values({ userId: access.user.id, applicationId: application.id, title: "Terima kasih atas penilaian Anda", body: "Masukan Anda membantu meningkatkan keterbukaan dan mutu pelayanan.", href: `/applications/${application.id}` });
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Rating untuk pengajuan ini sudah tercatat." }, { status: 409 });
  }
}
