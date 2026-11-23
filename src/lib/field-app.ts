/** Field Android app roles. Detected via Capacitor or ?app=field. */
export const FIELD_ROLES = ["sales", "logistics", "super_admin"] as const;

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
  return role === "sales" || role === "logistics" || role === "super_admin";
}

/** Nav URLs Super Admin gets in the field app — approvals + visit GPS check (no RBAC). */
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
  "Access denied. Only Sales, Logistics, and Super Admin can use this app.";
