import { and, eq, or } from "drizzle-orm";
import { db } from "@/db";
import { applications, services, users } from "@/db/schema";
import type { SessionUser } from "@/lib/auth";

export async function findApplication(identifier: string) {
  const looksLikeUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(identifier);
  const where = looksLikeUuid
    ? or(eq(applications.id, identifier), eq(applications.publicId, identifier))
    : eq(applications.publicId, identifier);
  const rows = await db
    .select({ application: applications, service: services, citizenName: users.fullName, citizenEmail: users.email })
    .from(applications)
    .innerJoin(services, eq(applications.serviceId, services.id))
    .innerJoin(users, eq(applications.citizenId, users.id))
    .where(where)
    .limit(1);
  return rows[0] ?? null;
}

export function canViewApplication(user: SessionUser, app: { citizenId: string; assignedStaffId: string | null; assignedRtrwId: string | null; status: string; service: { approvalStages: string[] } }) {
  switch (user.role) {
    case "WARGA": return app.citizenId === user.id;
    case "PETUGAS": return app.assignedStaffId === null || app.assignedStaffId === user.id;
    case "RTRW": return app.assignedRtrwId === user.id;
    case "LURAH": return true;
    case "CAMAT": return app.service.approvalStages.includes("CAMAT") && app.status === "MENUNGGU_CAMAT";
  }
}

export function canManageAsStaff(user: SessionUser, app: { assignedStaffId: string | null }) {
  return user.role === "PETUGAS" && (!app.assignedStaffId || app.assignedStaffId === user.id);
}

export function isSafeRoleStage(role: string, status: string) {
  return (role === "RTRW" && status === "MENUNGGU_RTRW") ||
    (role === "LURAH" && status === "MENUNGGU_LURAH") ||
    (role === "CAMAT" && status === "MENUNGGU_CAMAT");
}
