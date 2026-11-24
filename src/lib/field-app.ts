import { hasUserPermission, type UserProfile } from "./auth-service";

/**
 * Field Android app roles.
 * Detected via Capacitor native shell or `?app=field` on the hosted web URL.
 */
/** Field app: Sales, Logistics, Supervisor (support manager), Super Admin. */
export const FIELD_ROLES = ["sales", "logistics", "supervisor", "super_admin"] as const;

export type FieldRole = (typeof FIELD_ROLES)[number];

export function isFieldApp(): boolean {
  if (typeof window === "undefined") return false;
  if (import.meta.env["VITE_FIELD_APP"] === "true") return true;
  try {
    if (new URLSearchParams(window.location.search).get("app") === "field") return true;
  } catch {
    /* ignore */
  }
  const cap = (window as Window & { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return Boolean(cap?.isNativePlatform?.());
}

export function isFieldRole(role: string | undefined | null): role is FieldRole {
  return (
    role === "sales" ||
    role === "logistics" ||
    role === "supervisor" ||
    role === "super_admin"
  );
}

/**
 * Field app access by sticky base role.
 * (Legacy custom packs with field/logistics perms still allowed until migrated.)
 */
export function canUseFieldApp(profile: UserProfile | null | undefined): boolean {
  if (!profile) return false;
  if (isFieldRole(profile.role)) return true;
  return (
    hasUserPermission(profile, "field_visits.conduct") ||
    hasUserPermission(profile, "field_visits.schedule") ||
    hasUserPermission(profile, "logistics.deliver") ||
    hasUserPermission(profile, "logistics.dispatch")
  );
}

/**
 * Nav URLs Super Admin gets in the field app:
 * order approvals + sales visit GPS review (no RBAC / admin console).
 */
export const FIELD_ADMIN_URLS = ["/orders", "/field-visits"] as const;

export function isFieldAdminNavUrl(url: string): boolean {
  return (
    url === "/orders" ||
    url.startsWith("/orders/") ||
    url === "/field-visits" ||
    url.startsWith("/field-visits/")
  );
}

export const FIELD_APP_LOGIN_ERROR =
  "Access denied. Only Sales, Logistics, Supervisor, and Super Admin can use this app.";
