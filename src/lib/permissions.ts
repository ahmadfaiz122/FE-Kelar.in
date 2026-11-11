import type { UserRole } from "@/db/schema";

export type Permission =
  | "application:create"
  | "application:read_own"
  | "application:update_own"
  | "application:upload_own_document"
  | "application:download_own_completed_letter"
  | "rating:create_own"
  | "application:read_assigned"
  | "application:verify"
  | "application:return_document"
  | "application:process"
  | "application:manage_priority"
  | "application:finalize"
  | "application:read_pending_approval"
  | "application:approve_rtrw"
  | "application:return_rtrw"
  | "application:return_lurah"
  | "application:return_camat"
  | "application:read_all"
  | "application:approve_lurah"
  | "staff:manage"
  | "analytics:read"
  | "reports:read"
  | "application:read_pending_camat"
  | "application:approve_camat"
  | "notification:read"
  | "profile:read";

const rolePermissions: Record<UserRole, Permission[]> = {
  WARGA: ["application:create", "application:read_own", "application:update_own", "application:upload_own_document", "application:download_own_completed_letter", "rating:create_own", "notification:read", "profile:read"],
  PETUGAS: ["application:read_assigned", "application:verify", "application:return_document", "application:process", "application:manage_priority", "application:finalize", "notification:read", "profile:read"],
  RTRW: ["application:read_pending_approval", "application:approve_rtrw", "application:return_rtrw", "notification:read", "profile:read"],
  LURAH: ["application:read_all", "application:approve_lurah", "application:return_lurah", "staff:manage", "analytics:read", "reports:read", "notification:read", "profile:read"],
  CAMAT: ["application:read_pending_camat", "application:approve_camat", "application:return_camat", "notification:read", "profile:read"],
};

export function hasPermission(role: UserRole, permission: Permission) {
  return rolePermissions[role].includes(permission);
}

export function permissionsFor(role: UserRole) {
  return rolePermissions[role];
}

export function roleDashboard(role: UserRole) {
  return {
    WARGA: "/dashboard",
    PETUGAS: "/staff/dashboard",
    RTRW: "/rtrw/dashboard",
    LURAH: "/lurah/dashboard",
    CAMAT: "/camat/dashboard",
  }[role];
}

export function canAccessPath(role: UserRole, path: string) {
  const normalized = path.split("?")[0];
  const allowed: Record<UserRole, string[]> = {
    WARGA: ["/dashboard", "/applications", "/notifications", "/profile"],
    PETUGAS: ["/staff", "/notifications", "/profile"],
    RTRW: ["/rtrw", "/notifications", "/profile"],
    LURAH: ["/lurah", "/notifications", "/profile"],
    CAMAT: ["/camat", "/notifications", "/profile"],
  };
  return allowed[role].some((prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`));
}
