import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { type CompanyId, type ThemeMode, companies, resolveMode } from "@/lib/workspace-data";
import { supabase } from "@/lib/supabase";
import {
  type UserProfile,
  type RoleType,
  authenticateUser,
  authenticateAsRole,
  changeUserPassword as apiChangePassword,
  hasUserPermission,
  profileFromAuth,
} from "@/lib/auth-service";
import {
  assertLoginRateLimit,
  clearLoginRateLimit,
  isDemoAuthEnabled,
  setDemoActor,
} from "@/lib/security";
import { FIELD_APP_LOGIN_ERROR, canUseFieldApp, isFieldApp } from "@/lib/field-app";
import { logAudit } from "@/lib/erp-service";

interface WorkspaceContextType {
  company: CompanyId;
  setCompany: (id: CompanyId) => void;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  currentUser: UserProfile | null;
  setCurrentUser: (user: UserProfile | null) => void;
  login: (
    emailOrRole: string,
    password?: string,
  ) => Promise<{ success: boolean; error?: string }>;
  loginAsRole: (role: RoleType) => void;
  logout: () => void;
  changePassword: (
    currentPass: string,
    newPass: string,
  ) => Promise<{ success: boolean; message: string }>;
  hasPermission: (permission: string) => boolean;
  can: (permission: string) => boolean;
}

const Context = createContext<WorkspaceContextType>({
  company: "all",
  setCompany: () => {},
  mode: "light",
  setMode: () => {},
  currentUser: null,
  setCurrentUser: () => {},
  login: async () => ({ success: false }),
  loginAsRole: () => {},
  logout: () => {},
  changePassword: async () => ({ success: false, message: "" }),
  hasPermission: () => false,
  can: () => false,
});

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [company, setCompany] = useState<CompanyId>("all");
  const [mode, setMode] = useState<ThemeMode>("light");
  const [ready, setReady] = useState(false);
  // Never auto-login as owner — wait for Supabase session or explicit login.
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("workspace-appearance");
      const savedCompany = localStorage.getItem("workspace-company");
      if (saved === "dark" || saved === "light" || saved === "system") setMode(saved);
      if (savedCompany === "all" || companies.some((c) => c.id === savedCompany))
        setCompany(savedCompany as CompanyId);
    } catch {
      // Storage unavailable or restricted in sandboxed environments
    }
    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        const profile = data.session?.user ? profileFromAuth(data.session.user) : null;
        if (profile && isFieldApp() && !canUseFieldApp(profile)) {
          await supabase.auth.signOut();
          setCurrentUser(null);
          return;
        }
        if (profile) {
          setDemoActor(null);
          setCurrentUser(profile);
        }
      })
      .finally(() => setReady(true));

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const profile = session?.user ? profileFromAuth(session.user) : null;
      if (profile && isFieldApp() && !canUseFieldApp(profile)) {
        void supabase.auth.signOut();
        setCurrentUser(null);
        return;
      }
      if (profile) {
        setDemoActor(null);
        setCurrentUser(profile);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      document.documentElement.classList.toggle(
        "dark",
        resolveMode(mode, media.matches) === "dark",
      );
      document.documentElement.dataset["company"] = company;
    };
    apply();
    media.addEventListener("change", apply);
    if (ready) {
      try {
        localStorage.setItem("workspace-appearance", mode);
        localStorage.setItem("workspace-company", company);
      } catch {
        // Storage unavailable or restricted in sandboxed environments
      }
    }
    return () => media.removeEventListener("change", apply);
  }, [mode, company, ready]);

  const login = async (emailOrRole: string, password?: string) => {
    const rate = assertLoginRateLimit(emailOrRole);
    if (!rate.ok) return { success: false, error: rate.error };

    const email = emailOrRole.trim().toLowerCase();

    // Prefer real Supabase Auth (works with RLS).
    if (password) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      const profile = data.user ? profileFromAuth(data.user) : null;
      if (!error && data.user) {
        if (!profile) {
          await supabase.auth.signOut();
          return { success: false, error: "This account has no app role assigned." };
        }
        const status = String(data.user?.user_metadata?.["status"] || "Active").toLowerCase();
        if (status === "inactive") {
          await supabase.auth.signOut();
          return { success: false, error: "This account is inactive." };
        }
        if (status === "pending approval" || status === "pending") {
          await supabase.auth.signOut();
          return {
            success: false,
            error: "This login is waiting for Super Admin approval.",
          };
        }
        if (isFieldApp() && !canUseFieldApp(profile)) {
          await supabase.auth.signOut();
          return { success: false, error: FIELD_APP_LOGIN_ERROR };
        }
        clearLoginRateLimit(emailOrRole);
        setDemoActor(null);
        setCurrentUser(profile);
        void logAudit({
          userName: profile.name,
          companyId: profile.company === "all" ? undefined : profile.company,
          module: "auth",
          action: "login",
          recordId: profile.id,
          description: `${profile.name} (${profile.roleName}) logged in via ${email}`,
        });
        return { success: true };
      }
    }

    // DEV/demo local auth fallback (disabled in production unless explicitly enabled).
    if (!isDemoAuthEnabled()) {
      void logAudit({
        userName: email || "Unknown",
        module: "auth",
        action: "login_failed",
        recordId: email || "unknown",
        description: `Failed login attempt for ${email || "unknown"}`,
      });
      return {
        success: false,
        error: "Invalid email or password.",
      };
    }

    const res = authenticateUser(emailOrRole, password);
    if (!res.user) {
      void logAudit({
        userName: email || "Unknown",
        module: "auth",
        action: "login_failed",
        recordId: email || "unknown",
        description: `Failed login attempt for ${email || "unknown"}: ${res.error || "Authentication failed"}`,
      });
      return { success: false, error: res.error || "Authentication failed" };
    }
    if (isFieldApp() && !canUseFieldApp(res.user)) {
      return { success: false, error: FIELD_APP_LOGIN_ERROR };
    }

    // Keep trying to attach a Supabase session for the same credentials so RLS works.
    if (password) {
      await supabase.auth.signInWithPassword({ email: res.user.email, password }).catch(() => null);
    }

    clearLoginRateLimit(emailOrRole);
    setDemoActor(res.user);
    setCurrentUser(res.user);
    void logAudit({
      userName: res.user.name,
      companyId: res.user.company === "all" ? undefined : res.user.company,
      module: "auth",
      action: "login",
      recordId: res.user.id,
      description: `${res.user.name} (${res.user.roleName}) logged in`,
    });
    return { success: true };
  };

  const loginAsRole = (role: RoleType) => {
    if (!isDemoAuthEnabled()) return;
    if (isFieldApp() && role !== "sales" && role !== "logistics" && role !== "super_admin") return;
    const res = authenticateAsRole(role);
    if (res.user) {
      void supabase.auth.signOut();
      setDemoActor(res.user);
      setCurrentUser(res.user);
      void logAudit({
        userName: res.user.name,
        companyId: res.user.company === "all" ? undefined : res.user.company,
        module: "auth",
        action: "role_switch",
        recordId: res.user.id,
        description: `Switched session to ${res.user.name} (${res.user.roleName})`,
      });
    }
  };

  const logout = () => {
    if (currentUser) {
      void logAudit({
        userName: currentUser.name,
        companyId: currentUser.company === "all" ? undefined : currentUser.company,
        module: "auth",
        action: "logout",
        recordId: currentUser.id,
        description: `${currentUser.name} (${currentUser.roleName}) logged out`,
      });
    }
    setDemoActor(null);
    void supabase.auth.signOut();
    setCurrentUser(null);
  };

  // Global UI click & navigation audit logger for authenticated users
  useEffect(() => {
    if (!currentUser) return;
    let lastClickKey = "";
    let lastClickAt = 0;
    let lastPath = "";

    const logPageView = () => {
      const path = window.location.pathname;
      if (!path || path === lastPath) return;
      lastPath = path;
      void logAudit({
        userName: currentUser.name,
        companyId: company === "all" ? undefined : company,
        module: "navigation",
        action: "page_view",
        recordId: path,
        description: `Opened ${path}`,
      });
    };

    const onClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const el = target?.closest('button, a, [role="button"], [role="tab"]');
      if (!el) return;
      const rawLabel =
        el.getAttribute("aria-label") ||
        el.getAttribute("title") ||
        (el.textContent || "").replace(/\s+/g, " ").trim();
      const label = rawLabel.slice(0, 80);
      if (!label) return;
      const path = window.location.pathname;
      const now = Date.now();
      const key = `${path}::${label}`;
      // Deduplicate rapid double-clicks within 600ms
      if (key === lastClickKey && now - lastClickAt < 600) return;
      lastClickKey = key;
      lastClickAt = now;
      void logAudit({
        userName: currentUser.name,
        companyId: company === "all" ? undefined : company,
        module: "ui",
        action: "button_click",
        recordId: path,
        description: `Clicked "${label}" on ${path}`,
      });
    };

    logPageView();
    window.addEventListener("popstate", logPageView);
    document.addEventListener("click", onClick, { capture: true, passive: true });
    // Watch SPA pushState navigation via lightweight interval check
    // ponytail: 1s poll avoids monkey-patching history.pushState across router versions
    const navTimer = window.setInterval(logPageView, 1000);
    return () => {
      window.removeEventListener("popstate", logPageView);
      document.removeEventListener("click", onClick, { capture: true });
      window.clearInterval(navTimer);
    };
  }, [currentUser, company]);

  const changePassword = async (currentPass: string, newPass: string) => {
    if (!currentUser) {
      return { success: false, message: "No active user session." };
    }
    return apiChangePassword(currentUser, currentPass, newPass);
  };

  const hasPermission = (permission: string) => {
    return hasUserPermission(currentUser, permission);
  };

  return (
    <Context.Provider
      value={{
        company,
        setCompany,
        mode,
        setMode,
        currentUser,
        setCurrentUser,
        login,
        loginAsRole,
        logout,
        changePassword,
        hasPermission,
        can: hasPermission,
      }}
    >
      {ready ? children : null}
    </Context.Provider>
  );
}

export const useWorkspace = () => useContext(Context);
