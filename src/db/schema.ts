import {
  boolean,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => "bytea",
});

export type UserRole = "WARGA" | "PETUGAS" | "RTRW" | "LURAH" | "CAMAT";

export type ServiceRequirement = {
  id: string;
  label: string;
  required: boolean;
  reason: string;
  conditional?: { field: string; values: string[] };
};

export type ApprovalRole = "RTRW" | "LURAH" | "CAMAT";

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    fullName: varchar("full_name", { length: 180 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    role: varchar("role", { length: 24 }).$type<UserRole>().notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("users_role_idx").on(table.role)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("sessions_user_id_idx").on(table.userId), index("sessions_expiry_idx").on(table.expiresAt)],
);

export const services = pgTable(
  "services",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: varchar("code", { length: 48 }).notNull().unique(),
    name: varchar("name", { length: 180 }).notNull(),
    description: text("description").notNull(),
    category: varchar("category", { length: 80 }).notNull(),
    requirements: jsonb("requirements").$type<ServiceRequirement[]>().notNull(),
    approvalStages: jsonb("approval_stages").$type<ApprovalRole[]>().notNull(),
    slaBusinessDays: integer("sla_business_days").notNull().default(5),
    priorityEnabled: boolean("priority_enabled").notNull().default(false),
    priorityTargetHours: integer("priority_target_hours").notNull().default(8),
    priorityEvidenceReasons: jsonb("priority_evidence_reasons").$type<string[]>().notNull().default(["medical", "school_job_deadline", "legal"]),
    maxFileSizeMB: integer("max_file_size_mb").notNull().default(5),
    businessWeekdays: jsonb("business_weekdays").$type<number[]>().notNull().default([1, 2, 3, 4, 5]),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
);

export const applications = pgTable(
  "applications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    publicId: varchar("public_id", { length: 32 }).notNull().unique(),
    citizenId: uuid("citizen_id").notNull().references(() => users.id),
    serviceId: uuid("service_id").notNull().references(() => services.id),
    assignedStaffId: uuid("assigned_staff_id").references(() => users.id, { onDelete: "set null" }),
    assignedRtrwId: uuid("assigned_rtrw_id").references(() => users.id, { onDelete: "set null" }),
    status: varchar("status", { length: 40 }).notNull(),
    formData: jsonb("form_data").$type<Record<string, string>>().notNull().default({}),
    submittedAt: timestamp("submitted_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    verifiedAt: timestamp("verified_at", { withTimezone: true, mode: "date" }),
    slaStartedAt: timestamp("sla_started_at", { withTimezone: true, mode: "date" }),
    dueAt: timestamp("due_at", { withTimezone: true, mode: "date" }),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
    pausedAt: timestamp("paused_at", { withTimezone: true, mode: "date" }),
    accumulatedPauseDuration: integer("accumulated_pause_duration").notNull().default(0),
    delayReason: text("delay_reason"),
    progressNote: text("progress_note"),
    priorityRequested: boolean("priority_requested").notNull().default(false),
    priorityReason: varchar("priority_reason", { length: 60 }),
    priorityNote: text("priority_note"),
    priorityStatus: varchar("priority_status", { length: 32 }),
    priorityDecisionReason: text("priority_decision_reason"),
    priorityDecisionAt: timestamp("priority_decision_at", { withTimezone: true, mode: "date" }),
    priorityTargetAt: timestamp("priority_target_at", { withTimezone: true, mode: "date" }),
    letterData: bytea("letter_data"),
    letterFileName: varchar("letter_file_name", { length: 180 }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("applications_citizen_idx").on(table.citizenId, table.submittedAt),
    index("applications_status_idx").on(table.status, table.submittedAt),
    index("applications_staff_idx").on(table.assignedStaffId, table.status),
    index("applications_rtrw_idx").on(table.assignedRtrwId, table.status),
    index("applications_service_idx").on(table.serviceId),
  ],
);

export const applicationDocuments = pgTable(
  "application_documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    applicationId: uuid("application_id").notNull().references(() => applications.id, { onDelete: "cascade" }),
    requirementId: varchar("requirement_id", { length: 80 }).notNull(),
    originalName: varchar("original_name", { length: 255 }).notNull(),
    mimeType: varchar("mime_type", { length: 100 }).notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    content: bytea("content").notNull(),
    uploadedBy: uuid("uploaded_by").notNull().references(() => users.id),
    revision: integer("revision").notNull().default(1),
    isCurrent: boolean("is_current").notNull().default(true),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("application_documents_lookup_idx").on(table.applicationId, table.requirementId, table.isCurrent)],
);

export const applicationEvents = pgTable(
  "application_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    applicationId: uuid("application_id").notNull().references(() => applications.id, { onDelete: "cascade" }),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    eventType: varchar("event_type", { length: 60 }).notNull(),
    status: varchar("status", { length: 40 }),
    note: text("note"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("application_events_timeline_idx").on(table.applicationId, table.createdAt)],
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    applicationId: uuid("application_id").references(() => applications.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 180 }).notNull(),
    body: text("body").notNull(),
    href: varchar("href", { length: 255 }).notNull().default("/notifications"),
    readAt: timestamp("read_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("notifications_user_idx").on(table.userId, table.createdAt)],
);

export const ratings = pgTable(
  "ratings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    applicationId: uuid("application_id").notNull().unique().references(() => applications.id, { onDelete: "cascade" }),
    citizenId: uuid("citizen_id").notNull().references(() => users.id),
    handledStaffId: uuid("handled_staff_id").references(() => users.id, { onDelete: "set null" }),
    mayorId: uuid("mayor_id").references(() => users.id, { onDelete: "set null" }),
    stars: integer("stars").notNull(),
    category: varchar("category", { length: 32 }).notNull(),
    comment: text("comment"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("ratings_mayor_idx").on(table.mayorId), index("ratings_staff_idx").on(table.handledStaffId)],
);

export const systemAuditLogs = pgTable(
  "system_audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    action: varchar("action", { length: 80 }).notNull(),
    entityType: varchar("entity_type", { length: 80 }).notNull(),
    entityId: varchar("entity_id", { length: 80 }),
    beforeData: jsonb("before_data").$type<Record<string, unknown>>().notNull().default({}),
    afterData: jsonb("after_data").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("system_audit_actor_idx").on(table.actorId, table.createdAt), index("system_audit_entity_idx").on(table.entityType, table.entityId)],
);
