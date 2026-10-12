import { createClient } from "@supabase/supabase-js";

const env =
  typeof import.meta !== "undefined" && import.meta.env
    ? (import.meta.env as Record<string, string | undefined>)
    : typeof process !== "undefined" && process.env
      ? (process.env as Record<string, string | undefined>)
      : {};

const supabaseUrl = env["VITE_SUPABASE_URL"] || env["SUPABASE_URL"] || "";
const supabaseAnonKey =
  env["VITE_SUPABASE_ANON_KEY"] ||
  env["SUPABASE_ANON_KEY"] ||
  env["VITE_SUPABASE_PUBLISHABLE_KEY"] ||
  "";

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "Supabase credentials missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env (values are never logged).",
  );
}

export const supabase = createClient(supabaseUrl || "https://invalid.local", supabaseAnonKey || "missing", {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
