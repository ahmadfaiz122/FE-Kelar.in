import { and, asc, desc, eq, gte, inArray, isNull, lt, or } from "drizzle-orm";
import { db } from "@/db";
import { applicationDocuments, applicationEvents, applications, notifications, ratings, services, users } from "@/db/schema";
import type { SessionUser } from "@/lib/auth";
import type { UserRole } from "@/db/schema";
import { canViewApplication, findApplication } from "@/lib/application-access";
import { isLate } from "@/lib/dates";

export type ApplicationSummary = {
  id: string;
  publicId: string;
  status: string;
  serviceId: string;
  serviceCode: string;
  serviceName: string;
  category: string;
  requirements: typeof services.$inferSelect.requirements;
  approvalStages: typeof services.$inferSelect.approvalStages;
  slaBusinessDays: number;
  priorityTargetHours: number;
  maxFileSizeMB: number;
  citizenId: string;
  citizenName: string;
  citizenEmail: string;
  assignedStaffId: string | null;
  assignedStaffName: string | null;
  assignedRtrwId: string | null;
  submittedAt: string;
  verifiedAt: string | null;
  slaStartedAt: string | null;
  dueAt: string | null;
  completedAt: string | null;
  pausedAt: string | null;
  accumulatedPauseDuration: number;
  delayReason: string | null;
  progressNote: string | null;
  priorityRequested: boolean;
  priorityReason: string | null;
  priorityNote: string | null;
  priorityStatus: string | null;
  priorityDecisionReason: string | null;
  priorityTargetAt: string | null;
  formData: Record<string, string>;
};

const statusesForRole = (role: UserRole) => ({
  WARGA: undefined,
  PETUGAS: undefined,
  RTRW: undefined,
  LURAH: undefined,
  CAMAT: ["MENUNGGU_CAMAT"],
}[role]);

export async function loadApplications(user: SessionUser, options: { statuses?: string[]; limit?: number } = {}): Promise<ApplicationSummary[]> {
  const conditions = [];
  if (user.role === "WARGA") conditions.push(eq(applications.citizenId, user.id));
  if (user.role === "PETUGAS") conditions.push(or(isNull(applications.assignedStaffId), eq(applications.assignedStaffId, user.id))!);
  if (user.role === "RTRW") conditions.push(eq(applications.assignedRtrwId, user.id));
  if (user.role === "CAMAT") conditions.push(eq(applications.status, "MENUNGGU_CAMAT"));
  const allowedStatuses = options.statuses ?? statusesForRole(user.role);
  if (allowedStatuses?.length) conditions.push(inArray(applications.status, allowedStatuses));
  const rows = await db.select({
    id: applications.id,
    publicId: applications.publicId,
    status: applications.status,
    serviceId: services.id,
    serviceCode: services.code,
    serviceName: services.name,
    category: services.category,
    requirements: services.requirements,
    approvalStages: services.approvalStages,
    slaBusinessDays: services.slaBusinessDays,
    priorityTargetHours: services.priorityTargetHours,
    maxFileSizeMB: services.maxFileSizeMB,
    citizenId: applications.citizenId,
    citizenEmail: users.email,
    assignedStaffId: applications.assignedStaffId,
    assignedRtrwId: applications.assignedRtrwId,
    submittedAt: applications.submittedAt,
    verifiedAt: applications.verifiedAt,
    slaStartedAt: applications.slaStartedAt,
    dueAt: applications.dueAt,
    completedAt: applications.completedAt,
    pausedAt: applications.pausedAt,
    accumulatedPauseDuration: applications.accumulatedPauseDuration,
    delayReason: applications.delayReason,
    progressNote: applications.progressNote,
    priorityRequested: applications.priorityRequested,
    priorityReason: applications.priorityReason,
    priorityNote: applications.priorityNote,
    priorityStatus: applications.priorityStatus,
    priorityDecisionReason: applications.priorityDecisionReason,
    priorityTargetAt: applications.priorityTargetAt,
    formData: applications.formData,
  }).from(applications).innerJoin(services, eq(applications.serviceId, services.id)).innerJoin(users, eq(applications.citizenId, users.id)).where(and(...conditions)).orderBy(desc(applications.submittedAt)).limit(options.limit ?? 400);
  const assigneeIds = [...new Set(rows.map((row) => row.assignedStaffId).filter((id): id is string => Boolean(id)))];
  const assignees = assigneeIds.length ? await db.select({ id: users.id, fullName: users.fullName }).from(users).where(inArray(users.id, assigneeIds)) : [];
  const assigneeNames = new Map(assignees.map((person) => [person.id, person.fullName]));
  const summaries = rows.map((row) => ({
    ...row,
    citizenName: row.formData.fullName || row.citizenEmail,
    assignedStaffName: row.assignedStaffId ? assigneeNames.get(row.assignedStaffId) ?? null : null,
    submittedAt: row.submittedAt.toISOString(),
    verifiedAt: row.verifiedAt?.toISOString() ?? null,
    slaStartedAt: row.slaStartedAt?.toISOString() ?? null,
    dueAt: row.dueAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    pausedAt: row.pausedAt?.toISOString() ?? null,
    priorityTargetAt: row.priorityTargetAt?.toISOString() ?? null,
  }));
  return user.role === "CAMAT" ? summaries.filter((application) => application.approvalStages.includes("CAMAT")) : summaries;
}

export async function loadApplicationDetail(user: SessionUser, identifier: string) {
  const found = await findApplication(identifier);
  if (!found) return null;
  if (!canViewApplication(user, { ...found.application, service: found.service })) return "forbidden" as const;
  const [documents, events, ratingRows, stageActors] = await Promise.all([
    db.select({ id: applicationDocuments.id, requirementId: applicationDocuments.requirementId, originalName: applicationDocuments.originalName, mimeType: applicationDocuments.mimeType, sizeBytes: applicationDocuments.sizeBytes, revision: applicationDocuments.revision, isCurrent: applicationDocuments.isCurrent, uploadedAt: applicationDocuments.uploadedAt, uploadedBy: applicationDocuments.uploadedBy }).from(applicationDocuments).where(eq(applicationDocuments.applicationId, found.application.id)).orderBy(asc(applicationDocuments.uploadedAt)),
    db.select({ id: applicationEvents.id, eventType: applicationEvents.eventType, status: applicationEvents.status, note: applicationEvents.note, metadata: applicationEvents.metadata, createdAt: applicationEvents.createdAt, actorName: users.fullName, actorRole: users.role }).from(applicationEvents).leftJoin(users, eq(applicationEvents.actorId, users.id)).where(eq(applicationEvents.applicationId, found.application.id)).orderBy(asc(applicationEvents.createdAt)),
    db.select().from(ratings).where(eq(ratings.applicationId, found.application.id)).limit(1),
    db.select({ role: users.role, fullName: users.fullName, actorId: applicationEvents.actorId }).from(applicationEvents).leftJoin(users, eq(applicationEvents.actorId, users.id)).where(and(eq(applicationEvents.applicationId, found.application.id), inArray(applicationEvents.eventType, ["APPROVED_LURAH", "APPROVED_RTRW", "APPROVED_CAMAT"]))),
  ]);
  const staffName = found.application.assignedStaffId ? (await db.select({ fullName: users.fullName }).from(users).where(eq(users.id, found.application.assignedStaffId)).limit(1))[0]?.fullName ?? null : null;
  const summary: ApplicationSummary = {
    id: found.application.id,
    publicId: found.application.publicId,
    status: found.application.status,
    serviceId: found.service.id,
    serviceCode: found.service.code,
    serviceName: found.service.name,
    category: found.service.category,
    requirements: found.service.requirements,
    approvalStages: found.service.approvalStages,
    slaBusinessDays: found.service.slaBusinessDays,
    priorityTargetHours: found.service.priorityTargetHours,
    maxFileSizeMB: found.service.maxFileSizeMB,
    citizenId: found.application.citizenId,
    citizenName: found.application.formData.fullName || found.citizenName,
    citizenEmail: found.citizenEmail,
    assignedStaffId: found.application.assignedStaffId,
    assignedStaffName: staffName,
    assignedRtrwId: found.application.assignedRtrwId,
    submittedAt: found.application.submittedAt.toISOString(),
    verifiedAt: found.application.verifiedAt?.toISOString() ?? null,
    slaStartedAt: found.application.slaStartedAt?.toISOString() ?? null,
    dueAt: found.application.dueAt?.toISOString() ?? null,
    completedAt: found.application.completedAt?.toISOString() ?? null,
    pausedAt: found.application.pausedAt?.toISOString() ?? null,
    accumulatedPauseDuration: found.application.accumulatedPauseDuration,
    delayReason: found.application.delayReason,
    progressNote: found.application.progressNote,
    priorityRequested: found.application.priorityRequested,
    priorityReason: found.application.priorityReason,
    priorityNote: found.application.priorityNote,
    priorityStatus: found.application.priorityStatus,
    priorityDecisionReason: found.application.priorityDecisionReason,
    priorityTargetAt: found.application.priorityTargetAt?.toISOString() ?? null,
    formData: found.application.formData,
  };
  return { application: summary, documents: documents.map((document) => ({ ...document, uploadedAt: document.uploadedAt.toISOString() })), timeline: events.map((event) => ({ ...event, createdAt: event.createdAt.toISOString() })), rating: ratingRows[0] ?? null, approvalActors: stageActors, citizenName: found.citizenName };
}

function avg(values: number[]) { return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null; }

export async function loadLurahAnalytics(user: SessionUser) {
  const allApplications = await loadApplications(user, { limit: 1200 });
  const allRatings = await db.select({ stars: ratings.stars, category: ratings.category, mayorId: ratings.mayorId, handledStaffId: ratings.handledStaffId, createdAt: ratings.createdAt }).from(ratings).orderBy(desc(ratings.createdAt)).limit(3000);
  const completed = allApplications.filter((application) => application.status === "SELESAI" && application.completedAt);
  const onTime = completed.filter((application) => application.dueAt && new Date(application.completedAt!).getTime() <= new Date(application.dueAt).getTime());
  const processingHours = completed.map((application) => Math.max(0, (new Date(application.completedAt!).getTime() - new Date(application.slaStartedAt ?? application.submittedAt).getTime()) / 3_600_000));
  const currentMonth = new Date();
  const currentStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
  const previousStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
  const previousTotal = allApplications.filter((application) => { const date = new Date(application.submittedAt); return date >= previousStart && date < currentStart; }).length;
  const currentTotal = allApplications.filter((application) => new Date(application.submittedAt) >= currentStart).length;
  const trend = Array.from({ length: 6 }, (_, index) => {
    const month = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - (5 - index), 1);
    const total = allApplications.filter((application) => { const date = new Date(application.submittedAt); return date.getFullYear() === month.getFullYear() && date.getMonth() === month.getMonth(); }).length;
    return { label: new Intl.DateTimeFormat("id-ID", { month: "short" }).format(month), total };
  });
  const completedAverageHours = avg(processingHours);
  const globalStars = allRatings.map((rating) => rating.stars);
  const mayorStars = allRatings.filter((rating) => rating.mayorId === user.id).map((rating) => rating.stars);
  const lateApplications = allApplications.filter((application) => application.status !== "SELESAI" && isLate(application.dueAt, application.completedAt));
  const approvalsWaiting = allApplications.filter((application) => ["MENUNGGU_RTRW", "MENUNGGU_LURAH", "MENUNGGU_CAMAT"].includes(application.status));
  const distributions = [5, 4, 3, 2, 1].map((stars) => ({ stars, count: globalStars.filter((value) => value === stars).length }));
  return {
    totals: {
      applications: allApplications.length,
      completed: completed.length,
      late: lateApplications.length,
      waitingApproval: approvalsWaiting.length,
      onTimePercent: completed.length ? Math.round(onTime.length / completed.length * 100) : null,
      previousMonthChange: previousTotal ? Math.round((currentTotal - previousTotal) / previousTotal * 100) : null,
      currentMonth: currentTotal,
      averageDays: completedAverageHours === null ? null : Math.round(completedAverageHours / 24 * 10) / 10,
    },
    rating: {
      overall: avg(globalStars) === null ? null : Math.round(avg(globalStars)! * 10) / 10,
      count: globalStars.length,
      mayor: avg(mayorStars) === null ? null : Math.round(avg(mayorStars)! * 10) / 10,
      mayorCount: mayorStars.length,
      distribution: distributions,
      categories: ["kecepatan", "keramahan", "kejelasan"].map((category) => ({ category, count: allRatings.filter((rating) => rating.category === category).length })),
    },
    trend,
    lateApplications,
    approvalsWaiting,
  };
}

export async function loadAccountNotifications(userId: string) {
  const rows = await db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt)).limit(200);
  return rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString(), readAt: row.readAt?.toISOString() ?? null }));
}
