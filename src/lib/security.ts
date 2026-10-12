import { supabase } from "./supabase";
import {
  hasUserPermission,
  profileFromAuth,
  type RoleType,
  type UserProfile,
} from "./auth-service";
import { isDemoAuthEnabled } from "./demo-auth";

export { isDemoAuthEnabled } from "./demo-auth";

/** In-memory demo actor for DEV-only local sessions (never used in production builds). */
let demoActor: UserProfile | null = null;

export function setDemoActor(user: UserProfile | null) {
  demoActor = isDemoAuthEnabled() ? user : null;
}

export function getDemoActor(): UserProfile | null {
  return isDemoAuthEnabled() ? demoActor : null;
}

const LOGIN_WINDOW_MS = 60_000;
const LOGIN_MAX_ATTEMPTS = 8;
const loginAttempts = new Map<string, { count: number; startedAt: number }>();

export function assertLoginRateLimit(key: string): { ok: true } | { ok: false; error: string } {
  const now = Date.now();
  const normalized = key.trim().toLowerCase() || "unknown";
  const current = loginAttempts.get(normalized);
  if (!current || now - current.startedAt > LOGIN_WINDOW_MS) {
    loginAttempts.set(normalized, { count: 1, startedAt: now });
    return { ok: true };
  }
  current.count += 1;
  if (current.count > LOGIN_MAX_ATTEMPTS) {
    return {
      ok: false,
      error: "Too many login attempts. Please wait a minute and try again.",
    };
  }
  return { ok: true };
}

export function clearLoginRateLimit(key: string) {
  loginAttempts.delete(key.trim().toLowerCase());
}

export async function getAuthProfile(): Promise<UserProfile | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return profileFromAuth(data.user);
}

/**
 * Enforce permission using the live Supabase Auth session (not UI state).
 * Demo/local sessions without Auth are allowed only when demo auth is enabled.
 */
export async function requirePermission(permission: string): Promise<UserProfile> {
  const sessionUser = await getAuthProfile();
  if (sessionUser) {
    const status = String(
      (await supabase.auth.getUser()).data.user?.user_metadata?.["status"] || "Active",
    );
    if (status.toLowerCase() === "inactive") {
      throw new Error("This account is inactive.");
    }
    if (!hasUserPermission(sessionUser, permission)) {
      throw new Error(`Not authorized for "${permission}".`);
    }
    return sessionUser;
  }

  const local = getDemoActor();
  if (local) {
    if (!hasUserPermission(local, permission)) {
      throw new Error(`Not authorized for "${permission}".`);
    }
    return local;
  }

  throw new Error("Authentication required. Sign in with a valid account to continue.");
}

export async function requireRole(roles: RoleType[]): Promise<UserProfile> {
  const sessionUser = await getAuthProfile();
  const user = sessionUser || getDemoActor();
  if (!user) {
    throw new Error("Authentication required. Sign in with a valid account to continue.");
  }
  if (user.role !== "super_admin" && !roles.includes(user.role)) {
    throw new Error(`Not authorized. Requires one of: ${roles.join(", ")}`);
  }
  return user;
}

export async function requireSuperAdmin(): Promise<UserProfile> {
  return requireRole(["super_admin"]);
}

/** Allow if the actor has any of the listed permissions. */
export async function requireAnyPermission(permissions: string[]): Promise<UserProfile> {
  const sessionUser = await getAuthProfile();
  const user = sessionUser || getDemoActor();
  if (!user) {
    throw new Error("Authentication required. Sign in with a valid account to continue.");
  }
  if (permissions.some((permission) => hasUserPermission(user, permission))) {
    return user;
  }
  throw new Error(`Not authorized for any of: ${permissions.join(", ")}`);
}

/** Security headers applied to HTML/API responses from the app server. */
export const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(self), geolocation=(self)",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; "),
};

export function withSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    if (!headers.has(key)) headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
