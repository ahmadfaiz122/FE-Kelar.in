import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { applicationDocuments, applicationEvents, ratings, users } from "@/db/schema";
import { authorizeApi } from "@/lib/auth";
import { canViewApplication, findApplication } from "@/lib/application-access";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const access = await authorizeApi(["application:read_own", "application:read_assigned", "application:read_pending_approval", "application:read_all", "application:read_pending_camat"]);
  if ("response" in access) return access.response;
  const { id } = await context.params;
  const result = await findApplication(id);
  if (!result) return NextResponse.json({ error: "Pengajuan tidak ditemukan." }, { status: 404 });
  if (!canViewApplication(access.user, { ...result.application, service: result.service })) return NextResponse.json({ error: "Anda tidak dapat melihat pengajuan ini." }, { status: 403 });
  const [documents, timeline, rating] = await Promise.all([
    db.select({ id: applicationDocuments.id, requirementId: applicationDocuments.requirementId, originalName: applicationDocuments.originalName, mimeType: applicationDocuments.mimeType, sizeBytes: applicationDocuments.sizeBytes, revision: applicationDocuments.revision, isCurrent: applicationDocuments.isCurrent, uploadedAt: applicationDocuments.uploadedAt }).from(applicationDocuments).where(eq(applicationDocuments.applicationId, result.application.id)).orderBy(desc(applicationDocuments.uploadedAt)),
    db.select({ event: applicationEvents, actorName: users.fullName }).from(applicationEvents).leftJoin(users, eq(applicationEvents.actorId, users.id)).where(eq(applicationEvents.applicationId, result.application.id)).orderBy(desc(applicationEvents.createdAt)),
    db.select().from(ratings).where(eq(ratings.applicationId, result.application.id)).limit(1),
  ]);
  const { letterData: _letterData, ...safeApplication } = result.application;
  return NextResponse.json({ application: safeApplication, service: result.service, citizenName: result.citizenName, documents, timeline, rating: rating[0] ?? null });
}
