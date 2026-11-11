import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { applicationDocuments, applications, services } from "@/db/schema";
import { authorizeApi } from "@/lib/auth";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const access = await authorizeApi(["application:read_own", "application:read_assigned", "application:read_pending_approval", "application:read_all", "application:read_pending_camat"]);
  if ("response" in access) return access.response;
  const { id } = await context.params;
  const [row] = await db.select({ document: applicationDocuments, application: applications, service: services }).from(applicationDocuments).innerJoin(applications, eq(applicationDocuments.applicationId, applications.id)).innerJoin(services, eq(applications.serviceId, services.id)).where(eq(applicationDocuments.id, id)).limit(1);
  if (!row) return NextResponse.json({ error: "Dokumen tidak ditemukan." }, { status: 404 });
  const app = row.application;
  const role = access.user.role;
  const allowed = role === "WARGA" ? app.citizenId === access.user.id
    : role === "PETUGAS" ? !app.assignedStaffId || app.assignedStaffId === access.user.id
      : role === "RTRW" ? app.assignedRtrwId === access.user.id
        : role === "LURAH" ? true
          : row.service.approvalStages.includes("CAMAT") && app.status === "MENUNGGU_CAMAT";
  if (!allowed) return NextResponse.json({ error: "Anda tidak dapat mengakses dokumen ini." }, { status: 403 });
  const disposition = `inline; filename*=UTF-8''${encodeURIComponent(row.document.originalName)}`;
  const content = new Blob([Uint8Array.from(row.document.content)], { type: row.document.mimeType });
  return new Response(content, { headers: { "Content-Type": row.document.mimeType, "Content-Length": String(row.document.sizeBytes), "Content-Disposition": disposition, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}
