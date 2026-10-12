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
      .then(({ data }) => {
        const profile = data.session?.user ? profileFromAuth(data.session.user) : null;
        if (profile) {
          setDemoActor(null);
          setCurrentUser(profile);
        }
      })
      .finally(() => setReady(true));

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const profile = session?.user ? profileFromAuth(session.user) : null;
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
      if (!error && profile) {
        const status = String(data.user?.user_metadata?.["status"] || "Active");
        if (status.toLowerCase() === "inactive") {
          await supabase.auth.signOut();
          return { success: false, error: "This account is inactive." };
        }
        clearLoginRateLimit(emailOrRole);
        setDemoActor(null);
        setCurrentUser(profile);
        return { success: true };
      }
    }

    // DEV/demo local auth fallback (disabled in production unless explicitly enabled).
    if (!isDemoAuthEnabled()) {
      return {
        success: false,
        error: "Invalid email or password.",
      };
    }

    const res = authenticateUser(emailOrRole, password);
    if (!res.user) {
      return { success: false, error: res.error || "Authentication failed" };
    }

    // Keep trying to attach a Supabase session for the same credentials so RLS works.
    if (password) {
      await supabase.auth.signInWithPassword({ email: res.user.email, password }).catch(() => null);
    }

    clearLoginRateLimit(emailOrRole);
    setDemoActor(res.user);
    setCurrentUser(res.user);
    return { success: true };
  };

  const loginAsRole = (role: RoleType) => {
    if (!isDemoAuthEnabled()) return;
    const res = authenticateAsRole(role);
    if (res.user) {
      void supabase.auth.signOut();
      setDemoActor(res.user);
      setCurrentUser(res.user);
    }
  };

  const logout = () => {
    setDemoActor(null);
    void supabase.auth.signOut();
    setCurrentUser(null);
  };

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
